-- Restore the schema-level USAGE that the PostgREST pre-request guard needs.
--
-- 20260902138000 installed private.enforce_passwordless_data_api_session() as
-- the Data API pre-request hook and deliberately granted `usage on schema
-- private` to anon, authenticated and service_role: PostgREST calls that hook
-- as the request role on EVERY request, and a function call needs USAGE on its
-- schema in addition to EXECUTE.
--
-- The venue-code migrations (20260907100000, 20260907100100, 20260908100000)
-- each opened with `revoke all on schema private from public, anon,
-- authenticated, service_role` — an idiom copied from 20260902131000, which
-- predates the hook. That revoke strips the USAGE the hook depends on, so once
-- the guard is active every Data API request fails with
--
--   42501  permission denied for schema private
--
-- regardless of role or table. It surfaced first on the merchant OTP resend
-- path ("Unable to read rate limit bucket: permission denied for schema
-- private"), but nothing that speaks to PostgREST was working.
--
-- The safety the schema-level revoke was reaching for is already carried by
-- per-object revokes: every table and function in `private` revokes all from
-- public, anon, authenticated and service_role, and the guard function is the
-- single deliberate exception. USAGE on a schema grants no access to anything
-- inside it. To keep that true for objects added later, harden the schema's
-- default privileges so a new private function does not inherit PostgreSQL's
-- built-in EXECUTE-to-PUBLIC grant — the belt the blanket revoke was standing
-- in for.
--
-- Later migrations touching `private` must NOT reinstate a schema-level revoke
-- against the API roles. Revoke on the object, not on the schema.
--
-- Forward-only and re-runnable.

-- PUBLIC stays out of the schema entirely.
revoke all on schema private from public;

grant usage on schema private to anon, authenticated, service_role;

-- Objects created in `private` from here on start with no API-role privileges,
-- so restoring USAGE cannot widen a future function by omission.
alter default privileges for role postgres in schema private
  revoke execute on functions from public, anon, authenticated, service_role;

alter default privileges for role postgres in schema private
  revoke all on tables from public, anon, authenticated, service_role;

alter default privileges for role postgres in schema private
  revoke all on sequences from public, anon, authenticated, service_role;

notify pgrst, 'reload schema';
