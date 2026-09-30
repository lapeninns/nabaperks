-- The terms version guard refuses by default (QA BUG-037, 38c42a1..2c45031).
--
-- WHY
--   require_customer_legal_terms_version_snapshot() (20261007100100, widened
--   in 20261007100300) refused a dated version from 2026-09-26 onwards that
--   had no snapshot trigger, but let any other shape through: 2026-09-28.0,
--   2026-09-28.01, 2026-9-30, v2026-10-01, 2026-10-01T00:00 and so on. For
--   those the join stored its own built-in venue terms, which predate the
--   current terms, under the new label and with a matching hash. A typo in
--   CUSTOMER_LEGAL_VERSION would silently bring back the failure the guard
--   was written to stop.
--
-- WHAT CHANGES
--   A terms acceptance is admitted only when its policy_version is:
--     * a dated version (YYYY-MM-DD, optionally .N with N from 1) before
--       2026-09-26, the earlier behaviour;
--     * a dated version from 2026-09-26 whose enabled
--       customer_terms_apply_v<version>_snapshot trigger exists, as before;
--     * a plain fixture name with no digits except an optional -vN suffix
--       (lower-case words joined by '-', such as phone-test-v1, stress-test,
--       staging-release-v1), which tests and staging checks use.
--   Anything else is refused with object_not_in_prerequisite_state (55000),
--   so the join rolls back and nothing is recorded.
--
-- COMPATIBILITY
--   The deployed app (2c45031c) sends 2026-09-28.1, which has its trigger.
--   Every version the app has sent is dated. Stored acceptances are not read
--   or changed. The function keeps its name, trigger, owner, security
--   definer, search_path and grants.
--
-- Forward-only and re-runnable.

create or replace function public.require_customer_legal_terms_version_snapshot()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $function$
begin
  if new.policy_version is null then
    return new;
  end if;

  if new.policy_version !~ '^\d{4}-\d{2}-\d{2}(\.[1-9][0-9]*)?$' then
    if new.policy_version ~ '^[a-z]+(-[a-z]+)*(-v[1-9][0-9]*)?$' then
      return new;
    end if;
    raise exception using
      errcode = 'object_not_in_prerequisite_state',
      message = format(
        'Venue terms policy version %s is not a recognised version',
        new.policy_version
      ),
      hint = 'Customer terms versions are YYYY-MM-DD or YYYY-MM-DD.N with N from 1.';
  end if;

  if new.policy_version < '2026-09-26' then
    return new;
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_trigger trg
    where trg.tgrelid = 'public.customer_loyalty_terms_acceptances'::regclass
      and not trg.tgisinternal
      and trg.tgenabled <> 'D'
      and trg.tgname = 'customer_terms_apply_v'
        || replace(replace(new.policy_version, '-', ''), '.', '_')
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

notify pgrst, 'reload schema';
