revoke all on function public.production_readiness_probe()
  from public, anon, authenticated;
grant execute on function public.production_readiness_probe() to service_role;
