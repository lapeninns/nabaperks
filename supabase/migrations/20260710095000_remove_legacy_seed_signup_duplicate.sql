-- MS-db-emergency-containment — Blocker 3b: restore the lost seed-repair migration.
--
-- Version 20260710095000 was authored on an unmerged branch and applied to the
-- live database out-of-band, but never landed on main. The live ledger therefore
-- carries a migration the checkout does not, and `supabase migration list
-- --linked` reports it as remote-only drift. Re-introducing the file at its
-- original version realigns the ledger (live already has this version, so a push
-- skips it) and gives fresh databases a matching, replay-safe step.
--
-- The original was a one-shot DO block that asserted EXACTLY one candidate and
-- raised otherwise — correct for the specific production incident, but fatal on
-- a fresh database where the legacy Bean & Batch seed duplicate never existed.
-- This restoration is a fresh-SAFE bridge exposed as a re-runnable function so
-- its cardinality contract is directly testable:
--   * zero candidates  -> no-op (fresh / already-repaired), return 0
--   * exactly one       -> delete the superseded seed signup, return 1
--   * more than one     -> fail closed, change nothing
--
-- "Candidate" means a synthetic production-seed signup event for a merchant that
-- ALSO has a genuine, non-seed signup event — i.e. a duplicate the seed created.

create or replace function public.remove_legacy_seed_signup_duplicate()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_candidate_count bigint;
  v_deleted_count integer;
begin
  select count(*)
  into v_candidate_count
  from public.product_events as seed_event
  where seed_event.event_name = 'merchant_signed_up'
    and seed_event.metadata ->> 'source' = 'production_seed_bean_batch'
    and exists (
      select 1
      from public.product_events as genuine_event
      where genuine_event.merchant_id = seed_event.merchant_id
        and genuine_event.event_name = 'merchant_signed_up'
        and genuine_event.id <> seed_event.id
        and coalesce(genuine_event.metadata ->> 'source', '') <> 'production_seed_bean_batch'
    );

  if v_candidate_count = 0 then
    return 0;
  end if;

  if v_candidate_count > 1 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Expected at most one superseded production seed signup event; found %s',
        v_candidate_count
      );
  end if;

  delete from public.product_events as seed_event
  where seed_event.event_name = 'merchant_signed_up'
    and seed_event.metadata ->> 'source' = 'production_seed_bean_batch'
    and exists (
      select 1
      from public.product_events as genuine_event
      where genuine_event.merchant_id = seed_event.merchant_id
        and genuine_event.event_name = 'merchant_signed_up'
        and genuine_event.id <> seed_event.id
        and coalesce(genuine_event.metadata ->> 'source', '') <> 'production_seed_bean_batch'
    );

  get diagnostics v_deleted_count = row_count;
  return v_deleted_count;
end;
$$;

revoke execute on function public.remove_legacy_seed_signup_duplicate() from public, anon, authenticated;
grant execute on function public.remove_legacy_seed_signup_duplicate() to service_role;

-- Apply the repair once at migration time (no-op on fresh/already-clean databases).
select public.remove_legacy_seed_signup_duplicate();
