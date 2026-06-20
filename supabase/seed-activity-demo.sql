-- Rich Old Crown Girton fixtures for dashboard, customers, and activity log demos.
-- Safe to re-run: uses stable IDs with on conflict do update.

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
    '00000000-0000-0000-0000-000000000304',
    'authenticated',
    'authenticated',
    'priya.patel@example.test',
    extensions.crypt('NabaperksDemo1!', extensions.gen_salt('bf')),
    now(),
    '', '', '', '',
    now() - interval '8 days',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Priya Patel"}'::jsonb,
    false
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000305',
    'authenticated',
    'authenticated',
    'james.wright@example.test',
    extensions.crypt('NabaperksDemo1!', extensions.gen_salt('bf')),
    now(),
    '', '', '', '',
    now() - interval '3 hours',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"James Wright"}'::jsonb,
    false
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000306',
    'authenticated',
    'authenticated',
    'fiona.okonkwo@example.test',
    extensions.crypt('NabaperksDemo1!', extensions.gen_salt('bf')),
    now(),
    '', '', '', '',
    now() - interval '12 days',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Fiona Okonkwo"}'::jsonb,
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
  '00000000-0000-0000-0000-000000000304',
  '00000000-0000-0000-0000-000000000305',
  '00000000-0000-0000-0000-000000000306'
)
on conflict (provider_id, provider) do update
set identity_data = excluded.identity_data,
    last_sign_in_at = now(),
    updated_at = now();

insert into public.customers (id, auth_user_id, email, phone)
values
  (
    '15000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000304',
    'priya.patel@example.test',
    '+447700900201'
  ),
  (
    '15000000-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000305',
    'james.wright@example.test',
    null
  ),
  (
    '15000000-0000-0000-0000-000000000006',
    '00000000-0000-0000-0000-000000000306',
    'fiona.okonkwo@example.test',
    null
  )
on conflict (id) do update
set email = excluded.email,
    phone = excluded.phone,
    auth_user_id = excluded.auth_user_id;

insert into public.customer_memberships (
  id,
  merchant_id,
  customer_id,
  current_stamp_count,
  total_stamps_earned,
  total_rewards_redeemed,
  last_visit_at,
  created_at
)
values
  (
    '16000000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000001',
    '15000000-0000-0000-0000-000000000004',
    2,
    2,
    0,
    now() - interval '1 day',
    now() - interval '8 days'
  ),
  (
    '16000000-0000-0000-0000-000000000005',
    '10000000-0000-0000-0000-000000000001',
    '15000000-0000-0000-0000-000000000005',
    2,
    2,
    0,
    now() - interval '1 day',
    now() - interval '3 hours'
  ),
  (
    '16000000-0000-0000-0000-000000000006',
    '10000000-0000-0000-0000-000000000001',
    '15000000-0000-0000-0000-000000000006',
    2,
    5,
    1,
    now() - interval '1 day',
    now() - interval '12 days'
  )
on conflict (id) do update
set current_stamp_count = excluded.current_stamp_count,
    total_stamps_earned = excluded.total_stamps_earned,
    total_rewards_redeemed = excluded.total_rewards_redeemed,
    last_visit_at = excluded.last_visit_at,
    created_at = excluded.created_at;

