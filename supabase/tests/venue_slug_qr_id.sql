-- Venue-name slugs for join QR public ids.

begin;

set local request.jwt.claim.role = 'service_role';

do $$
begin
  if public.slugify_text('Old Crown & Girton') <> 'old-crown-and-girton' then
    raise exception 'slugify_text did not normalise venue names';
  end if;

  if public.derive_join_qr_public_id(
    '10000000-0000-0000-0000-000000000001',
    '11000000-0000-0000-0000-000000000001',
    '14000000-0000-0000-0000-000000000001'
  ) <> 'old-crown-girton' then
    raise exception 'derive_join_qr_public_id did not use the venue name slug';
  end if;
end $$;

rollback;
