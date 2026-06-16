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
- A final stamp cannot be issued unless at least one active reward pool item
  exists.
- Optional GPS review is a soft signal: out-of-range or unavailable location
  writes a fraud flag and still issues the stamp.
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
- **MS-STAFF-REWARDS-SELF-SERVICE-STAMP-ISSUING-003** WHEN location is in range, THE system SHALL issue the stamp without creating a
  geofence fraud flag.
- **MS-STAFF-REWARDS-SELF-SERVICE-STAMP-ISSUING-004** WHEN location is outside the configured radius, THE system SHALL issue the
  stamp and create a fraud flag.
- **MS-STAFF-REWARDS-SELF-SERVICE-STAMP-ISSUING-005** WHEN location is denied or unavailable, THE system SHALL issue the stamp and
  create a fraud flag.
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