insert into public.stamp_events (
  id,
  merchant_id,
  customer_id,
  membership_id,
  loyalty_card_id,
  location_id,
  event_type,
  stamps_delta,
  earned_business_date,
  created_at
)
values
  (
    '17000000-0000-0000-0000-000000000005',
    '10000000-0000-0000-0000-000000000001',
    '15000000-0000-0000-0000-000000000004',
    '16000000-0000-0000-0000-000000000004',
    '13000000-0000-0000-0000-000000000001',
    '11000000-0000-0000-0000-000000000001',
    'earned',
    1,
    public.uk_business_date(now() - interval '7 days'),
    now() - interval '7 days'
  ),
  (
    '17000000-0000-0000-0000-000000000006',
    '10000000-0000-0000-0000-000000000001',
    '15000000-0000-0000-0000-000000000006',
    '16000000-0000-0000-0000-000000000006',
    '13000000-0000-0000-0000-000000000001',
    '11000000-0000-0000-0000-000000000001',
    'earned',
    1,
    public.uk_business_date(now() - interval '10 days'),
    now() - interval '10 days'
  ),
  (
    '17000000-0000-0000-0000-000000000007',
    '10000000-0000-0000-0000-000000000001',
    '15000000-0000-0000-0000-000000000006',
    '16000000-0000-0000-0000-000000000006',
    '13000000-0000-0000-0000-000000000001',
    '11000000-0000-0000-0000-000000000001',
    'earned',
    1,
    public.uk_business_date(now() - interval '8 days'),
    now() - interval '8 days'
  ),
  (
    '17000000-0000-0000-0000-000000000008',
    '10000000-0000-0000-0000-000000000001',
    '15000000-0000-0000-0000-000000000006',
    '16000000-0000-0000-0000-000000000006',
    '13000000-0000-0000-0000-000000000001',
    '11000000-0000-0000-0000-000000000001',
    'earned',
    1,
    public.uk_business_date(now() - interval '6 days'),
    now() - interval '6 days'
  )
on conflict (id) do update
set earned_business_date = excluded.earned_business_date,
    created_at = excluded.created_at;

insert into public.reward_events (
  id,
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
  redeemed_at,
  created_at
)
values (
  '17500000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '15000000-0000-0000-0000-000000000006',
  '16000000-0000-0000-0000-000000000006',
  '13000000-0000-0000-0000-000000000001',
  '13500000-0000-0000-0000-000000000001',
  'Coffee upgrade',
  'Free size upgrade on any hot drink. Valid from the next UK business day.',
  350,
  public.uk_business_date(now() - interval '5 days'),
  'redeemed',
  now() - interval '1 day',
  now() - interval '6 days'
)
on conflict (id) do update
set status = excluded.status,
    redeemed_at = excluded.redeemed_at;

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
    '18000000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000001',
    '15000000-0000-0000-0000-000000000004',
    'email',
    'opted_in',
    'seed_qr_signup',
    '2026-06-mvp'
  ),
  (
    '18000000-0000-0000-0000-000000000005',
    '10000000-0000-0000-0000-000000000001',
    '15000000-0000-0000-0000-000000000005',
    'email',
    'opted_out',
    'seed_qr_signup',
    '2026-06-mvp'
  ),
  (
    '18000000-0000-0000-0000-000000000006',
    '10000000-0000-0000-0000-000000000001',
    '15000000-0000-0000-0000-000000000006',
    'email',
    'opted_in',
    'seed_qr_signup',
    '2026-06-mvp'
  )
on conflict (id) do nothing;

-- Replace sparse Old Crown Girton product events with a realistic activity timeline.
delete from public.product_events
where merchant_id = '10000000-0000-0000-0000-000000000001'
  and id::text like '1b000000-%';

