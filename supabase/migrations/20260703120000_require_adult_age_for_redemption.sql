-- Require customers to be 18 or over to redeem a reward.
--
-- The app layer (lib/customer/profile-fields.ts) already refuses to SAVE an
-- under-18 date of birth, so no new under-age profile can complete and reach a
-- redeemable state. This migration is the defence-in-depth backstop at the
-- database boundary: it also blocks any date of birth that was stored BEFORE
-- the app-layer gate existed, and any path that writes the column directly.
--
-- Both hard gates replicate the profile-completeness check inline (neither calls
-- the other), so the age check is added to both:
--   * create_reward_scan_token   — the customer mints the collection token,
--   * redeem_self_service_reward — the merchant scan consumes it.
-- Postgres has no way to patch a function body, so each is reproduced verbatim
-- from its current definition with a single new age guard added after the
-- existing profile gate (where date_of_birth is guaranteed non-null). "Today" is
-- the UK business date so the boundary matches the rest of the redemption logic.

create or replace function public.create_reward_scan_token(
  p_reward_event_id uuid,
  p_customer_id uuid
)
returns table (
  scan_token uuid,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  reward_record record;
  availability_reason text;
  reusable_token record;
begin
  if p_customer_id is null then
    raise insufficient_privilege using message = 'Verified customer required';
  end if;

  perform public.purge_expired_reward_scan_tokens(now());

  select
    reward_events.id,
    reward_events.status,
    reward_events.merchant_id,
    reward_events.customer_id,
    reward_events.membership_id,
    reward_events.reward_name,
    reward_events.redeemable_from,
    customer_memberships.current_stamp_count,
    customers.full_name as customer_full_name,
    customers.date_of_birth as customer_date_of_birth,
    customers.email as customer_email,
    customers.email_verified_at as customer_email_verified_at,
    loyalty_cards.stamps_required,
    loyalty_cards.is_active as card_is_active,
    merchants.status as merchant_status,
    merchants.requires_billing,
    billing_customers.status as billing_status
  into reward_record
  from public.reward_events
  join public.customer_memberships
    on customer_memberships.id = reward_events.membership_id
  join public.customers
    on customers.id = reward_events.customer_id
  join public.loyalty_cards
    on loyalty_cards.id = reward_events.loyalty_card_id
  join public.merchants
    on merchants.id = reward_events.merchant_id
  left join public.billing_customers
    on billing_customers.merchant_id = reward_events.merchant_id
  where reward_events.id = p_reward_event_id
  for update of reward_events;

  if reward_record.id is null then
    raise insufficient_privilege using message = 'Reward not found';
  end if;

  if reward_record.customer_id <> p_customer_id then
    raise insufficient_privilege using message = 'Reward ownership required';
  end if;

  if reward_record.status = 'redeemed' then
    raise exception 'Reward already redeemed';
  end if;

  if reward_record.status <> 'unlocked' then
    raise exception 'Reward is not ready to collect';
  end if;

  if reward_record.redeemable_from is not null
    and reward_record.redeemable_from > public.uk_business_date(now()) then
    raise exception 'Reward is not redeemable until the next UK business day';
  end if;

  availability_reason := public.loyalty_availability_reason(
    reward_record.merchant_status,
    reward_record.card_is_active,
    reward_record.billing_status,
    reward_record.requires_billing
  );

  if availability_reason is not null then
    raise exception 'This loyalty programme is unavailable right now';
  end if;

  if reward_record.current_stamp_count < reward_record.stamps_required then
    raise exception 'Reward is not ready to redeem';
  end if;

  if reward_record.customer_full_name is null
    or btrim(reward_record.customer_full_name) = ''
    or reward_record.customer_date_of_birth is null
    or (reward_record.customer_email is not null
        and reward_record.customer_email_verified_at is null) then
    raise exception 'Complete your profile before redeeming';
  end if;

  -- Age gate: DOB is guaranteed non-null by the profile gate above.
  if reward_record.customer_date_of_birth
       > (public.uk_business_date(now()) - interval '18 years')::date then
    raise exception 'Customer must be 18 or over to redeem';
  end if;

  select
    reward_scan_tokens.id,
    reward_scan_tokens.expires_at
  into reusable_token
  from public.reward_scan_tokens
  where reward_scan_tokens.reward_event_id = reward_record.id
    and reward_scan_tokens.customer_id = reward_record.customer_id
    and reward_scan_tokens.consumed_at is null
    and reward_scan_tokens.expires_at > now() + interval '5 minutes'
  order by reward_scan_tokens.expires_at desc
  limit 1;

  if reusable_token.id is not null then
    scan_token := reusable_token.id;
    expires_at := reusable_token.expires_at;
    return next;
    return;
  end if;

  insert into public.reward_scan_tokens (
    reward_event_id,
    merchant_id,
    customer_id,
    membership_id
  )
  values (
    reward_record.id,
    reward_record.merchant_id,
    reward_record.customer_id,
    reward_record.membership_id
  )
  returning id, reward_scan_tokens.expires_at
  into scan_token, expires_at;

  return next;
end;
$$;

create or replace function public.redeem_self_service_reward(
  p_reward_event_id uuid,
  p_customer_id uuid,
  p_latitude numeric default null,
  p_longitude numeric default null
)
returns table (
  reward_event_id uuid,
  reward_name text,
  membership_id uuid,
  new_stamp_count integer
)
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  current_user_id uuid := (select auth.uid());
  reward_record record;
  billing_status text;
  v_distance_meters numeric;
  v_geo_flagged boolean := false;
begin
  if p_customer_id is null then
    raise insufficient_privilege using message = 'Verified customer required';
  end if;

  select
    reward_events.id,
    reward_events.status,
    reward_events.merchant_id,
    reward_events.customer_id,
    reward_events.membership_id as reward_membership_id,
    reward_events.reward_name as assigned_reward_name,
    reward_events.redeemable_from,
    customers.auth_user_id,
    customers.full_name as customer_full_name,
    customers.date_of_birth as customer_date_of_birth,
    customers.email as customer_email,
    customers.email_verified_at as customer_email_verified_at,
    loyalty_cards.stamps_required,
    loyalty_cards.is_active as card_is_active,
    loyalty_cards.location_id,
    customer_memberships.current_stamp_count,
    merchants.status as merchant_status,
    merchants.requires_billing,
    merchant_locations.latitude,
    merchant_locations.longitude,
    merchant_locations.geofence_radius_meters,
    merchant_locations.require_geofence
  into reward_record
  from public.reward_events
  join public.customer_memberships
    on customer_memberships.id = reward_events.membership_id
  join public.customers on customers.id = reward_events.customer_id
  join public.merchants on merchants.id = reward_events.merchant_id
  join public.loyalty_cards on loyalty_cards.id = reward_events.loyalty_card_id
  left join public.merchant_locations on merchant_locations.id = loyalty_cards.location_id
  where reward_events.id = p_reward_event_id
  for update of reward_events;

  if reward_record.id is null then
    raise insufficient_privilege using message = 'Reward not found';
  end if;

  if reward_record.customer_id <> p_customer_id then
    raise insufficient_privilege using message = 'Reward ownership required';
  end if;

  if not public.is_service_role_request() then
    if current_user_id is null
      or reward_record.auth_user_id is null
      or reward_record.auth_user_id <> current_user_id then
      raise insufficient_privilege using message = 'Reward ownership required';
    end if;
  end if;

  reward_event_id := reward_record.id;
  reward_name := reward_record.assigned_reward_name;
  membership_id := reward_record.reward_membership_id;

  -- A reward that is already redeemed reads back idempotently, regardless of the
  -- current profile state — the customer has already collected it. Returning here
  -- before the cycle increment keeps duplicate redemption from advancing twice.
  if reward_record.status = 'redeemed' then
    new_stamp_count := reward_record.current_stamp_count;
    return next;
    return;
  end if;

  if reward_record.status <> 'unlocked' then
    raise exception 'Reward is not redeemable';
  end if;

  if reward_record.redeemable_from is not null
    and reward_record.redeemable_from > public.uk_business_date(now()) then
    raise exception 'Reward is not redeemable until the next UK business day';
  end if;

  if not reward_record.card_is_active then
    raise exception 'This loyalty card is not active';
  end if;

  if reward_record.current_stamp_count < reward_record.stamps_required then
    raise exception 'Reward is not ready to redeem';
  end if;

  -- Profile gate: once a reward is genuinely ready (stamps + date), require a
  -- usable customer profile — Name + DOB, with email optional but verified if
  -- present. Phone is already verified at sign-up via phone-first identity.
  if reward_record.customer_full_name is null
    or btrim(reward_record.customer_full_name) = ''
    or reward_record.customer_date_of_birth is null
    or (reward_record.customer_email is not null
        and reward_record.customer_email_verified_at is null) then
    raise exception 'Complete your profile before redeeming';
  end if;

  -- Age gate: DOB is guaranteed non-null by the profile gate above.
  if reward_record.customer_date_of_birth
       > (public.uk_business_date(now()) - interval '18 years')::date then
    raise exception 'Customer must be 18 or over to redeem';
  end if;

  if reward_record.merchant_status not in ('trial', 'active') then
    raise exception 'This merchant loyalty programme is not active';
  end if;

  select billing_customers.status
  into billing_status
  from public.billing_customers
  where billing_customers.merchant_id = reward_record.merchant_id;

  if coalesce(reward_record.requires_billing, true) and billing_status is null then
    raise exception 'This merchant loyalty programme is not active yet';
  end if;

  if billing_status in ('cancelled', 'suspended') then
    raise exception 'This merchant loyalty programme is unavailable';
  end if;

  if coalesce(reward_record.require_geofence, false) then
    if p_latitude is null
      or p_longitude is null
      or reward_record.latitude is null
      or reward_record.longitude is null then
      v_geo_flagged := true;
      perform public.record_self_service_geo_flag(
        reward_record.merchant_id,
        reward_record.customer_id,
        reward_record.reward_membership_id,
        reward_record.location_id,
        'self_service_geofence_unknown',
        'reward_redeem',
        p_latitude,
        p_longitude,
        null,
        reward_record.geofence_radius_meters
      );
    else
      v_distance_meters := public.geo_distance_meters(
        p_latitude,
        p_longitude,
        reward_record.latitude,
        reward_record.longitude
      );

      if v_distance_meters > reward_record.geofence_radius_meters then
        v_geo_flagged := true;
        perform public.record_self_service_geo_flag(
          reward_record.merchant_id,
          reward_record.customer_id,
          reward_record.reward_membership_id,
          reward_record.location_id,
          'self_service_geofence_out_of_range',
          'reward_redeem',
          p_latitude,
          p_longitude,
          v_distance_meters,
          reward_record.geofence_radius_meters
        );
      end if;
    end if;
  end if;

  update public.reward_events
  set
    status = 'redeemed',
    redeemed_at = now(),
    metadata = reward_events.metadata || jsonb_build_object(
      'redeemed_by', 'self_service',
      'geo_flagged', v_geo_flagged
    )
  where reward_events.id = reward_record.id
    and reward_events.status = 'unlocked';

  if not found then
    raise exception 'Reward already redeemed';
  end if;

  -- Advance the loyalty cycle: the active card starts collecting fresh stamps
  -- while the redeemed cycle's stamps stay in history.
  update public.customer_memberships
  set
    current_stamp_count = greatest(current_stamp_count - reward_record.stamps_required, 0),
    total_rewards_redeemed = total_rewards_redeemed + 1,
    active_cycle_number = active_cycle_number + 1
  where customer_memberships.id = reward_record.reward_membership_id
  returning current_stamp_count into new_stamp_count;

  insert into public.product_events (
    event_name,
    merchant_id,
    customer_id,
    membership_id,
    actor_type,
    actor_id,
    metadata
  )
  values (
    'reward_redeemed',
    reward_record.merchant_id,
    reward_record.customer_id,
    reward_record.reward_membership_id,
    'customer',
    coalesce(current_user_id::text, p_customer_id::text),
    jsonb_build_object(
      'reward_id', reward_record.id,
      'reward_name', reward_record.assigned_reward_name,
      'new_stamp_count', new_stamp_count,
      'geo_flagged', v_geo_flagged
    )
  );

  insert into public.audit_logs (
    actor_type,
    actor_id,
    merchant_id,
    customer_id,
    target_table,
    target_id,
    action,
    metadata
  )
  values (
    'customer',
    coalesce(current_user_id::text, p_customer_id::text),
    reward_record.merchant_id,
    reward_record.customer_id,
    'reward_events',
    reward_record.id,
    'reward_redeemed',
    jsonb_build_object(
      'new_stamp_count', new_stamp_count,
      'geo_flagged', v_geo_flagged
    )
  );

  return next;
end;
$$;

-- Grants are preserved across create-or-replace; re-issued here to keep this
-- migration self-contained and to match the callers (service_role for the
-- mint/collect path; authenticated is retained for the redeem RPC).
revoke all on function public.create_reward_scan_token(uuid, uuid) from public;
grant execute on function public.create_reward_scan_token(uuid, uuid) to service_role;

revoke all on function public.redeem_self_service_reward(uuid, uuid, numeric, numeric) from public;
grant execute on function public.redeem_self_service_reward(uuid, uuid, numeric, numeric) to authenticated, service_role;
