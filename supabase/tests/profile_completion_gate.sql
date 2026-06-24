-- Profile-completion gate on redeem_self_service_reward.
--
-- Builds a fresh, redeemable reward for a throwaway customer on the seeded Old
-- Crown Girton programme, then drives the profile gate through every branch. Runs as the
-- migration owner (RLS bypassed) with the service-role JWT claim so the RPC skips
-- the auth.uid ownership check and decides purely on customer_id + profile state.
-- The whole thing rolls back, leaving seed data untouched.

begin;

set local request.jwt.claim.role = 'service_role';

-- Throwaway customer with a phone identity but no name/DOB/email yet. phone_hmac
-- satisfies customers_contact_present so email can be null.
insert into public.customers (id, auth_user_id, phone_hmac, phone_last4, phone_country)
values (
  '15000000-0000-0000-0000-0000000009a1',
  null,
  'profile-gate-test-hmac-9a1',
  '4242',
  'GB'
);

insert into public.customer_memberships (
  id, merchant_id, customer_id, current_stamp_count, total_stamps_earned
)
values (
  '16000000-0000-0000-0000-0000000009a1',
  '10000000-0000-0000-0000-000000000001',
  '15000000-0000-0000-0000-0000000009a1',
  3,
  3
);

-- A reward that is ready by every existing rule: unlocked, full stamps, redeemable
-- today. Only the profile gate stands between it and redemption.
insert into public.reward_events (
  id, merchant_id, customer_id, membership_id, loyalty_card_id,
)
values (
  '1f000000-0000-0000-0000-0000000009a1',
  '10000000-0000-0000-0000-000000000001',
  '15000000-0000-0000-0000-0000000009a1',
  '16000000-0000-0000-0000-0000000009a1',
  '13000000-0000-0000-0000-000000000001',
  'unlocked',
  'Free pint',
  'A pint on the house.',
  null,
  public.uk_business_date(now())
);

-- Scenario 1: no name, no DOB -> blocked.
do $$
begin
  perform public.redeem_self_service_reward(
    '1f000000-0000-0000-0000-0000000009a1',
    '15000000-0000-0000-0000-0000000009a1'
  );
  raise exception 'redemption succeeded with an empty profile';
exception
  when others then
    if sqlerrm not like '%Complete your profile%' then
      raise exception 'expected profile gate, got: %', sqlerrm;
    end if;
end $$;

-- Scenario 2: name present but DOB still missing -> blocked.
update public.customers
set full_name = 'Sam Taylor'
where id = '15000000-0000-0000-0000-0000000009a1';

do $$
begin
  perform public.redeem_self_service_reward(
    '1f000000-0000-0000-0000-0000000009a1',
    '15000000-0000-0000-0000-0000000009a1'
  );
  raise exception 'redemption succeeded without a date of birth';
exception
  when others then
    if sqlerrm not like '%Complete your profile%' then
      raise exception 'expected profile gate (missing DOB), got: %', sqlerrm;
    end if;
end $$;

-- Scenario 3: name + DOB present, but an email is set and not yet verified -> blocked.
update public.customers
set date_of_birth = date '1990-01-01',
    email = 'sam.taylor@example.test',
    email_verified_at = null
where id = '15000000-0000-0000-0000-0000000009a1';

do $$
begin
  perform public.redeem_self_service_reward(
    '1f000000-0000-0000-0000-0000000009a1',
    '15000000-0000-0000-0000-0000000009a1'
  );
  raise exception 'redemption succeeded with an unverified email';
exception
  when others then
    if sqlerrm not like '%Complete your profile%' then
      raise exception 'expected profile gate (unverified email), got: %', sqlerrm;
    end if;
end $$;

-- Scenario 4: name + DOB present, email verified -> succeeds and marks the reward redeemed.
update public.customers
set email_verified_at = now()
where id = '15000000-0000-0000-0000-0000000009a1';

do $$
declare
  redeemed_status text;
begin
  perform public.redeem_self_service_reward(
    '1f000000-0000-0000-0000-0000000009a1',
    '15000000-0000-0000-0000-0000000009a1'
  );

  select status into redeemed_status
  from public.reward_events
  where id = '1f000000-0000-0000-0000-0000000009a1';

  if redeemed_status <> 'redeemed' then
    raise exception 'a complete profile did not redeem the reward (status %)', redeemed_status;
  end if;
end $$;

select 'profile completion gate ok';

rollback;
