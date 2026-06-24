-- Remove optional minimum-spend metadata from loyalty cards, reward pool items,
-- and reward event snapshots. Redemption was never gated on spend amount.

drop function if exists public.save_loyalty_card(uuid, uuid, text, integer, text, text, integer, boolean);
drop function if exists public.upsert_reward_pool_item(uuid, uuid, uuid, text, text, integer, integer, boolean, integer);
drop function if exists public.get_reward_scan_context(uuid, uuid);

create or replace function public.save_loyalty_card(
  p_merchant_id uuid,
  p_card_id uuid,
  p_card_name text,
  p_stamps_required integer,
  p_reward_name text,
  p_reward_terms text,
  p_is_active boolean
)
returns table (loyalty_card_id uuid, saved_action text)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_location_id uuid;
  existing_card_id uuid;
  existing_active_card_id uuid;
  v_reward_name text := coalesce(nullif(trim(p_reward_name), ''), 'Surprise reward');
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.merchants
    where merchants.id = p_merchant_id
      and merchants.owner_user_id = (select auth.uid())
  ) then
    raise insufficient_privilege using message = 'Merchant ownership required';
  end if;

  select merchant_locations.id
  into v_location_id
  from public.merchant_locations
  where merchant_locations.merchant_id = p_merchant_id
  order by merchant_locations.is_primary desc, merchant_locations.created_at asc
  limit 1;

  if v_location_id is null then
    raise exception 'Merchant location is required before creating a loyalty card';
  end if;

  if p_card_id is not null then
    select loyalty_cards.id
    into existing_card_id
    from public.loyalty_cards
    where loyalty_cards.id = p_card_id
      and loyalty_cards.merchant_id = p_merchant_id
      and loyalty_cards.location_id = v_location_id;

    if existing_card_id is null then
      raise insufficient_privilege using message = 'Loyalty card not found for merchant';
    end if;
  else
    select loyalty_cards.id
    into existing_card_id
    from public.loyalty_cards
    where loyalty_cards.merchant_id = p_merchant_id
      and loyalty_cards.location_id = v_location_id
    order by loyalty_cards.is_active desc, loyalty_cards.created_at asc
    limit 1;
  end if;

  if p_is_active then
    select loyalty_cards.id
    into existing_active_card_id
    from public.loyalty_cards
    where loyalty_cards.merchant_id = p_merchant_id
      and loyalty_cards.location_id = v_location_id
      and loyalty_cards.is_active
      and (existing_card_id is null or loyalty_cards.id <> existing_card_id)
    limit 1;

    if existing_active_card_id is not null then
      raise exception 'Only one active loyalty card is allowed for this location';
    end if;
  end if;

  if existing_card_id is null then
    insert into public.loyalty_cards (
      merchant_id,
      location_id,
      card_name,
      stamps_required,
      reward_name,
      reward_terms,
      is_active
    )
    values (
      p_merchant_id,
      v_location_id,
      p_card_name,
      p_stamps_required,
      v_reward_name,
      p_reward_terms,
      p_is_active
    )
    returning id into loyalty_card_id;

    saved_action := 'loyalty_card_created';
  else
    update public.loyalty_cards
    set
      card_name = p_card_name,
      stamps_required = p_stamps_required,
      reward_name = v_reward_name,
      reward_terms = p_reward_terms,
      is_active = p_is_active
    where loyalty_cards.id = existing_card_id
    returning id into loyalty_card_id;

    saved_action := 'loyalty_card_updated';
  end if;

  insert into public.product_events (
    event_name,
    merchant_id,
    actor_type,
    actor_id,
    metadata
  )
  values (
    saved_action,
    p_merchant_id,
    'merchant',
    (select auth.uid())::text,
    jsonb_build_object('loyalty_card_id', loyalty_card_id, 'is_active', p_is_active)
  );

  insert into public.audit_logs (
    actor_type,
    actor_id,
    merchant_id,
    target_table,
    target_id,
    action,
    metadata
  )
  values (
    'merchant',
    (select auth.uid())::text,
    p_merchant_id,
    'loyalty_cards',
    loyalty_card_id,
    saved_action,
    jsonb_build_object('stamps_required', p_stamps_required, 'reward_name', v_reward_name)
  );

  return next;
