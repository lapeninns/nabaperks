alter table public.merchant_locations
  add column if not exists latitude numeric,
  add column if not exists longitude numeric,
  add column if not exists geofence_radius_meters integer,
  add column if not exists require_geofence boolean,
  add column if not exists geocoded_at timestamptz;

update public.merchant_locations
set
  geofence_radius_meters = coalesce(geofence_radius_meters, 150),
  require_geofence = coalesce(require_geofence, false);

alter table public.merchant_locations
  alter column geofence_radius_meters set default 150,
  alter column geofence_radius_meters set not null,
  alter column require_geofence set default false,
  alter column require_geofence set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'merchant_locations_geofence_radius_meters_check'
      and conrelid = 'public.merchant_locations'::regclass
  ) then
    alter table public.merchant_locations
      add constraint merchant_locations_geofence_radius_meters_check
      check (geofence_radius_meters between 25 and 1000);
  end if;
end;
$$;

alter table public.audit_logs
  drop constraint if exists audit_logs_actor_type_check;

alter table public.audit_logs
  add constraint audit_logs_actor_type_check
  check (actor_type in ('merchant', 'staff', 'customer', 'admin', 'system'));

drop function if exists public.issue_stamp_with_staff_pin(uuid, text);
drop function if exists public.redeem_reward_with_staff_pin(uuid, text);
drop function if exists public.create_station_pairing(text);
drop function if exists public.revoke_station(uuid);
drop function if exists public.pair_station(text);
drop function if exists public.start_staff_session(uuid, text, uuid, text);
drop function if exists public.end_staff_session(uuid, text, uuid);
drop function if exists public.get_station_state(uuid, text);
drop function if exists public.create_verification_token(uuid, text, uuid);
drop function if exists public.get_verification_token_status(uuid);
drop function if exists public.lookup_verification_code(uuid, text, text);
drop function if exists public.approve_stamp_token(uuid, text, uuid, uuid);
drop function if exists public.redeem_reward_token(uuid, text, uuid, uuid);
drop function if exists public.undo_recent_stamp(uuid, text, uuid, uuid);
drop function if exists public.station_active_session(uuid, uuid);
drop function if exists public.station_authenticate(uuid, text);
drop function if exists public.generate_verification_code();

alter table public.stamp_events
  drop column if exists station_id,
  drop column if exists staff_session_id,
  drop column if exists verification_token_id,
  drop column if exists approved_by_staff_id;

alter table public.reward_events
  drop column if exists redeemed_by_station_id,
  drop column if exists redeemed_verification_token_id,
  drop column if exists redeemed_by_staff_id;

drop table if exists public.station_pin_attempts cascade;
drop table if exists public.staff_sessions cascade;
drop table if exists public.verification_tokens cascade;
drop table if exists public.stations cascade;
drop table if exists public.staff_pin_attempts cascade;

create or replace function public.geo_distance_meters(
  p_latitude_a numeric,
  p_longitude_a numeric,
  p_latitude_b numeric,
  p_longitude_b numeric
)
returns numeric
language sql
immutable
as $$
  select (
    2 * 6371000 * asin(
      sqrt(
        power(sin(radians((p_latitude_b - p_latitude_a)::double precision) / 2), 2) +
        cos(radians(p_latitude_a::double precision)) *
        cos(radians(p_latitude_b::double precision)) *
        power(sin(radians((p_longitude_b - p_longitude_a)::double precision) / 2), 2)
      )
    )
  )::numeric;
$$;

create or replace function public.record_self_service_geo_flag(
  p_merchant_id uuid,
  p_customer_id uuid,
  p_membership_id uuid,
  p_location_id uuid,
  p_signal text,
  p_context text,
  p_latitude numeric,
  p_longitude numeric,
  p_distance_meters numeric,
  p_radius_meters integer
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
    jsonb_build_object(
      'context', p_context,
      'location_id', p_location_id,
      'latitude', p_latitude,
      'longitude', p_longitude,
      'distance_meters', p_distance_meters,
      'radius_meters', p_radius_meters
    )
  );
end;
$$;

create or replace function public.issue_self_service_stamp(
  p_membership_id uuid,
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
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;

  perform public.enforce_rate_limit('selfstamp:' || p_membership_id::text, 10, 900000);

  select
    memberships.id,
    memberships.merchant_id,
    memberships.customer_id,
    memberships.current_stamp_count,
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

  if membership_record.auth_user_id <> (select auth.uid()) then
    raise insufficient_privilege using message = 'Membership ownership required';
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
    (select auth.uid())::text,
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
    (select auth.uid())::text,
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
  reward_record record;
  billing_status text;
  v_distance_meters numeric;
  v_geo_flagged boolean := false;
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Authentication required';
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

  if reward_record.auth_user_id <> (select auth.uid()) then
    raise insufficient_privilege using message = 'Reward ownership required';
  end if;

  reward_event_id := reward_record.id;
  reward_name := reward_record.assigned_reward_name;
  membership_id := reward_record.reward_membership_id;

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

  update public.customer_memberships
  set
    current_stamp_count = greatest(current_stamp_count - reward_record.stamps_required, 0),
    total_rewards_redeemed = total_rewards_redeemed + 1
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
    (select auth.uid())::text,
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
    (select auth.uid())::text,
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

create or replace function public.admin_log_pilot_note(
  p_merchant_id uuid,
  p_note_type text,
  p_notes text,
  p_training_minutes integer default null
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  admin_user_id uuid;
  audit_action text;
begin
  admin_user_id := (select auth.uid());

  if admin_user_id is null or not (select public.is_internal_admin()) then
    raise insufficient_privilege using message = 'Internal admin access required';
  end if;

  if p_note_type not in (
    'interview',
    'cancellation_reason',
    'support',
    'payment_objection',
    'launch_self_service_checked'
  ) then
    raise exception 'Unsupported pilot note type';
  end if;

  if length(trim(coalesce(p_notes, ''))) < 4 then
    raise exception 'Pilot note is required';
  end if;

  if not exists (
    select 1
    from public.merchants
    where merchants.id = p_merchant_id
  ) then
    raise exception 'Merchant not found';
  end if;

  audit_action := case
    when p_note_type = 'cancellation_reason' then 'merchant_cancel_reason_recorded'
    when p_note_type = 'launch_self_service_checked' then 'launch_self_service_checked'
    else 'pilot_note_logged'
  end;

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
    'admin',
    admin_user_id::text,
    p_merchant_id,
    'merchants',
    p_merchant_id,
    audit_action,
    jsonb_build_object(
      'note_type', p_note_type,
      'notes', trim(p_notes),
      'training_minutes', p_training_minutes
    )
  );
end;
$$;

grant execute on function public.issue_self_service_stamp(uuid, numeric, numeric) to authenticated, service_role;
grant execute on function public.redeem_self_service_reward(uuid, numeric, numeric) to authenticated, service_role;
grant execute on function public.geo_distance_meters(numeric, numeric, numeric, numeric) to authenticated, service_role;
grant execute on function public.record_self_service_geo_flag(uuid, uuid, uuid, uuid, text, text, numeric, numeric, numeric, integer) to service_role;

revoke execute on function public.issue_self_service_stamp(uuid, numeric, numeric) from anon;
revoke execute on function public.redeem_self_service_reward(uuid, numeric, numeric) from anon;
