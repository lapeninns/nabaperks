-- Issued rewards, phase 1: source-aware scan/redeem gates.
--
-- The four scan/redeem functions each replicate their profile/stamp checks
-- inline (none calls another), so — as with the 18+ gate at 20260703120000 —
-- each is reproduced verbatim from its current definition with only the
-- source-aware deltas applied. Return signatures are unchanged (Postgres refuses
-- to change a function's return type, and this repo re-applies migrations).
--
-- Deltas, in one place:
--   * The stamp-count threshold applies to `source = 'stamp_cycle'` only. Issued
--     rewards (birthday_month / merchant_direct) are collectable below the
--     threshold; every OTHER gate (profile, 18+, merchant-active, billing,
--     expiry, single-use token, geofence) is unchanged for all sources.
--   * On redemption, an earned reward still consumes stamps + advances the cycle;
--     an issued reward only counts the redemption (stamps + cycle untouched).
--   * The merchant read path (get_reward_scan_context) gains the 18+ gate the
--     mint/redeem paths already enforce — a parity fix, not a new rule.
--   * Collecting an issued reward does NOT enqueue reward_collected_cycle_started
--     (no new stamp cycle began).

-- 1. create_reward_scan_token --------------------------------------------------
-- Verbatim from 20260703120000 with `source` selected and the stamp gate scoped.

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
    reward_events.source,
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

  -- Stamp threshold applies to earned rewards only; issued rewards skip it.
  if reward_record.source = 'stamp_cycle'
    and reward_record.current_stamp_count < reward_record.stamps_required then
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

-- 2. redeem_self_service_reward -----------------------------------------------
-- Verbatim from 20260703120000 with `source` selected, the stamp gate scoped,
-- and the membership update branched by source.

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
    reward_events.source as reward_source,
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

  -- Stamp threshold applies to earned rewards only; issued rewards skip it.
  if reward_record.reward_source = 'stamp_cycle'
    and reward_record.current_stamp_count < reward_record.stamps_required then
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

  -- Advance the loyalty cycle for an EARNED reward: the active card starts
  -- collecting fresh stamps while the redeemed cycle's stamps stay in history.
  -- An ISSUED reward (birthday/direct) spent no stamps and began no new cycle —
  -- only the redemption count moves; the stamp count is returned unchanged.
  if reward_record.reward_source = 'stamp_cycle' then
    update public.customer_memberships
    set
      current_stamp_count = greatest(current_stamp_count - reward_record.stamps_required, 0),
      total_rewards_redeemed = total_rewards_redeemed + 1,
      active_cycle_number = active_cycle_number + 1
    where customer_memberships.id = reward_record.reward_membership_id
    returning current_stamp_count into new_stamp_count;
  else
    update public.customer_memberships
    set
      total_rewards_redeemed = total_rewards_redeemed + 1
    where customer_memberships.id = reward_record.reward_membership_id
    returning current_stamp_count into new_stamp_count;
  end if;

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
      'source', reward_record.reward_source,
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
      'source', reward_record.reward_source,
      'new_stamp_count', new_stamp_count,
      'geo_flagged', v_geo_flagged
    )
  );

  return next;
end;
$$;

-- 3. get_reward_scan_context ---------------------------------------------------
-- Verbatim from 20260628122828 with `source` selected, the stamp gate scoped,
-- and the missing 18+ gate added after the profile gate (parity with mint).

-- Replay guard (db dead field cleanup): the final chain shape drops
-- min_spend_pence, so replays must drop before recreating this older shape.
drop function if exists public.get_reward_scan_context(uuid, uuid);
create or replace function public.get_reward_scan_context(
  p_scan_token uuid,
  p_merchant_id uuid
)
returns table (
  scan_status text,
  reward_event_id uuid,
  reward_name text,
  reward_terms text,
  min_spend_pence integer,
  membership_id uuid,
  current_stamp_count integer,
  customer_email text,
  customer_phone text,
  customer_phone_last4 text,
  blocked_reason text
)
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  scan_record record;
  availability_reason text;
