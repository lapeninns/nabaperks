begin;

select 'tenant_isolation_fixture';

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
    '70000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'tenant-admin@nabaperks.test',
    extensions.crypt('NabaperksDemo1!', extensions.gen_salt('bf')),
    now(),
    '',
    '',
    '',
    '',
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Tenant Admin"}'::jsonb,
    false
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '70000000-0000-0000-0000-000000000101',
    'authenticated',
    'authenticated',
    'tenant-owner-a@nabaperks.test',
    extensions.crypt('NabaperksDemo1!', extensions.gen_salt('bf')),
    now(),
    '',
    '',
    '',
    '',
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Tenant Owner A"}'::jsonb,
    false
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '70000000-0000-0000-0000-000000000102',
    'authenticated',
    'authenticated',
    'tenant-owner-b@nabaperks.test',
    extensions.crypt('NabaperksDemo1!', extensions.gen_salt('bf')),
    now(),
    '',
    '',
    '',
    '',
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Tenant Owner B"}'::jsonb,
    false
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '70000000-0000-0000-0000-000000000301',
    'authenticated',
    'authenticated',
    'tenant-customer-a@nabaperks.test',
    extensions.crypt('NabaperksDemo1!', extensions.gen_salt('bf')),
    now(),
    '',
    '',
    '',
    '',
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Tenant Customer A"}'::jsonb,
    false
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '70000000-0000-0000-0000-000000000302',
    'authenticated',
    'authenticated',
    'tenant-customer-b@nabaperks.test',
    extensions.crypt('NabaperksDemo1!', extensions.gen_salt('bf')),
    now(),
    '',
    '',
    '',
    '',
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Tenant Customer B"}'::jsonb,
    false
  )
on conflict (id) do update
set email = excluded.email,
    encrypted_password = excluded.encrypted_password,
    email_confirmed_at = excluded.email_confirmed_at,
    raw_user_meta_data = excluded.raw_user_meta_data,
    updated_at = now();

insert into public.internal_admins (user_id, email)
values ('70000000-0000-0000-0000-000000000001', 'tenant-admin@nabaperks.test')
on conflict (user_id) do update
set email = excluded.email,
    is_active = true,
    updated_at = now();

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
values
  (
    '71000000-0000-0000-0000-000000000001',
    '70000000-0000-0000-0000-000000000101',
    'Tenant Bean A',
    'tenant-bean-a',
    'cafe',
    'tenant-owner-a@nabaperks.test',
    500,
    6500,
    150,
    'active'
  ),
  (
    '71000000-0000-0000-0000-000000000002',
    '70000000-0000-0000-0000-000000000102',
    'Tenant Bean B',
    'tenant-bean-b',
    'cafe',
    'tenant-owner-b@nabaperks.test',
    500,
    6500,
    150,
    'active'
  );

insert into public.merchant_locations (id, merchant_id, name, address)
values
  (
    '71100000-0000-0000-0000-000000000001',
    '71000000-0000-0000-0000-000000000001',
    'Tenant A Location',
    '1 Test Street'
  ),
  (
    '71100000-0000-0000-0000-000000000002',
    '71000000-0000-0000-0000-000000000002',
    'Tenant B Location',
    '2 Test Street'
  );

insert into public.loyalty_cards (
  id,
  merchant_id,
  location_id,
  card_name,
  stamps_required,
  reward_name,
  reward_terms,
  min_spend_pence,
  is_active
)
values
  (
    '71300000-0000-0000-0000-000000000001',
    '71000000-0000-0000-0000-000000000001',
    '71100000-0000-0000-0000-000000000001',
    'Tenant A Card',
    3,
    'Tenant reward A',
    'A fixture reward for tenant isolation.',
    null,
    true
  ),
  (
    '71300000-0000-0000-0000-000000000002',
    '71000000-0000-0000-0000-000000000002',
    '71100000-0000-0000-0000-000000000002',
    'Tenant B Card',
    3,
    'Tenant reward B',
    'A fixture reward for tenant isolation.',
    null,
    true
  );

