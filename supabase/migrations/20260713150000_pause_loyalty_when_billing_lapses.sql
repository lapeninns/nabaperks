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
    when coalesce(p_requires_billing, true) and p_billing_status is null then 'billing_required'
    when p_billing_status is not null
      and p_billing_status not in ('active', 'trialing') then 'billing_blocked'
    else null
  end;
$$;

create or replace function public.loyalty_availability_reason(
  p_merchant_status text,
  p_card_active boolean,
  p_billing_status text
)
returns text
language sql
immutable
as $$
  select public.loyalty_availability_reason(
    p_merchant_status,
    p_card_active,
    p_billing_status,
    false
  );
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

  if (coalesce(v_requires_billing, true) and v_billing_status is null)
    or (
      v_billing_status is not null
      and v_billing_status not in ('active', 'trialing')
    ) then
    raise exception 'This loyalty programme is unavailable while billing is inactive';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_stamp_billing_entitlement on public.stamp_events;
create trigger enforce_stamp_billing_entitlement
before insert on public.stamp_events
for each row
when (new.event_type = 'earned')
execute function public.enforce_stamp_billing_entitlement();

revoke all on function public.enforce_stamp_billing_entitlement()
from public, anon, authenticated;
grant execute on function public.enforce_stamp_billing_entitlement()
to service_role;
