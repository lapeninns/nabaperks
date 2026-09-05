-- Preserve collection arithmetic, source behaviour and legacy signatures.
-- The only additional caller admitted by the private transition is the owner
-- with an unforgeable receipt for this reward in this exact transaction.

create or replace function private.redeem_self_service_reward_transition(
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
  v_owner_collection boolean := false;
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

  v_owner_collection := coalesce(private.has_current_owner_id_check(
    p_reward_event_id, p_customer_id, current_user_id
  ), false);

  if not public.is_service_role_request() and not v_owner_collection then
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
      'redeemed_by', case when v_owner_collection then 'merchant_scan' else 'self_service' end,
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
    case when v_owner_collection then 'merchant' else 'customer' end,
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
    case when v_owner_collection then 'merchant' else 'customer' end,
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

revoke all on function private.redeem_self_service_reward_transition(uuid, uuid, numeric, numeric)
  from public, anon, authenticated, service_role;

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
as $function$
declare
  v_reward_status text;
begin
  perform 1 from public.customers where id = p_customer_id for update;
  select rewards.status
  into v_reward_status
  from public.reward_events rewards
  where rewards.id = p_reward_event_id
  for update;

  if v_reward_status = 'redeemed'
     and exists (
       select 1
       from public.reward_scan_tokens tokens
       where tokens.reward_event_id = p_reward_event_id
         and tokens.consumed_at is not null
     ) then
    raise exception 'Reward already collected by merchant';
  end if;

  return query
  select *
  from private.redeem_self_service_reward_transition(
    p_reward_event_id,
    p_customer_id,
    p_latitude,
    p_longitude
  );
end;
$function$;

revoke all on function public.redeem_self_service_reward(
  uuid, uuid, numeric, numeric
) from public, anon;
grant execute on function public.redeem_self_service_reward(
  uuid, uuid, numeric, numeric
) to authenticated, service_role;



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
as $function$
declare
  token_record record;
  redeem_record record;
  merchant_record record;
  v_reward_source text;
  v_reward_status text;
begin
  -- Read identifiers without row locks, then use the same order as minting,
  -- verification and customer DOB updates: customer -> reward -> token.
  select * into token_record from public.reward_scan_tokens where id = p_scan_token;
  if token_record.id is null then
    raise insufficient_privilege using message = 'Reward scan token not found';
  end if;
  perform 1 from public.customers where id = token_record.customer_id for update;
  perform 1 from public.reward_events where id = token_record.reward_event_id for update;
  select tokens.*,
         rewards.status as reward_status
  into token_record
  from public.reward_scan_tokens tokens
  join public.reward_events rewards
    on rewards.id = tokens.reward_event_id
  where tokens.id = p_scan_token
  for update of tokens;

  if token_record.id is null then
    raise insufficient_privilege using message = 'Reward scan token not found';
  end if;

  if p_merchant_id is null
     or token_record.merchant_id is distinct from p_merchant_id then
    raise insufficient_privilege using message = 'Reward scan token belongs to a different merchant';
  end if;

  if token_record.superseded_at is not null then
    raise exception 'Reward scan token superseded';
  end if;

  if token_record.expires_at <= now() then
    raise exception 'Reward scan token expired';
  end if;

  if token_record.consumed_at is not null then
    raise exception 'Reward scan token already used';
  end if;

  if token_record.reward_status = 'redeemed' then
    raise exception 'Reward already collected';
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
    and consumed_at is null
    and superseded_at is null;

  if not found then
    raise exception 'Reward scan token is no longer collectable';
  end if;

  select reward_events.source,
         reward_events.status
  into v_reward_source,
       v_reward_status
  from public.reward_events
  where reward_events.id = redeem_record.reward_event_id;

  if v_reward_status <> 'redeemed' then
    raise exception 'Reward collection did not complete';
  end if;

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
$function$;

revoke all on function public.collect_reward_scan_token(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.collect_reward_scan_token(uuid, uuid)
  to service_role;



-- The legacy collector now owns every check and lock. Do not take token
-- locks in this wrapper before it has locked the customer.
create or replace function public.collect_current_reward_scan_token(
  p_scan_token uuid, p_merchant_id uuid
)
returns table (
  reward_event_id uuid, reward_name text, membership_id uuid, new_stamp_count integer
)
language sql
security definer
set search_path = public, auth, pg_temp
as $function$
  select * from public.collect_reward_scan_token(p_scan_token, p_merchant_id);
$function$;
revoke all on function public.collect_current_reward_scan_token(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.collect_current_reward_scan_token(uuid, uuid) to service_role;

notify pgrst, 'reload schema';
