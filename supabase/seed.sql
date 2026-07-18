insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'admin@nabaperks.test',
    extensions.crypt('NabaperksDemo1!', extensions.gen_salt('bf')),
    now(),
    '',
    '',
    '',
    '',
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Alex Admin"}'::jsonb,
    false
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000101',
    'authenticated',
    'authenticated',
    'mia@old-crown-girton.test',
    extensions.crypt('NabaperksDemo1!', extensions.gen_salt('bf')),
    now(),
    '',
    '',
    '',
    '',
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Mia Chen"}'::jsonb,
    false
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000102',
    'authenticated',
    'authenticated',
    'jordan@bubble-yard.test',
    extensions.crypt('NabaperksDemo1!', extensions.gen_salt('bf')),
    now(),
    '',
    '',
    '',
    '',
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Jordan Park"}'::jsonb,
    false
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000201',
    'authenticated',
    'authenticated',
    'staff-a@nabaperks.test',
    extensions.crypt('NabaperksDemo1!', extensions.gen_salt('bf')),
    now(),
    '',
    '',
    '',
    '',
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Ella Brooks"}'::jsonb,
    false
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000202',
    'authenticated',
    'authenticated',
    'staff-b@nabaperks.test',
    extensions.crypt('NabaperksDemo1!', extensions.gen_salt('bf')),
    now(),
    '',
    '',
    '',
    '',
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Noah Singh"}'::jsonb,
    false
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000301',
    'authenticated',
    'authenticated',
    'sam.taylor@example.test',
    extensions.crypt('NabaperksDemo1!', extensions.gen_salt('bf')),
    now(),
    '',
    '',
    '',
    '',
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Sam Taylor"}'::jsonb,
    false
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000302',
    'authenticated',
    'authenticated',
    'riley.morgan@example.test',
    extensions.crypt('NabaperksDemo1!', extensions.gen_salt('bf')),
    now(),
    '',
    '',
    '',
    '',
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Riley Morgan"}'::jsonb,
    false
  )
on conflict (id) do update
set email = excluded.email,
    encrypted_password = excluded.encrypted_password,
    email_confirmed_at = excluded.email_confirmed_at,
    raw_user_meta_data = excluded.raw_user_meta_data,
    updated_at = now();

