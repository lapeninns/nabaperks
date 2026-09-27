-- Customer sessions last until the customer logs out.
--
-- Until now a customer session had a hard 30-day window: touch recorded
-- last-seen but never extended expires_at, so every customer was signed out a
-- month after signing in and had to receive another SMS code. The app now
-- registers new sessions with expires_at = 'infinity' and re-signs the browser
-- cookie on visits; this migration covers the database side.
--
-- 1. touch_customer_session: a session that is still valid (same customer,
--    same device, not revoked, not yet expired) becomes open-ended. Existing
--    30-day sessions therefore convert on the customer's next visit instead of
--    through a bulk backfill, and sessions minted by the previous app release
--    during the rollout convert the same way. Expired and revoked rows are
--    untouched, so revocation, erasure and the retention jobs keep working.
--
-- 2. revoke_all_customer_sessions: backs "Log out on all devices", the
--    customer's remedy for a lost or shared phone now that sessions no longer
--    lapse on their own. Service role only; the app passes the customer id
--    from the caller's own verified session.
--
-- Compatibility: the previous app release still registers 30-day sessions and
-- reads nothing new, so it keeps working against this schema.

create or replace function public.touch_customer_session(
  p_customer_id uuid,
  p_session_id uuid,
  p_device_hash text
)
returns boolean
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
begin
  if p_device_hash is null or p_device_hash !~ '^[0-9a-f]{64}$' then
    return false;
  end if;

  update public.customer_sessions
  set
    last_seen_at = now(),
    expires_at = 'infinity'
  where id = p_session_id
    and customer_id = p_customer_id
    and device_hash = p_device_hash
    and revoked_at is null
    and expires_at > now();

  if not found then
    return false;
  end if;

  update public.customer_otp_trusted_devices
  set
    last_seen_at = now(),
    trusted_until = now() + interval '90 days'
  where customer_id = p_customer_id
    and device_hash = p_device_hash
    and revoked_at is null;

  return true;
end;
$$;

revoke all on function public.touch_customer_session(uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.touch_customer_session(uuid, uuid, text)
  to service_role;

create or replace function public.revoke_all_customer_sessions(
  p_customer_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  revoked_count integer;
begin
  if not public.is_service_role_request() then
    raise insufficient_privilege using message = 'Service role required';
  end if;

  if p_customer_id is null then
    raise exception 'Invalid customer';
  end if;

  update public.customer_sessions
  set revoked_at = now()
  where customer_id = p_customer_id
    and revoked_at is null;

  get diagnostics revoked_count = row_count;
  return revoked_count;
end;
$$;

revoke all on function public.revoke_all_customer_sessions(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.revoke_all_customer_sessions(uuid)
  to service_role;

comment on function public.revoke_all_customer_sessions(uuid) is
  'Revokes every active session for one customer ("Log out on all devices"). Returns the number revoked. Service role only.';

notify pgrst, 'reload schema';
