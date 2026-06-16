---
spec_id: MS-OBSERVABILITY-COMPLIANCE-EVENTS-ANALYTICS-FUNNELS
status: active
risk_class: product-analytics
owner: factory-droid
last_reviewed: 2026-06-15
allowed_blast_radius:
  - app/**
  - lib/admin/pilot-report*.ts
  - lib/analytics/**
  - lib/merchant/**
  - micro-specs/07-observability-compliance/01-events-analytics-and-funnels.md
  - micro-specs/TRACEABILITY.md
  - micro-specs/traceability.json
  - supabase/migrations/**
implementation_surfaces:
  - lib/analytics/**
  - lib/merchant/**
  - lib/admin/pilot-report*.ts
  - app/**
  - supabase/migrations/**
related_docs:
  - docs/PROJECT_SPEC.md
  - docs/ARCHITECTURE.md
  - micro-specs/GLOBAL_CONTEXT.md
related_tests:
  - tests/micro-specs/analytics-dashboard-pilot.test.ts
  - tests/micro-specs/observability.test.ts
  - tests/micro-specs/perf-rpc-consolidation.test.ts
verification_gates:
  - pnpm governance
  - pnpm lint
  - pnpm typecheck
  - pnpm test
  - pnpm test:coverage
approved_exceptions: []
---

# Micro-Spec: Events, Analytics, and Funnels

## Governance Status Evidence

- Lifecycle status: `active` after review against `docs/PROJECT_SPEC.md`, `docs/ARCHITECTURE.md`, and related tests on 2026-06-15.
- Stale/superseded handling: this spec remains current intent; no replacement spec is linked.
- Evidence posture: related tests and verification gates are listed in metadata and traceability for implementation handoff.

## Exact Goal and User-Visible Outcomes

Nabaperks records the business events needed to prove the MVP is working and sends product analytics to PostHog for funnel analysis. The team can answer whether merchants launch, customers join, customers return, rewards redeem, and trials convert to paid.

## Blast Radius

In scope:

- `product_events` source-of-truth persistence.
- PostHog client/server event wrappers.
- Funnel event calls across merchant onboarding, QR scan, customer join, stamp issuing, reward redemption, dashboard engagement, and billing conversion.
- Pilot reporting queries or admin readback surfaces.

Out of scope:

- Replacing Supabase event tables with PostHog-only analytics.
- Session replay requirements unless already approved.
- AI segmentation.
- Automated marketing campaigns.

## Strict Constraints and Assumptions

- Supabase event tables are the source of truth.
- PostHog is for product analytics and funnel exploration.
- Event payloads must minimize personal data.
- Business-critical events must be recorded reliably server-side.
- Analytics failure must not incorrectly mark business mutations as failed if the source-of-truth write succeeded.

## Decisions Already Made

Required source-of-truth events:

- `qr_scanned`
- `customer_joined`
- `stamp_claim_started`
- `stamp_issued`
- `reward_unlocked`
- `reward_redeemed`
- `merchant_signed_up`
- `loyalty_card_created`
- `qr_created`
- `qr_downloaded`
- `subscription_started`
- `subscription_cancelled`

Key funnels:

- Merchant signup -> card created -> QR downloaded.
- QR scanned -> customer joined -> first stamp issued.
- First stamp -> second stamp.
- Reward unlocked -> reward redeemed.
- Trial started -> paid subscription.

## Behavioral Requirements

- **MS-OBSERVABILITY-COMPLIANCE-EVENTS-ANALYTICS-FUNNELS-001** WHEN a business-critical MVP event occurs, THE system SHALL write a Supabase product event with tenant context and timestamp.
- **MS-OBSERVABILITY-COMPLIANCE-EVENTS-ANALYTICS-FUNNELS-002** WHEN a funnel-relevant action occurs, THE system SHALL send a corresponding PostHog event where configured.
- **MS-OBSERVABILITY-COMPLIANCE-EVENTS-ANALYTICS-FUNNELS-003** WHEN PostHog is unavailable, THE source-of-truth Supabase event write SHALL still occur.
- **MS-OBSERVABILITY-COMPLIANCE-EVENTS-ANALYTICS-FUNNELS-004** WHEN events include customer context, THE payload SHALL avoid unnecessary personal data.
- **MS-OBSERVABILITY-COMPLIANCE-EVENTS-ANALYTICS-FUNNELS-005** WHEN a pilot report is generated, THE system SHALL use source-of-truth events for core counts.

## Verification Criteria

Acceptance criteria:

- All required events are emitted from their owning flows.
- Event names are consistent between source-of-truth and PostHog mapping.
- Pilot funnel queries can answer the five key success questions.
- Missing PostHog configuration does not break local development.

Manual QA:

- Complete merchant signup, card creation, QR download, QR scan, customer join, stamp issue, reward redeem, and subscription events.
- Confirm Supabase product events exist for each.
- Confirm PostHog receives events in a configured environment.
- Confirm payloads do not include raw secrets or avoidable personal data.

Task breakdown:

- Define event schema and names.
- Add server-side product event helper.
- Add PostHog wrapper.
- Instrument MVP flows.
- Verify event readback and funnel coverage.
