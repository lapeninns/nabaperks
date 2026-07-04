# Plan 011: Batch the delivery worker's per-event read context (remove the N+1)

> **Executor instructions**: Follow step by step; run every verification command.
> If a "STOP condition" occurs, stop and report. Update this plan's row in
> `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat 4a04c141..HEAD -- lib/notifications/delivery-worker.ts`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (live push pipeline; the DB moat + queue tests must stay green)
- **Depends on**: plans/010 recommended (cleaner seam), not required
- **Category**: performance
- **Planned at**: commit `4a04c141`, 2026-07-03

## Why this matters

The delivery worker processes a claimed batch **serially**, and each event makes
~6 sequential Supabase round-trips (preferences, frequency-cap, eligibility,
enabled subscriptions, already-sent filter, attempt-number), before its writes.
For the default batch size of 50 that is roughly 300+ fully serialized
round-trips per cron run, and it scales linearly with the member base — the
worker's latency/cost grows with every new customer. It is a background cron (off
the request path, so no user waits), which is why this is a scale-wall, not an
outage. Batching the read-side context for the whole claimed batch up front —
the exact Map-keyed pattern `lib/merchant/activity.ts` and `lib/customer/home.ts`
already use — collapses the per-event reads into a handful of `.in(...)` queries.

## Current state

```ts
// lib/notifications/delivery-worker.ts:116-122 — serial batch loop
for (const event of (data ?? []) as NotificationEventRow[]) {
  const delivery = await deliverNotificationEvent(supabase, event, now)
  // ...accumulate result
}

// deliverNotificationEvent(:206-328) issues, per event and in sequence:
//   getPreferences(supabase, event.customer_id)                      (:220)
//   customerNotificationDeliveryCapReached(...)                      (:240)
//   isDeliveryAllowed(supabase, event, preferences)                  (:259, +consent RPC for marketing)
//   getEnabledSubscriptions(supabase, event.customer_id)             (:267)
//   filterAlreadySentSubscriptions(supabase, event.id, subs)         (:271)
//   nextDeliveryAttemptNumber(...)                                   (:~302)
```
- The read helpers are around `:622-663` (`getPreferences`, `getEnabledSubscriptions`),
  `:665-697` (`filterAlreadySentSubscriptions`), `:703-721` (attempt number).
- **Invariants that must not change**: per-event quiet-hours defer, frequency cap,
  consent gating, no-double-send (`notification_deliveries` dedupe), and the
  status transitions (`sent`/`skipped`/`failed`/`cancelled`/`deferred`). These are
  covered by `tests/db/notifications.test.mjs` and
  `tests/micro-specs/notification-queue-claims.test.mjs` — keep them green.

## Commands you will need

| Purpose          | Command                 | Expected |
|------------------|-------------------------|----------|
| Typecheck        | `pnpm typecheck`        | exit 0   |
| Micro-spec tests | `pnpm test:micro-specs` | all pass |
| DB tests         | `pnpm test:db`          | pass (or skip cleanly) |
| Build            | `pnpm build`            | exit 0   |

The DB tier is the real proof here — run it locally (`supabase start` +
`SUPABASE_DB_URL`) if at all possible; do NOT consider this plan done on a skip.

## Scope

**In scope**:
- `lib/notifications/delivery-worker.ts` (and, if plan 010 landed, the extracted
  read helpers' module).

**Out of scope**:
- Eligibility/cap/quiet-hours/consent **logic** — only the *fetch shape* changes.
- The send path and retry classification.
- Any DB migration or index (the fix is query-shape; see Maintenance for indexes).

## Git workflow

- Branch: `advisor/011-delivery-worker-batching`
- Commit: `perf(notifications): batch delivery worker read context`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Pre-fetch batch context up front

After the batch is claimed (right after the loop-source `data` is available),
collect the distinct `customer_id`s and `event.id`s, then issue **one** query
each, keyed into Maps:
- preferences: `notification_preferences ... .in("customer_id", customerIds)` → `Map<customerId, prefs>`
- enabled subscriptions: `push_subscriptions ... .in("customer_id", customerIds).eq("enabled", true).is("revoked_at", null)` → `Map<customerId, subscription[]>`
- already-sent: `notification_deliveries ... .in("notification_event_id", eventIds)` → `Map<eventId, Set<subscriptionId>>`
(Model the Map-keyed batching on `lib/notifications/venue-announcements.ts:159-183`
`resolveAnnouncementAudience`, which already does exactly this for announcements.)

### Step 2: Make `deliverNotificationEvent` read from the pre-fetched maps

Change `deliverNotificationEvent`'s signature to accept the pre-fetched context
(preferences/subscriptions/already-sent for that event's customer) instead of
issuing its own reads. Keep every decision branch and its ordering identical —
only the *source* of the data changes (map lookup instead of query). The
frequency-cap check that depends on cross-event delivery counts must remain
correct: if it reads live per-event state, either keep that single read or fold
it into the batched counts — do NOT weaken the cap. If unsure whether a given
read is safe to batch, leave it per-event and report it (see STOP conditions).

### Step 3 (optional): bounded concurrency

Each event's **writes** are independent; after the reads are batched you may
process events with small bounded concurrency (e.g. `Promise.all` over chunks).
Only do this if the DB tests still pass — the no-double-send dedupe must hold
under concurrency. If in doubt, keep the loop serial (the read batching alone is
the main win).

**Verify** (after Steps 1–2, and again after any Step 3):
- `pnpm test:db` → all notification/moat tests pass (this is the gate that proves
  no invariant regressed).
- `pnpm test:micro-specs` → pass.
- `pnpm typecheck && pnpm build` → exit 0.

## Test plan

- No new behavior, so the value is that the **existing** DB + queue tests still
  pass with far fewer queries. If `tests/db/notifications.test.mjs` doesn't
  already assert cap/quiet-hours/no-double-send across a multi-event batch, add a
  case that enqueues several events for one customer and asserts the cap/skip
  counts — this guards the batched path.
- Verification: `pnpm test:db` green (not skipped), `pnpm test:micro-specs` green.

## Done criteria

ALL must hold:

- [ ] The per-event reads (preferences, enabled subscriptions, already-sent) are
      issued once per batch via `.in(...)`, not once per event
      (`grep -n "getPreferences\|getEnabledSubscriptions" lib/notifications/delivery-worker.ts`
      shows them called at batch scope, not inside the per-event body)
- [ ] `deliverNotificationEvent` no longer issues those reads itself
- [ ] `pnpm test:db` passes (executed, not skipped) — cap, quiet-hours, consent,
      no-double-send, and status transitions all still hold
- [ ] `pnpm test:micro-specs`, `pnpm typecheck`, `pnpm build` pass
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report if:
- You cannot run `pnpm test:db` locally (do NOT mark done on a skip — batching a
  trust-adjacent worker needs behavioral proof; report and hand back).
- A read cannot be safely batched without changing cap/consent semantics (leave
  it per-event and report which one).
- The DB tests fail after batching (an invariant regressed — revert, report).

## Maintenance notes

- If a future change adds pagination or a much larger batch size, revisit the
  `.in(...)` list sizes (Postgres/PostgREST have practical limits — chunk if needed).
- Reviewer: confirm the frequency cap and no-double-send still hold under the new
  read shape; that's the risk surface.
- Deferred (separate, needs schema evidence): verify indexes back the batched
  `.in("customer_id", ...)` / `.in("notification_event_id", ...)` filters via
  `EXPLAIN`; add indexes only with a real plan showing a seq scan.
