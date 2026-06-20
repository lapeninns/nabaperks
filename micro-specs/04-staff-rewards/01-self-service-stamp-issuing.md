---
spec_id: MS-STAFF-REWARDS-SELF-SERVICE-STAMP-ISSUING
status: active
risk_class: rls-rpc-ledger
owner: factory-droid
last_reviewed: 2026-06-15
allowed_blast_radius:
  - app/card/**
  - app/q/**
  - lib/customer/returning-qr-redirect.ts
  - lib/customer/stamp.ts
  - micro-specs/04-staff-rewards/01-self-service-stamp-issuing.md
  - micro-specs/TRACEABILITY.md
  - micro-specs/traceability.json
  - supabase/migrations/**
  - supabase/tests/**
implementation_surfaces:
  - app/q/**
  - app/card/**
  - lib/customer/stamp.ts
  - lib/customer/returning-qr-redirect.ts
  - supabase/migrations/**
  - supabase/tests/**
related_docs:
  - docs/PROJECT_SPEC.md
  - docs/ARCHITECTURE.md
  - micro-specs/GLOBAL_CONTEXT.md
related_tests:
  - tests/micro-specs/self-service-stamping.test.ts
  - tests/micro-specs/returning-qr-redirect.test.ts
  - tests/micro-specs/customer-stamp-loader.test.ts
  - supabase/tests/reward_redemption_cycles.sql
verification_gates:
  - pnpm governance
  - pnpm lint
  - pnpm typecheck
  - pnpm test
  - pnpm db:verify
  - pnpm security:verify
approved_exceptions: []
---

# Micro-Spec: Self-Service Stamp Issuing

## Governance Status Evidence

- Lifecycle status: `active` after review against `docs/PROJECT_SPEC.md`, `docs/ARCHITECTURE.md`, and related tests on 2026-06-15.
- Stale/superseded handling: this spec remains current intent; no replacement spec is linked.
- Evidence posture: related tests and verification gates are listed in metadata and traceability for implementation handoff.

## Exact Goal and User-Visible Outcomes

A customer can scan the permanent venue QR, tap once to add today's stamp, and
see the updated card immediately. The final stamp atomically reveals one
assigned mystery reward.

## Blast Radius

In scope:

- `/q/[qr_id]` existing-member routing.
- `/card/[membership_id]/stamp`
- `issue_self_service_stamp`
- Optional soft geofence fraud flags.
- `stamp_events`, `customer_memberships`, `reward_events`, `fraud_flags`,
  `audit_logs`, and `product_events`.

Out of scope:

- POS transaction verification.
- Hard location blocking.
- Native mobile app installation.
- Manual undo flow.

## Strict Constraints and Assumptions

- The server validates active QR/card, billing access, rate limits, UK business
  date, and customer membership ownership.
- A customer cannot receive more than one earned stamp per
  membership/location/UK date.
- A final stamp cannot be issued unless at least 3 active reward pool items with
  positive total weight exist (the minimum reward-pool breadth the RPC enforces).
- Cycle-stamp-3 soft GPS supersedes the older broad geofence flag rule:
  cycle stamp 1 and 2 do not request GPS, cycle stamp 1 and 2 do not write GPS unknown fraud flags, and cycle stamp 3 requires a browser GPS attempt when soft geofence is enabled.
- The stamp remains non-blocking: denied, timeout, unsupported, unavailable, or poor-accuracy GPS still issues the stamp.
- New stamp evidence stores no raw customer latitude or longitude; admin review uses minimized and bucketed evidence.
- Stamp mutation must be atomic: event creation and membership count update
  cannot drift.

## Decisions Already Made

- The permanent venue QR is the stamp entry point for existing members.
- Event type for normal stamp is `earned`.
- Dashboard metrics derive from stamp events and membership totals.
- Reward pool selection uses persisted integer weights.

## Behavioral Requirements

- **MS-STAFF-REWARDS-SELF-SERVICE-STAMP-ISSUING-001** WHEN an existing member scans the venue QR, THE app SHALL route to the
  stamp-confirm screen with QR context.
- **MS-STAFF-REWARDS-SELF-SERVICE-STAMP-ISSUING-002** WHEN the customer taps add stamp and all server checks pass, THE system SHALL
  create a `stamp_events` record and increment membership progress.
- **MS-STAFF-REWARDS-SELF-SERVICE-STAMP-ISSUING-003** WHEN the next active-cycle stamp number is 1 or 2, THE system SHALL not request GPS and SHALL not write a GPS unknown fraud flag.
- **MS-STAFF-REWARDS-SELF-SERVICE-STAMP-ISSUING-004** WHEN the next active-cycle stamp number is 3 and soft geofence is enabled, THE system SHALL request a fresh high-accuracy browser GPS fix when available and SHALL still issue the stamp when GPS is denied, timeout, unsupported, unavailable, or poor-accuracy.
- **MS-STAFF-REWARDS-SELF-SERVICE-STAMP-ISSUING-005** WHEN a reward cycle resets, THE system SHALL reapply the cycle stamp 3 trigger and SHALL store new stamp evidence without raw customer latitude or longitude.
- **MS-STAFF-REWARDS-SELF-SERVICE-STAMP-ISSUING-006** WHEN the customer has already received a stamp for the membership/location/UK
  date, THE system SHALL reject the duplicate attempt with safe copy.
- **MS-STAFF-REWARDS-SELF-SERVICE-STAMP-ISSUING-007** WHEN the stamp completes the visit target, THE system SHALL select one active
  reward pool item using integer weights and persist its details into
  `reward_events`.
- **MS-STAFF-REWARDS-SELF-SERVICE-STAMP-ISSUING-008** WHEN the merchant billing state is cancelled or suspended, THE system SHALL
  block new stamp issuance according to billing rules.
- **MS-STAFF-REWARDS-SELF-SERVICE-STAMP-ISSUING-009** WHEN a stamp is issued, THE system SHALL write `stamp_issued` to product
  events and an audit entry with non-sensitive metadata.

## Verification Criteria

Acceptance criteria:

- Valid QR context issues one stamp.
- Missing QR context does not change stamp count.
- UK-date gating prevents duplicate visit stamps.
- Final stamp creates exactly one assigned reward event.
- Soft geofence states never block a valid stamp.
- Stamp event and membership count stay consistent.

Manual QA:

- Issue first stamp after customer joins.
- Attempt a second stamp on the same UK business day.
- Test in-range, out-of-range, and denied-location browser states.
- Confirm event, audit, and fraud readback.

Task breakdown:

- Implement self-service stamp RPC.
- Implement QR-context stamp action and UI.
- Add rate-limit, UK-date, reward-unlock, and soft geofence tests.
- Verify UI success/failure states and readback.

## Changelog

- v1: Staff-mediated stamp approval.
- v2: Static-QR self-service stamping with optional soft geofence review.
