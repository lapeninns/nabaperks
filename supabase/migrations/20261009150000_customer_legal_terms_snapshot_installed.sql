-- Readiness can prove the terms snapshot for the app's version is installed
-- (QA BUG-006, 38c42a1..2c45031).
--
-- A join records the app's CUSTOMER_LEGAL_VERSION. When the database lacks
-- that version's snapshot trigger, the join function stores its older
-- built-in snapshot under the new version, silently and permanently (the
-- 20261007100100 guard only refuses plain dated versions, and the .N-aware
-- guard ships with the 2026-09-28.1 trigger in 20261007100300). The runbook
-- pre-flight named the wrong function and nothing automated checked it.
--
-- customer_legal_terms_snapshot_installed(p_version) answers whether the
-- enabled BEFORE INSERT trigger that snapshots p_version is installed on
-- customer_loyalty_terms_acceptances. The trigger name follows the existing
-- rule the guard uses: 'customer_terms_apply_v' || version with '-' removed
-- and '.' replaced by '_' || '_snapshot' (2026-09-28.1 ->
-- customer_terms_apply_v20260928_1_snapshot). A version that is not a dated
-- version (YYYY-MM-DD with optional .N) answers false. /api/readiness calls it
-- with the build's version and reports not_ready when it answers false.
--
-- Reads only pg_catalog; returns a boolean, no row data. Service role only.
-- Compatibility: a new function that nothing in the deployed app (2c45031c)
-- calls. The new app's readiness needs it, so apply it before that app, as
-- the release workflow does. Forward-only and re-runnable.

create or replace function public.customer_legal_terms_snapshot_installed(
  p_version text
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, pg_temp
as $function$
  select coalesce(p_version, '') ~ '^\d{4}-\d{2}-\d{2}(\.[1-9][0-9]*)?$'
    and exists (
      select 1
      from pg_catalog.pg_trigger trg
      where trg.tgrelid = 'public.customer_loyalty_terms_acceptances'::regclass
        and not trg.tgisinternal
        and trg.tgenabled <> 'D'
        and trg.tgname = 'customer_terms_apply_v'
          || replace(replace(p_version, '-', ''), '.', '_')
          || '_snapshot'
    );
$function$;

revoke all on function public.customer_legal_terms_snapshot_installed(text)
  from public, anon, authenticated;
grant execute on function public.customer_legal_terms_snapshot_installed(text)
  to service_role;

notify pgrst, 'reload schema';
