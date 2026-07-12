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
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'billing-state:' || new.merchant_id::text,
      0
    )
  );

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
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'billing-state:' || new.merchant_id::text,
      0
    )
  );

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

revoke all on function public.enforce_stamp_billing_entitlement()
from public, anon, authenticated;
grant execute on function public.enforce_stamp_billing_entitlement()
to service_role;

revoke all on function public.enforce_reward_billing_entitlement()
from public, anon, authenticated;
grant execute on function public.enforce_reward_billing_entitlement()
to service_role;