insert into auth.identities (
  id,
  user_id,
  provider_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
select
  users.id,
  users.id,
  users.id::text,
  jsonb_build_object(
    'sub', users.id::text,
    'email', users.email,
    'email_verified', true,
    'phone_verified', false
  ),
  'email',
  now(),
  now(),
  now()
from auth.users users
where users.id in (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000102',
  '00000000-0000-0000-0000-000000000201',
  '00000000-0000-0000-0000-000000000202',
  '00000000-0000-0000-0000-000000000301',
  '00000000-0000-0000-0000-000000000302'
)
on conflict (provider_id, provider) do update
set identity_data = excluded.identity_data,
    last_sign_in_at = now(),
    updated_at = now();

insert into public.internal_admins (user_id, email)
values ('00000000-0000-0000-0000-000000000001', 'admin@nabaperks.test')
on conflict (user_id) do update
set email = excluded.email,
    is_active = true;

insert into public.merchants (
  id,
  owner_user_id,
  business_name,
  business_slug,
  business_type,
  email,
  phone,
  status
)
values
  (
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000101',
    'Old Crown Girton',
    'old-crown-girton',
    'cafe',
    'mia@old-crown-girton.test',
    '+447700900101',
    'active'
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000102',
    'Bubble Yard',
    'bubble-yard',
    'bubble_tea',
    'jordan@bubble-yard.test',
    '+447700900102',
    'trial'
  )
on conflict (id) do update
set business_name = excluded.business_name,
    business_slug = excluded.business_slug,
    business_type = excluded.business_type,
    email = excluded.email,
    phone = excluded.phone,
    status = excluded.status;

-- Old Crown Girton pilot venue: operator-supplied entrance coordinates, a 100m
-- soft radius for a small single-site venue, geofence on, and a merchant-placed
-- pin (coordinate provenance is recorded separately from address provenance).
insert into public.merchant_locations (
  id,
  merchant_id,
  name,
  address,
  address_line_1,
  address_line_2,
  address_city,
  address_postcode,
  address_country,
  address_source,
  latitude,
  longitude,
  geofence_radius_meters,
  require_geofence,
  geofence_pin_source,
  geofence_pin_updated_at
)
values
  (
    '11000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'Old Crown Girton',
    '89 High Street, Girton, Cambridge CB3 0QD',
    '89 High Street',
    'Girton',
    'Cambridge',
    'CB3 0QD',
    'United Kingdom',
    'manual_entry',
    52.2425913,
    0.0814946,
    100,
    true,
    'merchant_pin',
    now()
  )
on conflict (id) do update
set name = excluded.name,
    address = excluded.address,
    address_line_1 = excluded.address_line_1,
    address_line_2 = excluded.address_line_2,
    address_city = excluded.address_city,
    address_postcode = excluded.address_postcode,
    address_country = excluded.address_country,
    address_source = excluded.address_source,
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    geofence_radius_meters = excluded.geofence_radius_meters,
    require_geofence = excluded.require_geofence,
    geofence_pin_source = excluded.geofence_pin_source,
    geofence_pin_updated_at = excluded.geofence_pin_updated_at;

insert into public.merchant_locations (id, merchant_id, name, address)
values
  (
    '11000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002',
    'Camden Market Unit',
    'Unit 17, Camden Lock Place, London NW1 8AF'
  )
on conflict (id) do update
set name = excluded.name,
    address = excluded.address;

insert into public.loyalty_cards (
  id,
  merchant_id,
  location_id,
  card_name,
  stamps_required,
  reward_name,
  reward_terms,
  is_active
)
values
  (
    '13000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '11000000-0000-0000-0000-000000000001',
    'Morning Ritual Mystery Card',
    3,
    'Surprise reward',
    'Collect 3 qualifying visits to reveal a surprise reward, redeemable from the next UK business day.',
    true
  ),
  (
    '13000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002',
    '11000000-0000-0000-0000-000000000002',
    'Sip & Surprise Card',
    3,
    'Surprise reward',
    'Visit 3 times to unlock a mystery topping or upgrade. Redeemable from the next UK business day.',
    true
  )
on conflict (id) do update
set card_name = excluded.card_name,
    stamps_required = excluded.stamps_required,
    reward_name = excluded.reward_name,
    reward_terms = excluded.reward_terms,
    is_active = true;

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
    '13500000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '11000000-0000-0000-0000-000000000001',
    '13000000-0000-0000-0000-000000000001',
    'Free pint',
    'A pint of any cask ale or lager on the house. Valid from the next UK business day.',
    4,
    true,
    1
  ),
  (
    '13500000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    '11000000-0000-0000-0000-000000000001',
    '13000000-0000-0000-0000-000000000001',
    'Cake slice',
    'Any single cake slice from the counter. Valid from the next UK business day.',
    2,
    false,
    2
  ),
  (
    '13500000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000002',
    '11000000-0000-0000-0000-000000000002',
    '13000000-0000-0000-0000-000000000002',
    'Bubble tea topping',
    'One premium topping on any medium drink. Valid from the next UK business day.',
    3,
    true,
    1
  ),
  (
    '13500000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000001',
    '11000000-0000-0000-0000-000000000001',
    '13000000-0000-0000-0000-000000000001',
    '10% off Food',
    'Get 10% off food items. Valid from the next UK business day.',
    2,
    true,
    3
  ),
  (
    '13500000-0000-0000-0000-000000000005',
    '10000000-0000-0000-0000-000000000001',
    '11000000-0000-0000-0000-000000000001',
    '13000000-0000-0000-0000-000000000001',
    'Free Honey Toffee IceCream',
    'One free Honey Toffee IceCream. Valid from the next UK business day.',
    2,
    true,
    4
  ),
  (
    '13500000-0000-0000-0000-000000000006',
    '10000000-0000-0000-0000-000000000002',
    '11000000-0000-0000-0000-000000000002',
    '13000000-0000-0000-0000-000000000002',
    'Free jasmine tea',
    'One regular jasmine tea on the house. Valid from the next UK business day.',
    2,
    true,
    2
  ),
  (
    '13500000-0000-0000-0000-000000000007',
    '10000000-0000-0000-0000-000000000002',
    '11000000-0000-0000-0000-000000000002',
    '13000000-0000-0000-0000-000000000002',
    'Large drink upgrade',
    'Upgrade one regular drink to a large. Valid from the next UK business day.',
    2,
    true,
    3
  )
on conflict (id) do update
set reward_name = excluded.reward_name,
    reward_terms = excluded.reward_terms,
    weight = excluded.weight,
    is_active = excluded.is_active,
    display_order = excluded.display_order;

-- Reconcile venue-slug join QRs to the stable fixture ids before upserting.
delete from public.qr_codes
where qr_id in ('old-crown-girton', 'camden-market-unit')
  and id not in (
    '14000000-0000-0000-0000-000000000001',
    '14000000-0000-0000-0000-000000000002'
  );