insert into public.reward_pool_items (
  id,
  merchant_id,
  location_id,
  loyalty_card_id,
  reward_name,
  reward_terms,
  min_spend_pence,
  weight,
  is_active,
  display_order
)
values
  (
    '71350000-0000-0000-0000-000000000001',
    '71000000-0000-0000-0000-000000000001',
    '71100000-0000-0000-0000-000000000001',
    '71300000-0000-0000-0000-000000000001',
    'Tenant A pint',
    'A fixture reward from tenant A.',
    null,
    1,
    true,
    1
  ),
  (
    '71350000-0000-0000-0000-000000000002',
    '71000000-0000-0000-0000-000000000001',
    '71100000-0000-0000-0000-000000000001',
    '71300000-0000-0000-0000-000000000001',
    'Tenant A toastie',
    'A second fixture reward from tenant A.',
    null,
    1,
    true,
    2
  ),
  (
    '71350000-0000-0000-0000-000000000003',
    '71000000-0000-0000-0000-000000000001',
    '71100000-0000-0000-0000-000000000001',
    '71300000-0000-0000-0000-000000000001',
    'Tenant A cake',
    'A third fixture reward from tenant A.',
    null,
    1,
    true,
    3
  ),
  (
    '71350000-0000-0000-0000-000000000004',
    '71000000-0000-0000-0000-000000000002',
    '71100000-0000-0000-0000-000000000002',
    '71300000-0000-0000-0000-000000000002',
    'Tenant B pint',
    'A fixture reward from tenant B.',
    null,
    1,
    true,
    1
  ),
  (
    '71350000-0000-0000-0000-000000000005',
    '71000000-0000-0000-0000-000000000002',
    '71100000-0000-0000-0000-000000000002',
    '71300000-0000-0000-0000-000000000002',
    'Tenant B toastie',
    'A second fixture reward from tenant B.',
    null,
    1,
    true,
    2
  ),
  (
    '71350000-0000-0000-0000-000000000006',
    '71000000-0000-0000-0000-000000000002',
    '71100000-0000-0000-0000-000000000002',
    '71300000-0000-0000-0000-000000000002',
    'Tenant B cake',
    'A third fixture reward from tenant B.',
    null,
    1,
    true,
    3
  );

insert into public.customers (
  id,
  auth_user_id,
  email,
  email_verified_at,
  phone_hmac,
  phone_last4,
  phone_country,
  full_name,
  date_of_birth
)
values
  (
    '75000000-0000-0000-0000-000000000301',
    '70000000-0000-0000-0000-000000000301',
    'tenant-customer-a@nabaperks.test',
    now(),
    'tenant-fixture-hmac-a',
    '0301',
    'GB',
    'Tenant Customer A',
    date '1990-01-01'
  ),
  (
    '75000000-0000-0000-0000-000000000302',
    '70000000-0000-0000-0000-000000000302',
    'tenant-customer-b@nabaperks.test',
    now(),
    'tenant-fixture-hmac-b',
    '0302',
    'GB',
    'Tenant Customer B',
    date '1990-01-01'
  );

insert into public.customer_memberships (
  id,
  merchant_id,
  customer_id,
  current_stamp_count,
  total_stamps_earned,
  total_rewards_redeemed,
  active_cycle_number
)
values
  (
    '76000000-0000-0000-0000-000000000301',
    '71000000-0000-0000-0000-000000000001',
    '75000000-0000-0000-0000-000000000301',
    2,
    2,
    0,
    1
  ),
  (
    '76000000-0000-0000-0000-000000000302',
    '71000000-0000-0000-0000-000000000002',
    '75000000-0000-0000-0000-000000000302',
    0,
    0,
    0,
    1
  );

insert into public.billing_customers (
  id,
  merchant_id,
  stripe_customer_id,
  stripe_subscription_id,
  status
)
values
  (
    '77000000-0000-0000-0000-000000000001',
    '71000000-0000-0000-0000-000000000001',
    'cus_tenant_a',
    'sub_tenant_a',
    'active'
  ),
  (
    '77000000-0000-0000-0000-000000000002',
    '71000000-0000-0000-0000-000000000002',
    'cus_tenant_b',
    'sub_tenant_b',
    'active'
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
  earned_business_date,
  cycle_number,
  created_at
)
values
  (
    '78000000-0000-0000-0000-000000000001',
    '71000000-0000-0000-0000-000000000001',
    '75000000-0000-0000-0000-000000000301',
    '76000000-0000-0000-0000-000000000301',
    '71300000-0000-0000-0000-000000000001',
    '71100000-0000-0000-0000-000000000001',
    'earned',
    1,
    public.uk_business_date(now()) - 2,
    1,
    now() - interval '2 days'
  ),
  (
    '78000000-0000-0000-0000-000000000002',
    '71000000-0000-0000-0000-000000000001',
    '75000000-0000-0000-0000-000000000301',
    '76000000-0000-0000-0000-000000000301',
    '71300000-0000-0000-0000-000000000001',
    '71100000-0000-0000-0000-000000000001',
    'earned',
    1,
    public.uk_business_date(now()) - 1,
    1,
    now() - interval '1 day'
  );

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '70000000-0000-0000-0000-000000000101';

do $$
declare
  visible_merchants integer;
  visible_customers integer;
  visible_billing integer;
  visible_reward_pool_items integer;
