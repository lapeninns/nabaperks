---
spec_id: MS-db-rls-hashed-select-policies
status: active
risk_class: migrations
owner: claude-code agent (amanshresthaa)
last_reviewed: 2026-07-07
allowed_blast_radius:
  - micro-specs/db/**
  - supabase/migrations/20260710090000_rls_hashed_select_policies.sql
  - tests/db/rls-hashed-policies.test.mjs
implementation_surfaces:
  - supabase/migrations/20260710090000_rls_hashed_select_policies.sql
  - tests/db/rls-hashed-policies.test.mjs
related_docs:
  - micro-specs/GLOBAL_CONTEXT.md
related_tests:
  - tests/db/rls-hashed-policies.test.mjs
  - tests/db/tenant-rls.test.mjs
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:coverage
  - pnpm test:db
required_playwright_projects: []
evidence_required:
  - Command output for the declared verification gates.
  - EXPLAIN (ANALYZE, BUFFERS) capture at 100k seeded members showing the merchant count query with owner subplans at loops=1 and buffer hits below 5,000.
  - pnpm db:migrate replayed twice against the local stack without error.
approved_exceptions:
  - "evidence-waiver: unrelated seed/stress WIP rides the working tree; program commits stay scoped to this spec's radius (expires: 2026-07-21)"
---

# MS-db-rls-hashed-select-policies — Hashed-subplan rewrite of correlated RLS SELECT policies

## 1. Exact Goal and User-Visible Outcomes

Merchant and customer reads over the activity ledgers stay fast as a venue
grows. Today every SELECT over `customer_memberships`, `stamp_events`,
`product_events`, `reward_events`, `consent_records`, `audit_logs`, and
`notification_preferences` re-executes `is_customer_owner(row.customer_id)` /
`is_merchant_owner(row.merchant_id)` once **per row** (correlated
subselects), making full scans O(rows × subquery): the members-page exact
count measured 936 ms at 100k members (2026-07-07 stress test; in-DB 596 ms
with ~503k buffer hits). When this ships, tenant ownership resolves **once
per query** (uncorrelated, materialized subplan), the same count lands at
tens of milliseconds at 100k rows, `/app/customers` drops from ~1.0 s toward
~100 ms — and row visibility stays byte-identical for every role.

## 2. Blast Radius

May touch: one new migration
`supabase/migrations/20260710090000_rls_hashed_select_policies.sql`, one new
DB test file `tests/db/rls-hashed-policies.test.mjs`, and this spec under
`micro-specs/db/**`.

Explicitly out of scope: any TypeScript/app change; INSERT/UPDATE/DELETE
policies (row-targeted writes pay the helper once — no scan cost); SELECT
policies on the small per-merchant config tables (`loyalty_cards`,
`merchant_locations`, `qr_codes`, `reward_pool_items`, `billing_customers` —
tens of rows, no scan pain); the `customers` / `customers_masked` PII read
path; `referrals_select_scoped` (EXISTS-shaped, bounded per-customer reads);
`notification_events` / `notification_deliveries` policies (customer-keyed
bounded reads); and the existing helper functions `is_customer_owner` /
`is_merchant_owner` / `is_internal_admin`, which remain for their other call
sites (RPC bodies, write policies).

## 3. Strict Constraints and Assumptions

- Row-visibility parity is non-negotiable: for every identity (anon,
  authenticated customer, authenticated merchant owner, cross-tenant
  outsider, internal admin, service_role) each rewritten table returns
  exactly the same rows before and after the migration.
- `authenticated` has no direct SELECT grant on `public.customers` (PII
  revocation, proven by `tests/db/tenant-rls.test.mjs`), so the rewrite MUST
  NOT inline `in (select … from public.customers …)` in policy expressions —
  policy subqueries run with the caller's privileges. Ownership comes from
  new SECURITY DEFINER set-returning helpers instead.
- New helpers are `language sql`, `stable`, `security definer`,
  `set search_path = public, auth`, return `setof uuid`, and are executable
  by `authenticated` and `service_role` only (revoked from `public`, `anon`).
- The migration is replay-idempotent (`create or replace function`,
  `drop policy if exists` + `create policy`), matching the repo's
  re-runnable migration chain (`pnpm db:migrate` replays all files).
- Migration timestamp `20260710090000` sorts after the current latest
  (`20260709090000_referral_bonus_stamp.sql`).
- Assumption (proven 2026-07-07 on the local stack): `col in (select
  owned_ids_fn())` with a STABLE definer set-returning function plans as an
  uncorrelated subplan — Materialize/ProjectSet executed once (loops=1) —
  not a correlated per-row SubPlan.
- Assumption: production Postgres matches supabase-local subplan
  materialization behavior; the plan-shape DB test guards this on every run.

## 4. Decisions Already Made

- Helper names: `public.owned_customer_ids()` (ids from `public.customers`
  where `auth_user_id = (select auth.uid())`) and
  `public.owned_merchant_ids()` (ids from `public.merchants` where
  `owner_user_id = (select auth.uid())`). Do not re-derive alternatives
  (inline table subqueries fail on grants; there is no JWT claim carrying
  owned ids).
- Exactly seven SELECT policies are rewritten, preserving each policy's
  current clause structure verbatim except the owner checks:
  - `customer_memberships_select_scoped`, `stamp_events_select_scoped`,
    `reward_events_select_scoped`, `consent_records_select_scoped`:
    `customer_id in (select public.owned_customer_ids()) or merchant_id in
    (select public.owned_merchant_ids()) or (select public.is_internal_admin())`.
  - `product_events_select_scoped` keeps both NULL guards:
    `(merchant_id is not null and merchant_id in (select
    public.owned_merchant_ids())) or (customer_id is not null and
    customer_id in (select public.owned_customer_ids())) or (select
    public.is_internal_admin())`.
  - `audit_logs_select_scoped`: `(merchant_id is not null and merchant_id in
    (select public.owned_merchant_ids())) or (select public.is_internal_admin())`.
  - `notification_preferences_select_customer_or_admin`: `customer_id in
    (select public.owned_customer_ids()) or (select public.is_internal_admin())`.
- `(select public.is_internal_admin())` stays verbatim — it takes no row
  argument, so it already collapses to an InitPlan.
- Policies are replaced via `drop policy if exists` + `create policy` with
  the same policy name and `for select to authenticated`.
- The plan-shape proof lives in the DB test as an `explain (analyze, format
  json)` assertion: every plan node carrying a `Subplan Name` must report
  `Actual Loops` ≤ 1 for the merchant full-scan query — deterministic at
  fixture scale (the correlated shape reports loops = scanned row count).
- Perf evidence at 100k is captured at advance time by reseeding
  (`pnpm db:seed:stress --clean --count 100000`), running the EXPLAIN
  capture, then `pnpm db:clean:stress` — timing numbers land in the evidence
  ledger acknowledgement, not in tests (timing assertions flake).

## 5. Behavioral Requirements (EARS)

- THE migration SHALL create `public.owned_customer_ids()` and `public.owned_merchant_ids()` as stable security-definer set-returning functions executable by authenticated and service_role only.
- WHEN an authenticated customer, merchant owner, cross-tenant outsider, or internal admin queries any of the seven rewritten tables, THE database SHALL return exactly the rows the previous policy allowed for that identity.
- IF `auth.uid()` resolves to NULL, THEN THE owner clauses of the rewritten policies SHALL expose zero rows.
- WHEN the merchant owner runs a full-scan aggregate over a rewritten table, THE query plan SHALL execute each owner subplan at most once per query rather than once per row.
- IF the migration SQL is applied to a database where it already ran, THEN THE second application SHALL complete without error and leave the same seven policies and two functions in place.
- THE migration SHALL leave every INSERT/UPDATE/DELETE policy, every non-listed table's SELECT policy, and the existing owner-helper functions unchanged.

## 6. Verification Criteria and Task Breakdown

Observable outcomes, in implementation order:

1. RED — `tests/db/rls-hashed-policies.test.mjs` exists and fails against
   the current schema for the right reason: the helper-existence probe finds
   no `owned_customer_ids` / `owned_merchant_ids`, and the plan-shape
   assertion sees per-row owner SubPlans (`Actual Loops` = fixture row
   count) on the merchant full-scan query.
2. GREEN — the migration applies via `pnpm db:migrate`; the new test file
   passes end to end: helpers exist with correct volatility/security/ACL;
   plan-shape loops ≤ 1; the visibility matrix (customer sees own rows,
   merchant owner sees own tenant, outsider sees none, anon owner-clauses
   yield zero) holds across all seven tables; replaying the migration file a
   second time inside the test raises no error.
3. REGRESSION — `tests/db/tenant-rls.test.mjs` passes unmodified (merchant
   scoping, anon denial, raw-PII denial, cross-tenant write no-op).
4. GATES — all six declared gates pass; `pnpm test:db` is the primary proof
   tier per the migrations risk floor. Record with
   `pnpm governance:run-gates --spec MS-db-rls-hashed-select-policies --record`
   and advance with `pnpm governance:advance`.
5. EVIDENCE — at 100k reseeded members the EXPLAIN capture shows the count
   query with owner subplans at loops=1 and buffers under 5,000 (was
   ~503,000), and the PostgREST-path count timing is recorded (was 936 ms).
