---
spec_id: MS-referral-retry-outbox
status: implemented
risk_class: rls-rpc-ledger
owner: amankumarshrestha
last_reviewed: 2026-07-10
allowed_blast_radius:
  - micro-specs/referral/**
  - supabase/migrations/20260710190000_referral_retry_outbox.sql
  - lib/notifications/catalog.ts
  - lib/customer/referral-bonus-bank.ts
  - lib/customer/referral-bonus-bank-copy.ts
  - components/customer/referral-bonus-bank-panels.tsx
  - tests/db/referral-retry-outbox.test.mjs
implementation_surfaces:
  - supabase/migrations/20260710190000_referral_retry_outbox.sql
  - lib/notifications/catalog.ts
  - lib/customer/referral-bonus-bank.ts
  - lib/customer/referral-bonus-bank-copy.ts
  - components/customer/referral-bonus-bank-panels.tsx
  - tests/db/referral-retry-outbox.test.mjs
related_docs:
  - micro-specs/GLOBAL_CONTEXT.md
  - micro-specs/referral/state-machine.md
  - micro-specs/referral/settlement.md
  - micro-specs/referral/bonus-stamp.md
related_tests:
  - tests/db/referral-retry-outbox.test.mjs
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
  - Live-DB output proving the five referral lifecycle events (referral_attributed, referral_qualified, referral_bonus_held, referral_bonus_awarded, referral_bonus_failed) are written to the transactional outbox at their transitions, and that the member notifications (friend joined / referral qualified / bonus saved / bonus added) are enqueued and deduplicated one per (referral id, event type).
  - Live-DB output proving event-driven retry: a held reward_unavailable bonus settles when a merchant activates/replenishes reward-pool items (and the referrer-visit case settles via the settlement stamp-ordering hook), and that the reward-pool retry trigger does not recurse on the settlement's own writes.
  - Live-DB output proving referral_bonus_failed is emitted (distinct from the held event) when settlement hits an unexpected error, and that a held bonus surfaces its reason to the bonus-bank read path.
  - Playwright (mobile-safari) output proving the referral bonus bank surface still renders after the outbox/notification changes (secondary journey proof; DB tier is primary).
approved_exceptions: []
---

# MS-referral-retry-outbox — Event-driven retries and the transactional outbox

## 1. Exact Goal and User-Visible Outcomes

Every referral milestone now produces a durable **outbox** event and, where the
member should hear about it, a deduplicated notification. A member is told **"Your
friend joined"** when the friend enrols, **"Your referral qualified"** when the
friend's first visit lands, **"Your bonus stamp has been added"** when it is
awarded, and **"Your bonus is saved and will be added automatically"** when it is
held — each at most once per referral per milestone. Analytics gains the full
five-event stream (`referral_attributed`, `referral_qualified`,
`referral_bonus_held`, `referral_bonus_awarded`, `referral_bonus_failed`).

Held bonuses are also retried **the moment the world changes**, not only on the
15-minute sweep: when a merchant activates or replenishes reward-pool items, the
venue's `reward_unavailable` holds are re-settled immediately (without ever
recursing on the settlement's own writes); the referrer-visit case is settled
transactionally by the settlement stamp-ordering hook, and the freed-card /
daily-reset cases by the scheduled drain that keeps those holds retry-eligible.

Finally the customer bonus-bank surface reads the **explicit** referral state
(banked, awarded-today, held-with-reason) instead of inferring it from timestamps,
so "saved and will be added automatically" is shown from the real hold, not a guess.

## 2. Blast Radius

In scope (may be edited):

- A new migration `supabase/migrations/20260710190000_referral_retry_outbox.sql`:
  - register the three new member notification types
    (`referral_friend_joined`, `referral_qualified`, `referral_bonus_saved`) in
    `notification_event_category` + the `notification_events` CHECK;
  - an `AFTER INSERT` trigger on `referrals` emitting `referral_attributed`
    (product event) + the friend-joined notification;
  - re-create `qualify_referral_on_stamp` (add the referral-qualified notification)
    and `hold_referral_bonus` (add the bonus-saved notification + a
    `referral_bonus_failed` product event on the error reason), each deduped;
  - an event-driven retry trigger `AFTER INSERT OR UPDATE ON reward_pool_items`
    (activation → settle `reward_unavailable` holds for the venue), guarded against
    recursion with `pg_trigger_depth()` and wrapped fail-safe.
- `lib/notifications/catalog.ts` — the three new transactional types + British copy.
- `lib/customer/referral-bonus-bank.ts` / `referral-bonus-bank-copy.ts` /
  `components/customer/referral-bonus-bank-panels.tsx` — read/show the explicit
  state (held-with-reason).
- `tests/db/referral-retry-outbox.test.mjs`.

Out of scope (explicitly not touched):

- `settle_referral_bonus` control flow, the drain, and the cron — owned by
  [`MS-referral-settlement`](settlement.md); this spec only adds the notification
  enqueue inside the hold writer and the retry triggers that call the existing
  per-referrer drain.
- Redemption / reward-pool RPCs themselves — the retry is a trigger reacting to
  their table effects, so those RPCs are unchanged.
- Support/ops visibility, code rotation, and fraud monitoring — later specs.

## 3. Strict Constraints and Assumptions

- **Transactional outbox.** All events and notifications are written in the same
  transaction as the transition that produced them (`product_events` for analytics,
  `enqueue_notification_event` for member messages), so nothing is lost on crash and
  a reader drains them asynchronously.
- **Dedup by referral id + event type.** Notifications use a dedupe key of
  `referral:<edge id>:<event>` (the enqueue helper is already idempotent on the
  key), so a repeated transition never double-notifies.
- **No friend PII.** The friend-joined / qualified notifications carry the venue and
  a link to the referrer's card, never the friend's identity, matching the awarded
  notification.
- **Recursion-safe trigger.** The reward-pool retry trigger fires only at
  `pg_trigger_depth() < 1`, so any settlement write cannot re-enter it; its body is
  wrapped `begin … exception when others then raise warning … end` so a retry
  failure never blocks the reward edit that triggered it. The `AFTER INSERT`
  attributed-outbox trigger is likewise wrapped so it never blocks the friend's
  enrolment.
- **Cheap in the common case.** Each trigger guards on a fast `EXISTS` over the
  referrer's / venue's non-terminal referrals before doing any settlement work, so
  memberships and reward pools with no owed bonuses pay only an indexed lookup.
- **Catalog parity.** Every new SQL notification type is mirrored in
  `lib/notifications/catalog.ts` (`notificationEventTypes`, category, and payload
  copy), which the delivery worker relies on; the exhaustive `PAYLOAD_COPY` record
  makes a missing type a type error.

## 4. Decisions Already Made

- **Notification types:** `referral_friend_joined`, `referral_qualified`,
  `referral_bonus_saved` are all **transactional** (they need a push subscription,
  not marketing consent).
- **`referral_bonus_failed` is analytics-only** (a `product_events` row), not a
  member notification — a transient processing error is not something to message a
  member about; it surfaces to operations.
- **Retry via a reward-pool trigger, not RPC edits.** A reward-pool activation is
  the observable effect of "merchant replenished rewards"; reacting to it with a
  trigger keeps the reward RPCs untouched. The referrer-visit case is already
  handled transactionally by the settlement stamp-ordering hook, and the freed-card
  / daily-reset cases by the scheduled drain — so no trigger is placed on the hot
  `customer_memberships` path (that would also fight the existing drain tests).
- **Bonus-bank reads explicit state** but the surface stays the existing card /
  home panels; no new screens.

## 5. Behavioral Requirements (EARS)

- **RO-1 (attributed outbox):** WHEN a referral edge is created, THE system SHALL
  write one `referral_attributed` product event and enqueue one
  `referral_friend_joined` notification to the referrer, deduped per edge.
- **RO-2 (qualified notification):** WHEN a referral qualifies, THE system SHALL
  enqueue one `referral_qualified` notification to the referrer, deduped per edge.
- **RO-3 (held notification):** WHEN a qualified bonus is held, THE system SHALL
  enqueue one `referral_bonus_saved` notification to the referrer, deduped per edge.
- **RO-4 (awarded unchanged):** THE awarded milestone SHALL keep emitting
  `referral_bonus_awarded` (product event) and `referral_bonus_stamp_issued`
  (notification), deduped per edge.
- **RO-5 (failed outbox):** IF settlement hits an unexpected error, THEN THE system
  SHALL write one `referral_bonus_failed` product event, distinct from the held
  event.
- **RO-6 (dedup):** THE system SHALL deduplicate every referral notification by
  referral id and event type so a member is notified at most once per milestone.
- **RO-7 (retry on referrer visit):** WHEN a referrer makes a new venue visit, THE
  system SHALL settle their owed bonuses before applying their stamp (delivered by
  the settlement stamp-ordering hook, [`MS-referral-settlement`](settlement.md)).
- **RO-8 (retry backstop):** WHILE a bonus is held for a transient reason
  (`card_full` / `reward_unavailable`), THE scheduled drain SHALL keep it
  retry-eligible so a freed card or a later visit settles it without manual action.
- **RO-9 (retry on replenish):** WHEN a merchant activates or replenishes a
  reward-pool item, THE system SHALL attempt to settle `reward_unavailable` holds
  for that venue.
- **RO-10 (no recursion):** THE reward-pool retry trigger SHALL NOT re-enter on the
  settlement's own writes, and a retry failure SHALL NOT block the reward edit that
  triggered it.
- **RO-11 (explicit bonus-bank state):** THE customer bonus-bank read path SHALL
  reflect the explicit referral `status`/`hold_reason` (banked / awarded-today /
  held-with-reason) rather than inferring solely from timestamps.

## 6. Verification Criteria and Task Breakdown

Observable behaviours to verify (DB tier is primary; live Postgres, rolled-back
transactions):

- Creating an edge writes one `referral_attributed` event + one
  `referral_friend_joined` notification; a second identical trigger does not
  double-notify (RO-1/RO-6).
- Qualifying enqueues one `referral_qualified`; holding enqueues one
  `referral_bonus_saved`; awarding still enqueues `referral_bonus_stamp_issued`;
  each deduped per edge (RO-2/RO-3/RO-4/RO-6).
- A temporary_processing_error records a `referral_bonus_failed` product event
  distinct from `referral_bonus_held` (RO-5).
- A held `reward_unavailable` bonus settles when the venue's reward pool is
  re-activated, with no infinite recursion and no error surfaced to the reward edit
  (RO-9/RO-10); a held `card_full` bonus settles on the referrer's next visit via
  the settlement stamp-ordering hook (RO-7) and remains drain-eligible otherwise
  (RO-8).
- The bonus-bank read path returns the held state/reason for a held edge (RO-11).

Browser tier (mobile-safari, secondary): the referral bonus bank still renders
(`tests/e2e/customer-referral-bonus-stamp.spec.ts`).

Source scan (`pnpm test`): the notification catalog lists the three new
transactional types with copy; notifications carry no friend PII.

Task breakdown (test-first per `Instructions_tdd.md`):

1. Migration: notification registration; attributed trigger; qualify/hold
   notification enqueues + failed event; reward-pool retry trigger with a recursion
   guard.
2. `lib/notifications/catalog.ts` types + copy.
3. Bonus-bank lib/copy/panel: explicit held-with-reason state.
4. DB tests red → green across RO-1…RO-11.

Prove the work with `governance:run-gates --spec MS-referral-retry-outbox --record`
and advance the lifecycle with `governance:advance`.