end;
$$;

create or replace function public.upsert_reward_pool_item(
  p_merchant_id uuid,
  p_loyalty_card_id uuid,
  p_reward_pool_item_id uuid,
  p_reward_name text,
  p_reward_terms text,
  p_weight integer,
  p_is_active boolean,
  p_display_order integer
)
returns table (reward_pool_item_id uuid, saved_action text)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_location_id uuid;
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;

  if not (select public.is_merchant_owner(p_merchant_id)) then
    raise insufficient_privilege using message = 'Merchant ownership required';
  end if;

  select loyalty_cards.location_id
  into v_location_id
  from public.loyalty_cards
  where loyalty_cards.id = p_loyalty_card_id
    and loyalty_cards.merchant_id = p_merchant_id;

  if v_location_id is null then
    raise insufficient_privilege using message = 'Loyalty card not found for merchant';
  end if;

  if p_reward_pool_item_id is not null and not exists (
    select 1
    from public.reward_pool_items
    where reward_pool_items.id = p_reward_pool_item_id
      and reward_pool_items.merchant_id = p_merchant_id
      and reward_pool_items.loyalty_card_id = p_loyalty_card_id
  ) then
    raise insufficient_privilege using message = 'Reward pool item not found for merchant';
  end if;

  if p_reward_pool_item_id is null then
    insert into public.reward_pool_items (
      merchant_id,
      location_id,
      loyalty_card_id,
      reward_name,
      reward_terms,
      weight,
      is_active,
      display_order
    )
    values (
      p_merchant_id,
      v_location_id,
      p_loyalty_card_id,
      trim(p_reward_name),
      trim(p_reward_terms),
      p_weight,
      p_is_active,
      p_display_order
    )
    returning id into reward_pool_item_id;

    saved_action := 'reward_pool_item_created';
  else
    update public.reward_pool_items
    set
      reward_name = trim(p_reward_name),
      reward_terms = trim(p_reward_terms),
      weight = p_weight,
      is_active = p_is_active,
      display_order = p_display_order
    where reward_pool_items.id = p_reward_pool_item_id
    returning id into reward_pool_item_id;

    saved_action := 'reward_pool_item_updated';
  end if;

  insert into public.product_events (
    event_name,
    merchant_id,
    actor_type,
    actor_id,
    metadata
  )
  values (
    saved_action,
    p_merchant_id,
    'merchant',
    (select auth.uid())::text,
    jsonb_build_object(
      'loyalty_card_id', p_loyalty_card_id,
      'reward_pool_item_id', reward_pool_item_id,
      'is_active', p_is_active,
      'weight', p_weight
    )
  );

  insert into public.audit_logs (
    actor_type,
    actor_id,
    merchant_id,
    target_table,
    target_id,
    action,
    metadata
  )
  values (
    'merchant',
    (select auth.uid())::text,
    p_merchant_id,
    'reward_pool_items',
    reward_pool_item_id,
    saved_action,
    jsonb_build_object('loyalty_card_id', p_loyalty_card_id)
  );

  return next;
end;
$$;

create or replace function public.get_reward_scan_context(
  p_scan_token uuid,
  p_merchant_id uuid
)
returns table (
  scan_status text,
  reward_event_id uuid,
  reward_name text,
  reward_terms text,
  -- Retained in the return signature to match the earlier backend_hardening
  -- definition; CI re-applies that migration and Postgres refuses to change a
  -- function's return type. Left unassigned (null); no caller reads it.
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

  if scan_record.expires_at <= now() then
    scan_status := 'not_found';
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
    scan_record.billing_status
  );

  if availability_reason is not null then
    scan_status := 'blocked';
    blocked_reason := 'This loyalty programme is unavailable right now.';
    return next;
    return;
  end if;

  if scan_record.card_stamp_count < scan_record.stamps_required then
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

  scan_status := 'ready';
  return next;
end;
$$;

grant execute on function public.save_loyalty_card(uuid, uuid, text, integer, text, text, boolean) to authenticated, service_role;
grant execute on function public.upsert_reward_pool_item(uuid, uuid, uuid, text, text, integer, boolean, integer) to authenticated, service_role;
grant execute on function public.get_reward_scan_context(uuid, uuid) to service_role;

