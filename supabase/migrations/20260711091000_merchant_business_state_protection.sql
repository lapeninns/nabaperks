-- MS-db-emergency-containment — Blocker 2: merchant owners can bypass billing.
--
-- `authenticated` holds broad table mutation grants and the merchants UPDATE
-- policy only checks ownership, so an owner can run
--   update public.merchants set requires_billing = false;
-- or flip status straight to 'active', and loyalty_availability_reason then
-- treats the venue as live without a billing record.
--
-- A BEFORE UPDATE trigger refuses changes to the protected business-state
-- columns (requires_billing, status) from any non-privileged session. Privileged
-- writers are unaffected:
--   * service_role  — Stripe webhook sync, cron, and admin service paths,
--   * internal admins — the admin console (verified via the same helper the
--     RLS policies use), and
--   * raw backend SQL — migrations, seeds, and psql, which carry no request
--     JWT role at all.
--
-- The trigger function is SECURITY DEFINER on purpose: it calls
-- is_service_role_request()/is_internal_admin(), which the companion ACL
-- migration revokes from `authenticated`. Running as the owner means those
-- helper calls succeed for every writer, while the decision still keys off the
-- request's JWT-claim GUCs (unchanged by SECURITY DEFINER), giving true
-- app-parity role detection.

create or replace function public.enforce_merchant_business_state_protection()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_privileged boolean;
begin
  -- Only guard genuine changes to the protected columns.
  if new.requires_billing is not distinct from old.requires_billing
     and new.status is not distinct from old.status then
    return new;
  end if;

  v_privileged :=
    public.is_service_role_request()
    or public.is_internal_admin()
    -- Raw backend SQL (migration/seed/psql/superuser) carries no request role.
    or nullif(current_setting('request.jwt.claim.role', true), '') is null;

  if not v_privileged then
    if new.requires_billing is distinct from old.requires_billing then
      raise exception using
        errcode = 'insufficient_privilege',
        message = 'merchants.requires_billing is billing-protected and cannot be changed directly';
    end if;
    raise exception using
      errcode = 'insufficient_privilege',
      message = 'merchants.status is billing-protected and cannot be changed directly';
  end if;

  return new;
end;
$$;

revoke execute on function public.enforce_merchant_business_state_protection() from public, anon, authenticated;
grant execute on function public.enforce_merchant_business_state_protection() to service_role;

drop trigger if exists merchants_protect_business_state on public.merchants;
create trigger merchants_protect_business_state
  before update on public.merchants
  for each row
  execute function public.enforce_merchant_business_state_protection();
