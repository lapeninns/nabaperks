---
spec_id: MS-customer-quiet-day-bonus-stamp
status: draft
risk_class: rls-rpc-ledger
owner: codex
last_reviewed: 2026-07-01
allowed_blast_radius:
  - micro-specs/customer/quiet-day-bonus-stamp.md
  - app/api/**
  - app/home/**
  - app/q/**
  - lib/customer/**
  - lib/merchant/**
  - supabase/migrations/20260606142000_initial_schema_rls.sql
  - supabase/migrations/20260606190000_mystery_visit_rewards.sql
  - supabase/migrations/**
  - tests/db/**
  - tests/e2e/**
  - tests/micro-specs/customer-quiet-day-bonus-stamp.test.mjs
  - tests/unit/**
implementation_surfaces:
  - supabase/migrations/20260606142000_initial_schema_rls.sql
  - supabase/migrations/20260606190000_mystery_visit_rewards.sql
  - supabase/migrations/**
  - lib/customer/**
  - lib/merchant/**
  - tests/db/quiet-day-bonus-stamp.test.mjs
  - tests/micro-specs/customer-quiet-day-bonus-stamp.test.mjs
related_docs:
  - AGENTS.md
  - micro-specs/README.md
  - micro-specs/GLOBAL_CONTEXT.md
  - micro-specs/customer/card-stamp.md
  - micro-specs/merchant/venue-announcements-ui.md
related_tests:
  - tests/db/quiet-day-bonus-stamp.test.mjs
  - tests/micro-specs/customer-quiet-day-bonus-stamp.test.mjs
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:coverage
  - pnpm test:db
  - pnpm test:e2e
required_playwright_projects:
  - chromium
  - mobile-safari
evidence_required:
  - DB output proving the chosen mechanic cannot double-award the same member, location, and UK business date.
  - DB output proving RLS/RPC ownership, staff approval, and ledger totals remain consistent.
  - Micro-Spec output proving the existing unique index and event_type CHECK are respected or migrated through a companion migrations spec.
  - Playwright output proving the customer and merchant surfaces explain the bonus without fabricating per-site membership counts.
approved_exceptions: []
---

# MS-customer-quiet-day-bonus-stamp

## Intent

Reward customers with a controlled bonus stamp for quiet-day campaigns without
weakening the loyalty ledger, the one-earned-stamp-per-day guard, or merchant
ownership rules.

This spec is author-only and must remain `draft` until a dedicated DB harness
and implementation plan are approved. Activating it before the harness exists
would make `governance:run-gates` fail by design.

## Scope

In scope:

- A future quiet-day bonus-stamp mechanic tied to merchant-owned memberships,
  merchant locations, and Europe/London business dates.
- Ledger-safe duplicate prevention for the same `membership_id`, `location_id`,
  and business date.
- Staff or system approval metadata sufficient for audit.
- Customer and merchant copy that describes a bonus stamp without implying a
  reward has been redeemed.

Out of scope while this spec is draft:

- Any migration, RPC, route, server action, customer UI, merchant UI, cron, or
  announcement backend change.
- Cross-location membership splitting. Membership and repeat-customer counts
  stay merchant-wide unless a later spec changes the data model.
- Bonus stamps that bypass RLS, staff approval, audit metadata, or existing
  fraud guards.

## Verified Constraints

- `stamp_events.event_type` currently allows only `earned`, `reversed`, and
  `manual_adjustment` in
  `supabase/migrations/20260606142000_initial_schema_rls.sql`.
- `stamp_events_one_earned_per_business_day_idx` is unique on
  `(membership_id, location_id, earned_business_date)` where
  `event_type = 'earned'` and `earned_business_date is not null` in
  `supabase/migrations/20260606190000_mystery_visit_rewards.sql`.
- The existing unique index protects normal earned visits only. Any bonus
  implementation must explicitly decide whether it should share that guard or
  use a separate bonus guard.
- Ledger totals derive from stamp events and membership counters. A bonus path
  must update both atomically through RPC or remain out of scope.

## Mechanic Options

### Option A: `manual_adjustment` Bonus Rows

Use `event_type = 'manual_adjustment'` with positive `stamps_delta`, structured
metadata such as `{ "reason": "quiet_day_bonus", "campaign_id": "..." }`, and a
new partial unique index for quiet-day bonuses.

Benefits:

- No `event_type` CHECK expansion.
- Can stay within the current stamp event vocabulary.
- Lower migration risk if the only schema addition is a bonus-specific unique
  index.

Costs:

- Reporting must distinguish campaign bonuses from staff corrections by
  metadata.
- The existing `earned` business-date index does not protect this option.
- Copy and analytics must avoid treating these rows as ordinary visits.

### Option B: New `bonus` Event Type

Add `event_type = 'bonus'` and create a dedicated RPC plus partial unique index
for quiet-day bonus stamps.

Benefits:

- Clear ledger semantics and easier reporting.
- Bonus rows can have first-class tests, analytics, and copy.
- The fraud guard can be expressed directly as
  `(membership_id, location_id, earned_business_date, campaign_id)` or the
  approved equivalent.

Costs:

- Requires a migrations-class companion spec before activation.
- Requires updating the `stamp_events.event_type` CHECK, any event-type parsers,
  dashboard/activity labels, DB tests, and customer history copy.
- Higher rollout risk because existing code may assume the three current event
  types.

## Decisions Needed Before Activation

- Pick Option A or Option B.
- Define whether one bonus is allowed per campaign day, per campaign, or per
  customer visit.
- Define who can approve the bonus: staff scan, merchant action, announcement
  campaign trigger, or future cron.
- Define how the mechanic interacts with the existing normal earned-stamp
  limit on the same business day.
- Define whether bonus stamps can unlock rewards immediately or only after the
  next normal visit.

## EARS Requirements

- **QB-1 (draft guard):** THE spec SHALL remain `draft` until DB, source, and
  browser harnesses exist.
- **QB-2 (no duplicate bonus):** WHEN the selected bonus mechanic is executed
  twice for the same member, location, and approved business-date scope, THE
  database SHALL record at most one bonus award.
- **QB-3 (ledger atomicity):** WHEN a bonus stamp is awarded, THE stamp event
  and membership counters SHALL update atomically or not at all.
- **QB-4 (ownership):** THE bonus-award path SHALL reject cross-merchant,
  cross-customer, and cross-location attempts under RLS/RPC checks.
- **QB-5 (audit):** THE stamp event SHALL retain enough metadata to identify
  the quiet-day campaign, actor, and reason.
- **QB-6 (event vocabulary):** IF the implementation uses `manual_adjustment`,
  THEN THE system SHALL not require an `event_type` CHECK migration. IF it uses
  `bonus`, THEN THE work SHALL split into a migrations-class companion spec.
- **QB-7 (customer copy):** THE customer history SHALL label the bonus as a
  bonus or adjustment and SHALL NOT present it as a normal visit.

## Verification

Required future checks:

- DB test proving duplicate bonus attempts cannot double-award the approved
  member/location/business-date scope.
- DB test proving membership counters and `stamp_events` rows stay consistent
  after success, duplicate, reversal, and unauthorized attempts.
- Micro-Spec source test proving the selected option respects the existing
  unique index and event-type CHECK, or that a migrations companion spec owns
  the CHECK expansion.
- Playwright harness proving the chosen customer and merchant copy is visible
  and does not imply per-site membership counts.

This draft has no implementation gates to run beyond `pnpm governance:check`.
