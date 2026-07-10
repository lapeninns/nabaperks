---
spec_id: MS-referral-state-machine
status: active
risk_class: rls-rpc-ledger
owner: amankumarshrestha
last_reviewed: 2026-07-10
allowed_blast_radius:
  - micro-specs/referral/**
  - supabase/migrations/20260710170000_referral_state_machine.sql
  - tests/db/referral-state-machine.test.mjs
implementation_surfaces:
  - supabase/migrations/20260710170000_referral_state_machine.sql
  - tests/db/referral-state-machine.test.mjs
related_docs:
  - micro-specs/GLOBAL_CONTEXT.md
  - micro-specs/referral/attribution.md
  - micro-specs/referral/bonus-stamp.md
  - micro-specs/customer/card-stamp.md
related_tests:
  - tests/db/referral-state-machine.test.mjs
  - tests/e2e/customer-referral-attribution.spec.ts
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:coverage
  - pnpm test:db
  - pnpm test:e2e -- --grep "referral attribution" --project=mobile-safari
required_playwright_projects:
  - mobile-safari
evidence_required:
  - Live-DB output proving a new referral edge is created `status='attributed'` with `venue_id`, `referrer_customer_id`, and `referred_customer_id` denormalised from the memberships, and that a friend's enrolment plus first-stamp outcome is byte-for-byte unchanged from v1 (the state machine is additive).
  - Live-DB output proving the referred membership's FIRST non-bonus `earned` stamp transitions its edge `attributed → qualified` with `qualified_at` and `qualifying_stamp_id` set, while a referral-bonus stamp, a second stamp, and an already-qualified/awarded/terminal edge cause no transition (qualification is one-way and idempotent).
  - Live-DB output proving the `UNIQUE (venue_id, referred_customer_id)` constraint holds (a recreated membership cannot gain a second referrer) and that the backfill maps every pre-existing edge's `status` from its v1 timestamps (`awarded` / `qualified` / `attributed`) with the v1 read columns preserved.
  - Playwright (mobile-safari) output proving the referral attribution journey still completes end-to-end after the schema change (secondary journey proof; DB tier is primary).
approved_exceptions: []
---

# MS-referral-state-machine — Referral v2 state machine and qualification decoupled from attribution

## 1. Exact Goal and User-Visible Outcomes

The referral engine gains an **explicit, auditable state machine** in place of v1's
two-timestamp inference. Every `referrals` edge now carries a `status`
(`attributed → qualified → settling → awarded | held`, plus the terminal
`rejected / cancelled / expired`), the denormalised identities it needs to be
settled and audited (`venue_id`, `referrer_customer_id`, `referred_customer_id`),
the qualification facts (`qualified_at`, `qualifying_stamp_id`), and the durable
hold/retry columns (`hold_reason`, `held_at`, `next_retry_at`, `retry_count`,
`last_error`) that later specs write.

The load-bearing product change is that **joining and qualifying become separate
events**. Creating a membership via a `?ref` link records an `attributed` edge and
nothing more. The edge only becomes `qualified` when the referred friend earns
their **first genuine venue-QR `earned` stamp** — the geofenced scan that proves a
real visit. In this app that scan can be the one taken at join (per the confirmed
product decision "join scan counts"), but membership creation alone, a referral
**bonus** stamp, and any future imported/manual stamp never qualify a referral.

This spec is **additive and backward-compatible**: enrolment, stamping, the
existing v1 referrer bonus, and every current read path behave exactly as before.
It lays the schema and the qualification transition that
[`MS-referral-settlement`](settlement.md) builds `settle_referral_bonus()` on. No
customer- or merchant-visible screen changes here.

## 2. Blast Radius

In scope (may be edited):

- A new migration
  `supabase/migrations/20260710170000_referral_state_machine.sql`:
  - additive columns on `public.referrals` (`status`, `venue_id`,
    `referrer_customer_id`, `referred_customer_id`, `qualified_at`,
    `qualifying_stamp_id`, `hold_reason`, `held_at`, `next_retry_at`,
    `retry_count`, `last_error`, `updated_at`) with `CHECK` allow-lists for
    `status` and `hold_reason`;
  - a `BEFORE INSERT` trigger that denormalises `venue_id` / customer ids from the
    referrer and referred memberships so the v1 join-wrapper `INSERT` is untouched;
  - a backfill that derives `status`, `qualified_at`, and the denormalised ids for
    every existing edge from its v1 timestamps;
  - a `UNIQUE (venue_id, referred_customer_id)` index (kept alongside the existing
    `UNIQUE (referred_membership_id)`);
  - an `updated_at` maintenance trigger;
  - a `SECURITY DEFINER`, service-role-only
    `qualify_referral_on_stamp(p_membership_id, p_stamp_event_id)` that performs the
    one-way `attributed → qualified` transition and emits `referral_qualified`;
  - a `create or replace` of the v1 `award_referrer_bonus_stamp` that **prepends**
    the qualification call and **writes `status='awarded'`** when it pays, keeping
    every other line of the v1 body identical.
- `tests/db/referral-state-machine.test.mjs` — the DB behavioural tier.

Out of scope (explicitly not touched):

- The settlement rewrite (`settle_referral_bonus()`), durable holds, the scheduled
  `drain_due_referral_bonuses()`, and `vercel.json` — owned by
  [`MS-referral-settlement`](settlement.md).
- Event-driven retries, the full five-event transactional outbox and member
  notification copy, and the bonus-bank UI — owned by
  [`MS-referral-retry-outbox`](retry-outbox.md).
- The `?ref` capture / attribution write path in the join wrapper
  (`MS-referral-attribution`) — this spec only adds columns the insert defaults or
  the trigger fills; it does not change how or when an edge is created.
- The friend's own stamp mechanic (one-per-UK-day, geofence, billing) and the v1
  bonus amount/velocity/full-card behaviour — unchanged; only the `status` write
  and the qualification prepend are added to `award_referrer_bonus_stamp`.

## 3. Strict Constraints and Assumptions

- **Additive, idempotent DDL.** All new columns use `add column if not exists`;
  triggers, functions, and the unique index are dropped/replaced or guarded so the
  migration is safe to re-apply and to replay on a disposable database.
- **Reuse the v1 bonus columns as the v2 award fields.** `bonus_awarded_at` and
  `bonus_stamp_id` from the architecture map onto the existing
  `referrer_bonus_awarded_at` and `referrer_stamp_event_id`; `referrer_bonus_due_at`
  is retained. No column is renamed, so every v1 read path keeps working.
- **Server-authoritative.** Qualification and status writes happen only inside
  `SECURITY DEFINER` RPCs; `qualify_referral_on_stamp` is granted to `service_role`
  only. The browser never mutates `referrals`.
- **Qualifying-stamp definition.** A stamp qualifies iff
  `event_type='earned' AND coalesce(metadata->>'source','') <> 'referral_bonus'`
  and it is the referred membership's first such stamp. `qualify_referral_on_stamp`
  resolves the qualifying stamp from the ledger (the referred membership's earliest
  non-bonus earned stamp), so it is correct whether called from the stamp hook or a
  later drain, and never records a bonus stamp as the qualifier.
- **Status is a superset now, written incrementally.** The `status` `CHECK` admits
  all eight values, but this spec only ever writes `attributed` (default),
  `qualified`, and `awarded`. `settling / held / rejected / cancelled / expired` are
  reserved for later specs; admitting them now avoids a second `CHECK` churn.
- **Backward compatibility is a hard gate.** A DB test asserts that enrolment and a
  first stamp with no referral edge, and the full v1 bonus award with an edge,
  produce byte-for-byte the same membership counters, stamp rows, reward rows, and
  returned flags as before this spec.
- **Uniqueness caveat (prod).** `UNIQUE (venue_id, referred_customer_id)` is created
  after the backfill; if historical prod data ever held two edges for one
  (venue, customer) the index build would fail and must be de-duplicated first. The
  local seed has zero referral rows, so the gate proves the constraint on fresh data.

## 4. Decisions Already Made

- **`venue_id = merchant_id`.** Memberships and attribution are merchant-scoped in
  this model; there is no separate venue entity.
- **Qualification lives inside `award_referrer_bonus_stamp` (prepended), not in the
  giant `issue_self_service_stamp` overload.** `award_referrer_bonus_stamp` is
  already the single referral hook the stamp path and the drain both call, and it
  already gates on "friend has ≥1 earned stamp"; prepending the transition there
  qualifies exactly when a real visit exists and leaves the ~90-line QR-gated stamp
  overload untouched. This isolates all v2 churn to the referral functions.
- **Qualification is one-way and idempotent.** `attributed → qualified` only; an
  already-qualified, awarded, or terminal edge is never regressed or re-qualified.
- **`referral_qualified` is emitted to `product_events` here**; the member-facing
  "Your referral qualified" notification and per-event outbox dedupe are deferred to
  [`MS-referral-retry-outbox`](retry-outbox.md).
- **Backfill mapping:** `referrer_bonus_awarded_at IS NOT NULL → awarded`; else
  `referrer_bonus_due_at IS NOT NULL → qualified` (friend visited, bonus owed);
  else `attributed`. `qualified_at` backfills from `referrer_bonus_due_at`.
- The v1 daily velocity cap, full-card hold-as-`due`, and reward-selection logic in
  `award_referrer_bonus_stamp` are preserved verbatim; only a `status='awarded'`
  write and the qualification prepend are added.

## 5. Behavioral Requirements (EARS)

- **SM-1 (explicit status):** THE `referrals` table SHALL carry a `status` column
  constrained to `{attributed, qualified, settling, held, awarded, rejected,
  cancelled, expired}`, defaulting to `attributed` for a newly created edge.
- **SM-2 (denormalised identity):** THE system SHALL record `venue_id`,
  `referrer_customer_id`, and `referred_customer_id` on every referral edge,
  derived from the referrer and referred memberships.
- **SM-3 (uniqueness survives recreation):** THE system SHALL permit at most one
  referral per `(venue_id, referred_customer_id)`, so a deleted-and-recreated
  membership cannot acquire a second referrer.
- **SM-4 (attribution is not qualification):** WHEN a referral edge is created at
  join, THE system SHALL set its status to `attributed` and SHALL NOT mark it
  qualified.
- **SM-5 (qualify on first verified visit):** WHEN a referred membership earns its
  first non-bonus `earned` stamp, THE system SHALL transition its `attributed` edge
  to `qualified`, recording `qualified_at` and the `qualifying_stamp_id`.
- **SM-6 (non-qualifying events):** THE system SHALL NOT qualify a referral from
  membership creation alone, from a referral-bonus stamp, or from any stamp whose
  `metadata.source` marks it imported or manually adjusted.
- **SM-7 (one-way, idempotent):** THE system SHALL transition an edge to `qualified`
  at most once and SHALL NOT regress or re-qualify an already `qualified`,
  `awarded`, or terminal edge.
- **SM-8 (durable hold/retry columns):** THE `referrals` table SHALL carry
  `hold_reason` (constrained to `{referrer_membership_inactive, card_full,
  daily_bonus_limit, reward_unavailable, temporary_processing_error}`), `held_at`,
  `next_retry_at`, `retry_count` (default 0), and `last_error`, so a later held
  bonus is never silently unresolved.
- **SM-9 (backfill parity):** THE migration SHALL backfill every existing edge's
  `status` from its v1 timestamps (`awarded`, else `qualified`, else `attributed`),
  populate the denormalised ids and `qualified_at`, and preserve every v1 read
  column.
- **SM-10 (additive / back-compat):** THE enrolment outcome, the friend's stamp
  outcome, and the existing v1 referrer bonus award SHALL be unchanged by this
  spec; the state machine SHALL be purely additive.
- **SM-11 (updated_at):** THE system SHALL maintain an `updated_at` timestamp on
  every referral row, advanced whenever the row changes.
- **SM-12 (qualification analytics):** WHEN a referral transitions to `qualified`,
  THE system SHALL record exactly one `referral_qualified` product event carrying
  the edge id and the qualifying stamp id.

## 6. Verification Criteria and Task Breakdown

Observable behaviours to verify (DB tier is primary; live Postgres, rolled-back
transactions):

- A new `?ref` enrolment writes one edge with `status='attributed'`, correct
  `venue_id` / `referrer_customer_id` / `referred_customer_id`, and leaves the
  friend's membership counters and returned flags identical to a no-ref enrolment
  (SM-1/SM-2/SM-4/SM-10).
- The referred friend's first non-bonus earned stamp flips the edge to `qualified`
  with `qualified_at` and `qualifying_stamp_id` set to that stamp; a second stamp,
  a referral-bonus stamp, and an already-awarded edge cause no transition
  (SM-5/SM-6/SM-7).
- Inserting a second edge for the same `(venue_id, referred_customer_id)` is
  rejected by the unique constraint (SM-3).
- Backfill: seeded edges with only v1 timestamps resolve to the correct `status`
  and denormalised ids after the migration, and the v1 bonus columns still read
  (SM-9).
- The full v1 award path still issues exactly one bonus, unlocks the reward on a
  completing card, respects the daily cap and full-card hold, and now also sets
  `status='awarded'` (SM-10) — asserted against the existing bonus behaviour.
- Exactly one `referral_qualified` product event per qualifying transition (SM-12).

Browser tier (mobile-safari, secondary journey proof): the existing referral
attribution journey still completes after the schema change
(`tests/e2e/customer-referral-attribution.spec.ts`).

Source scan (`pnpm test`): qualification and status writes occur only in the
definer RPCs; `qualify_referral_on_stamp` is service-role-only; no client write to
`referrals`.

Task breakdown (implement one at a time, test-first per `Instructions_tdd.md`):

1. Migration: additive columns + `CHECK`s; denormalise `BEFORE INSERT` trigger;
   backfill; `UNIQUE (venue_id, referred_customer_id)`; `updated_at` trigger;
   `qualify_referral_on_stamp`; `award_referrer_bonus_stamp` re-create (qualify
   prepend + `status='awarded'` write, v1 body otherwise verbatim).
2. DB tests red → green across SM-1…SM-12 (attribution status, qualification
   transition + all non-qualifying/idempotent cases, uniqueness, backfill,
   back-compat award, `referral_qualified`).

Prove the work with `governance:run-gates --spec MS-referral-state-machine --record`
and advance the lifecycle with `governance:advance`.
