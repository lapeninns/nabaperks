---
spec_id: MS-db-notification-durability
status: active
risk_class: rls-rpc-ledger
owner: amankumarshrestha
last_reviewed: 2026-07-10
allowed_blast_radius:
  - micro-specs/db/notification-durability.md
  - micro-specs/evidence/MS-db-notification-durability.json
  - supabase/migrations/20260712090000_notification_event_delivery_lease.sql
  - supabase/migrations/20260712091000_enqueue_notification_event_idempotency.sql
  - lib/notifications/delivery-worker.ts
  - tests/db/notification-delivery-record-contract.test.mjs
  - tests/db/notification-event-lease.test.mjs
  - tests/db/notification-enqueue-idempotency.test.mjs
  - tests/e2e/customer-notification-settings.spec.ts
implementation_surfaces:
  - supabase/migrations/20260712090000_notification_event_delivery_lease.sql
  - supabase/migrations/20260712091000_enqueue_notification_event_idempotency.sql
  - lib/notifications/delivery-worker.ts
  - tests/db/notification-delivery-record-contract.test.mjs
  - tests/db/notification-event-lease.test.mjs
  - tests/db/notification-enqueue-idempotency.test.mjs
  - tests/e2e/customer-notification-settings.spec.ts
related_docs:
  - AGENTS.md
  - micro-specs/README.md
related_tests:
  - tests/db/notification-delivery-record-contract.test.mjs
  - tests/db/notification-event-lease.test.mjs
  - tests/db/notification-enqueue-idempotency.test.mjs
  - tests/e2e/customer-notification-settings.spec.ts
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:coverage
  - pnpm test:db
  - pnpm test:e2e -- --project=mobile-safari --grep "@MS-db-notification-durability"
required_playwright_projects:
  - mobile-safari
evidence_required:
  - Command output for the declared verification gates.
  - test:db output showing the three notification-* DB tiers green (delivery-record arg contract, claim lease/reclaim, enqueue idempotency) plus the pre-existing tests/db/notifications.test.mjs still green.
  - Fresh-database replay (supabase db reset) proving both new migrations apply idempotently and order-safely after the Wave-1 containment migrations.
approved_exceptions: []
---

# MS-db-notification-durability — Notification queue durability: delivery-record arg contract, claim leases, idempotent enqueue

## 1. Exact Goal and User-Visible Outcomes

The 2026-07-10 database audit's Wave-2 fixes the durability of the push
notification delivery queue. When this ships:

- **Every delivery is recorded.** The delivery worker records each push attempt
  in the `notification_deliveries` ledger. Today it calls
  `record_notification_delivery` with a named argument (`p_response_metadata`)
  the SQL function does not declare, so PostgREST resolves no overload and
  returns PGRST202 (404); every record attempt throws "Unable to record
  notification delivery" and the ledger stays empty. The worker now sends the
  declared name (`p_metadata`) and the call succeeds.
- **A worker crash never strands a notification.** `claim_due_notification_events`
  now stamps each claim with `claimed_at` + `lease_expires_at`. If the worker
  dies mid-drain, the claimed row's lease expires and a later run reclaims it —
  a visibility-timeout, like SQS — instead of leaving it in `delivering`
  forever, undelivered and un-retried.
- **Scheduled producers enqueue idempotently and fairly.** `enqueue_notification_event`
  derives the dedupe key for the scheduled producer event types from
  (event_type, membership, cycle, business_date), so a membership that rolls
  into a new cycle on the same day keeps its distinct nudge, a caller can no
  longer break dedupe with a bad key, and the audit's 14,455-calls-for-222-rows
  churn resolves to at most one row per membership-cycle-day. The producer
  queries select their bounded batch in a deterministic order so no member is
  perpetually starved of the arbitrary 100.

This is durability containment, not a redesign of the notification catalogue,
delivery cadence, quiet-hours, or frequency-cap policy. Prod application of the
two new migrations is owner-owed; this spec proves them on a local database.

## 2. Blast Radius

In scope — two new forward-only migrations, the one worker call-site fix and
producer-ordering change, and their tests, all listed in the frontmatter:

- `supabase/migrations/20260712090000_notification_event_delivery_lease.sql` —
  add `claimed_at` / `lease_expires_at`, redefine `claim_due_notification_events`
  with lease stamping + expired-lease reclaim, one-time reset of pre-lease
  `delivering` rows, re-assert the service-role-only ACL.
- `supabase/migrations/20260712091000_enqueue_notification_event_idempotency.sql`
  — redefine `enqueue_notification_event` to canonicalise the dedupe key for the
  scheduled producer event types, re-assert the service-role-only ACL.
- `lib/notifications/delivery-worker.ts` — `record_notification_delivery` arg
  name fix (`p_response_metadata` → `p_metadata`); `enqueueRawEvent` stops
  sending an ad-hoc dedupe key (the DB now owns the canonical key); deterministic
  ordering on the four scheduled producer selects; clear the lease on graceful
  release.
