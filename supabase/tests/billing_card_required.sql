-- Billing-card-required gate for loyalty-affecting SQL/RPC surfaces.
--
-- Uses the seeded Old Crown Girton programme inside a rollback. Existing
-- merchants are grandfathered by the migration, so each scenario explicitly
-- toggles requires_billing to prove the gate branches.

begin;

set local request.jwt.claim.role = 'service_role';

-- Scenario 1: helper reports the new missing-card branch without weakening the
-- existing cancelled/suspended block.
do $$
begin
  if public.loyalty_availability_reason('active', true, null, true) <> 'billing_required' then
    raise exception 'missing billing row did not report billing_required';
  end if;

  if public.loyalty_availability_reason('active', true, 'cancelled', false) <> 'billing_blocked' then
    raise exception 'cancelled billing row no longer reports billing_blocked';
  end if;
end $$;

-- Scenario 2: requires_billing=true with no billing row blocks all feasible
-- customer mutation and scan-token surfaces.
update public.merchants
set requires_billing = true
where id = '10000000-0000-0000-0000-000000000001';

delete from public.billing_customers
where merchant_id = '10000000-0000-0000-0000-000000000001';

insert into public.customers (
  id, auth_user_id, phone_hmac, phone_last4, phone_country, full_name, date_of_birth
)
values (
  '15000000-0000-0000-0000-00000000b101',
  null,
  'billing-card-required-hmac-b101',
  '4101',
  'GB',
  'Billing Blocked',
  date '1990-01-01'
);

do $$
begin
  perform public.join_customer_membership(
    '15000000-0000-0000-0000-00000000b101',
    'old-crown-girton',
    'old-crown-girton',
    false,
    '2026-06-mvp'
  );
  raise exception 'join succeeded for a billing-required merchant without a billing row';
exception
  when others then
    if sqlerrm not like '%not active yet%' then
      raise exception 'expected billing-required join block, got: %', sqlerrm;
    end if;
end $$;

insert into public.customers (
  id, auth_user_id, phone_hmac, phone_last4, phone_country, full_name, date_of_birth
)
values (
  '15000000-0000-0000-0000-00000000b102',
  null,
  'billing-card-required-hmac-b102',
  '4102',
  'GB',
  'Billing Blocked First Stamp',
  date '1990-01-01'
);

do $$
begin
  perform public.join_customer_membership_with_first_stamp(
    '15000000-0000-0000-0000-00000000b102',
    'old-crown-girton',
    'old-crown-girton',
    false,
    '2026-06-mvp'
  );
  raise exception 'join with first stamp succeeded for a billing-required merchant without a billing row';
exception
  when others then
    if sqlerrm not like '%not active yet%' then
      raise exception 'expected billing-required join-first-stamp block, got: %', sqlerrm;
    end if;
end $$;

insert into public.customer_memberships (
  id, merchant_id, customer_id, current_stamp_count, total_stamps_earned
)
values (
  '16000000-0000-0000-0000-00000000b101',
  '10000000-0000-0000-0000-000000000001',
  '15000000-0000-0000-0000-00000000b101',
  3,
  3
);

insert into public.reward_events (
  id, merchant_id, customer_id, membership_id, loyalty_card_id,
  status, reward_name, reward_terms, redeemable_from, cycle_number
)
values (
  '1f000000-0000-0000-0000-00000000b101',
  '10000000-0000-0000-0000-000000000001',
  '15000000-0000-0000-0000-00000000b101',
  '16000000-0000-0000-0000-00000000b101',
  '13000000-0000-0000-0000-000000000001',
  'unlocked',
  'Billing test reward',
  'A reward used only for billing gate tests.',
  public.uk_business_date(now()),
  1
);

do $$
begin
  perform public.issue_self_service_stamp(
    '16000000-0000-0000-0000-00000000b101',
    '15000000-0000-0000-0000-00000000b101',
    'old-crown-girton'
  );
  raise exception 'stamp succeeded for a billing-required merchant without a billing row';
exception
  when others then
    if sqlerrm not like '%not active yet%' then
      raise exception 'expected billing-required stamp block, got: %', sqlerrm;
    end if;
end $$;

do $$
begin
  perform public.redeem_self_service_reward(
    '1f000000-0000-0000-0000-00000000b101',
    '15000000-0000-0000-0000-00000000b101'
  );
  raise exception 'redeem succeeded for a billing-required merchant without a billing row';
