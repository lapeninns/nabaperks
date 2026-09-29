-- Activate the verified-phone requirement for reward collection.
--
-- 20261007100200 installed the collection-state check and the scan-token and
-- redemption triggers behind this predicate, returning false so the app that
-- was live while it ran kept working. The compatible app (289f22bd, #400, and
-- its follow-up 2c45031c, #404) has been live in production since
-- 2026-09-29 11:42 UTC: it asks email-only wallets for a verified phone in
-- Profile and at the reward collection gate. From here the database refuses
-- collection, scan tokens and redemption for a wallet without one.

create or replace function private.reward_phone_verification_required()
returns boolean
language sql
stable
set search_path = pg_catalog
as $$ select true $$;

revoke all on function private.reward_phone_verification_required()
  from public, anon, authenticated, service_role;

notify pgrst, 'reload schema';
