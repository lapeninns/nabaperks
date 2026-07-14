-- Replay guard (db phone plaintext retirement): this view reads the
-- plaintext phone column dropped at the end of the chain; view creation
-- validates columns, so post-drop replays skip it (the retirement migration
-- provides the current, last4-only view).
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'customers' and column_name = 'phone'
  ) then
    return;
  end if;

  execute $view$
create or replace view public.customers_masked
with (security_barrier = true)
as
select
  customers.id,
  case
    when customers.email is null or btrim(customers.email) = '' then null
    when position('@' in btrim(customers.email)) > 1
      and position('@' in btrim(customers.email)) < length(btrim(customers.email))
      then lower(left(btrim(customers.email), 1))
        || '***@'
        || lower(split_part(btrim(customers.email), '@', 2))
    else 'Email hidden'
  end as email,
  case
    when customer_phone.last4 is null then null
    else 'Phone ending ' || customer_phone.last4
  end as phone,
  customer_phone.last4 as phone_last4,
  customers.created_at,
  customers.updated_at
from public.customers
cross join lateral (
  select nullif(
    right(
      nullif(
        regexp_replace(
          coalesce(customers.phone_last4, customers.phone, ''),
          '[^0-9]',
          '',
          'g'
        ),
        ''
      ),
      4
    ),
    ''
  ) as last4
) as customer_phone
where
  customers.auth_user_id = (select auth.uid())
  or (select public.merchant_can_access_customer(customers.id))
  or (select public.is_internal_admin())
$view$;
end
$$;

revoke all on table public.customers_masked from anon;
grant select on table public.customers_masked to authenticated, service_role;

revoke select on table public.customers from authenticated;
grant select (id, phone_last4, created_at, updated_at)
  on table public.customers
  to authenticated;
grant select on table public.customers to service_role;

notify pgrst, 'reload schema';
