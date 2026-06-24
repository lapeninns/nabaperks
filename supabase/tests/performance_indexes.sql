begin;

set local request.jwt.claim.role = 'service_role';

do $$
declare
  required_index text;
  required_function text;
begin
  foreach required_index in array array[
    'public.product_events_merchant_event_created_at_idx',
    'public.product_events_customer_event_created_at_idx',
    'public.reward_events_membership_status_created_at_idx',
    'public.stamp_events_merchant_earned_created_at_idx',
    'public.reward_events_merchant_redeemed_created_at_idx'
  ]
  loop
    if to_regclass(required_index) is null then
      raise exception 'missing performance index: %', required_index;
    end if;
  end loop;

  foreach required_function in array array[
    'public.get_merchant_dashboard_metrics(uuid)',
    'public.get_product_event_counts(text[])'
  ]
  loop
    if to_regprocedure(required_function) is null then
      raise exception 'missing performance RPC: %', required_function;
    end if;
  end loop;
end $$;

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
  '00000000-0000-0000-0000-00000000f501',
  'authenticated',
  'authenticated',
  'perf-rpc-owner@nabaperks.test',
  extensions.crypt('NabaperksDemo1!', extensions.gen_salt('bf')),
  now(),
  '',
  '',
  '',
  '',
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"name":"Perf RPC Owner"}'::jsonb,
  false
);

insert into public.merchants (
  id,
  owner_user_id,
  business_name,
  business_slug,
  business_type,
  email,
  average_order_value_pence,
  estimated_gross_margin_bps,
  reward_cost_pence,
  status
)
values (
  '10000000-0000-0000-0000-00000000f501',
  '00000000-0000-0000-0000-00000000f501',
  'Performance RPC Cafe',
  'performance-rpc-cafe',
  'cafe',
  'perf-rpc-owner@nabaperks.test',
  1200,
  6500,
  250,
  'trial'
);

insert into public.merchant_locations (id, merchant_id, name)
values (
  '11000000-0000-0000-0000-00000000f501',
  '10000000-0000-0000-0000-00000000f501',
  'Main counter'
);

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
values (
  '13000000-0000-0000-0000-00000000f501',
  '10000000-0000-0000-0000-00000000f501',
  '11000000-0000-0000-0000-00000000f501',
  'Performance card',
  3,
  'Coffee upgrade',
  'Valid on one hot drink.',
  true
);

insert into public.customers (id, auth_user_id, phone_hmac, phone_last4, phone_country)
values
  (
    '15000000-0000-0000-0000-00000000f501',
    null,
    'perf-rpc-hmac-1',
    '0501',
    'GB'
  ),
  (
    '15000000-0000-0000-0000-00000000f502',
    null,
    'perf-rpc-hmac-2',
    '0502',
    'GB'
  );

insert into public.customer_memberships (
  id,
  merchant_id,
  customer_id,
  current_stamp_count,
  total_stamps_earned,
  total_rewards_redeemed,
  created_at
)
values
  (
    '16000000-0000-0000-0000-00000000f501',
    '10000000-0000-0000-0000-00000000f501',
    '15000000-0000-0000-0000-00000000f501',
    2,
    4,
    1,
    now() - interval '1 day'
  ),
  (
    '16000000-0000-0000-0000-00000000f502',
    '10000000-0000-0000-0000-00000000f501',
    '15000000-0000-0000-0000-00000000f502',
    1,
    1,
    0,
    now() - interval '10 days'
  );

insert into public.billing_customers (
  merchant_id,
  stripe_customer_id,
  stripe_subscription_id,
  status
)
values (
  '10000000-0000-0000-0000-00000000f501',
  'cus_perf_rpc',
  'sub_perf_rpc',
  'active'
);

