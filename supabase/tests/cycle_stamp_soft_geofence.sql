begin;

set local request.jwt.claim.role = 'service_role';

create or replace function pg_temp.assert_no_raw_location_metadata(
  p_label text,
  p_metadata jsonb
)
returns void
language plpgsql
as $$
begin
  if p_metadata is null then
    raise exception '% metadata was missing', p_label;
  end if;

  if p_metadata ?| array[
    'latitude',
    'longitude',
    'lat',
    'lng',
    'customer_latitude',
    'customer_longitude',
    'customer_lat',
    'customer_lng'
  ] then
    raise exception '% metadata stored raw customer location: %', p_label, p_metadata;
  end if;
end;
$$;

update public.merchant_locations
set
  require_geofence = true,
  latitude = 52.220000,
  longitude = 0.120000,
  geofence_radius_meters = 150
where id = '11000000-0000-0000-0000-000000000001';

update public.loyalty_cards
set stamps_required = 5
where id = '13000000-0000-0000-0000-000000000001';

insert into public.reward_pool_items (
  id,
  merchant_id,
  location_id,
  loyalty_card_id,
  reward_name,
  reward_terms,
  weight,
  is_active,
  display_order
)
values
  (
    '13500000-0000-0000-0000-0000000000d2',
    '10000000-0000-0000-0000-000000000001',
    '11000000-0000-0000-0000-000000000001',
    '13000000-0000-0000-0000-000000000001',
    'Cycle soft geo bonus 2',
    'Test reward only.',
    null,
    10,
    true,
    20
  ),
  (
    '13500000-0000-0000-0000-0000000000d3',
    '10000000-0000-0000-0000-000000000001',
    '11000000-0000-0000-0000-000000000001',
    '13000000-0000-0000-0000-000000000001',
    'Cycle soft geo bonus 3',
    'Test reward only.',
    null,
    10,
    true,
    30
  );

insert into public.customers (
  id, auth_user_id, phone_hmac, phone_last4, phone_country, full_name, date_of_birth
)
values
  ('15000000-0000-0000-0000-0000000003a1', null, 'cycle-soft-geo-hmac-3a1', '3001', 'GB', 'Cycle Geo One', date '1990-01-01'),
  ('15000000-0000-0000-0000-0000000003a2', null, 'cycle-soft-geo-hmac-3a2', '3002', 'GB', 'Cycle Geo Two', date '1990-01-01'),
  ('15000000-0000-0000-0000-0000000003a3', null, 'cycle-soft-geo-hmac-3a3', '3003', 'GB', 'Cycle Geo Three', date '1990-01-01'),
  ('15000000-0000-0000-0000-0000000003a4', null, 'cycle-soft-geo-hmac-3a4', '3004', 'GB', 'Cycle Geo Four', date '1990-01-01'),
  ('15000000-0000-0000-0000-0000000003a5', null, 'cycle-soft-geo-hmac-3a5', '3005', 'GB', 'Cycle Geo Five', date '1990-01-01'),
  ('15000000-0000-0000-0000-0000000003a6', null, 'cycle-soft-geo-hmac-3a6', '3006', 'GB', 'Cycle Geo Six', date '1990-01-01');

insert into public.customer_memberships (
  id, merchant_id, customer_id, current_stamp_count, total_stamps_earned, active_cycle_number
)
values
  ('16000000-0000-0000-0000-0000000003a1', '10000000-0000-0000-0000-000000000001', '15000000-0000-0000-0000-0000000003a1', 0, 0, 1),
  ('16000000-0000-0000-0000-0000000003a2', '10000000-0000-0000-0000-000000000001', '15000000-0000-0000-0000-0000000003a2', 1, 1, 1),
  ('16000000-0000-0000-0000-0000000003a3', '10000000-0000-0000-0000-000000000001', '15000000-0000-0000-0000-0000000003a3', 2, 2, 1),
  ('16000000-0000-0000-0000-0000000003a4', '10000000-0000-0000-0000-000000000001', '15000000-0000-0000-0000-0000000003a4', 2, 2, 1),
  ('16000000-0000-0000-0000-0000000003a5', '10000000-0000-0000-0000-000000000001', '15000000-0000-0000-0000-0000000003a5', 2, 2, 1),
  ('16000000-0000-0000-0000-0000000003a6', '10000000-0000-0000-0000-000000000001', '15000000-0000-0000-0000-0000000003a6', 2, 2, 1);

