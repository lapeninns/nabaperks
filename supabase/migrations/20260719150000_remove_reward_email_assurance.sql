-- Drop per-reward email assurance (fresh 30-minute re-proof).
-- Keep account-level verified email as a DB guard on scan-token mint and redeem.

drop trigger if exists reward_scan_tokens_require_verified_email
  on public.reward_scan_tokens;
drop trigger if exists reward_events_redeem_require_verified_email
  on public.reward_events;

drop function if exists public.require_reward_email_assurance();
drop function if exists public.require_reward_redemption_email_assurance();

drop table if exists public.customer_reward_email_assurances;

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
    customers.email_hmac,
    customers.email_verified_at
  into reward_record
  from public.reward_events
  join public.customers on customers.id = reward_events.customer_id
  where reward_events.id = new.reward_event_id;

  if reward_record.customer_id is null
    or reward_record.customer_id <> new.customer_id
    or reward_record.merchant_id <> new.merchant_id
    or reward_record.membership_id <> new.membership_id
    or reward_record.email_hmac is null
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
      and customers.email_hmac is not null
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

create trigger reward_scan_tokens_require_verified_email
  before insert on public.reward_scan_tokens
  for each row
  execute function public.require_reward_verified_email_for_scan_token();

create trigger reward_events_redeem_require_verified_email
  before update of status on public.reward_events
  for each row
  when (new.status = 'redeemed' and old.status is distinct from new.status)
  execute function public.require_reward_verified_email_for_redeem();