insert into public.stamp_events (
  merchant_id,
  customer_id,
  membership_id,
  loyalty_card_id,
  location_id,
  event_type,
  stamps_delta,
  earned_business_date,
  cycle_number
)
values
  (
    '10000000-0000-0000-0000-00000000f501',
    '15000000-0000-0000-0000-00000000f501',
    '16000000-0000-0000-0000-00000000f501',
    '13000000-0000-0000-0000-00000000f501',
    '11000000-0000-0000-0000-00000000f501',
    'earned',
    1,
    public.uk_business_date(now()) - 2,
    1
  ),
  (
    '10000000-0000-0000-0000-00000000f501',
    '15000000-0000-0000-0000-00000000f501',
    '16000000-0000-0000-0000-00000000f501',
    '13000000-0000-0000-0000-00000000f501',
    '11000000-0000-0000-0000-00000000f501',
    'earned',
    1,
    public.uk_business_date(now()) - 1,
    1
  ),
  (
    '10000000-0000-0000-0000-00000000f501',
    '15000000-0000-0000-0000-00000000f502',
    '16000000-0000-0000-0000-00000000f502',
    '13000000-0000-0000-0000-00000000f501',
    '11000000-0000-0000-0000-00000000f501',
    'earned',
    1,
    public.uk_business_date(now()) - 1,
    1
  );

insert into public.reward_events (
  merchant_id,
  customer_id,
  membership_id,
  loyalty_card_id,
  status,
  reward_name,
  reward_terms,
)
values
  (
    '10000000-0000-0000-0000-00000000f501',
    '15000000-0000-0000-0000-00000000f501',
    '16000000-0000-0000-0000-00000000f501',
    '13000000-0000-0000-0000-00000000f501',
    'redeemed',
    'Coffee upgrade',
    'Valid on one hot drink.',
    250
  ),
  (
    '10000000-0000-0000-0000-00000000f501',
    '15000000-0000-0000-0000-00000000f502',
    '16000000-0000-0000-0000-00000000f502',
    '13000000-0000-0000-0000-00000000f501',
    'unlocked',
    'Coffee upgrade',
    'Valid on one hot drink.',
    250
  );

-- get_product_event_counts is a global (cross-tenant) admin metric, so capture
-- the seeded baseline before inserting this test's event and assert the delta.
create temporary table perf_baseline_counts as
select coalesce(
  (
    select event_count
    from public.get_product_event_counts(array['customer_joined'])
    where event_name = 'customer_joined'
  ),
  0
) as customer_joined;

insert into public.product_events (event_name, merchant_id, actor_type)
values
  ('qr_downloaded', '10000000-0000-0000-0000-00000000f501', 'merchant'),
  ('qr_downloaded', '10000000-0000-0000-0000-00000000f501', 'merchant'),
  ('customer_joined', '10000000-0000-0000-0000-00000000f501', 'customer');

do $$
declare
  dashboard record;
  joined_count bigint;
  baseline_joined bigint;
  missing_count bigint;
begin
  select * into dashboard
  from public.get_merchant_dashboard_metrics(
    '10000000-0000-0000-0000-00000000f501'
  );

  if dashboard.members <> 2
    or dashboard.new_members <> 1
    or dashboard.stamps_issued <> 3
    or dashboard.repeat_customers <> 1
    or dashboard.rewards_redeemed <> 1
    or dashboard.qr_downloads <> 2
    or dashboard.billing_status <> 'active' then
    raise exception 'dashboard metrics RPC returned unexpected row: %', dashboard;
  end if;

  select customer_joined into baseline_joined from perf_baseline_counts;

  select event_count into joined_count
  from public.get_product_event_counts(
    array['customer_joined', 'qr_downloaded', 'reward_redeemed']
  )
  where event_name = 'customer_joined';

  if joined_count <> baseline_joined + 1 then
    raise exception 'product event count RPC did not reflect the inserted customer_joined event (baseline %, got %)', baseline_joined, joined_count;
  end if;

  -- Probe a guaranteed-absent event name so the omit-zero-count invariant holds
  -- regardless of seeded data (real event names like reward_redeemed exist).
  select event_count into missing_count
  from public.get_product_event_counts(array['perf_test_zero_count_event'])
  where event_name = 'perf_test_zero_count_event';

  if missing_count is not null then
    raise exception 'product event count RPC should omit zero-count requested events';
  end if;
end $$;

select 'performance indexes and RPCs ok';

rollback;