insert into public.stamp_events (
  merchant_id, customer_id, membership_id, loyalty_card_id, location_id,
  event_type, stamps_delta, earned_business_date, cycle_number, created_at
)
values
  ('10000000-0000-0000-0000-000000000001', '15000000-0000-0000-0000-0000000003a2', '16000000-0000-0000-0000-0000000003a2', '13000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'earned', 1, public.uk_business_date(now()) - 1, 1, now() - interval '1 day'),
  ('10000000-0000-0000-0000-000000000001', '15000000-0000-0000-0000-0000000003a3', '16000000-0000-0000-0000-0000000003a3', '13000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'earned', 1, public.uk_business_date(now()) - 2, 1, now() - interval '2 days'),
  ('10000000-0000-0000-0000-000000000001', '15000000-0000-0000-0000-0000000003a3', '16000000-0000-0000-0000-0000000003a3', '13000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'earned', 1, public.uk_business_date(now()) - 1, 1, now() - interval '1 day'),
  ('10000000-0000-0000-0000-000000000001', '15000000-0000-0000-0000-0000000003a4', '16000000-0000-0000-0000-0000000003a4', '13000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'earned', 1, public.uk_business_date(now()) - 2, 1, now() - interval '2 days'),
  ('10000000-0000-0000-0000-000000000001', '15000000-0000-0000-0000-0000000003a4', '16000000-0000-0000-0000-0000000003a4', '13000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'earned', 1, public.uk_business_date(now()) - 1, 1, now() - interval '1 day'),
  ('10000000-0000-0000-0000-000000000001', '15000000-0000-0000-0000-0000000003a5', '16000000-0000-0000-0000-0000000003a5', '13000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'earned', 1, public.uk_business_date(now()) - 2, 1, now() - interval '2 days'),
  ('10000000-0000-0000-0000-000000000001', '15000000-0000-0000-0000-0000000003a5', '16000000-0000-0000-0000-0000000003a5', '13000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'earned', 1, public.uk_business_date(now()) - 1, 1, now() - interval '1 day'),
  ('10000000-0000-0000-0000-000000000001', '15000000-0000-0000-0000-0000000003a6', '16000000-0000-0000-0000-0000000003a6', '13000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'earned', 1, public.uk_business_date(now()) - 2, 1, now() - interval '2 days'),
  ('10000000-0000-0000-0000-000000000001', '15000000-0000-0000-0000-0000000003a6', '16000000-0000-0000-0000-0000000003a6', '13000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'earned', 1, public.uk_business_date(now()) - 1, 1, now() - interval '1 day');

-- Given cycle stamp 1, when stale coordinates are submitted, then stamp 1 ignores stale coordinates.
do $$
declare
  v_metadata jsonb;
begin
  perform public.issue_self_service_stamp(
    '16000000-0000-0000-0000-0000000003a1',
    '15000000-0000-0000-0000-0000000003a1',
    53.500000,
    -2.200000
  );

  if exists (
    select 1
    from public.fraud_flags
    where membership_id = '16000000-0000-0000-0000-0000000003a1'
      and signal in ('self_service_geofence_unknown', 'self_service_geofence_out_of_range')
  ) then
    raise exception 'stamp 1 created a geofence fraud flag';
  end if;

  select metadata into v_metadata
  from public.stamp_events
  where membership_id = '16000000-0000-0000-0000-0000000003a1'
    and earned_business_date = public.uk_business_date(now());

  if v_metadata ? 'latitude' or v_metadata ? 'longitude' then
    raise exception 'stamp 1 metadata stored raw coordinates: %', v_metadata;
  end if;

  if (v_metadata->>'cycle_stamp_number')::integer <> 1 then
    raise exception 'stamp 1 metadata missing cycle stamp number: %', v_metadata;
  end if;
end $$;

-- Given cycle stamp 2, when stale coordinates are submitted, then stamp 2 ignores stale coordinates.
do $$
begin
  perform public.issue_self_service_stamp(
    '16000000-0000-0000-0000-0000000003a2',
    '15000000-0000-0000-0000-0000000003a2',
    53.500000,
    -2.200000,
    25,
    'granted',
    250
  );

  if exists (
    select 1
    from public.fraud_flags
    where membership_id = '16000000-0000-0000-0000-0000000003a2'
      and signal in ('self_service_geofence_unknown', 'self_service_geofence_out_of_range')
  ) then
    raise exception 'stamp 2 created a geofence fraud flag';
  end if;
end $$;

-- Given cycle stamp 3, when location is denied, then stamp 3 denied location still issues without fraud flag.
do $$
declare
  v_stamp_count integer;
  v_metadata jsonb;
begin
  select new_stamp_count into v_stamp_count
  from public.issue_self_service_stamp(
    '16000000-0000-0000-0000-0000000003a3',
    '15000000-0000-0000-0000-0000000003a3',
    null,
    null,
    null,
    'denied',
    700
  );

  if v_stamp_count <> 3 then
    raise exception 'stamp 3 denied location did not issue stamp (got %)', v_stamp_count;
  end if;

  if exists (
    select 1
    from public.fraud_flags
    where membership_id = '16000000-0000-0000-0000-0000000003a3'
      and signal in ('self_service_geofence_unknown', 'self_service_geofence_out_of_range')
  ) then
    raise exception 'stamp 3 denied location created a geofence fraud flag';
  end if;

  select metadata into v_metadata
  from public.stamp_events
  where membership_id = '16000000-0000-0000-0000-0000000003a3'
    and earned_business_date = public.uk_business_date(now());

  if v_metadata->>'location_status' <> 'denied' then
    raise exception 'stamp 3 denied location status was not minimized: %', v_metadata;
  end if;
end $$;

-- Given cycle stamp 3, when GPS is timeout, unsupported, unavailable, or remembered denied, then non-granted statuses still issue without fraud flags and keep minimized status.
do $$
declare
  v_status text;
  v_customer_id uuid;
  v_membership_id uuid;
  v_stamp_count integer;
  v_metadata jsonb;
begin
  foreach v_status in array array['timeout', 'unsupported', 'unavailable', 'denied_remembered']
  loop
    v_customer_id := extensions.gen_random_uuid();
    v_membership_id := extensions.gen_random_uuid();

    insert into public.customers (
      id, auth_user_id, phone_hmac, phone_last4, phone_country, full_name, date_of_birth
    )
    values (
      v_customer_id,
      null,
      'cycle-soft-geo-status-' || v_status,
      '3099',
      'GB',
      'Cycle Geo Status',
      date '1990-01-01'
    );

    insert into public.customer_memberships (
      id, merchant_id, customer_id, current_stamp_count, total_stamps_earned, active_cycle_number
    )
    values (
      v_membership_id,
      '10000000-0000-0000-0000-000000000001',
      v_customer_id,
      2,
      2,
      1
    );

    insert into public.stamp_events (
      merchant_id, customer_id, membership_id, loyalty_card_id, location_id,
      event_type, stamps_delta, earned_business_date, cycle_number, created_at
    )
    values
      ('10000000-0000-0000-0000-000000000001', v_customer_id, v_membership_id, '13000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'earned', 1, public.uk_business_date(now()) - 2, 1, now() - interval '2 days'),
      ('10000000-0000-0000-0000-000000000001', v_customer_id, v_membership_id, '13000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'earned', 1, public.uk_business_date(now()) - 1, 1, now() - interval '1 day');

    select new_stamp_count into v_stamp_count
    from public.issue_self_service_stamp(
      v_membership_id,
      v_customer_id,
      null,
      null,
      null,
      v_status,
      1200
    );

    if v_stamp_count <> 3 then
      raise exception 'status % blocked stamp 3 (got %)', v_status, v_stamp_count;
    end if;

    select metadata into v_metadata
    from public.stamp_events
    where membership_id = v_membership_id
      and earned_business_date = public.uk_business_date(now());

    if v_metadata->>'location_status' <> v_status then
      raise exception 'status % was not preserved in stamp metadata: %', v_status, v_metadata;
    end if;

    if exists (
      select 1
      from public.fraud_flags
      where membership_id = v_membership_id
        and signal in ('self_service_geofence_unknown', 'self_service_geofence_out_of_range')
    ) then
      raise exception 'status % created a geofence fraud flag', v_status;
    end if;
  end loop;
end $$;

-- Given cycle stamp 3, when accuracy is poor, then poor accuracy does not create a medium out-of-range flag.
do $$
begin
  perform public.issue_self_service_stamp(
    '16000000-0000-0000-0000-0000000003a4',
    '15000000-0000-0000-0000-0000000003a4',
    53.500000,
    -2.200000,
    250,
    'granted',
    650
  );

  if exists (
    select 1
    from public.fraud_flags
    where membership_id = '16000000-0000-0000-0000-0000000003a4'
      and signal = 'self_service_geofence_out_of_range'
  ) then
    raise exception 'poor accuracy created an out-of-range geofence flag';
  end if;
end $$;

-- Given cycle stamp 3, when location is trustworthy and out of range, then trustworthy out-of-range creates minimized admin flag.
do $$
declare
  v_flag record;
  v_stamp_metadata jsonb;
begin
  perform public.issue_self_service_stamp(
    '16000000-0000-0000-0000-0000000003a5',
    '15000000-0000-0000-0000-0000000003a5',
    53.500000,
    -2.200000,
    25,
    'granted',
    420
  );

  select severity, metadata
  into v_flag
  from public.fraud_flags
  where membership_id = '16000000-0000-0000-0000-0000000003a5'
    and signal = 'self_service_geofence_out_of_range';

  if v_flag.severity is distinct from 'medium' then
    raise exception 'trustworthy out-of-range did not create a medium flag';
  end if;

  if v_flag.metadata ? 'latitude'
    or v_flag.metadata ? 'longitude'
    or v_flag.metadata ? 'distance_meters' then
    raise exception 'fraud flag stored exact location metadata: %', v_flag.metadata;
  end if;

  if v_flag.metadata->>'distance_bucket' is null
    or v_flag.metadata->>'accuracy_bucket' is null
    or v_flag.metadata->>'confidence' <> 'medium'
    or (v_flag.metadata->>'cycle_stamp_number')::integer <> 3
    or (v_flag.metadata->>'configured_radius_meters')::integer <> 150
    or (v_flag.metadata->>'effective_radius_meters')::integer <> 185
    or (v_flag.metadata->>'accuracy_cap_meters')::integer <> 100
    or (v_flag.metadata->>'fixed_tolerance_meters')::integer <> 10 then
    raise exception 'fraud flag metadata missing minimized review fields: %', v_flag.metadata;
  end if;

  select metadata into v_stamp_metadata
  from public.stamp_events
  where membership_id = '16000000-0000-0000-0000-0000000003a5'
    and earned_business_date = public.uk_business_date(now());

  if v_stamp_metadata ? 'latitude' or v_stamp_metadata ? 'longitude' then
    raise exception 'stamp metadata stored exact location metadata: %', v_stamp_metadata;
  end if;
end $$;

-- Given cycle stamp 3, when coordinates are invalid, then invalid coordinates do not block or flag.
do $$
declare
  v_stamp_count integer;
begin
  select new_stamp_count into v_stamp_count
  from public.issue_self_service_stamp(
    '16000000-0000-0000-0000-0000000003a6',
    '15000000-0000-0000-0000-0000000003a6',
    999,
    -2.200000,
    25,
    'granted',
    420
  );

  if v_stamp_count <> 3 then
    raise exception 'invalid coordinates blocked stamp 3 (got %)', v_stamp_count;
  end if;

  if exists (
    select 1
    from public.fraud_flags
    where membership_id = '16000000-0000-0000-0000-0000000003a6'
      and signal in ('self_service_geofence_unknown', 'self_service_geofence_out_of_range')
  ) then
    raise exception 'invalid coordinates created a geofence fraud flag';
  end if;
end $$;

-- Given a reward cycle reset, when the later active cycle reaches stamp 3, then the soft geofence trigger applies again without raw customer location metadata.
do $$
declare
  v_customer_id uuid := '15000000-0000-0000-0000-0000000003b1';
  v_membership_id uuid := '16000000-0000-0000-0000-0000000003b1';
  v_stamp_count integer;
  v_flag_metadata jsonb;
  v_stamp_metadata jsonb;
begin
  insert into public.customers (
    id, auth_user_id, phone_hmac, phone_last4, phone_country, full_name, date_of_birth
  )
  values (
    v_customer_id,
    null,
    'cycle-soft-geo-hmac-3b1',
    '3101',
    'GB',
    'Cycle Geo Later',
    date '1990-01-01'
  );

  insert into public.customer_memberships (
    id, merchant_id, customer_id, current_stamp_count, total_stamps_earned, active_cycle_number, total_rewards_redeemed
  )
  values (
    v_membership_id,
    '10000000-0000-0000-0000-000000000001',
    v_customer_id,
    2,
    7,
    2,
    1
  );

  insert into public.stamp_events (
    merchant_id, customer_id, membership_id, loyalty_card_id, location_id,
    event_type, stamps_delta, earned_business_date, cycle_number, created_at
  )
  values
    ('10000000-0000-0000-0000-000000000001', v_customer_id, v_membership_id, '13000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'earned', 1, public.uk_business_date(now()) - 6, 1, now() - interval '6 days'),
    ('10000000-0000-0000-0000-000000000001', v_customer_id, v_membership_id, '13000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'earned', 1, public.uk_business_date(now()) - 5, 1, now() - interval '5 days'),
    ('10000000-0000-0000-0000-000000000001', v_customer_id, v_membership_id, '13000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'earned', 1, public.uk_business_date(now()) - 4, 1, now() - interval '4 days'),
    ('10000000-0000-0000-0000-000000000001', v_customer_id, v_membership_id, '13000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'earned', 1, public.uk_business_date(now()) - 2, 2, now() - interval '2 days'),
    ('10000000-0000-0000-0000-000000000001', v_customer_id, v_membership_id, '13000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'earned', 1, public.uk_business_date(now()) - 1, 2, now() - interval '1 day');

  select new_stamp_count into v_stamp_count
  from public.issue_self_service_stamp(
    v_membership_id,
    v_customer_id,
    53.500000,
    -2.200000,
    25,
    'granted',
    420
  );

  if v_stamp_count <> 3 then
    raise exception 'later active cycle stamp 3 did not issue as stamp 3 (got %)', v_stamp_count;
  end if;

  select metadata into v_stamp_metadata
  from public.stamp_events
  where membership_id = v_membership_id
    and earned_business_date = public.uk_business_date(now())
    and cycle_number = 2;

  if (v_stamp_metadata->>'cycle_stamp_number')::integer <> 3
    or v_stamp_metadata->>'location_status' <> 'out_of_range' then
    raise exception 'later active cycle stamp 3 did not reapply geofence trigger: %', v_stamp_metadata;
  end if;

  perform pg_temp.assert_no_raw_location_metadata(
    'later active cycle stamp 3',
    v_stamp_metadata
  );

  select metadata into v_flag_metadata
  from public.fraud_flags
  where membership_id = v_membership_id
    and signal = 'self_service_geofence_out_of_range';

  perform pg_temp.assert_no_raw_location_metadata(
    'later active cycle fraud flag',
    v_flag_metadata
  );
end $$;

-- Given stamp 4 or later in an active cycle, when stale GPS is submitted, then GPS is not evaluated and no GPS fraud flag is created.
do $$
declare
  v_customer_id uuid := '15000000-0000-0000-0000-0000000003b2';
  v_membership_id uuid := '16000000-0000-0000-0000-0000000003b2';
  v_stamp_count integer;
  v_metadata jsonb;
begin
  insert into public.customers (
    id, auth_user_id, phone_hmac, phone_last4, phone_country, full_name, date_of_birth
  )
  values (
    v_customer_id,
    null,
    'cycle-soft-geo-hmac-3b2',
    '3102',
    'GB',
    'Cycle Geo Four Plus',
    date '1990-01-01'
  );

  insert into public.customer_memberships (
    id, merchant_id, customer_id, current_stamp_count, total_stamps_earned, active_cycle_number
  )
  values (
    v_membership_id,
    '10000000-0000-0000-0000-000000000001',
    v_customer_id,
    3,
    3,
    1
  );

  insert into public.stamp_events (
    merchant_id, customer_id, membership_id, loyalty_card_id, location_id,
    event_type, stamps_delta, earned_business_date, cycle_number, created_at
  )
  values
    ('10000000-0000-0000-0000-000000000001', v_customer_id, v_membership_id, '13000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'earned', 1, public.uk_business_date(now()) - 3, 1, now() - interval '3 days'),
    ('10000000-0000-0000-0000-000000000001', v_customer_id, v_membership_id, '13000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'earned', 1, public.uk_business_date(now()) - 2, 1, now() - interval '2 days'),
    ('10000000-0000-0000-0000-000000000001', v_customer_id, v_membership_id, '13000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'earned', 1, public.uk_business_date(now()) - 1, 1, now() - interval '1 day');

  select new_stamp_count into v_stamp_count
  from public.issue_self_service_stamp(
    v_membership_id,
    v_customer_id,
    53.500000,
    -2.200000,
    25,
    'granted',
    420
  );

  if v_stamp_count <> 4 then
    raise exception 'stamp 4 did not issue as stamp 4 (got %)', v_stamp_count;
  end if;

  if exists (
    select 1
    from public.fraud_flags
    where membership_id = v_membership_id
      and signal in ('self_service_geofence_unknown', 'self_service_geofence_out_of_range')
  ) then
    raise exception 'stamp 4 evaluated GPS and created a geofence fraud flag';
  end if;

  select metadata into v_metadata
  from public.stamp_events
  where membership_id = v_membership_id
    and earned_business_date = public.uk_business_date(now());

  if (v_metadata->>'cycle_stamp_number')::integer <> 4
    or v_metadata->>'location_status' <> 'not_applicable_before_trigger'
    or v_metadata->>'distance_bucket' <> 'unknown' then
    raise exception 'stamp 4 evaluated GPS metadata unexpectedly: %', v_metadata;
  end if;

  perform pg_temp.assert_no_raw_location_metadata('stamp 4', v_metadata);
end $$;

-- Given a cycle stamp 3 location inside the effective radius including accuracy buffer, when GPS is granted, then it is not flagged.
do $$
declare
  v_customer_id uuid := '15000000-0000-0000-0000-0000000003b3';
  v_membership_id uuid := '16000000-0000-0000-0000-0000000003b3';
  v_metadata jsonb;
begin
  insert into public.customers (
    id, auth_user_id, phone_hmac, phone_last4, phone_country, full_name, date_of_birth
  )
  values (
    v_customer_id,
    null,
    'cycle-soft-geo-hmac-3b3',
    '3103',
    'GB',
    'Cycle Geo Near Margin',
    date '1990-01-01'
  );

  insert into public.customer_memberships (
    id, merchant_id, customer_id, current_stamp_count, total_stamps_earned, active_cycle_number
  )
  values (
    v_membership_id,
    '10000000-0000-0000-0000-000000000001',
    v_customer_id,
    2,
    2,
    1
  );

  insert into public.stamp_events (
    merchant_id, customer_id, membership_id, loyalty_card_id, location_id,
    event_type, stamps_delta, earned_business_date, cycle_number, created_at
  )
  values
    ('10000000-0000-0000-0000-000000000001', v_customer_id, v_membership_id, '13000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'earned', 1, public.uk_business_date(now()) - 2, 1, now() - interval '2 days'),
    ('10000000-0000-0000-0000-000000000001', v_customer_id, v_membership_id, '13000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'earned', 1, public.uk_business_date(now()) - 1, 1, now() - interval '1 day');

  perform public.issue_self_service_stamp(
    v_membership_id,
    v_customer_id,
    52.220000,
    0.122350,
    25,
    'granted',
    420
  );

  if exists (
    select 1
    from public.fraud_flags
    where membership_id = v_membership_id
      and signal = 'self_service_geofence_out_of_range'
  ) then
    raise exception 'in-range location inside effective radius created a geofence flag';
  end if;

  select metadata into v_metadata
  from public.stamp_events
  where membership_id = v_membership_id
    and earned_business_date = public.uk_business_date(now());

  if v_metadata->>'location_status' <> 'in_range'
    or v_metadata->>'distance_bucket' <> 'near_margin'
    or (v_metadata->>'effective_radius_meters')::integer <> 185 then
    raise exception 'in-range effective radius metadata was not minimized correctly: %', v_metadata;
  end if;

  perform pg_temp.assert_no_raw_location_metadata(
    'in-range effective radius stamp',
    v_metadata
  );
end $$;

-- Given cycle stamp 3, when accuracy is between the new and old poor thresholds, then 150m accuracy is treated as poor and is not flagged.
do $$
declare
  v_customer_id uuid := '15000000-0000-0000-0000-0000000003b6';
  v_membership_id uuid := '16000000-0000-0000-0000-0000000003b6';
  v_metadata jsonb;
begin
  insert into public.customers (
    id, auth_user_id, phone_hmac, phone_last4, phone_country, full_name, date_of_birth
  )
  values (
    v_customer_id,
    null,
    'cycle-soft-geo-hmac-3b6',
    '3106',
    'GB',
    'Cycle Geo Poor 150',
    date '1990-01-01'
  );

  insert into public.customer_memberships (
    id, merchant_id, customer_id, current_stamp_count, total_stamps_earned, active_cycle_number
  )
  values (
    v_membership_id,
    '10000000-0000-0000-0000-000000000001',
    v_customer_id,
    2,
    2,
    1
  );

  insert into public.stamp_events (
    merchant_id, customer_id, membership_id, loyalty_card_id, location_id,
    event_type, stamps_delta, earned_business_date, cycle_number, created_at
  )
  values
    ('10000000-0000-0000-0000-000000000001', v_customer_id, v_membership_id, '13000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'earned', 1, public.uk_business_date(now()) - 2, 1, now() - interval '2 days'),
    ('10000000-0000-0000-0000-000000000001', v_customer_id, v_membership_id, '13000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'earned', 1, public.uk_business_date(now()) - 1, 1, now() - interval '1 day');

  -- 150m accuracy at a far-away point: under the old 200m poor threshold this
  -- would be evaluated and flagged out-of-range; under the new 100m threshold it
  -- is poor accuracy and must not flag.
  perform public.issue_self_service_stamp(
    v_membership_id,
    v_customer_id,
    53.500000,
    -2.200000,
    150,
    'granted',
    420
  );

  if exists (
    select 1
    from public.fraud_flags
    where membership_id = v_membership_id
      and signal = 'self_service_geofence_out_of_range'
  ) then
    raise exception '150m accuracy created an out-of-range geofence flag under the tightened poor threshold';
  end if;

  select metadata into v_metadata
  from public.stamp_events
  where membership_id = v_membership_id
    and earned_business_date = public.uk_business_date(now());

  if v_metadata->>'location_status' <> 'poor_accuracy'
    or v_metadata->>'accuracy_bucket' <> 'accuracy_over_100m' then
    raise exception '150m accuracy was not treated as poor accuracy in the over-100m bucket: %', v_metadata;
  end if;

  perform pg_temp.assert_no_raw_location_metadata('poor accuracy 150m stamp', v_metadata);
end $$;

-- Given new soft GPS params, when the customer is already stamped today, then idempotency still rejects the duplicate before GPS review.
do $$
declare
  v_customer_id uuid := '15000000-0000-0000-0000-0000000003b4';
  v_membership_id uuid := '16000000-0000-0000-0000-0000000003b4';
  v_duplicate_rejected boolean := false;
begin
  insert into public.customers (
    id, auth_user_id, phone_hmac, phone_last4, phone_country, full_name, date_of_birth
  )
  values (
    v_customer_id,
    null,
    'cycle-soft-geo-hmac-3b4',
    '3104',
    'GB',
    'Cycle Geo Idempotent',
    date '1990-01-01'
  );

  insert into public.customer_memberships (
    id, merchant_id, customer_id, current_stamp_count, total_stamps_earned, active_cycle_number
  )
  values (
    v_membership_id,
    '10000000-0000-0000-0000-000000000001',
    v_customer_id,
    2,
    2,
    1
  );

  insert into public.stamp_events (
    merchant_id, customer_id, membership_id, loyalty_card_id, location_id,
    event_type, stamps_delta, earned_business_date, cycle_number, created_at
  )
  values
    ('10000000-0000-0000-0000-000000000001', v_customer_id, v_membership_id, '13000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'earned', 1, public.uk_business_date(now()) - 2, 1, now() - interval '2 days'),
    ('10000000-0000-0000-0000-000000000001', v_customer_id, v_membership_id, '13000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'earned', 1, public.uk_business_date(now()) - 1, 1, now() - interval '1 day');

  perform public.issue_self_service_stamp(
    v_membership_id,
    v_customer_id,
    52.220000,
    0.120000,
    25,
    'granted',
    420
  );

  begin
    perform public.issue_self_service_stamp(
      v_membership_id,
      v_customer_id,
      53.500000,
      -2.200000,
      25,
      'granted',
      420
    );
  exception
    when others then
      if sqlerrm = 'Stamp already issued for this UK business day' then
        v_duplicate_rejected := true;
      else
        raise;
      end if;
  end;

  if not v_duplicate_rejected then
    raise exception 'duplicate same-day stamp with new GPS params unexpectedly succeeded';
  end if;

  if (
    select count(*)
    from public.stamp_events
    where membership_id = v_membership_id
      and earned_business_date = public.uk_business_date(now())
  ) <> 1 then
    raise exception 'duplicate same-day stamp changed stamp event count';
  end if;

  if exists (
    select 1
    from public.fraud_flags
    where membership_id = v_membership_id
      and signal = 'self_service_geofence_out_of_range'
  ) then
    raise exception 'duplicate same-day stamp evaluated GPS after idempotency failure';
  end if;
end $$;

-- Given legacy RPC callers, when they omit the new soft GPS params, then defaults preserve the old call shape.
do $$
declare
  v_customer_id uuid := '15000000-0000-0000-0000-0000000003b5';
  v_membership_id uuid := '16000000-0000-0000-0000-0000000003b5';
  v_stamp_count integer;
  v_metadata jsonb;
begin
  insert into public.customers (
    id, auth_user_id, phone_hmac, phone_last4, phone_country, full_name, date_of_birth
  )
  values (
    v_customer_id,
    null,
    'cycle-soft-geo-hmac-3b5',
    '3105',
    'GB',
    'Cycle Geo Legacy',
    date '1990-01-01'
  );

  insert into public.customer_memberships (
    id, merchant_id, customer_id, current_stamp_count, total_stamps_earned, active_cycle_number
  )
  values (
    v_membership_id,
    '10000000-0000-0000-0000-000000000001',
    v_customer_id,
    0,
    0,
    1
  );

  select new_stamp_count into v_stamp_count
  from public.issue_self_service_stamp(v_membership_id, v_customer_id);

  if v_stamp_count <> 1 then
    raise exception 'legacy two-argument stamp call returned unexpected count %', v_stamp_count;
  end if;

  select metadata into v_metadata
  from public.stamp_events
  where membership_id = v_membership_id
    and earned_business_date = public.uk_business_date(now());

  if (v_metadata->>'cycle_stamp_number')::integer <> 1
    or v_metadata->>'location_status' <> 'not_applicable_before_trigger' then
    raise exception 'legacy two-argument stamp defaults changed: %', v_metadata;
  end if;

  perform pg_temp.assert_no_raw_location_metadata('legacy two-argument stamp', v_metadata);
end $$;

select 'cycle stamp soft geofence ok';

rollback;
