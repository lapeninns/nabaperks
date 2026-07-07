---
spec_id: MS-notifications-drain-throughput
status: active
risk_class: product-analytics
owner: claude-code agent (amanshresthaa)
last_reviewed: 2026-07-07
allowed_blast_radius:
  - micro-specs/platform/**
  - lib/notifications/delivery-worker.ts
  - lib/notifications/drain-plan.ts
  - app/api/cron/notifications/route.ts
  - tests/unit/notification-drain-plan.test.mjs
  - tests/micro-specs/notifications-drain-throughput.test.mjs
implementation_surfaces:
  - lib/notifications/delivery-worker.ts
  - lib/notifications/drain-plan.ts
  - app/api/cron/notifications/route.ts
  - tests/unit/notification-drain-plan.test.mjs
  - tests/micro-specs/notifications-drain-throughput.test.mjs
related_docs:
  - micro-specs/GLOBAL_CONTEXT.md
  - micro-specs/platform/notifications.md
related_tests:
  - tests/unit/notification-drain-plan.test.mjs
  - tests/micro-specs/notifications-drain-throughput.test.mjs
  - tests/db/notifications.test.mjs
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:coverage
required_playwright_projects: []
evidence_required:
  - Command output for the declared verification gates.
approved_exceptions:
  - "evidence-waiver: unrelated seed/stress WIP rides the working tree; program commits stay scoped to this spec's radius (expires: 2026-07-21)"
---

# MS-notifications-drain-throughput — Notification delivery drains the due queue within explicit budgets

## 1. Exact Goal and User-Visible Outcomes

Customers receive queued notifications the same tick they come due, even on
a busy day. Today `runPushNotificationDeliveryWorker` claims exactly one
batch of 50 events per 15-minute cron tick while its producers materialize
up to 200 new events per tick — the 2026-07-07 stress test measured the
queue growing 4× faster than it drains, and a 6,113-event birthday sweep
would need ~31 hours of ticks to deliver. When this ships, each cron
invocation keeps claiming batches until the due queue is empty or an
explicit run budget (max events, soft time budget) is reached: the same
birthday sweep drains in a handful of ticks, bounded and observable
(`processed` reports the true per-run total).

## 2. Blast Radius

May touch: `lib/notifications/delivery-worker.ts` (drain loop),
`lib/notifications/drain-plan.ts` (new pure decision module),
`app/api/cron/notifications/route.ts` (budget options + `maxDuration`), the
two new tests `tests/unit/notification-drain-plan.test.mjs` and
`tests/micro-specs/notifications-drain-throughput.test.mjs`, and this spec
under `micro-specs/platform/**`.

Explicitly out of scope: the producers and their per-tick `limit(100)` caps
(they re-attempt next tick by design and self-exhaust as the backlog
drains); the `claim_due_notification_events` RPC and its 1–500 clamp (no
migration in this spec); delivery semantics per event (frequency caps,
quiet hours, retries, subscription lookup); every other cron route; and
`vercel.json` scheduling.

## 3. Strict Constraints and Assumptions

- The claim RPC clamps `p_limit` to 1..500 (proven in
  `tests/db/notifications.test.mjs`); the worker's batch size must stay
  inside that clamp, so SQL never silently reduces a requested batch.
- Producers run once per invocation, before the drain loop — NOT once per
  batch (produce/claim are separate stages; re-producing mid-drain could
  starve the loop's empty-batch exit).
- The not-configured guard is unchanged: without web-push VAPID config the
  worker still produces, logs `push_delivery_worker_not_configured`, and
  returns with `processed: 0`.
- The result counters (`produced`, `processed`, `sent`, `skipped`,
  `failed`) keep their shape and now sum across all claimed batches, so the
  cron response and `recordWorkerProductEvent` telemetry stay drop-in
  compatible.
- Batch claims stay sequential (no parallel claims from one invocation):
  `FOR UPDATE SKIP LOCKED` makes parallel workers safe across invocations,
  but in-process parallelism would multiply web-push concurrency and defeat
  the time-budget check.
- The loop must be safe against a misbehaving claim (a batch larger than
  requested counts fully against the budget; an empty batch always exits).
- No new npm dependencies. The pure decision logic lives in
  `lib/notifications/drain-plan.ts` with no server-only imports so the unit
  tier can import it directly (alias-loader pattern).
- Defaults preserve current single-batch behavior when no options are
  passed (`batchSize` 50, `maxEvents` = `batchSize`, no time budget) — the
  drain behavior is an explicit opt-in from the route.

## 4. Decisions Already Made

- Module split: `drain-plan.ts` exports `resolveDrainOptions(input)` and
  `shouldContinueDraining(state, options, elapsedMs)`;
  `delivery-worker.ts` owns the loop and I/O. Do not fold the decision
  logic back into the worker (it must stay unit-testable without
  `lib/supabase/server`).
- `resolveDrainOptions` clamps: `batchSize` to 1..500 (integer, default
  50); `maxEvents` to at least `batchSize` (default = `batchSize`, cap
  5,000); `timeBudgetMs` optional positive integer or null (no budget).
- Loop exit conditions, in order: last batch shorter than requested
  (queue drained) → stop; `processed >= maxEvents` → stop;
  `elapsedMs >= timeBudgetMs` (when set) → stop; otherwise claim again.
- The cron route passes `{ batchSize: 100, maxEvents: 500, timeBudgetMs:
  240000 }` and exports `maxDuration = 300` (mirrors the merchant-digest
  route) — one invocation can retire a ~500-event backlog, four ticks an
  entire 6k birthday sweep, while staying inside the function timeout with
  60s of headroom.
- Route response shape is unchanged (`{ ok: true, result }`).

## 5. Behavioral Requirements (EARS)

- WHEN a cron invocation runs with a due backlog larger than one batch, THE worker SHALL claim successive batches until the queue is empty or a run budget is reached, and `processed` SHALL equal the sum across batches.
- WHEN a claimed batch returns fewer events than requested, THE worker SHALL stop claiming (the due queue is drained).
- IF the processed total reaches `maxEvents`, THEN THE worker SHALL stop claiming further batches.
- IF a time budget is configured and the elapsed time reaches it after a batch, THEN THE worker SHALL stop claiming and report the events already processed.
- THE resolveDrainOptions helper SHALL clamp `batchSize` to the claim RPC's 1..500 window and `maxEvents` to at least `batchSize`.
- WHILE web-push is not configured, THE worker SHALL keep its current produce-then-return behavior with `processed: 0`.
- THE worker SHALL run its producers exactly once per invocation regardless of how many batches it claims.
- THE cron route SHALL pass the production drain budget (batchSize 100, maxEvents 500, timeBudgetMs 240000) and export `maxDuration = 300`.

## 6. Verification Criteria and Task Breakdown

Observable outcomes, in implementation order:

1. RED — `tests/unit/notification-drain-plan.test.mjs` fails for the right
   reason: `lib/notifications/drain-plan.ts` does not exist, so
   `resolveDrainOptions` / `shouldContinueDraining` are missing. RED —
   `tests/micro-specs/notifications-drain-throughput.test.mjs` pins the
   worker-loop and route wiring (drain options constant, `maxDuration`,
   loop delegation to drain-plan) and fails against the current
   single-batch worker.
2. GREEN — unit tier proves: clamping (batchSize 0/501/float/undefined;
   maxEvents below batchSize; cap 5,000), every loop exit (short batch,
   maxEvents, time budget, continue), and exit precedence when multiple
   conditions are true. Micro-spec tier proves the worker delegates to
   drain-plan, the route passes the decided budget, and `maxDuration = 300`
   is exported.
3. GREEN — `pnpm test:db` (run locally alongside the floor even though the
   floor does not require it) still passes: the claim RPC contract in
   `tests/db/notifications.test.mjs` is untouched.
4. GATES — all five declared gates pass;
   `pnpm governance:run-gates --spec MS-notifications-drain-throughput --record`
   writes the ledger; advance with `pnpm governance:advance`.