exception
  when others then
    if sqlerrm not like '%not active yet%' then
      raise exception 'expected billing-required redeem block, got: %', sqlerrm;
    end if;
end $$;

do $$
begin
  perform public.create_reward_scan_token(
    '1f000000-0000-0000-0000-00000000b101',
    '15000000-0000-0000-0000-00000000b101'
  );
  raise exception 'scan token succeeded for a billing-required merchant without a billing row';
exception
  when others then
    if sqlerrm not like '%unavailable right now%' then
      raise exception 'expected billing-required scan-token block, got: %', sqlerrm;
    end if;
end $$;

insert into public.reward_scan_tokens (
  id, reward_event_id, merchant_id, customer_id, membership_id
)
values (
  '21000000-0000-0000-0000-00000000b101',
  '1f000000-0000-0000-0000-00000000b101',
  '10000000-0000-0000-0000-000000000001',
  '15000000-0000-0000-0000-00000000b101',
  '16000000-0000-0000-0000-00000000b101'
);

do $$
declare
  v_status text;
  v_reason text;
begin
  select scan_status, blocked_reason
  into v_status, v_reason
  from public.get_reward_scan_context(
    '21000000-0000-0000-0000-00000000b101',
    '10000000-0000-0000-0000-000000000001'
  );

  if v_status <> 'blocked' or v_reason not like '%unavailable right now%' then
    raise exception 'expected blocked scan context, got status %, reason %', v_status, v_reason;
  end if;
end $$;

do $$
begin
  raise notice 'cardless blocked: PASS';
end $$;

-- Scenario 3: a trialing billing row means a card is on file and the same
-- customer-facing surfaces remain operational.
insert into public.billing_customers (
  id, merchant_id, stripe_customer_id, stripe_subscription_id, status, current_period_end
)
values (
  '19000000-0000-0000-0000-00000000b201',
  '10000000-0000-0000-0000-000000000001',
  'cus_billing_required_trialing',
  'sub_billing_required_trialing',
  'trialing',
  now() + interval '30 days'
);

insert into public.customers (
  id, auth_user_id, phone_hmac, phone_last4, phone_country, full_name, date_of_birth
)
values (
  '15000000-0000-0000-0000-00000000b201',
  null,
  'billing-card-required-hmac-b201',
  '4201',
  'GB',
  'Billing Trialing',
  date '1990-01-01'
);

do $$
declare
  v_membership uuid;
  v_stamp_count integer;
  v_scan_token uuid;
  v_scan_status text;
  v_new_stamp_count integer;
begin
  select membership_id
  into v_membership
  from public.join_customer_membership(
    '15000000-0000-0000-0000-00000000b201',
    'old-crown-girton',
    'old-crown-girton',
    false,
    '2026-06-mvp'
  );

  select new_stamp_count
  into v_stamp_count
  from public.issue_self_service_stamp(
    v_membership,
    '15000000-0000-0000-0000-00000000b201',
    'old-crown-girton'
  );

  if v_stamp_count <> 1 then
    raise exception 'trialing billing row did not allow stamp, got count %', v_stamp_count;
  end if;

  update public.customer_memberships
  set current_stamp_count = 3, total_stamps_earned = 3
  where id = v_membership;

  insert into public.reward_events (
    id, merchant_id, customer_id, membership_id, loyalty_card_id,
    status, reward_name, reward_terms, redeemable_from, cycle_number
  )
  values (
    '1f000000-0000-0000-0000-00000000b201',
    '10000000-0000-0000-0000-000000000001',
    '15000000-0000-0000-0000-00000000b201',
    v_membership,
    '13000000-0000-0000-0000-000000000001',
    'unlocked',
    'Trialing test reward',
    'A reward used only for trialing billing tests.',
    public.uk_business_date(now()),
    1
  );

  select scan_token
  into v_scan_token
  from public.create_reward_scan_token(
    '1f000000-0000-0000-0000-00000000b201',
    '15000000-0000-0000-0000-00000000b201'
  );

  select scan_status
  into v_scan_status
  from public.get_reward_scan_context(
    v_scan_token,
    '10000000-0000-0000-0000-000000000001'
  );

  if v_scan_status <> 'ready' then
    raise exception 'trialing billing row did not allow scan context, got %', v_scan_status;
  end if;

  select new_stamp_count
  into v_new_stamp_count
  from public.redeem_self_service_reward(
    '1f000000-0000-0000-0000-00000000b201',
    '15000000-0000-0000-0000-00000000b201'
  );

  if v_new_stamp_count <> 0 then
    raise exception 'trialing billing row did not allow redemption, got count %', v_new_stamp_count;
  end if;

  raise notice 'trialing allowed: PASS';
