-- The current application uses complete_merchant_onboarding, which derives a
-- collision-resistant slug from authenticated owner identity. The legacy
-- seven-argument adapter accepts a caller-selected global slug, so it is kept
-- only for trusted service-role release proof and removed from the public API.

revoke all on function public.create_merchant_onboarding(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text
) from public, anon, authenticated;

grant execute on function public.create_merchant_onboarding(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text
) to service_role;

notify pgrst, 'reload schema';