- `tests/db/notification-delivery-record-contract.test.mjs`,
  `tests/db/notification-event-lease.test.mjs`,
  `tests/db/notification-enqueue-idempotency.test.mjs` — behavioural proofs.
- `tests/e2e/customer-notification-settings.spec.ts` — secondary journey proof
  for the rls-rpc-ledger floor (the customer opt-in control renders and opens).

Explicitly out of scope: editing any already-applied migration file (forward-only
is the rule — the SQL `record_notification_delivery` is already correct at
`p_metadata`, so item 1 is a TS-only fix); the notification catalogue, payload
builders, quiet-hours, frequency-cap, or marketing-consent logic; the pre-existing
`tests/db/notifications.test.mjs` (it must stay green unchanged); prod `supabase
db push` (owner-owed, no prod credentials in session); the Wave-3 deferred audit
items.

## 3. Strict Constraints and Assumptions

- **Forward-only, fresh-safe, idempotent.** Both migrations are new dated files
  after Wave-1's `20260711092000`. Every statement re-runs safely: `add column
  if not exists`, `create or replace function`, declarative `revoke`/`grant`,
  and a no-op-safe one-time `update`. A fresh database replaying the whole chain
  and a linked database applying only the new tail must converge.
- **Builds on the uncommitted Wave-1 containment.** Migration `20260711090000`
  already revoked EXECUTE on these RPCs from public/anon/authenticated and
  granted `service_role`; the worker uses the service-role client, so it is
  unaffected. Both new migrations re-assert the service-role-only ACL on the
  functions they redefine (belt-and-braces; `create or replace` preserves ACLs).
- **`test:db` is the primary proof; Playwright is secondary journey proof.**
  DB behavioural tests assert the actual delivery-record contract, lease/reclaim
  transitions, and enqueue idempotency against a live local database via the
  established `tests/db/helpers` harness (GUC role-switching, rolled-back
  transactions). The e2e proves the customer-facing notification opt-in still
  renders.
- **The claim signature does not change.** `claim_due_notification_events` keeps
  its exact `(timestamptz, integer)` signature and return columns, so no new
  overload is created (which would inherit a default PUBLIC grant and re-leak),
  and the worker's row cast is untouched.
- **No cross-customer collapse.** The canonical dedupe key is applied only when
  `membership_id` is not null, so a null-membership scheduled event never
  collapses two different customers into one row; non-scheduled types are
  untouched.
- Assumption: the local live schema is current as of 2026-07-10 (Wave-1
  migrations applied), and London business-date semantics
  (`uk_business_date` / `londonBusinessDate`) are the dedupe date basis.

## 4. Decisions Already Made

- **Item 1 is a TS-only forward-only fix.** The SQL `record_notification_delivery`
  already declares `p_metadata`; the defect is entirely on the worker's call
  site. No migration. The DB proof calls the function with the argument names
  parsed from the worker source, so it fails until the source is fixed.
- **The lease is a fixed 5-minute window inside the function.** Keeping the
  2-arg signature (rather than adding a `p_lease_seconds` overload) avoids a new
  function that would inherit a default PUBLIC grant and regress Wave-1
  containment. Reclaim is folded into the claim query (self-healing on the next
  worker run), not a separate cron.
- **Pre-lease `delivering` rows are reset to `queued` once.** The lease
  migration resets existing `delivering` rows so pre-migration strands re-enter
  the normal queue; the reclaim predicate then requires a non-null, expired
  lease, so a concurrently-processing NULL-lease row is never double-claimed on
  the deploy boundary. Push is at-least-once by nature; the frequency cap bounds
  duplicates.
- **The canonical dedupe key lives in the DB, scoped to the scheduled producer
  types.** It must be DB-side so `test:db` proves it. It applies to
  `next_stamp_available`, `reward_ready`, `reward_expiring_soon`,
  `reward_expired`, `dormant_progress` — which are enqueued only by the worker
  producers and (for `reward_ready`) the `events.ts` confirmed-stamp path, both
  of which pass a non-null membership + cycle. This intentionally consolidates
  the transactional `reward_ready` to one-per-membership-cycle-day: safe because
  the `reward_ready` producer is scoped to one stamp-cycle reward per cycle and
  the frequency cap already bounds sends. Transactional types (`one_stamp_away`,
  `reward_collected_cycle_started`, etc.) keep their caller key.
- **No in-body role self-guard on `enqueue_notification_event` or
  `claim_due_notification_events`.** `enqueue_notification_event` is
  `perform`-called inside authenticated-executable SECURITY DEFINER RPCs
  (`issue_merchant_direct_reward`, `issue_self_service_stamp`, birthday/referral
  issuers); a `request.jwt.claim.role = 'service_role'` assertion would raise
  `authenticated` inside those and break merchant reward issuance. The Wave-1
  ACL revoke is the correct protection; the migrations only re-assert it.
- **Old-format dedupe rows coexist harmlessly.** Rows enqueued before deploy
  carry the old key format; the new canonical format will not collide with them,
  so at most one extra row per entity appears once at deploy and drains out. No
  data backfill of `dedupe_key` is warranted.

## 5. Behavioral Requirements (EARS)

- THE delivery worker SHALL call `record_notification_delivery` with the declared parameter name `p_metadata`, never `p_response_metadata`.
- WHEN the worker records a delivery, THE `record_notification_delivery` RPC SHALL accept the exact argument set the worker sends and insert exactly one `notification_deliveries` row.
- IF the worker's `record_notification_delivery` argument names diverge from the SQL function's declared parameters, THEN THE DB contract test SHALL fail.
- THE `notification_events` table SHALL carry `claimed_at` and `lease_expires_at` columns.
- WHEN `claim_due_notification_events` claims a due queued row, THE function SHALL flip it to `delivering`, stamp `claimed_at`, and set `lease_expires_at` to a fixed future lease window.
- WHEN a `delivering` row's `lease_expires_at` is in the past, THE claim SHALL reclaim it and refresh its lease.
- WHILE a `delivering` row's `lease_expires_at` is in the future, THE claim SHALL NOT reclaim it.
- IF a `delivering` row has a NULL `lease_expires_at`, THEN THE claim SHALL NOT reclaim it.
- THE lease migration SHALL reset any pre-existing `delivering` rows to `queued` exactly once so pre-lease strands re-enter the normal queue.
- WHERE the event type is a scheduled producer type and `membership_id` is not null, THE `enqueue_notification_event` function SHALL derive the dedupe key from (event_type, membership_id, cycle_number, business_date), ignoring any caller-supplied key.
- WHEN two scheduled enqueues share (event_type, membership, cycle, business_date), THE second SHALL collapse onto the first row.
- WHEN two scheduled enqueues differ only by cycle_number or business_date, THE function SHALL create distinct rows.
- WHERE the event type is not a scheduled producer type, THE `enqueue_notification_event` function SHALL continue to honour the caller-supplied dedupe key.
- THE four scheduled producer selects SHALL order their bounded batch deterministically so a per-run limit cannot indefinitely starve the same records.
- THE `claim_due_notification_events` and `enqueue_notification_event` functions SHALL remain executable only by `service_role`.

## 6. Verification Criteria and Task Breakdown

Browser gate scope: the `test:e2e` gate is scoped to `@MS-db-notification-durability`,
the tag on `tests/e2e/customer-notification-settings.spec.ts`.

Observable outcomes to verify:

- The worker's `record_notification_delivery` argument names are all declared
  parameters of the SQL function, and a named-argument call with that set
  inserts one delivery row (both fail before the arg-name fix).
- A `delivering` row with an expired lease is reclaimed and re-leased; one with
  a live lease or a NULL lease is left alone; a claimed queued row gains
  `claimed_at` + a future `lease_expires_at`.
- Two scheduled enqueues with the same (event_type, membership, cycle,
  business_date) but different caller keys collapse to one row; differing only
  by cycle or business_date yields two rows; a `reward_ready` from both historic
  caller-key formats collapses to one; a transactional `one_stamp_away` still
  honours distinct caller keys.
- `tests/db/notifications.test.mjs` stays green (claim still takes due queued
  rows, honours the batch limit, and the delivery readback holds).
- On a fresh `supabase db reset`, both migrations apply idempotently after the
  Wave-1 chain; re-applying is a no-op.

Task breakdown (red → green → refactor; run the narrowest `tests/db` file per
task, then the full recorded gate floor at the lifecycle boundary):

1. `tests/db/notification-delivery-record-contract.test.mjs` red, then fix the
   `p_response_metadata` → `p_metadata` argument name in
   `lib/notifications/delivery-worker.ts` green.
2. `tests/db/notification-event-lease.test.mjs` red, then migration
   `20260712090000` green: lease columns, lease-stamping + expired-lease reclaim
   claim, one-time reset, ACL re-assert.
3. `tests/db/notification-enqueue-idempotency.test.mjs` red, then migration
   `20260712091000` green: DB-owned canonical dedupe key for the scheduled
   producer types; update `enqueueRawEvent` to stop sending an ad-hoc key and
   add deterministic ordering to the producer selects.
4. `tests/e2e/customer-notification-settings.spec.ts` green against local
   Supabase (secondary journey proof).
5. Fresh-DB rehearsal: `supabase db reset`, `pnpm test:db`, then advance the
   lifecycle with `governance:advance MS-db-notification-durability --to
   implemented` to record the full gate floor.