begin
  select count(*) into visible_merchants
  from public.merchants
  where id in (
    '71000000-0000-0000-0000-000000000001',
    '71000000-0000-0000-0000-000000000002'
  );
  if visible_merchants <> 1 then
    raise exception 'tenant owner A saw % merchants, expected 1', visible_merchants;
  end if;

  select count(*) into visible_customers
  from public.customers
  where id in (
    '75000000-0000-0000-0000-000000000301',
    '75000000-0000-0000-0000-000000000302'
  );
  if visible_customers <> 1 then
    raise exception 'tenant owner A saw % customers, expected 1', visible_customers;
  end if;

  select count(*) into visible_billing
  from public.billing_customers
  where merchant_id in (
    '71000000-0000-0000-0000-000000000001',
    '71000000-0000-0000-0000-000000000002'
  );
  if visible_billing <> 1 then
    raise exception 'tenant owner A saw % billing rows, expected 1', visible_billing;
  end if;

  select count(*) into visible_reward_pool_items
  from public.reward_pool_items
  where merchant_id in (
    '71000000-0000-0000-0000-000000000001',
    '71000000-0000-0000-0000-000000000002'
  );
  if visible_reward_pool_items <> 3 then
    raise exception 'tenant owner A saw % reward pool items, expected 3', visible_reward_pool_items;
  end if;
end $$;

set local request.jwt.claim.sub = '70000000-0000-0000-0000-000000000102';

do $$
declare
  visible_merchants integer;
  visible_customers integer;
  visible_reward_pool_items integer;
begin
  select count(*) into visible_merchants
  from public.merchants
  where id in (
    '71000000-0000-0000-0000-000000000001',
    '71000000-0000-0000-0000-000000000002'
  );
  if visible_merchants <> 1 then
    raise exception 'tenant owner B saw % merchants, expected 1', visible_merchants;
  end if;

  select count(*) into visible_customers
  from public.customers
  where id in (
    '75000000-0000-0000-0000-000000000301',
    '75000000-0000-0000-0000-000000000302'
  );
  if visible_customers <> 1 then
    raise exception 'tenant owner B saw % customers, expected 1', visible_customers;
  end if;

  select count(*) into visible_reward_pool_items
  from public.reward_pool_items
  where merchant_id in (
    '71000000-0000-0000-0000-000000000001',
    '71000000-0000-0000-0000-000000000002'
  );
  if visible_reward_pool_items <> 3 then
    raise exception 'tenant owner B saw % reward pool items, expected 3', visible_reward_pool_items;
  end if;
end $$;

set local request.jwt.claim.sub = '70000000-0000-0000-0000-000000000301';

do $$
declare
  visible_customers integer;
  visible_memberships integer;
  visible_stamp_events integer;
  visible_merchants integer;
  visible_reward_pool_items integer;
  unlocked_reward_id uuid;
  assigned_reward_name text;
  assigned_redeemable_from date;
