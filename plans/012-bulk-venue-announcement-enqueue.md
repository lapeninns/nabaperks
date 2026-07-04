# Plan 012: Bulk-enqueue venue announcements instead of one RPC per member

> **Executor instructions**: Follow step by step; run every verification command.
> If a "STOP condition" occurs, stop and report. Update this plan's row in
> `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat 4a04c141..HEAD -- lib/notifications/venue-announcements.ts supabase/migrations`

## Status

- **Priority**: P3
- **Effort**: M–L
- **Risk**: MED (touches enqueue + a new/changed RPC; DB tests must stay green)
- **Depends on**: none
- **Category**: performance
- **Planned at**: commit `4a04c141`, 2026-07-03

## Why this matters

When a merchant sends a venue announcement, the eligible audience is resolved in
one batched read (good), but the enqueue then issues **one RPC per eligible
member** in a serial loop. For a venue with hundreds of members that is hundreds
of sequential round-trips inside the merchant's "send" action, making it slow and
chatty. Replacing the loop with a single set-based enqueue (a bulk RPC or a
multi-row insert with the same `ON CONFLICT (dedupe_key)` guarantee) makes the
action's cost independent of audience size.

## Current state

```ts
// lib/notifications/venue-announcements.ts:119-153 — per-member enqueue loop
for (const membership of memberships) {
  if (!audience.has(membership.customerId)) { skipped += 1; continue }
  const result = await enqueueNotificationEvent({
    eventType: "venue_announcement",
    customerId: membership.customerId,
    merchantId: input.merchantId,
    membershipId: membership.id,
    dedupeKey: venueAnnouncementDedupeKey({ merchantId, customerId, title, body }),
    payload: { ... url: `/card/${membership.id}` },
    metadata: { source: "merchant_console", actor_id: input.actorId },
  })
  if (result.status === "queued") queued += 1; else skipped += 1
}
```
- Audience resolution above (`:159-183`) is already batched via `.in(...)` — good;
  only the write is per-row.
- `enqueueNotificationEvent` is a single-row wrapper over an enqueue RPC (find its
  definition in `lib/notifications/events.ts` and the SQL RPC in
  `supabase/migrations/*`). The **dedupe key** semantics (`ON CONFLICT` →
  `queued` vs `skipped`) are load-bearing and must be preserved exactly.
- Migration conventions: timestamped SQL under `supabase/migrations/` (see the
  most recent files for the header/format); `migrations`/`rls-rpc-ledger`
  risk-class changes require `pnpm test:db` proof.

## Commands you will need

| Purpose   | Command          | Expected |
|-----------|------------------|----------|
| Typecheck | `pnpm typecheck` | exit 0   |
| DB tests  | `pnpm test:db`   | pass (run locally; do not accept a skip for this change) |
| Micro-specs | `pnpm test:micro-specs` | pass |

## Scope

**In scope**:
- `supabase/migrations/<timestamp>_bulk_enqueue_notification_events.sql` (create —
  a bulk enqueue RPC), OR a batched multi-row insert path if the existing RPC's
  logic is a plain insert-on-conflict (see Step 1).
- `lib/notifications/events.ts` (add a `enqueueNotificationEvents` bulk wrapper).
- `lib/notifications/venue-announcements.ts` (replace the loop with one bulk call).
- `tests/db/notifications.test.mjs` (extend) or a new `tests/db/*` case.

**Out of scope**:
- The audience-resolution read (already batched).
- Dedupe-key format or the per-member payload shape.
- The delivery worker (separate plans 010/011).

## Git workflow

- Branch: `advisor/012-bulk-announcement-enqueue`
- Commit: `perf(notifications): bulk-enqueue venue announcements`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Understand the existing enqueue RPC

Read `enqueueNotificationEvent` in `lib/notifications/events.ts` and the RPC it
calls in `supabase/migrations/*`. Decide the bulk shape:
- If the RPC is essentially `insert ... on conflict (dedupe_key) do nothing
  returning`, a **bulk RPC** taking a `jsonb[]`/rows array and doing one
  multi-row insert with the same `ON CONFLICT` is the clean path.
- Preserve the exact conflict target and the queued/skipped accounting (rows
  inserted = queued; conflicts = skipped).

### Step 2: Add the bulk RPC (migration)

Create the timestamped migration mirroring the single-row RPC's guards
(merchant/customer scoping, dedupe key) but accepting an array and returning the
inserted count (or the inserted ids) so the caller can compute queued vs skipped.
Match the header/grant style of the newest migration files.

### Step 3: Add the bulk wrapper + swap the loop

Add `enqueueNotificationEvents(rows)` to `lib/notifications/events.ts`; in
`venue-announcements.ts`, build the eligible-member rows array (filtering by
`audience.has(...)` as today) and call the bulk wrapper once, then set
`queued`/`skipped` from its result.

**Verify**:
- `pnpm test:db` → the announcement enqueue tests pass; extend them to assert
  that (a) N eligible members produce N queued rows in one call, and (b) a repeat
  send with the same title/body is fully deduped (0 queued, N skipped).
- `pnpm typecheck && pnpm test:micro-specs` → pass.

## Done criteria

ALL must hold:

- [ ] `venue-announcements.ts` no longer calls `enqueueNotificationEvent` inside a
      per-member loop (`grep -n "for (const membership" lib/notifications/venue-announcements.ts`
      shows the loop is gone or only builds the rows array)
- [ ] A bulk enqueue RPC + `enqueueNotificationEvents` wrapper exist
- [ ] `pnpm test:db` passes (executed) including a multi-member + dedupe-repeat case
- [ ] `pnpm typecheck`, `pnpm test:micro-specs` pass
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report if:
- The single-row enqueue RPC does more than an insert-on-conflict (e.g. side
  effects per row) that can't be safely batched — report the logic; do not drop
  a side effect.
- You cannot run `pnpm test:db` locally (this change needs behavioral proof —
  hand back rather than shipping unverified).
- The dedupe-key semantics would change under batching (they must be identical).

## Maintenance notes

- Cap the array size per call and chunk very large audiences (Postgres parameter
  limits); document the chunk size.
- Reviewer: the dedupe guarantee (no duplicate announcement per member) is the
  invariant to scrutinize.
- The same bulk pattern will help plan 011's write side if extended later.
