-- Admin assurance boundary: make the database own the admin step-up decision.
--
-- `is_internal_admin()` gates ~58 RLS policies and ~22 admin RPCs, so it — not
-- the React layout — decides whether a compromised password-only (aal1) admin
-- session can reach admin state straight through the Data API. Until now it
-- asked only "is there an active internal_admins row", so the app-layer MFA
-- prompt in lib/admin/mfa-gate.ts could be skipped entirely by calling PostgREST.
--
-- 20260702180000 previously required aal2 unconditionally and 20260720100000
-- reverted it because password sign-in is aal1 and that locked out every admin.
-- This migration therefore encodes the SAME policy the app already applies
-- ("enforce only when enrolled") rather than a blanket aal2 requirement:
--
--   no verified factor  -> allowed at aal1 (nothing to enforce, no lockout)
--   verified factor     -> the session must have completed the challenge (aal2)
--
-- Because an admin can always reach aal2 through the in-app step-up flow that
-- did not exist in July, the lockout that forced the revert cannot recur.

-- Assurance level of the calling request. Mirrors auth.uid()'s claim
-- resolution: GoTrue may present claims either as individual GUCs or as one
-- JSON blob, and both must yield the same answer. Absent/blank claims degrade
-- to 'aal1', so an unauthenticated or malformed context is never treated as
-- stepped up.
create or replace function public.request_assurance_level()
returns text
language sql
stable
set search_path = public, auth
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.aal', true), ''),
    nullif(
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'aal',
      ''
    ),
    'aal1'
  );
$$;

comment on function public.request_assurance_level() is
  'Authenticator assurance level (aal1/aal2) of the current request, defaulting to aal1 when unproven.';

-- True once the user has an authenticator they could step up with. Only a
-- 'verified' factor counts: an abandoned half-finished enrolment must not be
-- able to lock an admin out of the console.
-- auth.mfa_factors has RLS enabled and NO policies, so a reader without
-- BYPASSRLS sees zero rows *without error* — indistinguishable from "not
-- enrolled", which would silently reopen the bypass. Fail closed instead: if
-- this function cannot actually read the table, it raises rather than lying.
create or replace function public.has_verified_mfa_factor(p_user_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_can_read boolean;
begin
  select coalesce(bool_or(rolbypassrls or rolsuper), false)
  into v_can_read
  from pg_roles
  where rolname = current_user;

  if not v_can_read
     or not has_table_privilege(current_user, 'auth.mfa_factors', 'select') then
    raise exception
      'has_verified_mfa_factor cannot read auth.mfa_factors as %', current_user
      using errcode = 'insufficient_privilege';
  end if;

  return exists (
    select 1
    from auth.mfa_factors
    where user_id = p_user_id
      and status = 'verified'
  );
end;
$$;

comment on function public.has_verified_mfa_factor(uuid) is
  'True when the user has at least one verified MFA factor, so step-up can be required of them. Raises rather than returning false when it cannot read auth.mfa_factors.';

-- The application cannot trust the browser session for enrolment state:
-- supabase-js derives nextLevel from the cached session cookie''s factor list,
-- which is stale for any session minted before the factor was enrolled. This
-- exposes the authoritative answer for the CALLER''S OWN account only.
create or replace function public.viewer_has_verified_mfa_factor()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.has_verified_mfa_factor((select auth.uid()));
$$;

comment on function public.viewer_has_verified_mfa_factor() is
  'Authoritative MFA-enrolment state for the calling user only; the browser session cannot be trusted for this.';

create or replace function public.is_internal_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.internal_admins
    where user_id = (select auth.uid())
      and is_active
  )
  and (
    -- "Enforce only when enrolled": unenrolled admins keep working, enrolled
    -- admins must present a stepped-up session.
    not (select public.has_verified_mfa_factor((select auth.uid())))
    or (select public.request_assurance_level()) = 'aal2'
  );
$$;

-- The two helpers are internal to is_internal_admin(), which is SECURITY
-- DEFINER and therefore reaches them as the function owner. Nothing outside
-- that boundary may call them, so they stay off the authenticated EXECUTE
-- allowlist enforced by rpc-execute-privilege-containment.
revoke all on function public.request_assurance_level() from public, anon, authenticated;
revoke all on function public.has_verified_mfa_factor(uuid) from public, anon, authenticated;

-- service_role still holds execute on every public function (asserted by
-- rpc-execute-privilege-containment); only the API roles are excluded.
grant execute on function public.request_assurance_level() to service_role;
grant execute on function public.has_verified_mfa_factor(uuid) to service_role;

-- Callable by the signed-in user: it discloses only their own enrolment state.
revoke all on function public.viewer_has_verified_mfa_factor() from public, anon;
grant execute on function public.viewer_has_verified_mfa_factor() to authenticated, service_role;

grant execute on function public.is_internal_admin() to authenticated, service_role;

notify pgrst, 'reload schema';
