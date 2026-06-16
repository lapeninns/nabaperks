begin;

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000101';

do $$
declare
  visible_merchants integer;
  visible_customers integer;
  visible_billing integer;
  visible_reward_pool_items integer;
begin
  select count(*) into visible_merchants from public.merchants;
  if visible_merchants <> 1 then
    raise exception 'merchant owner A saw % merchants, expected 1', visible_merchants;
  end if;

  select count(*) into visible_customers from public.customers;
  if visible_customers <> 5 then
    raise exception 'merchant owner A saw % customers, expected 5', visible_customers;
  end if;

  select count(*) into visible_billing from public.billing_customers;
  if visible_billing <> 1 then
    raise exception 'merchant owner A saw % billing rows, expected 1', visible_billing;
  end if;

  select count(*) into visible_reward_pool_items from public.reward_pool_items;
  if visible_reward_pool_items <> 4 then
    raise exception 'merchant owner A saw % reward pool items, expected 4', visible_reward_pool_items;
  end if;
end $$;

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000102';

do $$
declare
  visible_merchants integer;
  visible_customers integer;
  visible_reward_pool_items integer;
begin
  select count(*) into visible_merchants from public.merchants;
  if visible_merchants <> 1 then
    raise exception 'merchant owner B saw % merchants, expected 1', visible_merchants;
  end if;

  select count(*) into visible_customers from public.customers;
  if visible_customers <> 1 then
    raise exception 'merchant owner B saw % customers, expected 1', visible_customers;
  end if;

  select count(*) into visible_reward_pool_items from public.reward_pool_items;
  if visible_reward_pool_items <> 1 then
    raise exception 'merchant owner B saw % reward pool items, expected 1', visible_reward_pool_items;
  end if;
end $$;

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000301';

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
  select count(*) into visible_customers from public.customers;
  if visible_customers <> 1 then
    raise exception 'customer A saw % customers, expected 1', visible_customers;
  end if;

  select count(*) into visible_memberships from public.customer_memberships;
  if visible_memberships <> 1 then
    raise exception 'customer A saw % memberships, expected 1', visible_memberships;
  end if;

  select count(*) into visible_stamp_events from public.stamp_events;
  if visible_stamp_events <> 1 then
    raise exception 'customer A saw % stamp events, expected 1', visible_stamp_events;
  end if;

  select count(*) into visible_merchants from public.merchants;
  if visible_merchants <> 1 then
    raise exception 'customer A saw % merchants, expected 1', visible_merchants;
  end if;

  select count(*) into visible_reward_pool_items from public.reward_pool_items;
  if visible_reward_pool_items <> 0 then
    raise exception 'customer A saw % reward pool items, expected 0', visible_reward_pool_items;
  end if;

  perform public.issue_self_service_stamp(
    '16000000-0000-0000-0000-000000000001',
    '15000000-0000-0000-0000-000000000001',
    51.524,
    -0.071
  );

  select reward_events.id, reward_events.reward_name, reward_events.redeemable_from
  into unlocked_reward_id, assigned_reward_name, assigned_redeemable_from
  from public.reward_events
  where reward_events.membership_id = '16000000-0000-0000-0000-000000000001'
    and reward_events.status = 'unlocked'
  order by reward_events.created_at desc
  limit 1;

  if unlocked_reward_id is null then
    raise exception 'final mystery stamp did not unlock a reward';
  end if;

  if assigned_reward_name not in (
    'Free pint', '10% off Food', 'Free Honey Toffee IceCream'
  ) then
    raise exception 'assigned reward name % did not come from active pool', assigned_reward_name;
  end if;

  if assigned_redeemable_from <> public.next_uk_business_date(now()) then
    raise exception 'reward redeemable_from % did not match next UK business day', assigned_redeemable_from;
  end if;

  perform set_config(
    'request.jwt.claim.sub',
    '00000000-0000-0000-0000-000000000101',
    true
  );

  update public.reward_pool_items
  set reward_name = 'Changed after assignment'
  where id = '13500000-0000-0000-0000-000000000001';

  perform set_config(
    'request.jwt.claim.sub',
    '00000000-0000-0000-0000-000000000301',
    true
  );

  if not exists (
    select 1
    from public.reward_events
    where id = unlocked_reward_id
      and reward_name = assigned_reward_name
  ) then
    raise exception 'assigned reward details changed after merchant pool edit';
  end if;

  begin
    perform public.redeem_self_service_reward(
      unlocked_reward_id,
      '15000000-0000-0000-0000-000000000001',
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

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000302';

do $$
declare
  visible_customers integer;
  visible_memberships integer;
begin
  select count(*) into visible_customers from public.customers;
  if visible_customers <> 1 then
    raise exception 'customer B saw % customers, expected 1', visible_customers;
  end if;

  select count(*) into visible_memberships from public.customer_memberships;
  if visible_memberships <> 1 then
    raise exception 'customer B saw % memberships, expected 1', visible_memberships;
  end if;
end $$;

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';

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
  '00000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
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
  where action = 'tenant_isolation_test_adjustment';

  if visible_audit_logs <> 1 then
    raise exception 'admin audit readback saw % rows, expected 1', visible_audit_logs;
  end if;
end $$;

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000101';

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
    '00000000-0000-0000-0000-000000000101',
    '10000000-0000-0000-0000-000000000001',
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
