-- "Log out on all devices" also withdraws device trust (QA BUG-011,
-- 38c42a1..2c45031).
--
-- revoke_all_customer_sessions (20261005100600) is the customer's remedy for
-- a lost or shared phone, but it revoked only customer_sessions. Every
-- customer_otp_trusted_devices row kept up to 90 days of trust, so the lost
-- device was still "recognised" on its next sign-in, and would skip the
-- recovery step if the device-continuity gate (SEC-RISK-001) is restored.
--
-- It now also revokes the customer's unrevoked trusted-device rows, so
-- customer_auth_device_is_trusted treats them as untrusted. A later verified
-- sign-in re-establishes trust through register_customer_session's upsert,
-- which clears revoked_at. The return value is unchanged: the number of
-- sessions revoked.
--
-- Same signature, security definer, search_path and grants as before. Safe to
-- apply before or after the app, which calls it unchanged.

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

  update public.customer_otp_trusted_devices
  set revoked_at = now()
  where customer_id = p_customer_id
    and revoked_at is null;

  return revoked_count;
end;
$$;

revoke all on function public.revoke_all_customer_sessions(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.revoke_all_customer_sessions(uuid)
  to service_role;

comment on function public.revoke_all_customer_sessions(uuid) is
  'Revokes every active session and every device trust row for one customer ("Log out on all devices"). Returns the number of sessions revoked. Service role only.';

notify pgrst, 'reload schema';
