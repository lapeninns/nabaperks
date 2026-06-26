-- One-off fixture: amanshresthaaaaa@gmail.com on Old Crown Girton at 2/3 stamps.

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
values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000303',
  'authenticated',
  'authenticated',
  'amanshresthaaaaa@gmail.com',
  extensions.crypt('NabaperksDemo1!', extensions.gen_salt('bf')),
  now(),
  '',
  '',
  '',
  '',
  now() - interval '4 days',
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"name":"Aman Shrestha"}'::jsonb,
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
values (
  '00000000-0000-0000-0000-000000000303',
  '00000000-0000-0000-0000-000000000303',
  '00000000-0000-0000-0000-000000000303',
  jsonb_build_object(
    'sub', '00000000-0000-0000-0000-000000000303',
    'email', 'amanshresthaaaaa@gmail.com',
    'email_verified', true,
    'phone_verified', false
  ),
  'email',
  now(),
  now(),
  now()
)
on conflict (provider_id, provider) do update
set identity_data = excluded.identity_data,
    last_sign_in_at = now(),
    updated_at = now();

insert into public.customers (id, auth_user_id, email)
values (
  '15000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000303',
  'amanshresthaaaaa@gmail.com'
)
on conflict (id) do update
set email = excluded.email,
    auth_user_id = excluded.auth_user_id;

insert into public.customer_memberships (
  id,
  merchant_id,
  customer_id,
  current_stamp_count,
  total_stamps_earned,
  last_visit_at,
  created_at
)
values (
  '16000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000001',
  '15000000-0000-0000-0000-000000000003',
  2,
  2,
  now() - interval '1 day',
  now() - interval '4 days'
)
on conflict (id) do update
set current_stamp_count = excluded.current_stamp_count,
    total_stamps_earned = excluded.total_stamps_earned,
    last_visit_at = excluded.last_visit_at,
    created_at = excluded.created_at;

delete from public.stamp_events
where membership_id = '16000000-0000-0000-0000-000000000003';

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
    '17000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000001',
    '15000000-0000-0000-0000-000000000003',
    '16000000-0000-0000-0000-000000000003',
    '13000000-0000-0000-0000-000000000001',
    '11000000-0000-0000-0000-000000000001',
    'earned',
    1,
    public.uk_business_date(now() - interval '3 days'),
    now() - interval '3 days'
  ),
  (
    '17000000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000001',
    '15000000-0000-0000-0000-000000000003',
    '16000000-0000-0000-0000-000000000003',
    '13000000-0000-0000-0000-000000000001',
    '11000000-0000-0000-0000-000000000001',
    'earned',
    1,
    public.uk_business_date(now() - interval '1 day'),
    now() - interval '1 day'
  )
on conflict (id) do update
set earned_business_date = excluded.earned_business_date,
    created_at = excluded.created_at;

insert into public.consent_records (
  id,
  merchant_id,
  customer_id,
  channel,
  consent_status,
  source,
  policy_version
)
values (
  '18000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000001',
  '15000000-0000-0000-0000-000000000003',
  'email',
  'opted_in',
  'manual_seed',
  '2026-06-foundation'
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
  metadata,
  created_at
)
values
  (
    '1b000000-0000-0000-0000-000000000040',
    'qr_scanned',
    '10000000-0000-0000-0000-000000000001',
    null,
    null,
    '14000000-0000-0000-0000-000000000001',
    'customer',
    '00000000-0000-0000-0000-000000000303',
    '{"available":true,"destination_type":"join","device":"iphone-safari"}'::jsonb,
    now() - interval '4 days'
  ),
  (
    '1b000000-0000-0000-0000-000000000041',
    'customer_joined',
    '10000000-0000-0000-0000-000000000001',
    '15000000-0000-0000-0000-000000000003',
    '16000000-0000-0000-0000-000000000003',
    '14000000-0000-0000-0000-000000000001',
    'customer',
    '00000000-0000-0000-0000-000000000303',
    '{"marketing_opt_in":true,"source":"manual_seed"}'::jsonb,
    now() - interval '4 days' + interval '3 minutes'
  ),
  (
    '1b000000-0000-0000-0000-000000000042',
    'stamp_claim_started',
    '10000000-0000-0000-0000-000000000001',
    '15000000-0000-0000-0000-000000000003',
    '16000000-0000-0000-0000-000000000003',
    null,
    'customer',
    '16000000-0000-0000-0000-000000000003',
    '{"source":"manual_seed","visit_number":1}'::jsonb,
    now() - interval '3 days' + interval '15 minutes'
  ),
  (
    '1b000000-0000-0000-0000-000000000043',
    'stamp_issued',
    '10000000-0000-0000-0000-000000000001',
    '15000000-0000-0000-0000-000000000003',
    '16000000-0000-0000-0000-000000000003',
    '14000000-0000-0000-0000-000000000001',
    'staff',
    '12000000-0000-0000-0000-000000000001',
    jsonb_build_object(
      'new_stamp_count', 1,
      'business_date', public.uk_business_date(now() - interval '3 days')::text
    ),
    now() - interval '3 days' + interval '17 minutes'
  ),
  (
    '1b000000-0000-0000-0000-000000000044',
    'stamp_claim_started',
    '10000000-0000-0000-0000-000000000001',
    '15000000-0000-0000-0000-000000000003',
    '16000000-0000-0000-0000-000000000003',
    null,
    'customer',
    '16000000-0000-0000-0000-000000000003',
    '{"source":"manual_seed","visit_number":2}'::jsonb,
    now() - interval '1 day' + interval '5 minutes'
  ),
  (
    '1b000000-0000-0000-0000-000000000045',
    'stamp_issued',
    '10000000-0000-0000-0000-000000000001',
    '15000000-0000-0000-0000-000000000003',
    '16000000-0000-0000-0000-000000000003',
    null,
    'staff',
    '12000000-0000-0000-0000-000000000001',
    jsonb_build_object(
      'new_stamp_count', 2,
      'business_date', public.uk_business_date(now() - interval '1 day')::text
    ),
    now() - interval '1 day' + interval '7 minutes'
  ),
  (
    '1b000000-0000-0000-0000-000000000046',
    'stamp_claim_started',
    '10000000-0000-0000-0000-000000000001',
    '15000000-0000-0000-0000-000000000003',
    '16000000-0000-0000-0000-000000000003',
    null,
    'customer',
    '16000000-0000-0000-0000-000000000003',
    '{"source":"manual_seed","visit_number":3}'::jsonb,
    now() - interval '10 minutes'
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
