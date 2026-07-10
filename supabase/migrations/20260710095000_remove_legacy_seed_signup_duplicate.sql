-- Production repair: remove the legacy Bean & Batch seed signup event only
-- when the same merchant also has a genuine onboarding signup event.
--
-- The atomic-onboarding migration deliberately refuses to choose between
-- duplicate ledger rows. This repair makes that choice explicit and guarded:
-- exactly one synthetic seed row must match, and a non-seed signup event for
-- the same merchant must already exist. Any unexpected production shape fails
-- closed without deleting data.

do $remove_legacy_seed_signup_duplicate$
declare
  v_candidate_count bigint;
  v_deleted_count bigint;
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
        and coalesce(
          genuine_event.metadata ->> 'source',
          ''
        ) <> 'production_seed_bean_batch'
    );

  if v_candidate_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Expected exactly one superseded production seed signup event; found %s',
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
        and coalesce(
          genuine_event.metadata ->> 'source',
          ''
        ) <> 'production_seed_bean_batch'
    );

  get diagnostics v_deleted_count = row_count;

  if v_deleted_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Expected to remove exactly one superseded production seed signup event; removed %s',
        v_deleted_count
      );
  end if;
end;
$remove_legacy_seed_signup_duplicate$;
