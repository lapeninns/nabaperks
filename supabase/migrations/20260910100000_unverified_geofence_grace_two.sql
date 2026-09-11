-- Unverified-location grace: 3 visits -> 2 per membership.
--
-- From visit 3, a missing GPS fix is still not treated as absence. The lifetime
-- allowance of those unverified visits is reduced so a farmed QR cannot ride
-- location-off as far. Already-issued unverified stamps stay; the next GPS visit
-- after two unverified stamps now refuses (NBS11) and offers the venue code.

create or replace function public.geofence_unverified_grace_limit()
returns integer
language sql
immutable
set search_path = public, auth, extensions
as $function$
  select 2;
$function$;

comment on function public.geofence_unverified_grace_limit() is
  'Lifetime unverified visits allowed per membership before location becomes mandatory.';

revoke all on function public.geofence_unverified_grace_limit() from public, anon, authenticated;
grant execute on function public.geofence_unverified_grace_limit() to service_role;
