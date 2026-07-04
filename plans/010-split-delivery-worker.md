# Plan 010: Split `delivery-worker.ts` into orchestrator + producers + sender

> **Executor instructions**: Follow step by step; run every verification command.
> If a "STOP condition" occurs, stop and report. Update this plan's row in
> `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat 4a04c141..HEAD -- lib/notifications/delivery-worker.ts`

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED (live customer-facing push pipeline — behavior must not change)
- **Depends on**: none (but do this BEFORE plan 011 to reduce merge churn)
- **Category**: tech-debt
- **Planned at**: commit `4a04c141`, 2026-07-03

## Why this matters

`lib/notifications/delivery-worker.ts` (938 lines) is the customer push pipeline
and mixes five concerns in one file: the batch loop, four event **producers**,
the 122-line per-event **eligibility+send gate** (`deliverNotificationEvent`),
web-push **send/retry classification**, and observability. That size is why the
gate isn't independently testable and why the N+1 in plan 011 is easy to miss.
Splitting into focused modules (producers, sender) behind the same entry function
shrinks the god object and sets up the read-batching in plan 011. This is a pure
code-motion refactor — no behavior change.

## Current state

- Entry: `runPushNotificationDeliveryWorker()` — claims a batch, then the loop:
  ```ts
  // lib/notifications/delivery-worker.ts:116-122
  for (const event of (data ?? []) as NotificationEventRow[]) {
    const delivery = await deliverNotificationEvent(supabase, event, now)
    result.processed += 1
    result.sent += delivery.sent
    result.skipped += delivery.skipped
    result.failed += delivery.failed
  }
  ```
- `deliverNotificationEvent(supabase, event, now)` (`:206-328`) — quiet-hours
  defer, frequency-cap, `isDeliveryAllowed`, subscription fetch/filter, send.
- Producers (`:399-563`) — the four functions that enqueue the event types.
- Web-push send + retry classification (`:330-397`).
- Pure predicates it uses are already extracted + tested:
  `lib/notifications/frequency-cap.ts` (`tests/unit/notification-frequency-cap.test.mjs`),
  quiet-hours (`tests/unit/notification-quiet-hours.test.mjs`).
- Behavioral coverage today is source-grep
  (`tests/micro-specs/notification-queue-claims.test.mjs`) + DB tier
  (`tests/db/notifications.test.mjs`). Both must stay green.

## Commands you will need

| Purpose          | Command                 | Expected |
|------------------|-------------------------|----------|
| Typecheck        | `pnpm typecheck`        | exit 0   |
| Build            | `pnpm build`            | exit 0   |
| Micro-spec tests | `pnpm test:micro-specs` | all pass |
| DB tests         | `pnpm test:db`          | pass or skip cleanly |

## Scope

**In scope**:
- `lib/notifications/notification-producers.ts` (create — the four producers)
- `lib/notifications/push-sender.ts` (create — web-push send + retry classification)
- `lib/notifications/delivery-worker.ts` (keep the entry loop + `deliverNotificationEvent`,
  importing from the two new modules)

**Out of scope**:
- Changing any eligibility/quiet-hours/cap/consent logic or ordering.
- Changing the read pattern (that's plan 011).
- `frequency-cap.ts`, the cron route, the DB migrations.

## Git workflow

- Branch: `advisor/010-split-delivery-worker`
- Commit: `refactor(notifications): split producers and sender out of delivery worker`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Extract the web-push sender

Move the send + retry-classification helpers (`:330-397`) into
`lib/notifications/push-sender.ts`, exporting what `deliverNotificationEvent`
needs. Import them back.

### Step 2: Extract the producers

Move the four producer functions (`:399-563`) into
`lib/notifications/notification-producers.ts`. Keep names identical; import them
where the worker references them.

### Step 3: Keep the orchestrator thin

`delivery-worker.ts` retains `runPushNotificationDeliveryWorker` and
`deliverNotificationEvent`, now importing producers + sender. Do not alter the
per-event status transitions or ordering.

**Verify** after each step:
- `pnpm typecheck` → exit 0.
- `pnpm build` → exit 0.
- `pnpm test:micro-specs` → all pass (reconcile any grep spec that references a
  moved symbol by pointing it at the new module — test files are in scope).
- `pnpm test:db` → passes or skips cleanly (proves the pipeline behavior is intact).

## Done criteria

ALL must hold:

- [ ] `notification-producers.ts` and `push-sender.ts` exist; `delivery-worker.ts`
      imports from them
- [ ] `deliverNotificationEvent`'s logic and ordering are unchanged (diff is code motion)
- [ ] `pnpm typecheck`, `pnpm build`, `pnpm test:micro-specs` pass
- [ ] `pnpm test:db` passes or skips cleanly
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report if:
- Moving a helper would change the order of quiet-hours → cap → eligibility →
  send checks (that ordering is load-bearing — do not reorder).
- `pnpm test:db` fails (a behavior changed — revert and report; do not "fix" the test).
- A moved symbol is imported by a file outside `lib/notifications/` you didn't expect.

## Maintenance notes

- Plan 011 (read-batching) builds on this split — land 010 first.
- Reviewer: verify the diff is motion-only; any logic change here is out of scope
  and a red flag given this is the live push pipeline.
