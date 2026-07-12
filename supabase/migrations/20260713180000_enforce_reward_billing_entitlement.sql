create or replace function public.loyalty_billing_entitled(
  p_requires_billing boolean,
  p_billing_status text
)
returns boolean
language sql
immutable
as $$
  select not coalesce(p_requires_billing, true)
    or coalesce(p_billing_status, '') in ('active', 'trialing');
$$;

revoke all on function public.loyalty_billing_entitled(boolean, text)
from public, anon, authenticated;
grant execute on function public.loyalty_billing_entitled(boolean, text)
to service_role;

create or replace function public.loyalty_availability_reason(
  p_merchant_status text,
  p_card_active boolean,
  p_billing_status text,
  p_requires_billing boolean
)
returns text
language sql
immutable
as $$
  select case
    when p_merchant_status not in ('trial', 'active') then 'merchant_inactive'
    when not coalesce(p_card_active, false) then 'card_inactive'
    when not public.loyalty_billing_entitled(
      p_requires_billing,
      p_billing_status
    ) then case
      when p_billing_status is null then 'billing_required'
      else 'billing_blocked'
    end
    else null
  end;
$$;

create or replace function public.enforce_stamp_billing_entitlement()
returns trigger
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_requires_billing boolean;
  v_billing_status text;
begin
  select merchants.requires_billing, billing_customers.status
  into v_requires_billing, v_billing_status
  from public.merchants
  left join public.billing_customers
    on billing_customers.merchant_id = merchants.id
  where merchants.id = new.merchant_id;

  if not public.loyalty_billing_entitled(
    v_requires_billing,
    v_billing_status
  ) then
    raise exception 'This loyalty programme is unavailable while billing is inactive';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_reward_billing_entitlement()
returns trigger
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_requires_billing boolean;
  v_billing_status text;
begin
  select merchants.requires_billing, billing_customers.status
  into v_requires_billing, v_billing_status
  from public.merchants
  left join public.billing_customers
    on billing_customers.merchant_id = merchants.id
  where merchants.id = new.merchant_id;

  if not public.loyalty_billing_entitled(
    v_requires_billing,
    v_billing_status
  ) then
    raise exception 'This loyalty programme is unavailable while billing is inactive';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_reward_billing_entitlement_insert
on public.reward_events;
create trigger enforce_reward_billing_entitlement_insert
before insert on public.reward_events
for each row
when (new.status = 'unlocked')
execute function public.enforce_reward_billing_entitlement();

drop trigger if exists enforce_reward_billing_entitlement_redeem
on public.reward_events;
create trigger enforce_reward_billing_entitlement_redeem
before update of status on public.reward_events
for each row
when (new.status = 'redeemed' and old.status is distinct from new.status)
execute function public.enforce_reward_billing_entitlement();

revoke all on function public.enforce_reward_billing_entitlement()
from public, anon, authenticated;
grant execute on function public.enforce_reward_billing_entitlement()
to service_role;
