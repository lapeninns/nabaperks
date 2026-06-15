-- Durable loyalty cycle boundary for reward redemptions.
--
-- A card used to get stuck after a redemption: lifetime stamp history kept the
-- active card reading "3 of 3" even though the reward had been claimed. This
-- migration makes each loyalty cycle an explicit, durable boundary:
--   * customer_memberships.active_cycle_number — the cycle the card is on now.
--   * stamp_events.cycle_number / reward_events.cycle_number — the cycle an event
--     belongs to, so live card progress can be scoped to the active cycle while
--     earlier cycles stay visible in reward/activity history.
--
-- The RPCs are updated so issuing a stamp tags it (and any unlocked reward) with
-- the membership's active cycle, and redeeming a reward advances the cycle. The
-- redemption body is merged with 20260615120000_customer_profile_completion.sql:
-- it keeps the profile-completion gate and only adds the cycle increment.
--
-- The one-stamp-per-UK-business-day rule is intentionally NOT cycle scoped: a
-- card completed and redeemed mid-day cannot earn a second stamp the same day.
--
-- Idempotent (add column if not exists / create or replace / guarded backfill)
-- per the repo's re-apply-every-run migrations.

alter table public.customer_memberships
  add column if not exists active_cycle_number integer not null default 1;

alter table public.stamp_events
  add column if not exists cycle_number integer;

alter table public.reward_events
  add column if not exists cycle_number integer;

create index if not exists stamp_events_membership_cycle_idx
  on public.stamp_events (membership_id, cycle_number);

create index if not exists reward_events_membership_cycle_idx
  on public.reward_events (membership_id, cycle_number);

-- Backfill the active cycle from redemption history. The invariant
-- active_cycle_number = total_rewards_redeemed + 1 holds after every redemption,
-- so re-applying this is a no-op once each row is correct.
update public.customer_memberships
set active_cycle_number = total_rewards_redeemed + 1
where active_cycle_number <> total_rewards_redeemed + 1;

-- Best-effort backfill of stamp cycles: a stamp belongs to one cycle past the
-- number of rewards already redeemed for the membership when it was earned.
update public.stamp_events se
set cycle_number = (
  select count(*)
  from public.reward_events re
  where re.membership_id = se.membership_id
    and re.status = 'redeemed'
    and re.redeemed_at is not null
    and re.redeemed_at < se.created_at
) + 1
where se.cycle_number is null;

-- Best-effort backfill of reward cycles: count rewards redeemed before each
-- reward was created.
update public.reward_events re
set cycle_number = (
  select count(*)
  from public.reward_events prior
  where prior.membership_id = re.membership_id
    and prior.status = 'redeemed'
    and prior.redeemed_at is not null
    and prior.redeemed_at < re.created_at
) + 1
where re.cycle_number is null;

create or replace function public.issue_self_service_stamp(
  p_membership_id uuid,
  p_customer_id uuid,
  p_latitude numeric default null,
  p_longitude numeric default null
)
returns table (
  stamp_event_id uuid,
  new_stamp_count integer,
  reward_unlocked boolean,
  geo_flagged boolean
)
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  current_user_id uuid := (select auth.uid());
  membership_record record;
  card_record record;
  reward_pool_record record;
  billing_status text;
  recent_stamp_count integer;
  v_business_date date := public.uk_business_date(now());
  v_total_weight integer := 0;
  v_weight_threshold integer;
  v_distance_meters numeric;
