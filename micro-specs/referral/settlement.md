---
spec_id: MS-referral-settlement
status: implemented
risk_class: rls-rpc-ledger
owner: amankumarshrestha
last_reviewed: 2026-07-10
allowed_blast_radius:
  - micro-specs/referral/**
  - supabase/migrations/20260710180000_referral_settlement.sql
  - app/api/cron/referral-bonus-drain/route.ts
  - vercel.json
  - tests/db/referral-settlement.test.mjs
implementation_surfaces:
  - supabase/migrations/20260710180000_referral_settlement.sql
  - app/api/cron/referral-bonus-drain/route.ts
  - vercel.json
  - tests/db/referral-settlement.test.mjs
related_docs:
  - micro-specs/GLOBAL_CONTEXT.md
  - micro-specs/referral/state-machine.md
  - micro-specs/referral/bonus-stamp.md
  - micro-specs/customer/card-stamp.md
related_tests:
  - tests/db/referral-settlement.test.mjs
  - tests/e2e/customer-referral-bonus-stamp.spec.ts
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:coverage
  - pnpm test:db
  - pnpm test:e2e -- --grep "referral bonus" --project=mobile-safari
required_playwright_projects:
  - mobile-safari
evidence_required:
  - Live-DB output proving settle_referral_bonus(referral_id) awards exactly one bonus for a qualified edge (earned stamp, NULL business date, source referral_bonus) through the normal cycle + reward-unlock pipeline, marks the edge awarded with hold fields cleared, and is a no-op for an already-awarded / rejected / cancelled / attributed edge (idempotent, one-per-edge).
  - Live-DB output proving each blocked settlement records a durable hold with a reason from {referrer_membership_inactive, card_full, daily_bonus_limit, reward_unavailable, temporary_processing_error}, held_at, next_retry_at, incremented retry_count, and (for the velocity case) a referral_bonus_velocity fraud flag — so no qualified referral is left silently unresolved.
  - Live-DB output proving drain_due_referral_bonuses() settles due (qualified/held, next_retry_at ≤ now) referrals in bounded FOR UPDATE SKIP LOCKED batches, that two concurrent drains never double-issue a bonus, and that a full-card referrer's held bonus is paid once room frees.
  - Live-DB output proving a referrer with a held bonus who makes a new venue visit has the owed bonus settled before their visit stamp is applied (stamp ordering), in one transaction, and that the legacy award_referrer_bonus_stamp entrypoint + the friend's stamp outcome are unchanged (back-compat shim over settle).
  - Playwright (mobile-safari) output proving the referral bonus share/award journey still completes end-to-end after the settlement rewrite (secondary journey proof; DB tier is primary).
approved_exceptions: []
---

# MS-referral-settlement — One settlement function, durable holds, and a scheduled drain

## 1. Exact Goal and User-Visible Outcomes

The referral bonus is now paid through a single, auditable settlement function
`settle_referral_bonus(referral_id)` rather than the membership-keyed v1 primitive.
It locks the referral, refuses to act on a terminal edge, requires the referral to
be **qualified**, revalidates the referrer, checks velocity, room, and reward
availability, and — when it can — awards exactly one bonus through the normal
card-completion and reward-unlock pipeline, marking the edge `awarded`. When it
**cannot** award, it never silently drops the bonus: it records a **durable hold**
with an explicit reason, a retry time, a retry count, and (for unexpected errors)
the last error, so every qualified referral ends `awarded`, `held` with a reason,
or explicitly terminal.

Held bonuses now settle **autonomously**: `drain_due_referral_bonuses()` is a
concurrency-safe worker (`FOR UPDATE SKIP LOCKED`, bounded batches, respecting
`next_retry_at`) that is **registered as a scheduled cron** — the v1 drain route
existed but was never scheduled, so full-card bonuses only settled by luck. And
when a referrer with an owed bonus makes a new visit, the **owed bonus is settled
before their visit stamp** so an older referral bonus is never outranked by a fresh
stamp.

For members nothing visibly regresses: the friend's stamp path is untouched, the
existing `award_referrer_bonus_stamp` entrypoint keeps working as a thin shim over
`settle_referral_bonus`, and a bonus that could be paid instantly still is. What
changes is that owed bonuses are now durably tracked and reliably paid.

## 2. Blast Radius

In scope (may be edited):

- A new migration `supabase/migrations/20260710180000_referral_settlement.sql`:
  - `settle_referral_bonus(p_referral_id uuid) returns text` — the referral-keyed
    settlement (lock, terminal guard, qualified guard, revalidate, velocity, room,
    reward-availability, award via the normal pipeline, hold-on-block,
    hold-on-error), reusing the v1 award tail verbatim for the actual stamp/reward
    writes;
  - `hold_referral_bonus(p_referral_id, p_reason, p_error)` — the durable-hold
    writer (status `held`, `hold_reason`, `held_at`, `next_retry_at` with backoff,
    `retry_count += 1`, `last_error`) that also emits `referral_bonus_held`;
  - `drain_due_referral_bonuses(p_limit int) returns integer` — the scheduled,
    concurrency-safe worker;
  - re-point `award_referrer_bonus_stamp` and
    `drain_due_referrer_bonuses[_for_membership]` onto `settle_referral_bonus`
    (thin shims; the reward-unlock tail now lives in one place);
  - a `create or replace` of the QR-gated `issue_self_service_stamp` overload that
    settles the scanner's own owed bonuses **before** issuing their visit stamp
    (stamp ordering), then keeps the v1 friend-side award hook.
- `app/api/cron/referral-bonus-drain/route.ts` — call `drain_due_referral_bonuses`.
- `vercel.json` — register the drain cron schedule.
- `tests/db/referral-settlement.test.mjs`.

Out of scope (explicitly not touched):

- The state machine, qualification transition, and denormalised columns —
  delivered by [`MS-referral-state-machine`](state-machine.md); this spec consumes
  them.
- Event-driven retry hooks beyond the on-visit settle, the full five-event outbox
  and member notification copy, and the bonus-bank UI — owned by
  [`MS-referral-retry-outbox`](retry-outbox.md).
- The inner 7-arg `issue_self_service_stamp` ledger, geofence, billing, and the
  friend's one-per-UK-day guard — unchanged.

## 3. Strict Constraints and Assumptions

- **Server-authoritative, service-role-only.** `settle_referral_bonus`,
  `hold_referral_bonus`, and the drains are `SECURITY DEFINER`, granted to
  `service_role` only; the browser never settles.
- **One bonus per edge, ever.** Settlement locks the referral row `FOR UPDATE`;
  the terminal-status guard and the existing `referrer_bonus_awarded_at is null`
  invariant make a second award impossible, including under a concurrent drain
  (`SKIP LOCKED` on the batch, re-lock inside settle).
- **Award writes are the v1 tail, verbatim.** The stamp shape (`earned`,
  `stamps_delta 1`, `source referral_bonus`, `earned_business_date NULL`), the
  counter bump, and the first-cycle-default / weighted-random reward selection are
  reproduced exactly from `award_referrer_bonus_stamp`; only the surrounding
  control flow (status-aware, hold-recording) is new.
- **Holds are durable and self-describing.** Every non-award outcome writes
  `status='held'`, a `hold_reason` in the CHECK allow-list, `held_at`,
  `next_retry_at`, `retry_count += 1`, and (on error) `last_error`. A successful
  award clears `hold_reason/held_at/next_retry_at`.
- **Backoff by reason.** `next_retry_at` for `daily_bonus_limit` is the next UK
  business day; for `referrer_membership_inactive` and `temporary_processing_error`
  it is a capped exponential backoff on `retry_count` (so a genuinely stuck or
  erroring referral is visibly retried, never hot-looped); for the event-driven
  `card_full` and `reward_unavailable` it stays retry-eligible (`now()`) so the
  scheduled drain settles them promptly once the referrer's card frees or the
  merchant replenishes rewards.
- **Concurrency.** `drain_due_referral_bonuses` selects its batch with
  `FOR UPDATE SKIP LOCKED` so parallel workers/cron ticks partition the work and
  never double-issue.
- **Back-compat.** `award_referrer_bonus_stamp(referred_membership_id, …)` keeps
  its signature and callers; it now qualifies then resolves the edge and calls
  `settle_referral_bonus`. The friend's stamp outcome and the returned flags are
  byte-for-byte unchanged.

## 4. Decisions Already Made

- **Keyed by `referral_id`.** Settlement takes the edge id (not the membership) so
  a specific referral can be retried in isolation by the drain and event hooks.
- **`settling` is a transient in-flight marker** set at the top of settlement and
  replaced by `awarded` or `held` before the function returns; it is never a
  resting state.
- **Hold reasons.** No active card / no reward pool → `reward_unavailable`; missing
  referrer membership → `referrer_membership_inactive`; over daily cap →
  `daily_bonus_limit`; full card → `card_full`; unexpected exception →
  `temporary_processing_error`.
- **Stamp ordering is transactional in the RPC.** The QR-gated
  `issue_self_service_stamp` settles the scanner's owed bonuses before the inner
  ledger stamp, so both happen in the friend/visitor's single stamp transaction.
- **The scheduled cron runs every 15 minutes** (matching the notifications sweep
  cadence); the drain is idempotent so a missed tick self-heals.
- The daily cap (2) and the min-3-reward completion guard are unchanged from v1.

## 5. Behavioral Requirements (EARS)

- **SE-1 (single settlement):** THE system SHALL award a referral bonus only
  through `settle_referral_bonus(referral_id)`, which locks the edge and issues at
  most one bonus per edge.
- **SE-2 (terminal guard):** IF a referral is `awarded`, `rejected`, `cancelled`,
  or `expired`, THEN `settle_referral_bonus` SHALL make no change.
- **SE-3 (qualified required):** THE system SHALL award a bonus only for a
  `qualified` or previously `held` referral; an `attributed` referral SHALL NOT be
  awarded.
- **SE-4 (durable hold):** IF settlement cannot award, THEN THE system SHALL record
  `status='held'` with a `hold_reason`, `held_at`, `next_retry_at`,
  `retry_count += 1`, and `last_error`, and SHALL emit one `referral_bonus_held`
  event.
- **SE-5 (velocity):** IF awarding would exceed two referral bonuses for the
  referrer on the current UK business day, THEN settlement SHALL hold
  `daily_bonus_limit`, record one `referral_bonus_velocity` fraud flag, and set
  `next_retry_at` to the next UK business day.
- **SE-6 (full card):** IF the referrer's card is full, THEN settlement SHALL hold
  `card_full` and SHALL NOT push the card beyond `stamps_required`.
- **SE-7 (reward availability):** IF a completing bonus cannot select a fulfilable
  reward, THEN settlement SHALL hold `reward_unavailable`.
- **SE-8 (award pipeline):** WHEN settlement awards, THE bonus SHALL be an `earned`
  stamp (`stamps_delta 1`, `source referral_bonus`, `earned_business_date NULL`)
  that advances the referrer's cycle and unlocks a reward on completion exactly as
  a normal stamp, storing the bonus stamp id and marking the edge `awarded` with
  hold fields cleared.
- **SE-9 (never silently stuck):** THE system SHALL leave every qualified referral
  `awarded`, `held` with a reason, or explicitly terminal — never silently
  unresolved.
- **SE-10 (scheduled drain):** THE `drain_due_referral_bonuses()` worker SHALL
  process due referrals (`qualified`/`held` with `next_retry_at` null or ≤ now) in
  bounded `FOR UPDATE SKIP LOCKED` batches and SHALL be safe to run concurrently
  without double-issuing.
- **SE-11 (backoff + surfacing):** WHEN a hold recurs, THE system SHALL increase
  the `next_retry_at` backoff and increment `retry_count` so a persistently failing
  referral is visibly retried and surfaceable to operations.
- **SE-12 (cron registered):** THE referral bonus drain SHALL be registered as a
  scheduled cron so owed bonuses settle autonomously.
- **SE-13 (stamp ordering):** WHEN a referrer with a held bonus makes a new venue
  visit, THE system SHALL settle the owed bonus before applying the visit stamp, in
  one transaction.
- **SE-14 (back-compat shim):** THE `award_referrer_bonus_stamp` entrypoint and the
  legacy drains SHALL continue to work by routing through `settle_referral_bonus`,
  and the friend's stamp path, guards, and returned flags SHALL be unchanged.
- **SE-15 (temporary error):** IF an unexpected error occurs while awarding, THEN
  settlement SHALL hold `temporary_processing_error` with `last_error` and a
  backoff retry, without corrupting the edge or the ledger.

## 6. Verification Criteria and Task Breakdown

Observable behaviours to verify (DB tier is primary; live Postgres, rolled-back
transactions except the concurrency test which commits and tears down):

- `settle_referral_bonus` on a qualified edge awards one `referral_bonus` stamp
  (NULL date), advances the referrer, marks `awarded`, clears hold fields; a second
  call and calls on awarded/rejected/cancelled/attributed edges are no-ops
  (SE-1/SE-2/SE-3/SE-8).
- A full-card referrer holds `card_full`; over-cap holds `daily_bonus_limit` +
  fraud flag with `next_retry_at` = next business day; a completing bonus with an
  insufficient pool holds `reward_unavailable`; a missing referrer holds
  `referrer_membership_inactive`; each writes `held_at`/`next_retry_at`/
  `retry_count`/`referral_bonus_held` (SE-4/SE-5/SE-6/SE-7/SE-9).
- `drain_due_referral_bonuses()` pays a full-card bonus once room frees and skips
  not-yet-due (`next_retry_at` in future) rows; two concurrent drains issue exactly
  one bonus (SE-10).
- A referrer with a held bonus who scans issues the owed bonus before their own
  visit stamp, in one transaction; `award_referrer_bonus_stamp` still awards on a
  friend's first stamp and the friend's outcome is unchanged (SE-13/SE-14).
- Forcing an award error records `temporary_processing_error` with `last_error`
  and a future `next_retry_at` (SE-15).

Browser tier (mobile-safari, secondary): the referral bonus journey still
completes (`tests/e2e/customer-referral-bonus-stamp.spec.ts`).

Source scan (`pnpm test`): settlement is service-role-only; the cron route is
`CRON_SECRET`-gated and calls `drain_due_referral_bonuses`; `vercel.json` schedules
it.

Task breakdown (test-first per `Instructions_tdd.md`):

1. Migration: `hold_referral_bonus`; `settle_referral_bonus`; re-point
   `award_referrer_bonus_stamp` + legacy drains; `drain_due_referral_bonuses`;
   `issue_self_service_stamp` overload settle-first re-create.
2. DB tests red → green across SE-1…SE-15 (award, all holds, drain, concurrency,
   stamp ordering, shim back-compat, temporary error).
3. Cron route → `drain_due_referral_bonuses`; `vercel.json` schedule.

Prove the work with `governance:run-gates --spec MS-referral-settlement --record`
and advance the lifecycle with `governance:advance`.
