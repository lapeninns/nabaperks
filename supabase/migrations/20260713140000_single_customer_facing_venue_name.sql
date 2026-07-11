create or replace function public.enforce_canonical_venue_name()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select merchants.business_name
  into new.name
  from public.merchants
  where merchants.id = new.merchant_id;

  if new.name is null then
    raise foreign_key_violation using message = 'Venue merchant not found';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_canonical_venue_name() from public, anon, authenticated;
grant execute on function public.enforce_canonical_venue_name() to service_role;

drop trigger if exists merchant_locations_canonical_name
on public.merchant_locations;

create trigger merchant_locations_canonical_name
before insert or update of name, merchant_id
on public.merchant_locations
for each row
execute function public.enforce_canonical_venue_name();

create or replace function public.sync_canonical_venue_name()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.merchant_locations
  set name = new.business_name
  where merchant_locations.merchant_id = new.id
    and merchant_locations.name is distinct from new.business_name;

  return new;
end;
$$;

revoke all on function public.sync_canonical_venue_name() from public, anon, authenticated;
grant execute on function public.sync_canonical_venue_name() to service_role;

drop trigger if exists merchants_sync_canonical_venue_name
on public.merchants;

create trigger merchants_sync_canonical_venue_name
after update of business_name
on public.merchants
for each row
when (old.business_name is distinct from new.business_name)
execute function public.sync_canonical_venue_name();

update public.merchant_locations
set name = merchants.business_name
from public.merchants
where merchant_locations.merchant_id = merchants.id
  and merchant_locations.name is distinct from merchants.business_name;
