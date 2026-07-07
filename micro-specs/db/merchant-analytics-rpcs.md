---
spec_id: MS-db-merchant-analytics-rpcs
status: active
risk_class: migrations
owner: claude-code agent (amanshresthaa)
last_reviewed: 2026-07-07
allowed_blast_radius:
  - micro-specs/db/**
  - supabase/migrations/20260710091000_merchant_analytics_rpcs.sql
  - lib/merchant/dashboard-query.ts
  - lib/merchant/dashboard-buckets.ts
  - lib/merchant/activity.ts
  - tests/db/merchant-analytics-rpcs.test.mjs
  - tests/unit/merchant-analytics-mapping.test.mjs
implementation_surfaces:
  - supabase/migrations/20260710091000_merchant_analytics_rpcs.sql
  - lib/merchant/dashboard-query.ts
  - lib/merchant/dashboard-buckets.ts
  - lib/merchant/activity.ts
  - tests/db/merchant-analytics-rpcs.test.mjs
  - tests/unit/merchant-analytics-mapping.test.mjs
related_docs:
  - micro-specs/GLOBAL_CONTEXT.md
related_tests:
  - tests/db/merchant-analytics-rpcs.test.mjs
  - tests/unit/merchant-analytics-mapping.test.mjs
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
  - DB test output proving series/summary counts stay exact with more than 1,000 window rows.
approved_exceptions:
  - "evidence-waiver: unrelated seed/stress WIP rides the working tree; program commits stay scoped to this spec's radius (expires: 2026-07-21)"
---

# MS-db-merchant-analytics-rpcs — Cap-proof merchant analytics via SQL-side aggregation RPCs

## 1. Exact Goal and User-Visible Outcomes

A busy merchant's dashboard numbers stay honest at scale. Today the 14-day
dashboard series (`getMerchantDashboardSeriesByQuery` in
`lib/merchant/dashboard-query.ts`) and the 7-day activity summary
(`loadMerchantActivitySummary` in `lib/merchant/activity.ts`) fetch raw rows
with no limit and tally them in JS — PostgREST caps any row response at
1,000, so a venue with more than 1,000 stamps/joins/redemptions (or product
events) in the window silently under-counts its charts and summary (flagged
by the 2026-07-07 stress test: `rows=1000` truncation at 100k members). When
this ships, both surfaces get their numbers from SQL-side aggregation RPCs
whose output is bounded (one row per day / per event name), so the counts
are exact no matter how busy the venue is — and each render moves 14–30
small rows instead of up to 3×1,000 timestamps.

## 2. Blast Radius

May touch: one new migration
`supabase/migrations/20260710091000_merchant_analytics_rpcs.sql`; the two
consuming modules `lib/merchant/dashboard-query.ts` and
`lib/merchant/activity.ts`; the pure bucket helpers in
`lib/merchant/dashboard-buckets.ts` (new mapping function); new tests
`tests/db/merchant-analytics-rpcs.test.mjs` and
`tests/unit/merchant-analytics-mapping.test.mjs`; and this spec under
`micro-specs/db/**`.

Explicitly out of scope: `lib/merchant/dashboard-metrics.ts` (its RPC-first /
fallback wiring for the KPI metrics already works and stays untouched — the
series fallback lives inside `dashboard-query.ts` itself); the count-based
window helpers (`dashboard-counts.ts`, `dashboard-period-counts.ts` — already
cap-safe head counts); the weekly digest (its `.limit(1)` dedupe probe is an
existence check, not a count); `get_product_event_counts` (global,
admin-scoped — a different tool); and any UI component.

## 3. Strict Constraints and Assumptions

- Day bucketing must match the existing JS semantics exactly:
  `bucketize` keys rows by Europe/London calendar day (`en-CA` date key from
  `dashboard-buckets.ts`); the RPC groups by
  `(created_at at time zone 'Europe/London')::date`.
- Series semantics preserved: joins = `customer_memberships.created_at` in
  window; stamps = `stamp_events` with `event_type = 'earned'`; rewards =
  `reward_events` with `status = 'redeemed'` — filtered by `created_at >=`
  the window start, exactly as the current queries do. The members running
  total keeps using the existing cap-safe `countMembersBefore` head count.
- Activity summary semantics preserved: `product_events` filtered to the
  module's `activityEvents` allowlist, 7-day window, and the JS
  categorisation switch stays in TS — the RPC returns per-`event_name`
  counts and the existing switch consumes counts instead of rows.
- Both RPCs are `language sql`, `stable`, `security definer`,
  `set search_path = public, auth`, granted to `service_role` only (both
  call sites use `createSupabaseServiceRoleClient()`), with an in-body
  defense-in-depth guard mirroring `get_merchant_dashboard_metrics`:
  service-role request OR internal admin OR owning merchant; anything else
  raises `insufficient_privilege`.
- Deploy-before-migrate safety: when the RPC is missing (PostgREST error
  `PGRST202`), both call sites fall back to the current row-fetch path —
  the same hardened pattern `dashboard-metrics.ts` already uses. Any other
  RPC error still throws.
- Migration is replay-idempotent (`create or replace function`, `drop
  function if exists` before signature changes) and timestamped
  `20260710091000` (after `20260710090000_rls_hashed_select_policies.sql`).
- No new npm dependencies; no PostgREST config changes (the 1,000-row cap
  itself stays as the platform default).

## 4. Decisions Already Made

- RPC names and shapes (do not re-derive):
  - `get_merchant_dashboard_series(target_merchant_id uuid, p_days integer default 14)`
    returns `table(day date, joins bigint, stamps bigint, rewards bigint)` —
    one row per London day that has at least one event; TS zero-fills the
    full window from `buildDayBuckets`.
  - `get_merchant_activity_event_counts(target_merchant_id uuid, p_since timestamptz, p_event_names text[])`
    returns `table(event_name text, event_count bigint)`.
- The TS mapping from RPC rows to the existing `MerchantDashboardSeries`
  arrays lives in `lib/merchant/dashboard-buckets.ts` as a pure exported
  function (`mapSeriesRowsToBuckets(rows, buckets)`) so it is unit-testable
  via the repo's alias-loader unit tier.
- Fallback detection keys on PostgREST's missing-function code `PGRST202`
  only, matching the `isMissingRpcError` precedent in
  `lib/merchant/dashboard-metrics.ts` — implement a local helper rather
  than widening the radius with a cross-module import.
- `p_days` is clamped in SQL to 1..90; the activity RPC treats an empty
  `p_event_names` array as zero rows, never a full-table sweep.
- DB-test proof of cap-immunity seeds >1,000 rows of one type inside the
  rolled-back fixture transaction and asserts the RPC count equals the true
  seeded count (the row-fetch path would have been truncated by PostgREST —
  the RPC must not be).

## 5. Behavioral Requirements (EARS)

- THE migration SHALL create `get_merchant_dashboard_series` and `get_merchant_activity_event_counts` as stable security-definer RPCs granted to service_role only, with in-body authorization matching `get_merchant_dashboard_metrics`.
- WHEN the dashboard series is requested for a merchant, THE system SHALL return per-London-day joins, earned-stamp, and redeemed-reward counts equal to the true database counts regardless of row volume in the window.
- WHEN the activity summary is requested for a merchant, THE system SHALL return per-event-name counts over the window equal to the true database counts regardless of row volume.
- IF the aggregation RPC is missing at runtime (PGRST202), THEN THE consuming module SHALL fall back to the existing row-fetch computation without throwing.
- IF a non-owner authenticated caller invokes either RPC directly, THEN THE database SHALL raise insufficient_privilege.
- THE TS series mapping SHALL zero-fill days with no RPC row so the rendered axis keeps one entry per bucket day.
- IF the migration SQL is applied twice, THEN THE second application SHALL complete without error.

## 6. Verification Criteria and Task Breakdown

Observable outcomes, in implementation order:

1. RED — `tests/db/merchant-analytics-rpcs.test.mjs` fails for the right
   reason: the RPC existence probe finds neither function. RED —
   `tests/unit/merchant-analytics-mapping.test.mjs` fails because
   `mapSeriesRowsToBuckets` is not exported yet.
2. GREEN (DB) — after the migration applies via `pnpm db:migrate`: both
   RPCs exist with the declared ACL; a multi-day fixture returns exact
   per-day counts; a >1,000-rows-in-window fixture returns the full count;
   a non-owner authenticated caller gets insufficient_privilege; the
   service-role path succeeds; executing the migration file twice inside
   the test raises no error.
3. GREEN (TS) — `mapSeriesRowsToBuckets` zero-fills and orders by bucket
   day; `getMerchantDashboardSeriesByQuery` and
   `loadMerchantActivitySummary` call the RPCs first and keep the legacy
   row-fetch as the PGRST202 fallback.
4. GATES — all six declared gates pass;
   `pnpm governance:run-gates --spec MS-db-merchant-analytics-rpcs --record`
   writes the ledger; advance with `pnpm governance:advance`.
5. EVIDENCE — DB test output shows the >1,000-row exactness case passing.
