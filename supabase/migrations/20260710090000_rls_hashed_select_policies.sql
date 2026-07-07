-- MS-db-rls-hashed-select-policies: resolve tenant ownership once per query.
--
-- The seven ledger SELECT policies below called is_customer_owner(row.col) /
-- is_merchant_owner(row.col) inside correlated subselects, so Postgres
-- executed them once per scanned row: the members-page exact count measured
-- 936 ms at 100k members with ~503k buffer hits (2026-07-07 stress test).
-- Policy subqueries run with the caller's privileges and `authenticated`
-- holds no SELECT on public.customers, so the ownership lookup moves into
-- SECURITY DEFINER set-returning helpers that the planner materializes once
-- per query (uncorrelated subplan). Row visibility is unchanged for every
-- identity; write-path policies and the small config tables are untouched.

create or replace function public.owned_customer_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select c.id
  from public.customers c
  where c.auth_user_id = (select auth.uid())
$$;

create or replace function public.owned_merchant_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select m.id
  from public.merchants m
  where m.owner_user_id = (select auth.uid())
$$;

revoke all on function public.owned_customer_ids() from public, anon;
revoke all on function public.owned_merchant_ids() from public, anon;
grant execute on function public.owned_customer_ids() to authenticated, service_role;
grant execute on function public.owned_merchant_ids() to authenticated, service_role;

-- Shared customer-or-merchant-or-admin shape.

drop policy if exists customer_memberships_select_scoped on public.customer_memberships;
create policy customer_memberships_select_scoped on public.customer_memberships
  for select to authenticated
  using (
    customer_id in (select public.owned_customer_ids())
    or merchant_id in (select public.owned_merchant_ids())
    or (select public.is_internal_admin())
  );

drop policy if exists stamp_events_select_scoped on public.stamp_events;
create policy stamp_events_select_scoped on public.stamp_events
  for select to authenticated
  using (
    customer_id in (select public.owned_customer_ids())
    or merchant_id in (select public.owned_merchant_ids())
    or (select public.is_internal_admin())
  );

drop policy if exists reward_events_select_scoped on public.reward_events;
create policy reward_events_select_scoped on public.reward_events
  for select to authenticated
  using (
    customer_id in (select public.owned_customer_ids())
    or merchant_id in (select public.owned_merchant_ids())
    or (select public.is_internal_admin())
  );

drop policy if exists consent_records_select_scoped on public.consent_records;
create policy consent_records_select_scoped on public.consent_records
  for select to authenticated
  using (
    customer_id in (select public.owned_customer_ids())
    or merchant_id in (select public.owned_merchant_ids())
    or (select public.is_internal_admin())
  );

-- product_events keeps its NULL guards (rows may be merchant-only or
-- customer-only).

drop policy if exists product_events_select_scoped on public.product_events;
create policy product_events_select_scoped on public.product_events
  for select to authenticated
  using (
    (merchant_id is not null and merchant_id in (select public.owned_merchant_ids()))
    or (customer_id is not null and customer_id in (select public.owned_customer_ids()))
    or (select public.is_internal_admin())
  );

-- audit_logs stays merchant-or-admin only (no customer clause, as before).

drop policy if exists audit_logs_select_scoped on public.audit_logs;
create policy audit_logs_select_scoped on public.audit_logs
  for select to authenticated
  using (
    (merchant_id is not null and merchant_id in (select public.owned_merchant_ids()))
    or (select public.is_internal_admin())
  );

-- notification_preferences stays customer-or-admin only (no merchant clause).

drop policy if exists notification_preferences_select_customer_or_admin on public.notification_preferences;
create policy notification_preferences_select_customer_or_admin on public.notification_preferences
  for select to authenticated
  using (
    customer_id in (select public.owned_customer_ids())
    or (select public.is_internal_admin())
  );
