-- Keep verified-email reward collection compatible with accounts verified
-- before customers.email_hmac existed. The verification timestamp and stored
-- email are the authoritative account-level proof; email_hmac is a lookup aid
-- derived by the application and cannot be safely reconstructed in SQL.

create or replace function public.require_reward_verified_email_for_scan_token()
returns trigger
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  reward_record record;
begin
  select
    reward_events.customer_id,
    reward_events.merchant_id,
    reward_events.membership_id,
    customers.email,
    customers.email_verified_at
  into reward_record
  from public.reward_events
  join public.customers on customers.id = reward_events.customer_id
  where reward_events.id = new.reward_event_id;

  if reward_record.customer_id is null
    or reward_record.customer_id <> new.customer_id
    or reward_record.merchant_id <> new.merchant_id
    or reward_record.membership_id <> new.membership_id
    or nullif(btrim(reward_record.email), '') is null
    or reward_record.email_verified_at is null then
    raise check_violation
      using message = 'Verified email required for reward collection';
  end if;

  return new;
end;
$$;

create or replace function public.require_reward_verified_email_for_redeem()
returns trigger
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
begin
  if not exists (
    select 1
    from public.customers
    where customers.id = new.customer_id
      and nullif(btrim(customers.email), '') is not null
      and customers.email_verified_at is not null
  ) then
    raise check_violation
      using message = 'Verified email required for reward collection';
  end if;

  return new;
end;
$$;

revoke all on function public.require_reward_verified_email_for_scan_token()
  from public, anon, authenticated;
revoke all on function public.require_reward_verified_email_for_redeem()
  from public, anon, authenticated;
grant execute on function public.require_reward_verified_email_for_scan_token()
  to service_role;
grant execute on function public.require_reward_verified_email_for_redeem()
  to service_role;
