-- Loyalty cycle boundaries on the self-service stamp + redeem RPCs.
--
-- Drives a throwaway customer on the seeded Old Crown Girton programme from a
-- two-stamp card to the final stamp (which unlocks a reward), then redeems it,
-- asserting that:
--   * the final stamp and the unlocked reward are tagged with the active cycle,
--   * redemption advances the membership's active cycle and clears the card,
--   * the new cycle excludes the previous cycle's stamp events,
--   * a duplicate redemption is idempotent and does not advance the cycle twice.
--
-- Runs as the migration owner (RLS bypassed) with the service-role JWT claim so
-- the RPCs skip the auth.uid ownership check and decide on customer_id alone. The
-- whole thing rolls back, leaving seed data untouched.

begin;

set local request.jwt.claim.role = 'service_role';

-- Throwaway customer with a complete profile so the redemption gate passes.
insert into public.customers (
  id, auth_user_id, phone_hmac, phone_last4, phone_country, full_name, date_of_birth
)
values (
  '15000000-0000-0000-0000-0000000000c1',
  null,
  'cycle-test-hmac-00c1',
  '4242',
  'GB',
  'Cycle Tester',
  date '1990-01-01'
);

-- Two stamps already on the card (cycle 1), on earlier business days so the
-- daily-uniqueness rule does not block today's final stamp.
insert into public.customer_memberships (
  id, merchant_id, customer_id, current_stamp_count, total_stamps_earned, active_cycle_number
)
values (
  '16000000-0000-0000-0000-0000000000c1',
  '10000000-0000-0000-0000-000000000001',
  '15000000-0000-0000-0000-0000000000c1',
  2,
  2,
  1
);

-- Add a second active reward with a much higher weight so first-cycle behaviour
-- must be deterministic by default ordering, not weighted randomness.
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
values (
  '13500000-0000-0000-0000-0000000000c2',
  '10000000-0000-0000-0000-000000000001',
  '11000000-0000-0000-0000-000000000001',
  '13000000-0000-0000-0000-000000000001',
  'Bonus loaf',
  'A seeded loaf from the bakery shelf.',
  null,
  100,
  true,
  2
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
values (
  '13500000-0000-0000-0000-0000000000c3',
  '10000000-0000-0000-0000-000000000001',
  '11000000-0000-0000-0000-000000000001',
  '13000000-0000-0000-0000-000000000001',
  'Breakfast bun',
  'One breakfast bun from the counter.',
  null,
  1,
  true,
  3
);

insert into public.stamp_events (
  merchant_id, customer_id, membership_id, loyalty_card_id, location_id,
  event_type, stamps_delta, earned_business_date, cycle_number, created_at
)
values
  (
    '10000000-0000-0000-0000-000000000001',
    '15000000-0000-0000-0000-0000000000c1',
    '16000000-0000-0000-0000-0000000000c1',
    '13000000-0000-0000-0000-000000000001',
    '11000000-0000-0000-0000-000000000001',
    'earned', 1, public.uk_business_date(now()) - 2, 1, now() - interval '2 days'
  ),
  (
    '10000000-0000-0000-0000-000000000001',
    '15000000-0000-0000-0000-0000000000c1',
    '16000000-0000-0000-0000-0000000000c1',
    '13000000-0000-0000-0000-000000000001',
    '11000000-0000-0000-0000-000000000001',
    'earned', 1, public.uk_business_date(now()) - 1, 1, now() - interval '1 day'
  );

-- Final stamp: unlocks a reward. Assert the stamp + reward carry cycle 1.
do $$
declare
  v_today_cycle integer;
  v_reward_cycle integer;
  v_reward_pool_item uuid;
begin
  perform public.issue_self_service_stamp(
    '16000000-0000-0000-0000-0000000000c1',
    '15000000-0000-0000-0000-0000000000c1'
  );

  select cycle_number into v_today_cycle
  from public.stamp_events
  where membership_id = '16000000-0000-0000-0000-0000000000c1'
    and earned_business_date = public.uk_business_date(now())
    and event_type = 'earned';

  if v_today_cycle is distinct from 1 then
    raise exception 'final stamp not tagged with cycle 1 (got %)', v_today_cycle;
  end if;

  select cycle_number into v_reward_cycle
  from public.reward_events
  where membership_id = '16000000-0000-0000-0000-0000000000c1'
    and status = 'unlocked';

  if v_reward_cycle is distinct from 1 then
    raise exception 'unlocked reward not tagged with the final stamp cycle (got %)', v_reward_cycle;
  end if;

  select reward_pool_item_id into v_reward_pool_item
  from public.reward_events
  where membership_id = '16000000-0000-0000-0000-0000000000c1'
    and status = 'unlocked';

  if v_reward_pool_item is distinct from '13500000-0000-0000-0000-000000000001'::uuid then
    raise exception 'first cycle did not unlock the default advertised reward (got %)', v_reward_pool_item;
  end if;
end $$;

-- Make the freshly unlocked reward redeemable today.
update public.reward_events
set redeemable_from = public.uk_business_date(now())
where membership_id = '16000000-0000-0000-0000-0000000000c1'
  and status = 'unlocked';

-- Redeem: advances the active cycle and clears the active card.
do $$
declare
  v_reward_id uuid;
  v_active_cycle integer;
  v_stamp_count integer;
begin
  select id into v_reward_id
  from public.reward_events
  where membership_id = '16000000-0000-0000-0000-0000000000c1'
    and status = 'unlocked';

  perform public.redeem_self_service_reward(
    v_reward_id,
    '15000000-0000-0000-0000-0000000000c1'
  );

  select active_cycle_number, current_stamp_count
  into v_active_cycle, v_stamp_count
  from public.customer_memberships
  where id = '16000000-0000-0000-0000-0000000000c1';

  if v_active_cycle <> 2 then
    raise exception 'redemption did not advance the active cycle to 2 (got %)', v_active_cycle;
  end if;

  if v_stamp_count <> 0 then
    raise exception 'redemption did not clear the active card (got %)', v_stamp_count;
  end if;

  -- The new cycle excludes the previous cycle's stamp events.
  if (
    select count(*)
    from public.stamp_events
    where membership_id = '16000000-0000-0000-0000-0000000000c1'
      and event_type = 'earned'
      and cycle_number = 2
  ) <> 0 then
    raise exception 'new cycle unexpectedly contains stamp events';
  end if;

  if (
    select count(*)
    from public.stamp_events
    where membership_id = '16000000-0000-0000-0000-0000000000c1'
      and event_type = 'earned'
      and cycle_number = 1
  ) <> 3 then
    raise exception 'previous cycle should retain all three stamp events';
  end if;

  -- Duplicate redemption reads back idempotently without advancing the cycle.
  perform public.redeem_self_service_reward(
    v_reward_id,
    '15000000-0000-0000-0000-0000000000c1'
  );

  select active_cycle_number into v_active_cycle
  from public.customer_memberships
  where id = '16000000-0000-0000-0000-0000000000c1';

  if v_active_cycle <> 2 then
    raise exception 'duplicate redemption advanced the cycle twice (got %)', v_active_cycle;
  end if;
end $$;

select 'reward redemption cycles ok';

rollback;
