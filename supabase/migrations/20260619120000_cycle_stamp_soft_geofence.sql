-- Cycle-relative soft GPS review for self-service stamps.
--
-- The customer keeps the stamp even when GPS is denied, slow, unsupported, or
-- unavailable. Only the configured cycle stamp is evaluated, and review
-- metadata is minimized so raw customer coordinates are not stored in the stamp
-- ledger or fraud flag.

alter table public.merchant_locations
  add column if not exists soft_geofence_trigger_stamp_number integer not null default 3;

alter table public.merchant_locations
  drop constraint if exists merchant_locations_soft_geofence_trigger_stamp_number_check;

alter table public.merchant_locations
  add constraint merchant_locations_soft_geofence_trigger_stamp_number_check
  check (soft_geofence_trigger_stamp_number = 3);

create or replace function public.record_cycle_stamp_soft_geofence_flag(
  p_merchant_id uuid,
  p_customer_id uuid,
  p_membership_id uuid,
  p_location_id uuid,
  p_signal text,
  p_context text,
  p_cycle_stamp_number integer,
  p_location_status text,
  p_accuracy_meters numeric,
  p_distance_bucket text,
  p_radius_meters integer,
  p_effective_radius_meters integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.fraud_flags (
    merchant_id,
    customer_id,
    membership_id,
    signal,
    severity,
    metadata
  )
  values (
    p_merchant_id,
    p_customer_id,
    p_membership_id,
    p_signal,
    case when p_signal = 'self_service_geofence_out_of_range' then 'medium' else 'low' end,
    jsonb_strip_nulls(
      jsonb_build_object(
        'context', p_context,
        'location_id', p_location_id,
        'cycle_stamp_number', p_cycle_stamp_number,
        'location_status', p_location_status,
        'accuracy_bucket',
          case
            when p_accuracy_meters is null then null
            when p_accuracy_meters <= 25 then '0_25m'
            when p_accuracy_meters <= 50 then '26_50m'
            when p_accuracy_meters <= 100 then '51_100m'
            when p_accuracy_meters <= 200 then '101_200m'
            else 'over_200m'
          end,
        'distance_bucket', p_distance_bucket,
        'radius_meters', p_radius_meters,
        'effective_radius_meters', p_effective_radius_meters
      )
    )
  );
end;
$$;

revoke all on function public.record_cycle_stamp_soft_geofence_flag(
  uuid, uuid, uuid, uuid, text, text, integer, text, numeric, text, integer, integer
) from public;

grant execute on function public.record_cycle_stamp_soft_geofence_flag(
  uuid, uuid, uuid, uuid, text, text, integer, text, numeric, text, integer, integer
) to service_role;

drop function if exists public.issue_self_service_stamp(uuid, uuid, numeric, numeric);

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
  v_distance_meters numeric;
  v_active_cycle_stamp_count integer;
  v_next_cycle_stamp_number integer;
  v_location_status text;
  v_accuracy_meters numeric;
  v_accuracy_bucket text;
  v_distance_bucket text;
  v_effective_radius_meters integer;
  v_capture_elapsed_ms integer;
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

  select count(*)
  into v_active_cycle_stamp_count
  from public.stamp_events
  where stamp_events.membership_id = p_membership_id
    and stamp_events.event_type = 'earned'
    and stamp_events.cycle_number = membership_record.active_cycle_number;

  v_next_cycle_stamp_number := v_active_cycle_stamp_count + 1;
  v_location_status := lower(trim(coalesce(p_location_status, '')));
  v_accuracy_meters :=
    case
      when p_accuracy_meters is not null and p_accuracy_meters >= 0 then p_accuracy_meters
      else null
    end;
  v_capture_elapsed_ms :=
    case
      when p_capture_elapsed_ms is null then null
      when p_capture_elapsed_ms < 0 then 0
      when p_capture_elapsed_ms > 30000 then 30000
      else p_capture_elapsed_ms
    end;

  if v_location_status = '' then
    if p_latitude is not null and p_longitude is not null then
      v_location_status := 'available';
    else
      v_location_status := 'unavailable';
    end if;
  end if;

  -- location_status in ('skipped', 'denied', 'denied_remembered', 'timeout', 'unsupported', 'unavailable')
  if v_location_status not in (
    'skipped',
    'available',
    'denied',
    'denied_remembered',
    'timeout',
    'unsupported',
    'unavailable'
  ) then
    v_location_status := 'unavailable';
  end if;

  v_accuracy_bucket :=
    case
      when v_accuracy_meters is null then null
      when v_accuracy_meters <= 25 then '0_25m'
      when v_accuracy_meters <= 50 then '26_50m'
      when v_accuracy_meters <= 100 then '51_100m'
      when v_accuracy_meters <= 200 then '101_200m'
      else 'over_200m'
    end;

  geo_flagged := false;

  if coalesce(card_record.require_geofence, false)
    and v_next_cycle_stamp_number = coalesce(card_record.soft_geofence_trigger_stamp_number, 3) then
    if v_location_status = 'available'
      and p_latitude is not null
      and p_longitude is not null
      and v_accuracy_meters is not null
      and v_accuracy_meters <= 200
      and card_record.latitude is not null
      and card_record.longitude is not null then
      v_effective_radius_meters :=
        coalesce(card_record.geofence_radius_meters, 150)
        + least(ceil(v_accuracy_meters)::integer, 200)
        + 15;
      v_distance_meters := public.geo_distance_meters(
        p_latitude,
        p_longitude,
        card_record.latitude,
        card_record.longitude
      );
      v_distance_bucket :=
        case
          when v_distance_meters <= v_effective_radius_meters then 'inside_effective_radius'
          when v_distance_meters <= v_effective_radius_meters + 50 then 'outside_0_50m'
          when v_distance_meters <= v_effective_radius_meters + 200 then 'outside_51_200m'
          else 'outside_over_200m'
        end;

      if v_distance_meters > v_effective_radius_meters then
        geo_flagged := true;
        perform public.record_cycle_stamp_soft_geofence_flag(
          membership_record.merchant_id,
          membership_record.customer_id,
          p_membership_id,
          card_record.location_id,
          'self_service_geofence_out_of_range',
          'stamp',
          v_next_cycle_stamp_number,
          v_location_status,
          v_accuracy_meters,
          v_distance_bucket,
          card_record.geofence_radius_meters,
          v_effective_radius_meters
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
      jsonb_strip_nulls(
        jsonb_build_object(
          'source', 'self_service_qr',
          'geo_flagged', geo_flagged,
          'cycle_stamp_number', v_next_cycle_stamp_number,
          'location_status', v_location_status,
          'location_capture_elapsed_ms', v_capture_elapsed_ms,
          'accuracy_bucket', v_accuracy_bucket,
          'distance_bucket', v_distance_bucket,
          'configured_radius_meters', card_record.geofence_radius_meters,
          'effective_radius_meters', v_effective_radius_meters
        )
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

revoke all on function public.issue_self_service_stamp(
  uuid, uuid, numeric, numeric, numeric, text, integer
) from public;

grant execute on function public.issue_self_service_stamp(
  uuid, uuid, numeric, numeric, numeric, text, integer
) to authenticated, service_role;

revoke execute on function public.issue_self_service_stamp(
  uuid, uuid, numeric, numeric, numeric, text, integer
) from anon;