begin
  select
    reward_scan_tokens.id as token_id,
    reward_scan_tokens.merchant_id as token_merchant_id,
    reward_scan_tokens.expires_at,
    reward_scan_tokens.consumed_at,
    reward_events.id as event_id,
    reward_events.status as event_status,
    reward_events.source as reward_source,
    reward_events.reward_name as assigned_reward_name,
    reward_events.reward_terms as assigned_reward_terms,
    reward_events.redeemable_from,
    customer_memberships.id as card_membership_id,
    customer_memberships.current_stamp_count as card_stamp_count,
    customers.email as safe_customer_email,
    customers.phone as safe_customer_phone,
    customers.phone_last4 as safe_customer_phone_last4,
    customers.full_name as customer_full_name,
    customers.date_of_birth as customer_date_of_birth,
    customers.email_verified_at as customer_email_verified_at,
    loyalty_cards.stamps_required,
    loyalty_cards.is_active as card_is_active,
    merchants.status as merchant_status,
    merchants.requires_billing,
    billing_customers.status as billing_status
  into scan_record
  from public.reward_scan_tokens
  join public.reward_events
    on reward_events.id = reward_scan_tokens.reward_event_id
  join public.customer_memberships
    on customer_memberships.id = reward_scan_tokens.membership_id
  join public.customers
    on customers.id = reward_scan_tokens.customer_id
  join public.loyalty_cards
    on loyalty_cards.id = reward_events.loyalty_card_id
  join public.merchants
    on merchants.id = reward_scan_tokens.merchant_id
  left join public.billing_customers
    on billing_customers.merchant_id = reward_scan_tokens.merchant_id
  where reward_scan_tokens.id = p_scan_token;

  if scan_record.token_id is null then
    scan_status := 'not_found';
    return next;
    return;
  end if;

  if scan_record.token_merchant_id <> p_merchant_id then
    scan_status := 'unauthorized';
    return next;
    return;
  end if;

  reward_event_id := scan_record.event_id;
  reward_name := scan_record.assigned_reward_name;
  reward_terms := scan_record.assigned_reward_terms;
  membership_id := scan_record.card_membership_id;
  current_stamp_count := scan_record.card_stamp_count;
  customer_email := scan_record.safe_customer_email;
  customer_phone := scan_record.safe_customer_phone;
  customer_phone_last4 := scan_record.safe_customer_phone_last4;

  if scan_record.consumed_at is not null or scan_record.event_status = 'redeemed' then
    scan_status := 'redeemed';
    return next;
    return;
  end if;

  -- Expired tokens get a stable, distinct status so the read path agrees with
  -- the collect path (which raises 'Reward scan token expired') instead of
  -- collapsing expiry into not_found / a 404.
  if scan_record.expires_at <= now() then
    scan_status := 'expired';
    return next;
    return;
  end if;

  if scan_record.event_status <> 'unlocked' then
    scan_status := 'blocked';
    blocked_reason := 'This reward is not ready to collect.';
    return next;
    return;
  end if;

  if scan_record.redeemable_from is not null
    and scan_record.redeemable_from > public.uk_business_date(now()) then
    scan_status := 'blocked';
    blocked_reason := 'This reward cannot be collected until the next opening day.';
    return next;
    return;
  end if;

  availability_reason := public.loyalty_availability_reason(
    scan_record.merchant_status,
    scan_record.card_is_active,
    scan_record.billing_status,
    scan_record.requires_billing
  );

  if availability_reason is not null then
    scan_status := 'blocked';
    blocked_reason := 'This loyalty programme is unavailable right now.';
    return next;
    return;
  end if;

  -- Stamp threshold applies to earned rewards only; issued rewards skip it.
  if scan_record.reward_source = 'stamp_cycle'
    and scan_record.card_stamp_count < scan_record.stamps_required then
    scan_status := 'blocked';
    blocked_reason := 'This customer has not collected enough stamps yet.';
    return next;
    return;
  end if;

  if scan_record.customer_full_name is null
    or btrim(scan_record.customer_full_name) = ''
    or scan_record.customer_date_of_birth is null
    or (scan_record.safe_customer_email is not null
        and scan_record.customer_email_verified_at is null) then
    scan_status := 'blocked';
    blocked_reason := 'Ask the customer to finish their profile before this reward can be collected.';
    return next;
    return;
  end if;

  -- Age gate parity with the mint/redeem paths: DOB is non-null by the profile
  -- gate above. Blocks a token whose customer is (or became) under 18.
  if scan_record.customer_date_of_birth
       > (public.uk_business_date(now()) - interval '18 years')::date then
    scan_status := 'blocked';
    blocked_reason := 'This customer must be 18 or over to collect this reward.';
    return next;
    return;
  end if;

  scan_status := 'ready';
  return next;
