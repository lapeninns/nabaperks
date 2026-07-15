# Full-Stack Stress Test — 2026-07-07

Four-surface stress test of Nabaperks (database reads under RLS, server HTTP,
write-path mutation concurrency, backend cron/RPC) against a **local disposable
Supabase stack**. No staging or production system was touched at any point.

## Environment

| Item | Value |
| --- | --- |
| Host | Apple M5 Pro, 18 cores, 64 GB RAM (macOS, Darwin 25.5.0) |
| Docker VM | 18 CPUs, ~8.2 GB RAM (Supabase local stack, project `Nabaperks`) |
| Database | Supabase local, Postgres at `127.0.0.1:54322`, API at `127.0.0.1:54321` |
| App server | `next build && next start` (Next.js 16.2.10, production mode) on `:3900`, isolated working-tree copy |
| Node / pnpm | v24.16.0 / 10.28.0; supabase CLI 2.106.0 |
| Fixture | Old Crown Girton (`10000000-…-0001`), 3-stamp card, owner `amanshresthaaaaa+32@gmail.com` |
| Benchmarks | `PERF_STRESS_RUNS=5 pnpm perf:stress` (5 samples/benchmark; with n=5, p95≈max), custom load generator, `scripts/perf-mutation-stress.mjs` (new harness, written for this test) |

Scale matrix: **10k / 50k / 100k** members, each with 1 stamp event + 2 product
events (so the 100k tier is ~100k customers, 100k memberships, 100k stamp
events, 200k product events ≈ 500k rows, DB ~92 MB → larger after sweeps).

## Dimension 1 — Database (read scale under RLS)

### Seed / insert throughput

| Tier | Rows inserted | Wall time | Throughput | Clean time (prior tier) |
| --- | --- | --- | --- | --- |
| 10k | 50,000 | 1.0 s | ~50k rows/s | 0.7 s |
| 50k | 250,000 | 4.7 s | ~53k rows/s | 0.6 s |
| 100k | 500,000 | 10.3 s | ~49k rows/s | 2.9 s |

Batched multi-row inserts (1k/batch) scale linearly. **PASS** — no insert-side
degradation up to 500k rows.

### Read benchmarks via PostgREST as the merchant owner (RLS enforced), median of 5

| Benchmark (median ms) | 10k | 50k | 100k | max @100k | Verdict |
| --- | --- | --- | --- | --- | --- |
| Member count (`count: exact`) | 103.7 | 528.9 | **936.4** | 959.7 | **FAIL — linear, ~9.4 µs/row** |
| Members page 1 (15 rows) | 3.5 | 8.3 | 8.9 | 9.5 | PASS |
| Members page 100 (offset 1,485) | 18.2 | 18.9 | 18.3 | 18.7 | PASS (O(offset), see below) |
| Members offset 9,990 | 96.2 | 106.1 | 98.7 | 100.5 | offset ramp visible |
| Members **true last page** (offset 99,990) |  |  | **617.8 (in-DB)** |  | **FAIL — walks all 100k rows** |
| Dashboard 7d membership rows | 3.8 | 9.7 | 12.5 | 14.2 | PASS latency; **rows silently capped at 1,000** |
| Dashboard 7d stamp rows | 4.9 | 10.5 | 13.0 | 15.2 | PASS latency; same 1,000-row cap |
| Activity feed (40 events) | 2.4 | 2.9 | 2.4 | 3.3 | PASS |
| Push marketing prefs count | 2.1 | 2.5 | 2.2 | 5.3 | PASS |