insert into public.product_events (
  id,
  event_name,
  merchant_id,
  customer_id,
  membership_id,
  qr_code_id,
  actor_type,
  actor_id,
  metadata,
  created_at
)
values
  (
    '1b000000-0000-0000-0000-000000000010',
    'merchant_signed_up',
    '10000000-0000-0000-0000-000000000001',
    null,
    null,
    null,
    'merchant',
    '00000000-0000-0000-0000-000000000101',
    '{"source":"onboarding","duration_minutes":6}'::jsonb,
    now() - interval '14 days'
  ),
  (
    '1b000000-0000-0000-0000-000000000011',
    'loyalty_card_created',
    '10000000-0000-0000-0000-000000000001',
    null,
    null,
    null,
    'merchant',
    '00000000-0000-0000-0000-000000000101',
    '{"loyalty_card_id":"13000000-0000-0000-0000-000000000001","is_active":true}'::jsonb,
    now() - interval '14 days' + interval '8 minutes'
  ),
  (
    '1b000000-0000-0000-0000-000000000012',
    'qr_created',
    '10000000-0000-0000-0000-000000000001',
    null,
    null,
    '14000000-0000-0000-0000-000000000001',
    'merchant',
    '00000000-0000-0000-0000-000000000101',
    '{"destination_type":"join"}'::jsonb,
    now() - interval '14 days' + interval '12 minutes'
  ),
  (
    '1b000000-0000-0000-0000-000000000013',
    'subscription_started',
    '10000000-0000-0000-0000-000000000001',
    null,
    null,
    null,
    'system',
    null,
    '{"plan":"growth","status":"active","source":"seed"}'::jsonb,
    now() - interval '14 days' + interval '20 minutes'
  ),
  (
    '1b000000-0000-0000-0000-000000000039',
    'staff_session_started',
    '10000000-0000-0000-0000-000000000001',
    null,
    null,
    null,
    'staff',
    '12000000-0000-0000-0000-000000000001',
    jsonb_build_object(
      'station_id', '1d000000-0000-0000-0000-000000000001'
    ),
    now() - interval '14 days' + interval '22 minutes'
  ),
  (
    '1b000000-0000-0000-0000-000000000014',
    'qr_downloaded',
    '10000000-0000-0000-0000-000000000001',
    null,
    null,
    '14000000-0000-0000-0000-000000000001',
    'merchant',
    '00000000-0000-0000-0000-000000000101',
    '{"asset_type":"poster"}'::jsonb,
    now() - interval '13 days'
  ),
  (
    '1b000000-0000-0000-0000-000000000015',
    'qr_downloaded',
    '10000000-0000-0000-0000-000000000001',
    null,
    null,
    '14000000-0000-0000-0000-000000000001',
    'merchant',
    '00000000-0000-0000-0000-000000000101',
    '{"asset_type":"sticker"}'::jsonb,
    now() - interval '13 days' + interval '4 minutes'
  ),
  (
    '1b000000-0000-0000-0000-000000000016',
    'qr_scanned',
    '10000000-0000-0000-0000-000000000001',
    null,
    null,
    '14000000-0000-0000-0000-000000000001',
    'customer',
    null,
    '{"available":true,"destination_type":"join","device":"iphone-safari"}'::jsonb,
    now() - interval '12 days'
  ),
  (
    '1b000000-0000-0000-0000-000000000017',
    'customer_joined',
    '10000000-0000-0000-0000-000000000001',
    '15000000-0000-0000-0000-000000000001',
    '16000000-0000-0000-0000-000000000001',
    '14000000-0000-0000-0000-000000000001',
    'customer',
    '00000000-0000-0000-0000-000000000301',
    '{"marketing_opt_in":true,"source":"seed"}'::jsonb,
    now() - interval '12 days' + interval '2 minutes'
  ),
  (
    '1b000000-0000-0000-0000-000000000018',
    'stamp_claim_started',
    '10000000-0000-0000-0000-000000000001',
    '15000000-0000-0000-0000-000000000001',
    '16000000-0000-0000-0000-000000000001',
    null,
    'customer',
    '16000000-0000-0000-0000-000000000001',
    '{"source":"seed"}'::jsonb,
    now() - interval '11 days'
  ),
  (
    '1b000000-0000-0000-0000-000000000019',
    'stamp_issued',
    '10000000-0000-0000-0000-000000000001',
    '15000000-0000-0000-0000-000000000001',
    '16000000-0000-0000-0000-000000000001',
    '14000000-0000-0000-0000-000000000001',
    'staff',
    '12000000-0000-0000-0000-000000000001',
    jsonb_build_object(
      'new_stamp_count', 1,
      'business_date', public.uk_business_date(now() - interval '11 days')::text
    ),
    now() - interval '11 days' + interval '1 minute'
  ),
  (
    '1b000000-0000-0000-0000-000000000020',
    'qr_scanned',
    '10000000-0000-0000-0000-000000000001',
    '15000000-0000-0000-0000-000000000006',
    '16000000-0000-0000-0000-000000000006',
    '14000000-0000-0000-0000-000000000001',
    'customer',
    '00000000-0000-0000-0000-000000000306',
    '{"available":true,"destination_type":"join","returning_member":false}'::jsonb,
    now() - interval '12 days' + interval '30 minutes'
  ),
  (
    '1b000000-0000-0000-0000-000000000021',
    'customer_joined',
    '10000000-0000-0000-0000-000000000001',
    '15000000-0000-0000-0000-000000000006',
    '16000000-0000-0000-0000-000000000006',
    '14000000-0000-0000-0000-000000000001',
    'customer',
    '00000000-0000-0000-0000-000000000306',
    '{"marketing_opt_in":true,"source":"seed"}'::jsonb,
    now() - interval '12 days' + interval '32 minutes'
  ),
  (
    '1b000000-0000-0000-0000-000000000022',
    'stamp_claim_started',
    '10000000-0000-0000-0000-000000000001',
    '15000000-0000-0000-0000-000000000006',
    '16000000-0000-0000-0000-000000000006',
    null,
    'customer',
    '16000000-0000-0000-0000-000000000006',
    '{"source":"seed"}'::jsonb,
    now() - interval '10 days'
  ),
  (
    '1b000000-0000-0000-0000-000000000023',
    'stamp_issued',
    '10000000-0000-0000-0000-000000000001',
    '15000000-0000-0000-0000-000000000006',
    '16000000-0000-0000-0000-000000000006',
    null,
    'staff',
    '12000000-0000-0000-0000-000000000001',
    jsonb_build_object(
      'new_stamp_count', 1,
      'business_date', public.uk_business_date(now() - interval '10 days')::text
    ),
    now() - interval '10 days' + interval '2 minutes'
  ),
  (
    '1b000000-0000-0000-0000-000000000024',
    'stamp_issued',
    '10000000-0000-0000-0000-000000000001',
    '15000000-0000-0000-0000-000000000006',
    '16000000-0000-0000-0000-000000000006',
    null,
    'staff',
    '12000000-0000-0000-0000-000000000001',
    jsonb_build_object(
      'new_stamp_count', 2,
      'business_date', public.uk_business_date(now() - interval '8 days')::text
    ),
    now() - interval '8 days'
  ),
  (
    '1b000000-0000-0000-0000-000000000025',
    'stamp_issued',
    '10000000-0000-0000-0000-000000000001',
    '15000000-0000-0000-0000-000000000006',
    '16000000-0000-0000-0000-000000000006',
    null,
    'staff',
    '12000000-0000-0000-0000-000000000001',
    jsonb_build_object(
      'new_stamp_count', 3,
      'business_date', public.uk_business_date(now() - interval '6 days')::text
    ),
    now() - interval '6 days'
  ),
  (
    '1b000000-0000-0000-0000-000000000040',
    'staff_session_started',
    '10000000-0000-0000-0000-000000000001',
    null,
    null,
    null,
    'staff',
    '12000000-0000-0000-0000-000000000001',
    jsonb_build_object(
      'station_id', '1d000000-0000-0000-0000-000000000001'
    ),
    now() - interval '9 days'
  ),
  (
    '1b000000-0000-0000-0000-000000000026',
    'reward_unlocked',
    '10000000-0000-0000-0000-000000000001',
    '15000000-0000-0000-0000-000000000006',
    '16000000-0000-0000-0000-000000000006',
    null,
    'system',
    null,
    jsonb_build_object(
      'loyalty_card_id', '13000000-0000-0000-0000-000000000001',
      'reward_pool_item_id', '13500000-0000-0000-0000-000000000001',
      'reward_name', 'Coffee upgrade'
    ),
    now() - interval '6 days' + interval '1 minute'
  ),
  (
    '1b000000-0000-0000-0000-000000000027',
    'customer_joined',
    '10000000-0000-0000-0000-000000000001',
    '15000000-0000-0000-0000-000000000004',
    '16000000-0000-0000-0000-000000000004',
    '14000000-0000-0000-0000-000000000001',
    'customer',
    '00000000-0000-0000-0000-000000000304',
    '{"marketing_opt_in":true,"source":"seed"}'::jsonb,
    now() - interval '8 days'
  ),
  (
    '1b000000-0000-0000-0000-000000000028',
    'stamp_claim_started',
    '10000000-0000-0000-0000-000000000001',
    '15000000-0000-0000-0000-000000000004',
    '16000000-0000-0000-0000-000000000004',
    null,
    'customer',
    '16000000-0000-0000-0000-000000000004',
    '{"source":"seed"}'::jsonb,
    now() - interval '7 days' + interval '10 minutes'
  ),
  (
    '1b000000-0000-0000-0000-000000000029',
    'stamp_issued',
    '10000000-0000-0000-0000-000000000001',
    '15000000-0000-0000-0000-000000000004',
    '16000000-0000-0000-0000-000000000004',
    null,
    'staff',
    '12000000-0000-0000-0000-000000000001',
    jsonb_build_object(
      'new_stamp_count', 1,
      'business_date', public.uk_business_date(now() - interval '7 days')::text
    ),
    now() - interval '7 days' + interval '12 minutes'
  ),
  (
    '1b000000-0000-0000-0000-000000000030',
    'stamp_claim_started',
    '10000000-0000-0000-0000-000000000001',
    '15000000-0000-0000-0000-000000000001',
    '16000000-0000-0000-0000-000000000001',
    null,
    'customer',
    '16000000-0000-0000-0000-000000000001',
    '{"source":"seed","visit_number":2}'::jsonb,
    now() - interval '5 days'
  ),
  (
    '1b000000-0000-0000-0000-000000000031',
    'stamp_issued',
    '10000000-0000-0000-0000-000000000001',
    '15000000-0000-0000-0000-000000000001',
    '16000000-0000-0000-0000-000000000001',
    null,
    'staff',
    '12000000-0000-0000-0000-000000000001',
    jsonb_build_object(
      'new_stamp_count', 2,
      'business_date', public.uk_business_date(now() - interval '5 days')::text
    ),
    now() - interval '5 days' + interval '2 minutes'
  ),
  (
    '1b000000-0000-0000-0000-000000000032',
    'qr_downloaded',
    '10000000-0000-0000-0000-000000000001',
    null,
    null,
    '14000000-0000-0000-0000-000000000001',
    'merchant',
    '00000000-0000-0000-0000-000000000101',
    '{"asset_type":"till_card"}'::jsonb,
    now() - interval '2 days'
  ),
  (
    '1b000000-0000-0000-0000-000000000042',
    'subscription_cancelled',
    '10000000-0000-0000-0000-000000000001',
    null,
    null,
    null,
    'system',
    null,
    jsonb_build_object(
      'plan', 'growth',
      'status', 'cancelled',
      'stripe_subscription_id', 'sub_seed_bean_cancelled_demo',
      'source', 'seed'
    ),
    now() - interval '2 days' + interval '30 minutes'
  ),
  (
    '1b000000-0000-0000-0000-000000000033',
    'reward_redeemed',
    '10000000-0000-0000-0000-000000000001',
    '15000000-0000-0000-0000-000000000006',
    '16000000-0000-0000-0000-000000000006',
    null,
    'staff',
    '12000000-0000-0000-0000-000000000001',
    jsonb_build_object(
      'reward_id', '17500000-0000-0000-0000-000000000001',
      'reward_name', 'Coffee upgrade',
      'new_stamp_count', 0
    ),
    now() - interval '1 day'
  ),
  (
    '1b000000-0000-0000-0000-000000000041',
    'staff_session_started',
    '10000000-0000-0000-0000-000000000001',
    null,
    null,
    null,
    'staff',
    '12000000-0000-0000-0000-000000000001',
    jsonb_build_object(
      'station_id', '1d000000-0000-0000-0000-000000000001'
    ),
    now() - interval '19 hours'
  ),
  (
    '1b000000-0000-0000-0000-000000000034',
    'loyalty_card_updated',
    '10000000-0000-0000-0000-000000000001',
    null,
    null,
    null,
    'merchant',
    '00000000-0000-0000-0000-000000000101',
    '{"loyalty_card_id":"13000000-0000-0000-0000-000000000001","is_active":true}'::jsonb,
    now() - interval '20 hours'
  ),
  (
    '1b000000-0000-0000-0000-000000000035',
    'qr_scanned',
    '10000000-0000-0000-0000-000000000001',
    null,
    null,
    '14000000-0000-0000-0000-000000000001',
    'customer',
    null,
    '{"available":true,"destination_type":"join","device":"android-chrome"}'::jsonb,
    now() - interval '3 hours' + interval '10 minutes'
  ),
  (
    '1b000000-0000-0000-0000-000000000036',
    'customer_joined',
    '10000000-0000-0000-0000-000000000001',
    '15000000-0000-0000-0000-000000000005',
    '16000000-0000-0000-0000-000000000005',
    '14000000-0000-0000-0000-000000000001',
    'customer',
    '00000000-0000-0000-0000-000000000305',
    '{"marketing_opt_in":false,"source":"seed"}'::jsonb,
    now() - interval '3 hours'
  ),
  (
    '1b000000-0000-0000-0000-000000000037',
    'qr_scanned',
    '10000000-0000-0000-0000-000000000001',
    '15000000-0000-0000-0000-000000000001',
    '16000000-0000-0000-0000-000000000001',
    '14000000-0000-0000-0000-000000000001',
    'customer',
    '00000000-0000-0000-0000-000000000301',
    '{"available":true,"destination_type":"join","returning_member":true}'::jsonb,
    now() - interval '45 minutes'
  ),
  (
    '1b000000-0000-0000-0000-000000000038',
    'stamp_claim_started',
    '10000000-0000-0000-0000-000000000001',
    '15000000-0000-0000-0000-000000000001',
    '16000000-0000-0000-0000-000000000001',
    null,
    'customer',
    '16000000-0000-0000-0000-000000000001',
    '{"source":"seed","visit_number":3}'::jsonb,
    now() - interval '20 minutes'
  )
