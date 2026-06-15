-- Global marketing consent from the /home profile.
--
-- A throwaway customer belongs to two seeded merchants. Toggling SMS off through
-- record_customer_marketing_consent must append one opted_out row per membership
-- (preserving each merchant's per-merchant trail), and the latest SMS row must read
-- as opted_out. Runs as the migration owner with the service-role JWT claim so the
-- security-definer RPC trusts the resolved customer. The whole thing rolls back.

begin;

set local request.jwt.claim.role = 'service_role';

-- Throwaway customer with a phone identity (phone_hmac satisfies the contact-present
-- invariant so email can be null).
insert into public.customers (id, auth_user_id, phone_hmac, phone_last4, phone_country)
values (
  '15000000-0000-0000-0000-0000000009b1',
  null,
  'marketing-consent-test-hmac-9b1',
  '4242',
  'GB'
);

-- Two memberships across the two seeded merchants.
insert into public.customer_memberships (
  id, merchant_id, customer_id, current_stamp_count, total_stamps_earned
)
values
  (
    '16000000-0000-0000-0000-0000000009b1',
    '10000000-0000-0000-0000-000000000001',
    '15000000-0000-0000-0000-0000000009b1',
    0,
    0
  ),
  (
    '16000000-0000-0000-0000-0000000009b2',
    '10000000-0000-0000-0000-000000000002',
    '15000000-0000-0000-0000-0000000009b1',
    0,
    0
  );

-- Prior state: opted in on SMS at join time across both venues. Inserted directly
-- with an earlier created_at so the later opt-out is unambiguously the newest row
-- (record_customer_marketing_consent stamps every row with the transaction's now()).
insert into public.consent_records (
  merchant_id, customer_id, channel, consent_status, source, policy_version, created_at
)
values
  (
    '10000000-0000-0000-0000-000000000001',
    '15000000-0000-0000-0000-0000000009b1',
    'sms', 'opted_in', 'customer_join', '2026-06-06', now() - interval '1 hour'
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    '15000000-0000-0000-0000-0000000009b1',
    'sms', 'opted_in', 'customer_join', '2026-06-06', now() - interval '1 hour'
  );

-- Now toggle SMS off from the profile.
do $$
begin
  perform public.record_customer_marketing_consent(
    '15000000-0000-0000-0000-0000000009b1',
    'sms',
    'opted_out',
    '2026-06-06'
  );
end $$;

-- Exactly one opted_out SMS row per membership (two merchants), all sourced from
-- the profile and scoped to all memberships.
do $$
declare
  opted_out_count integer;
begin
  select count(*) into opted_out_count
  from public.consent_records
  where customer_id = '15000000-0000-0000-0000-0000000009b1'
    and channel = 'sms'
    and consent_status = 'opted_out'
    and source = 'customer_profile'
    and metadata ->> 'scope' = 'all_memberships';

  if opted_out_count <> 2 then
    raise exception 'expected 2 opted_out SMS rows, got %', opted_out_count;
  end if;
end $$;

-- Latest SMS record per merchant reads as opted_out.
do $$
declare
  merchant record;
  latest_status text;
begin
  for merchant in
    select unnest(array[
      '10000000-0000-0000-0000-000000000001'::uuid,
      '10000000-0000-0000-0000-000000000002'::uuid
    ]) as merchant_id
  loop
    select consent_status into latest_status
    from public.consent_records
    where customer_id = '15000000-0000-0000-0000-0000000009b1'
      and merchant_id = merchant.merchant_id
      and channel = 'sms'
    order by created_at desc
    limit 1;

    if latest_status <> 'opted_out' then
      raise exception 'latest SMS consent for merchant % was % (expected opted_out)',
        merchant.merchant_id, latest_status;
    end if;
  end loop;
end $$;

select 'customer marketing consent ok';

rollback;