insert into public.qr_codes (
  id,
  qr_id,
  merchant_id,
  location_id,
  loyalty_card_id,
  destination_type
)
values
  (
    '14000000-0000-0000-0000-000000000001',
    'old-crown-girton',
    '10000000-0000-0000-0000-000000000001',
    '11000000-0000-0000-0000-000000000001',
    '13000000-0000-0000-0000-000000000001',
    'join'
  ),
  (
    '14000000-0000-0000-0000-000000000002',
    'camden-market-unit',
    '10000000-0000-0000-0000-000000000002',
    '11000000-0000-0000-0000-000000000002',
    '13000000-0000-0000-0000-000000000002',
    'join'
  )
on conflict (id) do update
set qr_id = excluded.qr_id,
    merchant_id = excluded.merchant_id,
    location_id = excluded.location_id,
    loyalty_card_id = excluded.loyalty_card_id,
    destination_type = excluded.destination_type,
    is_active = true;

insert into public.billing_customers (
  id,
  merchant_id,
  stripe_customer_id,
  stripe_subscription_id,
  plan,
  status,
  current_period_end
)
values
  (
    '19000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'cus_seed_bean',
    'sub_seed_bean',
    'growth',
    'active',
    now() + interval '30 days'
  ),
  (
    '19000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002',
    'cus_seed_bubble',
    'sub_seed_bubble',
    'growth',
    'trialing',
    now() + interval '30 days'
  )
on conflict (id) do update
set status = excluded.status,
    current_period_end = excluded.current_period_end;

insert into public.customers (id, auth_user_id, email)
values
  (
    '15000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000301',
    'sam.taylor@example.test'
  ),
  (
    '15000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000302',
    'riley.morgan@example.test'
  )
on conflict (id) do update
set email = excluded.email;

insert into public.customer_memberships (
  id,
  merchant_id,
  customer_id,
  current_stamp_count,
  total_stamps_earned,
  last_visit_at
)
values
  (
    '16000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '15000000-0000-0000-0000-000000000001',
    2,
    2,
    now() - interval '1 day'
  ),
  (
    '16000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002',
    '15000000-0000-0000-0000-000000000002',
    2,
    2,
    now() - interval '1 day'
  )
on conflict (id) do update
set current_stamp_count = excluded.current_stamp_count,
    total_stamps_earned = excluded.total_stamps_earned,
    last_visit_at = excluded.last_visit_at;

delete from public.stamp_events
where metadata ->> 'source' in (
  'seed_rewards_ready_today',
  'seed_second_cycle_complete',
  'seed_two_of_three_stamps'
);

insert into public.stamp_events (
  id,
  merchant_id,
  customer_id,
  membership_id,
  loyalty_card_id,
  location_id,
  event_type,
  stamps_delta,
  earned_business_date
)
values
  (
    '17000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '15000000-0000-0000-0000-000000000001',
    '16000000-0000-0000-0000-000000000001',
    '13000000-0000-0000-0000-000000000001',
    '11000000-0000-0000-0000-000000000001',
    'earned',
    1,
    public.uk_business_date(now() - interval '2 days')
  ),
  (
    '17000000-0000-0000-0000-000000000011',
    '10000000-0000-0000-0000-000000000001',
    '15000000-0000-0000-0000-000000000001',
    '16000000-0000-0000-0000-000000000001',
    '13000000-0000-0000-0000-000000000001',
    '11000000-0000-0000-0000-000000000001',
    'earned',
    1,
    public.uk_business_date(now() - interval '1 day')
  ),
  (
    '17000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002',
    '15000000-0000-0000-0000-000000000002',
    '16000000-0000-0000-0000-000000000002',
    '13000000-0000-0000-0000-000000000002',
    '11000000-0000-0000-0000-000000000002',
    'earned',
    1,
    public.uk_business_date(now() - interval '2 days')
  ),
  (
    '17000000-0000-0000-0000-000000000012',
    '10000000-0000-0000-0000-000000000002',
    '15000000-0000-0000-0000-000000000002',
    '16000000-0000-0000-0000-000000000002',
    '13000000-0000-0000-0000-000000000002',
    '11000000-0000-0000-0000-000000000002',
    'earned',
    1,
    public.uk_business_date(now() - interval '1 day')
  )
on conflict (id) do update
set earned_business_date = excluded.earned_business_date,
    created_at = least(public.stamp_events.created_at, now() - interval '1 day');