end;
$$;

-- 4. collect_reward_scan_token -------------------------------------------------
-- Verbatim from 20260622140000 with the cycle-started notification gated on the
-- reward being a stamp_cycle reward (an issued reward begins no new cycle).

create or replace function public.collect_reward_scan_token(
  p_scan_token uuid,
  p_merchant_id uuid
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
  token_record record;
  redeem_record record;
  merchant_record record;
  v_reward_source text;
begin
  select *
  into token_record
  from public.reward_scan_tokens
  where id = p_scan_token
  for update;

  if token_record.id is null then
    raise insufficient_privilege using message = 'Reward scan token not found';
  end if;

  if token_record.merchant_id <> p_merchant_id then
    raise insufficient_privilege using message = 'Reward scan token belongs to a different merchant';
  end if;

  if token_record.expires_at <= now() then
    raise exception 'Reward scan token expired';
  end if;

  if token_record.consumed_at is not null then
    raise exception 'Reward scan token already used';
  end if;

  select
    redeemed.reward_event_id,
    redeemed.reward_name,
    redeemed.membership_id,
    redeemed.new_stamp_count
  into redeem_record
  from public.redeem_self_service_reward(
    token_record.reward_event_id,
    token_record.customer_id,
    null,
    null
  ) redeemed;

  update public.reward_scan_tokens
  set
    consumed_at = now(),
    consumed_by_merchant_id = p_merchant_id
  where id = p_scan_token
    and consumed_at is null;

  select reward_events.source
  into v_reward_source
  from public.reward_events
  where reward_events.id = redeem_record.reward_event_id;

  -- Only an earned reward starts a fresh stamp cycle; issued rewards do not, so
  -- they skip the "new cycle started" nudge.
  if v_reward_source = 'stamp_cycle' then
    select merchants.business_name
    into merchant_record
    from public.merchants
    where merchants.id = p_merchant_id;

    perform public.enqueue_notification_event(
      'reward_collected_cycle_started',
      token_record.customer_id,
      p_merchant_id,
      redeem_record.membership_id,
      redeem_record.reward_event_id,
      null,
      public.uk_business_date(now()),
      now(),
      'reward_collected_cycle_started:' || redeem_record.reward_event_id::text,
      jsonb_build_object(
        'title', 'Reward collected',
        'body', 'A new ' || coalesce(merchant_record.business_name, 'venue') || ' stamp cycle has started.',
        'url', '/card/' || redeem_record.membership_id::text,
        'rewardEventId', redeem_record.reward_event_id,
        'membershipId', redeem_record.membership_id
      ),
      jsonb_build_object(
        'source', 'collect_reward_scan_token',
        'scan_token_expiry_separate', true
      )
    );
  end if;

  reward_event_id := redeem_record.reward_event_id;
  reward_name := redeem_record.reward_name;
  membership_id := redeem_record.membership_id;
  new_stamp_count := redeem_record.new_stamp_count;
  return next;
end;
$$;

-- Grants re-issued to match the callers (create/get/collect are service_role;
-- redeem keeps authenticated for the self-service page).
revoke all on function public.create_reward_scan_token(uuid, uuid) from public;
grant execute on function public.create_reward_scan_token(uuid, uuid) to service_role;

revoke all on function public.redeem_self_service_reward(uuid, uuid, numeric, numeric) from public;
grant execute on function public.redeem_self_service_reward(uuid, uuid, numeric, numeric) to authenticated, service_role;

revoke all on function public.get_reward_scan_context(uuid, uuid) from public;
grant execute on function public.get_reward_scan_context(uuid, uuid) to service_role;

grant execute on function public.collect_reward_scan_token(uuid, uuid) to service_role;
revoke execute on function public.collect_reward_scan_token(uuid, uuid) from anon, authenticated;

notify pgrst, 'reload schema';
