create or replace function public.production_readiness_probe()
returns boolean
language sql
immutable
parallel safe
as $$
  select true;
$$;

revoke all on function public.production_readiness_probe() from public;
grant execute on function public.production_readiness_probe()
  to anon, authenticated, service_role;