end $$;

-- Scenario 3b: active and past_due rows also mean a card is on file for the
-- join gate. past_due stays operational while billing retries are handled.
update public.billing_customers
set status = 'active'
where merchant_id = '10000000-0000-0000-0000-000000000001';

insert into public.customers (
  id, auth_user_id, phone_hmac, phone_last4, phone_country, full_name, date_of_birth
)
values (
  '15000000-0000-0000-0000-00000000b202',
  null,
  'billing-card-required-hmac-b202',
  '4202',
  'GB',
  'Billing Active',
  date '1990-01-01'
);

do $$
declare
  v_membership uuid;
begin
  select membership_id
  into v_membership
  from public.join_customer_membership(
    '15000000-0000-0000-0000-00000000b202',
    'old-crown-girton',
    'old-crown-girton',
    false,
    '2026-06-mvp'
  );

  if v_membership is null then
    raise exception 'active billing row did not allow join';
  end if;
end $$;

update public.billing_customers
set status = 'past_due'
where merchant_id = '10000000-0000-0000-0000-000000000001';

insert into public.customers (
  id, auth_user_id, phone_hmac, phone_last4, phone_country, full_name, date_of_birth
)
values (
  '15000000-0000-0000-0000-00000000b203',
  null,
  'billing-card-required-hmac-b203',
  '4203',
  'GB',
  'Billing Past Due',
  date '1990-01-01'
);

do $$
declare
  v_membership uuid;
begin
  select membership_id
  into v_membership
  from public.join_customer_membership(
    '15000000-0000-0000-0000-00000000b203',
    'old-crown-girton',
    'old-crown-girton',
    false,
    '2026-06-mvp'
  );

  if v_membership is null then
    raise exception 'past_due billing row did not allow join';
  end if;
end $$;

-- Scenario 4: requires_billing=false keeps a cardless merchant operational.
update public.merchants
set requires_billing = false
where id = '10000000-0000-0000-0000-000000000001';

delete from public.billing_customers
where merchant_id = '10000000-0000-0000-0000-000000000001';

insert into public.customers (
  id, auth_user_id, phone_hmac, phone_last4, phone_country, full_name, date_of_birth
)
values (
  '15000000-0000-0000-0000-00000000b301',
  null,
  'billing-card-required-hmac-b301',
  '4301',
  'GB',
  'Billing Grandfathered',
  date '1990-01-01'
);

do $$
declare
  v_membership uuid;
  v_stamp_count integer;
  v_new_stamp_count integer;
begin
  select membership_id
  into v_membership
  from public.join_customer_membership(
    '15000000-0000-0000-0000-00000000b301',
    'old-crown-girton',
    'old-crown-girton',
    false,
    '2026-06-mvp'
  );

  select new_stamp_count
  into v_stamp_count
  from public.issue_self_service_stamp(
    v_membership,
    '15000000-0000-0000-0000-00000000b301',
    'old-crown-girton'
  );

  if v_stamp_count <> 1 then
    raise exception 'grandfathered cardless merchant did not allow stamp, got count %', v_stamp_count;
  end if;

  update public.customer_memberships
  set current_stamp_count = 3, total_stamps_earned = 3
  where id = v_membership;

  insert into public.reward_events (
    id, merchant_id, customer_id, membership_id, loyalty_card_id,
    status, reward_name, reward_terms, redeemable_from, cycle_number
  )
  values (
    '1f000000-0000-0000-0000-00000000b301',
    '10000000-0000-0000-0000-000000000001',
    '15000000-0000-0000-0000-00000000b301',
    v_membership,
    '13000000-0000-0000-0000-000000000001',
    'unlocked',
    'Grandfathered test reward',
    'A reward used only for grandfathered billing tests.',
    public.uk_business_date(now()),
    1
  );

  select new_stamp_count
  into v_new_stamp_count
  from public.redeem_self_service_reward(
    '1f000000-0000-0000-0000-00000000b301',
    '15000000-0000-0000-0000-00000000b301'
  );

  if v_new_stamp_count <> 0 then
    raise exception 'grandfathered cardless merchant did not allow redemption, got count %', v_new_stamp_count;
  end if;

  raise notice 'grandfathered allowed: PASS';
end $$;

select 'billing card required gate ok';

rollback;