The offset benchmarks are label-fixed in `perf-stress.mjs` (page 667 was "last
page" at 10k); the true 100k last page was measured separately via EXPLAIN.

### EXPLAIN findings (measured at 100k, real RLS context: `role=authenticated` + JWT claims GUC)

**1. Exact member count — the headline problem.**

```
Aggregate (596.7 ms)  Buffers: shared hit=502,895
  -> Seq Scan on customer_memberships (rows=100,005)
     Filter: merchant_id = … AND ((SubPlan 1) OR (SubPlan 2) OR (InitPlan 3).col1)
     SubPlan 1 -> loops=100,005   (is_customer_owner(customer_id),  300k buffers)
     SubPlan 2 -> loops=100,004   (is_merchant_owner(merchant_id),  200k buffers)
```

Root cause: the `*_select_scoped` RLS policies use
`( SELECT is_customer_owner(customer_memberships.customer_id) ) OR ( SELECT is_merchant_owner(merchant_id) ) OR …`.
Because the helper-function arguments are **row columns**, these subselects are
*correlated* — executed once per row, not cached as InitPlans. Every full-scan
query under these policies pays 2 function calls + an EXISTS probe per row.
**This is not a missing index** — `customer_memberships_merchant_created_at_idx
(merchant_id, created_at DESC)` exists and is fine; the filter itself is the cost.

Fix shape, validated live (same predicate, uncorrelated `IN` subqueries):

```
Aggregate (15.9 ms)  Buffers: shared hit=2,592          -- 37x faster
  Filter: merchant_id = … AND (customer_id = ANY (hashed SubPlan 1)
                            OR merchant_id = ANY (hashed SubPlan 2))
  SubPlan 1 -> Index Scan customers_auth_user_id_key  (loops=1)
  SubPlan 2 -> Index Scan merchants_owner_user_id_idx (loops=1)
```

Concrete recommendation — rewrite the SELECT policies on
`customer_memberships`, `stamp_events`, `product_events` (and any other
merchant/customer-scoped table) from function-per-row to hashed-subplan form,
e.g. for `customer_memberships`:

```sql
alter policy customer_memberships_select_scoped on public.customer_memberships
using (
  customer_id in (select c.id from public.customers c
                  where c.auth_user_id = (select auth.uid()))
  or merchant_id in (select m.id from public.merchants m
                     where m.owner_user_id = (select auth.uid()))
  or (select public.is_internal_admin())
);
```

(`is_internal_admin()` takes no row argument, so it already collapses to an
InitPlan — keep it as-is.) Expected effect: exact count 936 ms → ~25–40 ms
end-to-end; every large scan under RLS gets the same win. Interim app-side
mitigation: the members page should use `count: 'estimated'`/`'planned'` or the
already-fast `get_merchant_dashboard_metrics` RPC (8 ms at 100k) instead of a
PostgREST exact count.

**2. Deep pagination — true last page at 100k.**

```
Limit (617.8 ms)  Buffers: shared hit=600,502
  -> Index Scan customer_memberships_merchant_created_at_idx
     (rows=100,005 walked to satisfy OFFSET 99,990)
```

OFFSET is O(n) by construction; the RLS subplans multiply the constant. No
index can fix an OFFSET-99,990 walk. Fix: **keyset pagination** on
`(created_at, id)` (`where (created_at, id) < (:cursor_ts, :cursor_id) order by
created_at desc, id desc limit 15`) — the supporting index already exists. The
policy rewrite above independently cuts the walk cost ~10×, so do both.

**3. 7-day dashboard windows.** Healthy plan (partial index
`stamp_events_merchant_earned_created_at_idx` used, 9.2 ms for 1,306 rows), but
at 100k scale the raw-row fetch hits **PostgREST's 1,000-row response cap** —
the `rows=1000` readings above are truncated result sets, i.e. a dashboard that
computes 7d numbers by fetching rows will silently under-count for a busy
merchant. `get_merchant_dashboard_metrics` (SQL-side counts, 5.8–8.4 ms at
100k) is the correct primitive; ensure every surface uses it rather than
row-fetch-then-count.

**4. Activity feed / prefs count.** Index-backed, flat across tiers. No action.

## Dimension 2 — Server (production build, authenticated pages + HTTP load)

### Authenticated page loads at 100k (median of 5, production `:3900`)

| Route | median | max | Verdict |
| --- | --- | --- | --- |
| `/app` (dashboard) | 148.9 ms | 218.0 ms | PASS |
| `/app/customers` | **1,023.8 ms** | 1,048.6 ms | **FAIL** — dominated by the 936 ms exact count |
| `/app/customers?page=100` | **1,029.3 ms** | 1,050.0 ms | **FAIL** — same |
| `/app/activity` | 96.1 ms | 101.8 ms | PASS |
| `/app/announcements` | 108.5 ms | 109.3 ms | PASS |

The dashboard is fast because it uses the RPC; the members page is slow because
it uses the PostgREST exact count. Same database, same rows — the difference is
entirely the query shape identified in Dimension 1.

### Concurrent HTTP load (15–20 s phases, keep-alive, loopback)

| Target | Concurrency | Throughput | p50 | p95 | p99 | max | Errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/api/health` | 50 | 4,027 req/s | 11.2 ms | 19.2 ms | 24.3 ms | 388 ms | 0 |
| `/api/health` | 100 | 4,124 req/s | 23.4 ms | 32.3 ms | 45.3 ms | 601 ms | 0 |
| `/api/health` | 200 | 3,772 req/s | 48.0 ms | 70.8 ms | 101.2 ms | 2,588 ms | 0 |
| `/app` (authed SSR) | 25 | 15.7 req/s | 1,535 ms | 1,682 ms | 2,606 ms | 2,613 ms | 0 |
| `/app` (authed SSR) | 50 | 16.1 req/s | 3,095 ms | 4,316 ms | 7,156 ms | 7,180 ms | 0 |
| `/app` (authed SSR) | 100 | 16.4 req/s | 6,125 ms | 12,652 ms | 12,897 ms | 13,030 ms | 4.1%\* |

\* 14 non-2xx in one phase only; a direct replication at c=100 returned 226/226
HTTP 200. Most plausible cause is the Supabase session token rotating mid-phase
(the cookie was minted once and reused for ~90 s of load). No 5xx was ever
observed.

Reading: the liveness route sustains ~4k req/s per instance with p99 ≤ ~100 ms
at 200 concurrent — **PASS**. Authenticated SSR saturates at **~16 req/s per
instance** (Little's law: latency growth above c≈25 is pure queueing, not new
failure). That is the per-instance budget to plan capacity around; on
serverless (Vercel) this bounds per-lambda concurrency rather than the fleet,
but the dashboard render itself (~1.5 s under saturation) would benefit from
fewer sequential Supabase round-trips per render.

## Dimension 3 — Mutations (write-path concurrency)

New harness: **`scripts/perf-mutation-stress.mjs`** (local-only guarded exactly
like `seed-stress.mjs`; refuses non-local DB hosts). Each RPC call runs in its
own transaction with PostgREST-equivalent GUCs (`role`,
`request.jwt.claims`), so `auth.uid()`, `is_service_role_request()` and
SECURITY DEFINER bodies behave exactly as in production. M parallel calls are
fired at the SAME target, then final DB state is read back and asserted.
Note: `issue_stamp_with_staff_pin` **no longer exists** (dropped in the
2026-07-07 staff-subsystem excision); its replacement, the QR-gated
`issue_self_service_stamp`, is what was raced.

Run: `node scripts/perf-mutation-stress.mjs --contenders 16` → **PASS, zero violations**.

| Scenario | Contenders | Winners | Loser outcome (all expected) | Deadlocks | 40001 | Final-state asserts |
| --- | --- | --- | --- | --- | --- | --- |
| `issue_self_service_stamp` same membership | 32 | 1 | 31× "Stamp already issued for this UK business day" | 0 | 0 | 1 earned stamp today; count 1→2; cycle unchanged |
| Same, at 2/3 so winner unlocks | 8 | 1 | 7× "A reward is already ready to redeem" | 0 | 0 | exactly 1 unlocked `stamp_cycle` reward; count capped 3/3 |
| 32 distinct memberships in parallel | 32 | 32 | — | 0 | 0 | all succeed; **~2,000 stamps/s** |
| `join_customer_membership` same (merchant, customer) | 24 | 24 (idempotent) | — | 0 | 0 | exactly 1 membership; exactly 1 `created=true`; 0 NULL returns |
| `create_or_get_join_qr` same location | 16 | 16 (idempotent) | — | 0 | 0 | exactly 1 active join QR; all calls returned the same id |
| `create_reward_scan_token` same reward | 16 | 16 | — | 0 | 0 | all 16 converge on **1** live token (no duplicate-token mint) |
| `collect_reward_scan_token` same token | 16 | 1 | 15× "Reward scan token already used" | 0 | 0 | reward redeemed once; cycle advanced exactly once (1→2); count reset 0 |
| 8× collect ∥ 8× create same reward (AB-BA probe) | 16 | 1 | 7× "already used", 8× "Reward already redeemed" | 0 | 0 | redeemed exactly once |
| `award_referrer_bonus_stamp` same edge | 16 | (void, no-op losers) | — | 0 | 0 | exactly 1 bonus stamp; edge awarded once; count 1→2 |
| `drain_due_referrer_bonuses` ∥ award same edge | 4+8 | — | — | 0 | 0 | exactly 1 bonus stamp for the contested edge |
| Pool guard: 2 due edges, referrer has 1 slot | 6 | — | — | 0 | 0 | exactly 1 awarded; card capped 3/3 (never overdrawn); losing edge **still owed** |
| `issue_birthday_rewards` same customer | 8 | 8 (idempotent) | — | 0 | 0 | 1 birthday reward this year; **stamp-cycle rail untouched** (two-rail held) |

**Zero lost updates, zero double-counts, zero deadlocks (40P01), zero
serialization failures (40001)** across all 12 scenarios. Contention costs are
modest: 32-way single-row pile-up median 55.5 ms/call (lock convoy on the
membership row + rate-limit bucket), max 72 ms.

Mechanism notes (verified in plans/behavior):
- One-stamp-per-day rests on the partial unique index
  `stamp_events_one_earned_per_business_day_idx` + `FOR UPDATE` on the
  membership — belt and braces; both fired correctly.
- The stamp RPC **derives** the cycle count from `stamp_events` rather than
  trusting the counter column (self-healing; discovered when a counter-only
  fixture was ignored).
- Single-use scan tokens have **no unique index**; single-use is procedural
  (`FOR UPDATE` + `consumed_at` guard). It held under 16-way contention and the
  mint∥collect cross-race; if the token path ever moves off single-statement
  locking, add a uniqueness guard.
- Rate-limit bucket increments roll back with a failed stamp transaction, so
  the 10/15-min limiter binds only *committed* stamps — dedup losers don't
  consume budget (arguably the right semantics; noted as by-design).
- Minimal repro for any scenario: run the harness; each scenario is a
  self-contained function with fixtures + asserts.

(Stryker `pnpm mutation:check` was **not** run — the request was read as
write-path concurrency, which is what the harness covers. The command exists if
mutation *testing* is wanted separately.)

## Dimension 4 — Backend (cron endpoints, batch RPCs at 100k)

Auth guard (`lib/security/cron-auth.ts`, timing-safe): absent token → **401**,
wrong token → **401**, wrong scheme (`Basic`) → **401**, all ≤5 ms. PASS.

| Endpoint (Bearer CRON_SECRET) | Result | Rows processed | Wall time |
| --- | --- | --- | --- |
| `GET /api/cron/birthday-rewards` | 200 | **6,113 rewards issued** | **0.709 s** (~8,600 rows/s) |
| `GET /api/cron/notifications` (×4, VAPID configured) | 200 | 50 claimed+delivered per tick (all `skipped` — no push subscriptions, correct) + 200 produced per tick | 0.28–0.38 s |
| `GET /api/cron/referral-bonus-drain` | 200 | **2,000 bonuses paid** | **0.324 s** (~6,200 rows/s) |
| `GET /api/cron/merchant-digest` | 200 | `notConfigured: true` (no Resend key locally — send path env-gated, auth+config path exercised) | 0.003 s |
| `GET /api/cron/privacy-retention` | 200 | 0 purged / 0 invites / 0 buckets (nothing stale in fixture) | 0.014 s |

Drain correctness at scale: 2,000 edges → exactly 2,000 `awarded_at` and 2,000
bonus stamps, 0 edges with multiple stamps. Second `drain` run → 0. Birthday
second run issued 44 — **not** an idempotency failure: the drain's bonus stamps
count as visits and pulled 44 July-birthday referrers back inside the 12-month
activity window; third run → 0, and a global group-by found **0 duplicate
(merchant, customer, year) birthday rewards**.

Batch RPCs timed directly via psql at 100k:

| RPC | Time | Notes |
| --- | --- | --- |
| `issue_birthday_rewards()` re-run (idempotent) | 74–88 ms | full-table sweep, 0 issued |
| `claim_due_notification_events(now(), 500)` | 6.8 ms | `FOR UPDATE SKIP LOCKED`, 500 claimed (rolled back) |
| `drain_due_referrer_bonuses()` re-run | 1.0 ms | 0 due |
| `expire_and_purge_reward_invites(now())` | 0.5 ms | 0 rows |
| `admin_purge_stale_customer_pii(now()-365d)` | 3.2 ms | 0 rows |
| `get_merchant_dashboard_metrics` @10k/50k/100k | 0.3–1.6 / 0.3–1.3 / **5.8–8.4 ms** | counts 100k members in 8 ms — same count the client-side query needs 936 ms for |
| `get_product_event_counts` @100k (200k+ events) | 6.3–10.2 ms | |

**Capacity finding — notification pipeline.** Producers materialize up to 200
events/tick (two producers × limit 100) while delivery claims 50/tick; the
queue ended the test at **8,357 queued** and grows 4× faster than it drains
whenever producer backlog exists. A 6k-reward birthday day at a 15-minute cron
cadence needs ~31 hours of ticks to deliver at batch 50. Raise the claim batch
(the claim RPC is 6.8 ms at 500 — DB headroom is not the constraint), loop
until the queue is empty within the route's `maxDuration`, or split delivery
into parallel workers.

## Prioritized fix list

1. **P0 — Rewrite the row-correlated RLS SELECT policies** (`customer_memberships`,
   `stamp_events`, `product_events`) to uncorrelated `IN (select …)` form
   (hashed subplan, evaluated once). Validated 37× on the exact count; benefits
   every full-scan read under RLS. No new index needed. Until it lands, switch
   the members page to `count: 'estimated'` or the dashboard RPC — this alone
   takes `/app/customers` from ~1.0 s to ~100 ms at 100k.
2. **P1 — Keyset pagination for the members list.** OFFSET walks the whole
   index (617 ms at the 100k last page); cursor on `(created_at, id)` uses the
   existing index. Do it together with (1).
3. **P1 — 7d dashboard row-fetches silently truncate at PostgREST's 1,000-row
   cap.** Any surface computing weekly numbers by fetching rows under-counts at
   scale; standardize on `get_merchant_dashboard_metrics` (8 ms at 100k).
4. **P2 — Notification delivery throughput.** 50/tick delivery vs 200/tick
   production + campaign spikes (6,113 in one sweep). Raise batch / loop until
   drained / parallelize; DB claim path already fast and contention-safe
   (SKIP LOCKED).
5. **P2 — Authenticated SSR ceiling ~16 req/s/instance.** Fine for launch
   scale; before a big fleet, profile the dashboard render's sequential
   Supabase round-trips (policy rewrite in (1) also shaves every query it makes).
6. **P3 — Single-use scan tokens rely on procedural locking only.** Held under
   all races here; add a partial unique guard (e.g. one unconsumed token per
   reward) if the code path ever stops going through the single `FOR UPDATE`
   function.

## PASS/FAIL vs thresholds

| Threshold | Result |
| --- | --- |
| Read p95 < 200 ms at 100k rows | **FAIL** for exact member count (936 ms) and true-last-page offset (618 ms in-DB); PASS for every other read (≤ 19 ms) |
| Zero double-stamps under write concurrency | **PASS** (32-way race → exactly 1) |
| Zero deadlocks (40P01) / serialization failures (40001) | **PASS** (0 across all 12 scenarios incl. AB-BA probe) |
| Idempotency (join, QR, token mint, birthday, drain re-runs) | **PASS** |
| Referral pool never overdrawn; two-rail invariant | **PASS** (card capped at 3/3; issued-reward rail never touched stamp rail) |
| Cron auth fails closed | **PASS** (401 on absent/wrong/wrong-scheme; timing-safe compare) |
| `/api/health` under 200-concurrent load | **PASS** (~3.8–4.1k req/s, p99 ≤ 101 ms, 0 errors) |

**Overall: the trust mechanics are solid under contention — every
single-winner invariant held with zero deadlocks. The scaling problem is
one query shape (correlated RLS subplans) plus OFFSET pagination, both with
validated, low-risk fixes.**

## Caveats

- Loopback, single machine: no network latency, and app + DB + load generator
  share the box. Absolute numbers are optimistic; the *scaling shapes* (linear
  count, offset walk, 16 req/s SSR ceiling) are the durable findings.
- 5 samples per perf:stress benchmark → p95 reported as ≈max.
- `merchant-digest`'s send path is env-gated locally (no Resend key); only
  auth + config handling was exercised.
- The mutation harness leaves the schema untouched and cleans its fixtures
  (auth users, edges, tokens, fabricated rewards, rate-limit buckets); the
  birthday flag on the fixture card was enabled for Dimension 4 and is removed
  with the stress data on teardown. `audit_logs` rows from raced stamps remain
  (append-only, disposable stack).
- Teardown: `pnpm db:clean:stress && pnpm db:supabase:stop` (all FKs from
  sweep-created rows are CASCADE/SET NULL — verified before cleanup).