insert into public.consent_records (
  id,
  merchant_id,
  customer_id,
  channel,
  consent_status,
  source,
  policy_version
)
values
  (
    '18000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '15000000-0000-0000-0000-000000000001',
    'email',
    'opted_in',
    'seed_qr_signup',
    '2026-06-foundation'
  ),
  (
    '18000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002',
    '15000000-0000-0000-0000-000000000002',
    'email',
    'opted_out',
    'seed_qr_signup',
    '2026-06-foundation'
  )
on conflict (id) do nothing;

insert into public.audit_logs (
  id,
  actor_type,
  actor_id,
  merchant_id,
  customer_id,
  target_table,
  target_id,
  action,
  metadata
)
values
  (
    '1a000000-0000-0000-0000-000000000001',
    'admin',
    '00000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '15000000-0000-0000-0000-000000000001',
    'customer_memberships',
    '16000000-0000-0000-0000-000000000001',
    'seed_admin_adjustment',
    '{"reason":"fixture audit readback"}'::jsonb
  )
on conflict (id) do nothing;

insert into public.fraud_flags (
  id,
  merchant_id,
  customer_id,
  membership_id,
  signal,
  severity,
  status,
  metadata
)
values
  (
    '1c000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002',
    '15000000-0000-0000-0000-000000000002',
    '16000000-0000-0000-0000-000000000002',
    'high_stamp_velocity',
    'medium',
    'open',
    '{"source":"seed","note":"Demo flag for admin review queue"}'::jsonb
  )
on conflict (id) do nothing;

insert into public.product_events (
  id,
  event_name,
  merchant_id,
  customer_id,
  membership_id,
  qr_code_id,
  actor_type,
  actor_id,
  metadata
)
values
  (
    '1b000000-0000-0000-0000-000000000001',
    'customer_joined',
    '10000000-0000-0000-0000-000000000001',
    '15000000-0000-0000-0000-000000000001',
    '16000000-0000-0000-0000-000000000001',
    '14000000-0000-0000-0000-000000000001',
    'customer',
    '00000000-0000-0000-0000-000000000301',
    '{"source":"seed"}'::jsonb
  ),
  (
    '1b000000-0000-0000-0000-000000000002',
    'stamp_issued',
    '10000000-0000-0000-0000-000000000001',
    '15000000-0000-0000-0000-000000000001',
    '16000000-0000-0000-0000-000000000001',
    '14000000-0000-0000-0000-000000000001',
    'staff',
    '12000000-0000-0000-0000-000000000001',
    '{"source":"seed"}'::jsonb
  ),
  (
    '1b000000-0000-0000-0000-000000000003',
    'qr_scanned',
    '10000000-0000-0000-0000-000000000001',
    null,
    null,
    '14000000-0000-0000-0000-000000000001',
    'customer',
    null,
    '{"source":"seed","device":"iphone-safari"}'::jsonb
  ),
  (
    '1b000000-0000-0000-0000-000000000004',
    'merchant_onboarding_completed',
    '10000000-0000-0000-0000-000000000001',
    null,
    null,
    null,
    'merchant',
    '00000000-0000-0000-0000-000000000101',
    '{"source":"seed","duration_minutes":4}'::jsonb
  ),
  (
    '1b000000-0000-0000-0000-000000000005',
    'customer_joined',
    '10000000-0000-0000-0000-000000000002',
    '15000000-0000-0000-0000-000000000002',
    '16000000-0000-0000-0000-000000000002',
    '14000000-0000-0000-0000-000000000002',
    'customer',
    '00000000-0000-0000-0000-000000000302',
    '{"source":"seed","marketing_opt_in":false}'::jsonb
  ),
  (
    '1b000000-0000-0000-0000-000000000006',
    'stamp_issued',
    '10000000-0000-0000-0000-000000000002',
    '15000000-0000-0000-0000-000000000002',
    '16000000-0000-0000-0000-000000000002',
    '14000000-0000-0000-0000-000000000002',
    'staff',
    '12000000-0000-0000-0000-000000000002',
    '{"source":"seed","visit_number":1}'::jsonb
  ),
  (
    '1b000000-0000-0000-0000-000000000007',
    'qr_scanned',
    '10000000-0000-0000-0000-000000000002',
    '15000000-0000-0000-0000-000000000002',
    '16000000-0000-0000-0000-000000000002',
    '14000000-0000-0000-0000-000000000002',
    'customer',
    '00000000-0000-0000-0000-000000000302',
    '{"source":"seed","returning_member":true}'::jsonb
  )
on conflict (id) do nothing;
