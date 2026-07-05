---
spec_id: MS-customer-card-stamp
status: implemented
risk_class: rls-rpc-ledger
owner: claude-code agent (amanshresthaa)
last_reviewed: 2026-06-30
allowed_blast_radius:
  - app/card/**
  - lib/customer/**
  - micro-specs/customer/**
  - supabase/migrations/20260619120000_cycle_stamp_soft_geofence.sql
  - supabase/migrations/20260606190000_mystery_visit_rewards.sql
  - tests/e2e/customer-card-stamp*.spec.ts
implementation_surfaces:
  - app/card/[membershipId]/page.tsx
  - app/card/[membershipId]/stamp/page.tsx
  - app/card/[membershipId]/actions.ts
  - supabase/migrations/20260619120000_cycle_stamp_soft_geofence.sql
  - supabase/migrations/20260606190000_mystery_visit_rewards.sql
related_docs:
  - micro-specs/GLOBAL_CONTEXT.md
  - micro-specs/customer/join.md
related_tests:
  - tests/db/customer-card-stamp.test.mjs
  - tests/db/architecture-moat.test.mjs
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:e2e
required_playwright_projects:
  - chromium
  - mobile-safari
evidence_required:
  - Command output for the declared verification gates and related tests.
approved_exceptions: []
---

# MS-customer-card-stamp — Self-service stamp: one per UK business day, soft geofence

## Intent

A member opens their card at `/card/[membershipId]` and adds a stamp from the
`/stamp` page. The system issues **at most one stamp per UK business day** per
membership+location, advances the cycle, and unlocks a reward when the card is
full. A coarse geofence check runs on the third stamp of a cycle but is
**advisory only**: an out-of-range stamp still succeeds and merely records a
fraud flag for the merchant to review. This is the core ledger invariant of the
product and must be proven against real Postgres, not mocks.

## Scope (in)

- The card + stamp pages (`/card/[membershipId]`, `/card/[membershipId]/stamp`)
  and `selfStampAction`.
- The `issue_self_service_stamp` RPC (newest def:
  `20260619120000_cycle_stamp_soft_geofence.sql`): the one-per-UK-day rule, cycle
  advance, reward unlock, and the non-blocking soft geofence + `fraud_flags`
  write.
- The Europe/London business-date boundary (`uk_business_date`).

## Scope (out)

- Enrolment / first stamp (owned by [MS-customer-join]); reward redemption
  (owned by [MS-customer-redeem]).
- **There is no undo/void/reverse-stamp capability** — stamp events are
  immutable; no such RPC, action, or table delete exists, and none is to be
  added here. (The plan's inferred `undo_recent_stamp` does not exist.)
- Geofence radius tuning, fraud triage UI, RLS policy text — out of scope.

## Decisions already made

- The UK business date is `(now() at time zone 'Europe/London')::date`
  (`uk_business_date`). The single-stamp-per-day rule is enforced both by an
  explicit `raise exception 'Stamp already issued for this UK business day'`
  inside the RPC and by a partial unique index
  `stamp_events_one_earned_per_business_day_idx (membership_id, location_id,
  earned_business_date) where event_type='earned'`.
- The soft geofence triggers on the configurable Nth cycle stamp (default 3) and
  only when the location has `require_geofence = true`. Effective radius =
  `configured_radius + min(accuracy, 200) + 15` metres. Out-of-range writes a
  `fraud_flags` row with `signal = 'self_service_geofence_out_of_range'`,
  `severity = 'medium'`, and `geo_flagged = true` is returned — the stamp is
  still inserted.
- `issue_self_service_stamp` takes `p_membership_id`, `p_customer_id`, optional
  `p_latitude`/`p_longitude`/`p_accuracy_meters`/`p_location_status`/
  `p_capture_elapsed_ms` and returns `stamp_event_id`, `new_stamp_count`,
  `reward_unlocked`, `geo_flagged`.

## EARS requirements

- **CS-1 (one per UK day — invariant):** THE system SHALL issue at most one
  earned stamp per membership per location per UK business day.
- **CS-2 (second stamp rejected):** IF a stamp has already been issued for the
  membership+location on the current UK business day, THEN a further
  self-service stamp SHALL be rejected and no second `stamp_events` row SHALL be
  written.
- **CS-3 (day boundary):** WHEN the UK business date rolls over (Europe/London),
  THE system SHALL again permit one stamp for that membership+location.
- **CS-4 (cycle advance + unlock):** WHEN a stamp completes a card
  (`stamps_required` reached), THE system SHALL unlock a reward
  (`reward_unlocked = true`) and start a new cycle.
- **CS-5 (geofence non-blocking):** WHILE a location requires geofencing, IF the
  triggering cycle stamp is reported out of the effective radius, THEN THE system
  SHALL still issue the stamp AND record exactly one `fraud_flags` row
  (`self_service_geofence_out_of_range`) and return `geo_flagged = true`.
- **CS-6 (in-range no flag):** WHEN a geofenced stamp is within the effective
  radius, THE system SHALL NOT write a fraud flag and SHALL return
  `geo_flagged = false`.
- **CS-7 (no undo):** THE system SHALL expose no way to remove or reverse an
  issued stamp; an issued stamp is immutable.
- **CS-8 (tenant safety):** THE stamp action SHALL only ever mutate the
  membership it is invoked for and its merchant's ledger.

## Verification method

Live-Supabase tier (mocks cannot enforce these): seed a membership, call the
stamp path once and assert one `stamp_events (earned)` row + the returned count;
call again the same day and assert rejection with **no** second row (CS-2);
`pnpm db:reset:today-stamps` then assert a fresh stamp is allowed (CS-3); drive a
membership to its third geofenced cycle stamp out of range and assert the stamp
row exists AND one matching `fraud_flags` row exists (CS-5), and in range that no
flag is written (CS-6). DB-free harness tier proves the card/stamp UI renders.

## Gates

`pnpm lint` · `pnpm typecheck` · `pnpm build` · `pnpm test` · `pnpm test:e2e` ·
`pnpm test:db` (live-DB invariant tier).

## Verification log — 2026-06-30

Live-DB tier green via `pnpm test:db` against local Supabase (Postgres 17.6,
schema brought current with all 55 migrations applied):

- **CS-1/CS-2** proven by `tests/db/customer-card-stamp.test.mjs`: the real
  `issue_self_service_stamp` RPC issues one stamp, the second same-day call
  raises `Stamp already issued for this UK business day`, and exactly one earned
  `stamp_events` row exists for the Europe/London business date. Runs inside a
  rolled-back transaction with the service-role request context the app uses
  (`is_service_role_request()` bypass), so the seed is never mutated.
- **CS-1 atomicity** is additionally covered by the concurrency race in
  `tests/db/architecture-moat.test.mjs` ("two QR stamp attempts race for one
  membership → only one stamp"), and **fail-closed billing** by its
  "requires billing + no billing row → stamp fails closed inside the RPC".
- **CS-7 (no undo)** verified by source reconciliation: no void/undo/reverse
  stamp RPC, action, or table-delete exists anywhere in `supabase/migrations`,
  `app/`, or `lib/` (the plan's inferred `undo_recent_stamp` does not exist).

Verdict: **READY** for CS-1/CS-2/CS-7. CS-3 (true day-rollover) is asserted via
the per-`earned_business_date` index semantics; CS-5/CS-6 (geofence flag) are
authored and pending a dedicated live test. The repo-wide `pnpm typecheck`/
`build` reds are the pre-existing analytics-audit batch, outside this spec.