-- issue_self_service_stamp: stop snapshotting min spend onto reward_events.
create or replace function public.issue_self_service_stamp(
  p_membership_id uuid,
  p_customer_id uuid,
  p_latitude numeric default null,
  p_longitude numeric default null,
  p_accuracy_meters numeric default null,
  p_location_status text default null,
  p_capture_elapsed_ms integer default null
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
  v_active_reward_count integer := 0;
  v_weight_threshold integer;
  v_distance numeric;
  v_active_cycle_stamp_count integer := 0;
  v_next_cycle_stamp_number integer;
  v_location_status text;
  v_distance_bucket text := 'unknown';
  v_accuracy_bucket text := 'unknown';
  v_confidence text := 'none';
  v_effective_radius_meters integer;
  v_capture_elapsed_bucket text := 'unknown';
begin
  if p_customer_id is null then
    raise insufficient_privilege using message = 'Verified customer required';
  end if;

  perform public.enforce_rate_limit('selfstamp:' || p_membership_id::text, 10, 900000);

  select
    memberships.id,
    memberships.merchant_id,
    memberships.customer_id,
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
    merchant_locations.require_geofence,
    merchant_locations.soft_geofence_trigger_stamp_number
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

  select count(*)
  into v_active_cycle_stamp_count
  from public.stamp_events
  where stamp_events.membership_id = p_membership_id
    and stamp_events.event_type = 'earned'
    and stamp_events.cycle_number = membership_record.active_cycle_number;

  v_next_cycle_stamp_number := v_active_cycle_stamp_count + 1;

  if v_active_cycle_stamp_count >= card_record.stamps_required then
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

  if v_next_cycle_stamp_number >= card_record.stamps_required then
    select
      count(*),
      coalesce(sum(reward_pool_items.weight), 0)
    into v_active_reward_count, v_total_weight
    from public.reward_pool_items
    where reward_pool_items.merchant_id = membership_record.merchant_id
      and reward_pool_items.location_id = card_record.location_id
      and reward_pool_items.loyalty_card_id = card_record.id
      and reward_pool_items.is_active;

    if v_active_reward_count < 3 then
      raise exception 'At least 3 active reward pool items are required before unlocking a reward';
    end if;

    if v_total_weight <= 0 then
      raise exception 'At least 3 active reward pool items are required before unlocking a reward';
    end if;
  end if;

  geo_flagged := false;
  v_location_status := 'not_applicable_before_trigger';

  if p_capture_elapsed_ms is not null then
    v_capture_elapsed_bucket := case
      when p_capture_elapsed_ms < 0 then 'invalid'
      when p_capture_elapsed_ms <= 500 then 'under_500ms'
      when p_capture_elapsed_ms <= 1200 then '500_1200ms'
      when p_capture_elapsed_ms <= 3000 then '1200_3000ms'
      else 'over_3000ms'
    end;
  end if;

  if coalesce(card_record.require_geofence, false)
    and v_next_cycle_stamp_number = coalesce(card_record.soft_geofence_trigger_stamp_number, 3) then
    v_location_status := lower(coalesce(nullif(trim(p_location_status), ''), ''));

    if v_location_status not in ('granted', 'denied', 'denied_remembered', 'timeout', 'unsupported', 'unavailable') then
      v_location_status := case
        when p_latitude is not null and p_longitude is not null then 'granted'
        else 'unavailable'
      end;
    end if;

    if v_location_status = 'granted' then
      if p_latitude is null
        or p_longitude is null
        or card_record.latitude is null
        or card_record.longitude is null then
        v_location_status := 'unavailable';
      elsif p_latitude < -90
        or p_latitude > 90
        or p_longitude < -180
        or p_longitude > 180 then
        v_location_status := 'invalid_coordinates';
      elsif p_accuracy_meters is null then
        v_location_status := 'accuracy_unknown';
        v_confidence := 'low';
      elsif p_accuracy_meters < 0 then
        v_location_status := 'invalid_accuracy';
      else
        v_accuracy_bucket := case
          when p_accuracy_meters <= 25 then 'accuracy_0_25m'
          when p_accuracy_meters <= 100 then 'accuracy_25_100m'
          else 'accuracy_over_100m'
        end;
        v_effective_radius_meters := (
          card_record.geofence_radius_meters + least(p_accuracy_meters, 100) + 10
        )::integer;
        v_distance := public.geo_distance_meters(
          p_latitude,
          p_longitude,
          card_record.latitude,
          card_record.longitude
        );
        v_distance_bucket := case
          when v_distance <= card_record.geofence_radius_meters then 'in_range'
          when v_distance <= v_effective_radius_meters then 'near_margin'
          when v_distance <= 250 then 'out_100_250m'
          when v_distance <= 1000 then 'out_250_1000m'
          else 'out_1km_plus'
        end;

        if p_accuracy_meters > 100 then
          v_location_status := 'poor_accuracy';
          v_confidence := 'low';
        elsif v_distance > v_effective_radius_meters then
          v_location_status := 'out_of_range';
          v_confidence := 'medium';
          geo_flagged := true;
          perform public.record_cycle_stamp_soft_geofence_flag(
            membership_record.merchant_id,
            membership_record.customer_id,
            p_membership_id,
            card_record.location_id,
            v_next_cycle_stamp_number,
            v_location_status,
            v_distance_bucket,
            v_accuracy_bucket,
            v_confidence,
            card_record.geofence_radius_meters,
            v_effective_radius_meters
          );
        else
          v_location_status := 'in_range';
          v_confidence := 'medium';
        end if;
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
        'cycle_stamp_number', v_next_cycle_stamp_number,
        'location_status', v_location_status,
        'distance_bucket', v_distance_bucket,
        'accuracy_bucket', v_accuracy_bucket,
        'confidence', v_confidence,
        'configured_radius_meters', card_record.geofence_radius_meters,
        'effective_radius_meters', v_effective_radius_meters,
        'capture_elapsed_bucket', v_capture_elapsed_bucket
      )
    )
    returning id into stamp_event_id;
  exception
    when unique_violation then
      raise exception 'Stamp already issued for this UK business day';
  end;

  update public.customer_memberships
  set
    current_stamp_count = v_next_cycle_stamp_number,
    total_stamps_earned = total_stamps_earned + 1,
    last_visit_at = now()
  where customer_memberships.id = p_membership_id
  returning current_stamp_count into new_stamp_count;

  reward_unlocked := new_stamp_count >= card_record.stamps_required;

  if reward_unlocked then
    if membership_record.active_cycle_number = 1 then
      select *
      into reward_pool_record
      from public.reward_pool_items
      where reward_pool_items.merchant_id = membership_record.merchant_id
        and reward_pool_items.location_id = card_record.location_id
        and reward_pool_items.loyalty_card_id = card_record.id
        and reward_pool_items.is_active
      order by reward_pool_items.display_order asc,
        reward_pool_items.created_at asc,
        reward_pool_items.id asc
      limit 1;
    else
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
    end if;

    insert into public.reward_events (
      merchant_id,
      customer_id,
      membership_id,
      loyalty_card_id,
      reward_pool_item_id,
      reward_name,
      reward_terms,
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
      public.next_uk_business_date(now()),
      'unlocked',
      membership_record.active_cycle_number,
      jsonb_build_object(
        'source', 'self_service_qr',
        'selection_mode',
        case
          when membership_record.active_cycle_number = 1 then 'first_cycle_default'
          else 'weighted_random'
        end
      )
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
      'geo_flagged', geo_flagged,
      'cycle_stamp_number', v_next_cycle_stamp_number,
      'location_status', v_location_status
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
      'geo_flagged', geo_flagged,
      'cycle_stamp_number', v_next_cycle_stamp_number,
      'location_status', v_location_status
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

-- NOTE: the `min_spend_pence` columns are intentionally retained (left vestigial)
-- rather than dropped. This repo re-applies every non-initial migration on each
-- run for idempotency, and earlier migrations still reference these columns;
-- physically dropping them here makes those earlier migrations fail on re-apply
-- with "column ... does not exist". Retiring minimum-spend at the function and
-- application layer (above) is sufficient — new writes no longer populate the
-- columns. A physical column drop must happen later via a migration-history
-- squash, not an out-of-order DROP.
