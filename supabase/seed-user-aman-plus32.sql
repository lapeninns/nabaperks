-- Local dev fixture: amanshresthaaaaa+32@gmail.com owns Old Crown Girton
-- (including any stress-seed members on merchant 10000000-...-000001).
-- Password: NabaperksDemo1!

begin;

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
  '00000000-0000-0000-0000-000000000304',
  'authenticated',
  'authenticated',
  'amanshresthaaaaa+32@gmail.com',
  extensions.crypt('NabaperksDemo1!', extensions.gen_salt('bf')),
  now(),
  '',
  '',
  '',
  '',
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"name":"Aman Shrestha"}'::jsonb,
  false
)
on conflict (id) do update
set
  email = excluded.email,
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
  '00000000-0000-0000-0000-000000000304',
  '00000000-0000-0000-0000-000000000304',
  '00000000-0000-0000-0000-000000000304',
  jsonb_build_object(
    'sub', '00000000-0000-0000-0000-000000000304',
    'email', 'amanshresthaaaaa+32@gmail.com',
    'email_verified', true,
    'phone_verified', false
  ),
  'email',
  now(),
  now(),
  now()
)
on conflict (provider_id, provider) do update
set
  identity_data = excluded.identity_data,
  last_sign_in_at = now(),
  updated_at = now();

update public.merchants
set
  owner_user_id = '00000000-0000-0000-0000-000000000304',
  email = 'amanshresthaaaaa+32@gmail.com',
  status = 'active',
  updated_at = now()
where id = '10000000-0000-0000-0000-000000000001';

insert into public.billing_customers (
  id,
  merchant_id,
  stripe_customer_id,
  stripe_subscription_id,
  plan,
  status,
  current_period_end
)
values (
  '19000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'cus_seed_aman_plus32',
  'sub_seed_aman_plus32',
  'growth',
  'trialing',
  now() + interval '30 days'
)
on conflict (id) do update
set
  stripe_customer_id = excluded.stripe_customer_id,
  stripe_subscription_id = excluded.stripe_subscription_id,
  status = excluded.status,
  current_period_end = excluded.current_period_end,
  updated_at = now();

commit;