on conflict (id) do update
set event_name = excluded.event_name,
    customer_id = excluded.customer_id,
    membership_id = excluded.membership_id,
    qr_code_id = excluded.qr_code_id,
    actor_type = excluded.actor_type,
    actor_id = excluded.actor_id,
    metadata = excluded.metadata,
    created_at = excluded.created_at;

-- Enrich Bubble Yard with a couple of readable account events.
insert into public.product_events (
  id,
  event_name,
  merchant_id,
  customer_id,
  membership_id,
  qr_code_id,
  actor_type,
  actor_id,
  metadata,
  created_at
)
values
  (
    '1b000000-0000-0000-0000-000000000003',
    'qr_scanned',
    '10000000-0000-0000-0000-000000000002',
    '15000000-0000-0000-0000-000000000002',
    '16000000-0000-0000-0000-000000000002',
    '14000000-0000-0000-0000-000000000002',
    'customer',
    '00000000-0000-0000-0000-000000000302',
    '{"available":true,"destination_type":"join","returning_member":true}'::jsonb,
    now() - interval '2 days'
  ),
  (
    '1b000000-0000-0000-0000-000000000004',
    'merchant_signed_up',
    '10000000-0000-0000-0000-000000000002',
    null,
    null,
    null,
    'merchant',
    '00000000-0000-0000-0000-000000000102',
    '{"source":"onboarding"}'::jsonb,
    now() - interval '10 days'
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
    '{"marketing_opt_in":false,"source":"seed"}'::jsonb,
    now() - interval '9 days'
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
    jsonb_build_object(
      'new_stamp_count', 1,
      'business_date', public.uk_business_date(now() - interval '1 day')::text
    ),
    now() - interval '1 day'
  )
on conflict (id) do update
set metadata = excluded.metadata,
    created_at = excluded.created_at;
