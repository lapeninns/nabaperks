-- Close two database-containment gaps left by additive schema evolution:
--
-- 1. Supabase's table default ACL gave `authenticated` non-DML privileges on
--    the initial tables. TRUNCATE bypasses row-level security entirely, so a
--    session running as `authenticated` could erase protected ledgers.
-- 2. Three later tables enabled RLS but did not FORCE it, unlike every other
--    application table in the public schema.
--
-- Keep the supported SELECT/INSERT/UPDATE/DELETE grants unchanged. Only
-- schema-management and RLS-bypassing table privileges are removed from the
-- API roles. Cover the application migration owner so future application
-- tables cannot reintroduce the same grants through its default ACL.

alter table public.customer_join_stamp_recoveries force row level security;
alter table public.customer_loyalty_terms_acceptances force row level security;
alter table public.referrals force row level security;

revoke truncate, references, trigger, maintain
  on all tables in schema public
  from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke truncate, references, trigger, maintain
  on tables
  from anon, authenticated, service_role;