begin
  if p_customer_id is null then
    raise insufficient_privilege using message = 'Verified customer required';
  end if;

  perform public.enforce_rate_limit('selfstamp:' || p_membership_id::text, 10, 900000);

  select
    memberships.id,
    memberships.merchant_id,
    memberships.customer_id,
    memberships.current_stamp_count,
    memberships.active_cycle_number,
    customers.auth_user_id,
    merchants.status as merchant_status
  into membership_record
  from public.customer_memberships memberships
  join public.customers customers on customers.id = memberships.customer_id
  join public.merchants merchants on merchants.id = memberships.merchant_id
  where memberships.id = p_membership_id
  for update of memberships;

  if membership_record.id is null then
    raise insufficient_privilege using message = 'Membership not found';
  end if;

  if membership_record.customer_id <> p_customer_id then
    raise insufficient_privilege using message = 'Membership ownership required';
  end if;

  if not public.is_service_role_request() then
    if current_user_id is null
      or membership_record.auth_user_id is null
      or membership_record.auth_user_id <> current_user_id then
      raise insufficient_privilege using message = 'Membership ownership required';
    end if;
  end if;

  if membership_record.merchant_status not in ('trial', 'active') then
    raise exception 'This merchant loyalty programme is not active';
  end if;

  select billing_customers.status
  into billing_status
  from public.billing_customers
  where billing_customers.merchant_id = membership_record.merchant_id;

  if billing_status in ('cancelled', 'suspended') then
    raise exception 'This merchant loyalty programme is unavailable';
  end if;

  select
    loyalty_cards.id,
    loyalty_cards.location_id,
    loyalty_cards.stamps_required,
    merchant_locations.latitude,
    merchant_locations.longitude,
    merchant_locations.geofence_radius_meters,
    merchant_locations.require_geofence
  into card_record
  from public.loyalty_cards
  left join public.merchant_locations on merchant_locations.id = loyalty_cards.location_id
  where loyalty_cards.merchant_id = membership_record.merchant_id
    and loyalty_cards.is_active
  order by loyalty_cards.created_at asc
  limit 1;

  if card_record.id is null then
    raise exception 'This loyalty card is not active';
  end if;

  if membership_record.current_stamp_count >= card_record.stamps_required then
    raise exception 'A reward is already ready to redeem';
  end if;

  if exists (
    select 1
    from public.stamp_events
    where stamp_events.membership_id = p_membership_id
      and stamp_events.location_id = card_record.location_id
      and stamp_events.event_type = 'earned'
      and stamp_events.earned_business_date = v_business_date
  ) then
    raise exception 'Stamp already issued for this UK business day';
  end if;

  if membership_record.current_stamp_count + 1 >= card_record.stamps_required then
    select coalesce(sum(reward_pool_items.weight), 0)
    into v_total_weight
    from public.reward_pool_items
    where reward_pool_items.merchant_id = membership_record.merchant_id
      and reward_pool_items.location_id = card_record.location_id
      and reward_pool_items.loyalty_card_id = card_record.id
      and reward_pool_items.is_active;

    if v_total_weight <= 0 then
      raise exception 'At least one active reward pool item is required before unlocking a reward';
    end if;
  end if;

  geo_flagged := false;

  if coalesce(card_record.require_geofence, false) then
    if p_latitude is null
      or p_longitude is null
      or card_record.latitude is null
      or card_record.longitude is null then
      geo_flagged := true;
      perform public.record_self_service_geo_flag(
        membership_record.merchant_id,
        membership_record.customer_id,
        p_membership_id,
        card_record.location_id,
        'self_service_geofence_unknown',
        'stamp',
        p_latitude,
        p_longitude,
        null,
        card_record.geofence_radius_meters
      );
    else
      v_distance_meters := public.geo_distance_meters(
        p_latitude,
        p_longitude,
        card_record.latitude,
        card_record.longitude
      );

      if v_distance_meters > card_record.geofence_radius_meters then
        geo_flagged := true;
        perform public.record_self_service_geo_flag(
          membership_record.merchant_id,
          membership_record.customer_id,
          p_membership_id,
          card_record.location_id,
          'self_service_geofence_out_of_range',
          'stamp',
          p_latitude,
          p_longitude,
          v_distance_meters,
          card_record.geofence_radius_meters
        );
      end if;
    end if;
  end if;

  begin
    insert into public.stamp_events (
      merchant_id,
      customer_id,
      membership_id,
      loyalty_card_id,
      location_id,
      event_type,
      stamps_delta,
      earned_business_date,
      cycle_number,
      metadata
    )
    values (
      membership_record.merchant_id,
      membership_record.customer_id,
      p_membership_id,
      card_record.id,
      card_record.location_id,
      'earned',
      1,
      v_business_date,
      membership_record.active_cycle_number,
      jsonb_build_object(
        'source', 'self_service_qr',
        'geo_flagged', geo_flagged,
        'latitude', p_latitude,
        'longitude', p_longitude
      )
    )
    returning id into stamp_event_id;
  exception
    when unique_violation then
      raise exception 'Stamp already issued for this UK business day';
  end;

  update public.customer_memberships
  set
    current_stamp_count = current_stamp_count + 1,
    total_stamps_earned = total_stamps_earned + 1,
    last_visit_at = now()
  where customer_memberships.id = p_membership_id
  returning current_stamp_count into new_stamp_count;

  reward_unlocked := new_stamp_count >= card_record.stamps_required;

  if reward_unlocked then
    v_weight_threshold := floor(random() * v_total_weight)::integer + 1;

    select *
    into reward_pool_record
    from (
      select
        reward_pool_items.*,
        sum(reward_pool_items.weight) over (
          order by reward_pool_items.display_order asc,
            reward_pool_items.created_at asc,
            reward_pool_items.id asc
        ) as running_weight
      from public.reward_pool_items
      where reward_pool_items.merchant_id = membership_record.merchant_id
        and reward_pool_items.location_id = card_record.location_id
        and reward_pool_items.loyalty_card_id = card_record.id
        and reward_pool_items.is_active
    ) weighted_items
    where weighted_items.running_weight >= v_weight_threshold
    order by weighted_items.running_weight asc
    limit 1;

    insert into public.reward_events (
      merchant_id,
      customer_id,
      membership_id,
      loyalty_card_id,
      reward_pool_item_id,
      reward_name,
      reward_terms,
      min_spend_pence,
      redeemable_from,
      status,
      cycle_number,
      metadata
    )
    values (
      membership_record.merchant_id,
      membership_record.customer_id,
      p_membership_id,
      card_record.id,
      reward_pool_record.id,
      reward_pool_record.reward_name,
      reward_pool_record.reward_terms,
      reward_pool_record.min_spend_pence,
      public.next_uk_business_date(now()),
      'unlocked',
      membership_record.active_cycle_number,
      jsonb_build_object('source', 'self_service_qr')
    );

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
      'reward_unlocked',
      membership_record.merchant_id,
      membership_record.customer_id,
      p_membership_id,
      'system',
      null,
      jsonb_build_object(
        'loyalty_card_id', card_record.id,
        'reward_pool_item_id', reward_pool_record.id
      )
    );
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
    'stamp_issued',
    membership_record.merchant_id,
    membership_record.customer_id,
    p_membership_id,
    'customer',
    coalesce(current_user_id::text, p_customer_id::text),
    jsonb_build_object(
      'new_stamp_count', new_stamp_count,
      'business_date', v_business_date,
      'geo_flagged', geo_flagged
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
    membership_record.merchant_id,
    membership_record.customer_id,
    'customer_memberships',
    p_membership_id,
    'stamp_issued',
    jsonb_build_object(
      'new_stamp_count', new_stamp_count,
      'business_date', v_business_date,
      'geo_flagged', geo_flagged
    )
  );

  select count(*)
  into recent_stamp_count
  from public.stamp_events
  where stamp_events.merchant_id = membership_record.merchant_id
    and stamp_events.event_type = 'earned'
    and stamp_events.created_at > now() - interval '15 minutes';

  if recent_stamp_count >= 20 and not exists (
    select 1
    from public.fraud_flags
    where fraud_flags.merchant_id = membership_record.merchant_id
      and fraud_flags.signal = 'high_stamp_velocity'
      and fraud_flags.status = 'open'
      and fraud_flags.created_at > now() - interval '15 minutes'
  ) then
    insert into public.fraud_flags (
      merchant_id,
      customer_id,
      membership_id,
      signal,
      severity,
      metadata
    )
    values (
      membership_record.merchant_id,
      membership_record.customer_id,
      p_membership_id,
      'high_stamp_velocity',
      'medium',
      jsonb_build_object(
        'threshold', 20,
        'window_minutes', 15,
        'observed_stamp_count', recent_stamp_count
      )
    );
  end if;

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

  if reward_record.merchant_status not in ('trial', 'active') then
    raise exception 'This merchant loyalty programme is not active';
  end if;

  select billing_customers.status
  into billing_status
  from public.billing_customers
  where billing_customers.merchant_id = reward_record.merchant_id;

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

grant execute on function public.issue_self_service_stamp(uuid, uuid, numeric, numeric) to authenticated, service_role;
grant execute on function public.redeem_self_service_reward(uuid, uuid, numeric, numeric) to authenticated, service_role;
