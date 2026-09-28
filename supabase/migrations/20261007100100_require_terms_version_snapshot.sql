-- Refuse a terms acceptance whose version has no snapshot trigger.
--
-- WHY
--   Each customer terms version from 2026-09-26 onwards records its venue
--   terms snapshot through a dedicated BEFORE INSERT trigger named
--   customer_terms_apply_v<YYYYMMDD>_snapshot. When no trigger matches the
--   submitted policy_version, join_customer_membership stores its own built-in
--   snapshot (20260802120000), whose text predates later terms. If an
--   application build that sends a new version reaches a database before that
--   version's snapshot migration (an out-of-order promote, an app-only
--   redeploy, or a preview against an older database), every join in that
--   window would permanently record outdated venue terms under the new
--   version, with a matching hash, and nothing would fail.
--
-- WHAT CHANGES
--   * A new BEFORE INSERT trigger on customer_loyalty_terms_acceptances raises
--     object_not_in_prerequisite_state (55000) when a dated policy_version on
--     or after 2026-09-26 has no enabled customer_terms_apply_v<date>_snapshot
--     trigger on the table. The join transaction rolls back, so no membership,
--     consent or acceptance row is written, and the join page shows its
--     existing failure state.
--   * Future terms versions need no change here: adding their snapshot
--     trigger is what admits them.
--
-- WHAT DOES NOT CHANGE
--   * Versions 2026-09-26 and 2026-09-28 have their triggers (20260926100000,
--     20261007100000), so current and rolling-deploy joins are unaffected.
--   * Versions before 2026-09-26 and non-date versions (fixtures) keep the
--     earlier behaviour; the 2026-07-15 and 2026-07-19 triggers stay.
--   * Stored acceptances are not read or changed.
--
-- LIMITATION
--   This guard ships with the 2026-09-28 snapshot, so it cannot protect the
--   2026-09-28 rollout itself: a database without this migration has neither.
--   Apply migrations before the build, as the production runbook says. It
--   protects every later version.
--
-- Forward-only and re-runnable.

create or replace function public.require_customer_legal_terms_version_snapshot()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $function$
begin
  if new.policy_version is null
     or new.policy_version !~ '^\d{4}-\d{2}-\d{2}$'
     or new.policy_version < '2026-09-26' then
    return new;
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_trigger trg
    where trg.tgrelid = 'public.customer_loyalty_terms_acceptances'::regclass
      and not trg.tgisinternal
      and trg.tgenabled <> 'D'
      and trg.tgname = 'customer_terms_apply_v'
        || replace(new.policy_version, '-', '')
        || '_snapshot'
  ) then
    raise exception using
      errcode = 'object_not_in_prerequisite_state',
      message = format(
        'No venue terms snapshot is defined for policy version %s',
        new.policy_version
      ),
      hint = 'Apply the terms snapshot migration for this version before the application build that sends it.';
  end if;

  return new;
end;
$function$;
revoke all on function public.require_customer_legal_terms_version_snapshot()
  from public, anon, authenticated;
grant execute on function public.require_customer_legal_terms_version_snapshot()
  to service_role;

-- BEFORE triggers fire in name order; this name sorts after every
-- customer_terms_apply_v* trigger, although the check does not depend on it.
drop trigger if exists customer_terms_require_version_snapshot
  on public.customer_loyalty_terms_acceptances;
create trigger customer_terms_require_version_snapshot
before insert on public.customer_loyalty_terms_acceptances
for each row execute function public.require_customer_legal_terms_version_snapshot();

notify pgrst, 'reload schema';
