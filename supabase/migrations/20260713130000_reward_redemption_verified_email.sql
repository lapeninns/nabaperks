create table if not exists public.customer_reward_email_assurances (
  reward_event_id uuid primary key references public.reward_events(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  email_hmac text not null check (btrim(email_hmac) <> ''),
  verified_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  check (expires_at > verified_at)
);

alter table public.customer_reward_email_assurances enable row level security;
alter table public.customer_reward_email_assurances force row level security;
revoke all on table public.customer_reward_email_assurances
  from public, anon, authenticated;
grant select, insert, update, delete on table public.customer_reward_email_assurances
  to service_role;

create or replace function public.require_reward_email_assurance()
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
    or reward_record.email_verified_at is null
    or not exists (
      select 1
      from public.customer_reward_email_assurances assurances
      where assurances.reward_event_id = new.reward_event_id
        and assurances.customer_id = reward_record.customer_id
        and assurances.email_hmac = reward_record.email_hmac
        and assurances.expires_at > now()
    ) then
    raise check_violation using message = 'Fresh email verification required for reward collection';
  end if;

  return new;
end;
$$;

create or replace function public.require_reward_redemption_email_assurance()
returns trigger
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
begin
  if not exists (
    select 1
    from public.customers
    join public.customer_reward_email_assurances assurances
      on assurances.customer_id = customers.id
     and assurances.email_hmac = customers.email_hmac
    where customers.id = new.customer_id
      and customers.email_verified_at is not null
      and assurances.reward_event_id = new.id
      and assurances.expires_at > now()
  ) then
    raise check_violation using message = 'Fresh email verification required for reward collection';
  end if;

  return new;
end;
$$;

revoke all on function public.require_reward_email_assurance()
  from public, anon, authenticated;
revoke all on function public.require_reward_redemption_email_assurance()
  from public, anon, authenticated;
grant execute on function public.require_reward_email_assurance() to service_role;
grant execute on function public.require_reward_redemption_email_assurance() to service_role;

drop trigger if exists reward_scan_tokens_require_verified_email
  on public.reward_scan_tokens;
create trigger reward_scan_tokens_require_verified_email
  before insert on public.reward_scan_tokens
  for each row
  execute function public.require_reward_email_assurance();

drop trigger if exists reward_events_redeem_require_verified_email
  on public.reward_events;
create trigger reward_events_redeem_require_verified_email
  before update of status on public.reward_events
  for each row
  when (new.status = 'redeemed' and old.status is distinct from new.status)
  execute function public.require_reward_redemption_email_assurance();