begin
  select count(*) into visible_customers
  from public.customers
  where id in (
    '75000000-0000-0000-0000-000000000301',
    '75000000-0000-0000-0000-000000000302'
  );
  if visible_customers <> 1 then
    raise exception 'tenant customer A saw % customers, expected 1', visible_customers;
  end if;

  select count(*) into visible_memberships
  from public.customer_memberships
  where id in (
    '76000000-0000-0000-0000-000000000301',
    '76000000-0000-0000-0000-000000000302'
  );
  if visible_memberships <> 1 then
    raise exception 'tenant customer A saw % memberships, expected 1', visible_memberships;
  end if;

  select count(*) into visible_stamp_events
  from public.stamp_events
  where membership_id in (
    '76000000-0000-0000-0000-000000000301',
    '76000000-0000-0000-0000-000000000302'
  );
  if visible_stamp_events <> 2 then
    raise exception 'tenant customer A saw % stamp events, expected 2', visible_stamp_events;
  end if;

  select count(*) into visible_merchants
  from public.merchants
  where id in (
    '71000000-0000-0000-0000-000000000001',
    '71000000-0000-0000-0000-000000000002'
  );
  if visible_merchants <> 1 then
    raise exception 'tenant customer A saw % merchants, expected 1', visible_merchants;
  end if;

  select count(*) into visible_reward_pool_items
  from public.reward_pool_items
  where merchant_id in (
    '71000000-0000-0000-0000-000000000001',
    '71000000-0000-0000-0000-000000000002'
  );
  if visible_reward_pool_items <> 0 then
    raise exception 'tenant customer A saw % reward pool items, expected 0', visible_reward_pool_items;
  end if;

  perform public.issue_self_service_stamp(
    '76000000-0000-0000-0000-000000000301',
    '75000000-0000-0000-0000-000000000301',
    51.524,
    -0.071
  );

  select reward_events.id, reward_events.reward_name, reward_events.redeemable_from
  into unlocked_reward_id, assigned_reward_name, assigned_redeemable_from
  from public.reward_events
  where reward_events.membership_id = '76000000-0000-0000-0000-000000000301'
    and reward_events.status = 'unlocked'
  order by reward_events.created_at desc
  limit 1;

  if unlocked_reward_id is null then
    raise exception 'tenant final stamp did not unlock a reward';
  end if;

  if assigned_reward_name not in (
    'Tenant A pint',
    'Tenant A toastie',
    'Tenant A cake'
  ) then
    raise exception 'tenant assigned reward name % did not come from active pool', assigned_reward_name;
  end if;

  if assigned_redeemable_from <> public.next_uk_business_date(now()) then
    raise exception 'tenant reward redeemable_from % did not match next UK business day', assigned_redeemable_from;
  end if;

  perform set_config(
    'request.jwt.claim.sub',
    '70000000-0000-0000-0000-000000000101',
    true
  );

  update public.reward_pool_items
  set reward_name = 'Changed after assignment'
  where id = '71350000-0000-0000-0000-000000000001';

  perform set_config(
    'request.jwt.claim.sub',
    '70000000-0000-0000-0000-000000000301',
    true
  );

  if not exists (
    select 1
    from public.reward_events
    where id = unlocked_reward_id
      and reward_name = assigned_reward_name
  ) then
    raise exception 'tenant assigned reward details changed after pool edit';
  end if;

  begin
    perform public.redeem_self_service_reward(
      unlocked_reward_id,
      '75000000-0000-0000-0000-000000000301',
      51.524,
      -0.071
    );
    raise exception 'same-day reward redemption unexpectedly succeeded';
  exception
    when others then
      if sqlerrm not like '%next UK business day%' then
        raise;
      end if;
  end;
end $$;

set local request.jwt.claim.sub = '70000000-0000-0000-0000-000000000302';

do $$
declare
  visible_customers integer;
  visible_memberships integer;
begin
  select count(*) into visible_customers
  from public.customers
  where id in (
    '75000000-0000-0000-0000-000000000301',
    '75000000-0000-0000-0000-000000000302'
  );
  if visible_customers <> 1 then
    raise exception 'tenant customer B saw % customers, expected 1', visible_customers;
  end if;

  select count(*) into visible_memberships
  from public.customer_memberships
  where id in (
    '76000000-0000-0000-0000-000000000301',
    '76000000-0000-0000-0000-000000000302'
  );
  if visible_memberships <> 1 then
    raise exception 'tenant customer B saw % memberships, expected 1', visible_memberships;
  end if;
end $$;

set local request.jwt.claim.sub = '70000000-0000-0000-0000-000000000001';

insert into public.audit_logs (
  actor_type,
  actor_id,
  merchant_id,
  target_table,
  action,
  metadata
)
values (
  'admin',
  '70000000-0000-0000-0000-000000000001',
  '71000000-0000-0000-0000-000000000001',
  'customer_memberships',
  'tenant_isolation_test_adjustment',
  '{"source":"tenant_isolation.sql"}'::jsonb
);

do $$
declare
  visible_audit_logs integer;
begin
  select count(*) into visible_audit_logs
  from public.audit_logs
  where action = 'tenant_isolation_test_adjustment'
    and merchant_id = '71000000-0000-0000-0000-000000000001';

  if visible_audit_logs <> 1 then
    raise exception 'tenant admin audit readback saw % rows, expected 1', visible_audit_logs;
  end if;
end $$;

set local request.jwt.claim.sub = '70000000-0000-0000-0000-000000000101';

do $$
begin
  insert into public.audit_logs (
    actor_type,
    actor_id,
    merchant_id,
    target_table,
    action,
    metadata
  )
  values (
    'merchant',
    '70000000-0000-0000-0000-000000000101',
    '71000000-0000-0000-0000-000000000001',
    'customer_memberships',
    'role_denial_test',
    '{"source":"tenant_isolation.sql"}'::jsonb
  );
  raise exception 'role denial unexpectedly succeeded';
exception
  when insufficient_privilege then
    null;
end $$;

select 'duplicate redemption boundary';

rollback;

begin;

set local role anon;
set local request.jwt.claim.role = 'anon';
set local request.jwt.claim.sub = '';

do $$
begin
  perform count(*) from public.merchants;
  raise exception 'anon direct table access unexpectedly succeeded';
exception
  when insufficient_privilege then
    null;
end $$;

rollback;
