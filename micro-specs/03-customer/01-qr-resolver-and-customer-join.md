---
spec_id: MS-CUSTOMER-QR-RESOLVER-JOIN
status: active
risk_class: auth-session
owner: factory-droid
last_reviewed: 2026-06-15
allowed_blast_radius:
  - app/m/**
  - app/q/**
  - lib/customer/join.ts
  - lib/customer/phone.ts
  - lib/customer/session*.ts
  - micro-specs/03-customer/01-qr-resolver-and-customer-join.md
  - micro-specs/TRACEABILITY.md
  - micro-specs/traceability.json
  - supabase/migrations/**
implementation_surfaces:
  - app/q/**
  - app/m/**
  - lib/customer/join.ts
  - lib/customer/phone.ts
  - lib/customer/session*.ts
  - supabase/migrations/**
related_docs:
  - docs/PROJECT_SPEC.md
  - docs/ARCHITECTURE.md
  - micro-specs/GLOBAL_CONTEXT.md
  - DESIGN.md
related_tests:
  - tests/micro-specs/customer.test.ts
  - tests/micro-specs/customer-phone-auth.test.ts
  - tests/micro-specs/returning-qr-redirect.test.ts
  - tests/micro-specs/customer-legal-sheets.test.ts
verification_gates:
  - pnpm governance
  - pnpm lint
  - pnpm typecheck
  - pnpm test
  - pnpm security:verify
  - pnpm build
approved_exceptions: []
---

# Micro-Spec: QR Resolver and Customer Join

## Governance Status Evidence

- Lifecycle status: `active` after review against `docs/PROJECT_SPEC.md`, `docs/ARCHITECTURE.md`, and related tests on 2026-06-15.
- Stale/superseded handling: this spec remains current intent; no replacement spec is linked.
- Evidence posture: related tests and verification gates are listed in metadata and traceability for implementation handoff.

## Exact Goal and User-Visible Outcomes

A customer scans a merchant QR code, lands on a branded mobile web page, joins the loyalty card without downloading an app, accepts loyalty terms, optionally opts into marketing, and sees their digital card.

## Blast Radius

In scope:

- `/q/[qr_id]`
- `/m/[merchant_slug]`
- `/m/[merchant_slug]/join`
- Customer phone identity flow using Twilio Verify and signed customer sessions.
- `customers`, `customer_memberships`, and `consent_records` writes.
- QR scan and customer join events.

Out of scope:

- Customer mobile app.
- Mandatory marketing opt-in.
- SMS/WhatsApp campaigns.
- Multi-merchant customer wallet beyond the current membership flow.
- POS purchase verification.

## Strict Constraints and Assumptions

- Customer identity is phone-first. Customer OTP is sent and checked through Twilio Verify, then stored in a first-party signed customer session cookie.
- Customers can join loyalty without accepting marketing.
- The join flow must be fast and mobile-first.
- Inactive QR or inactive card must not create a membership.
- QR scans should be tracked even when join conversion does not happen, where privacy-safe.

## Decisions Already Made

- QR scan starts at `/q/{qr_id}`.
- Active QR may route to `/m/{merchant_slug}/join` or `/card/{membership_id}` depending on identity and membership state.
- Join page message: "Join [Business Name] Rewards - no app needed."
- Consent records store channel, consent status, source, timestamp, merchant, customer, and policy version.

## Behavioral Requirements

- **MS-CUSTOMER-QR-RESOLVER-JOIN-001** WHEN a customer scans an active QR, THE resolver SHALL look up the QR record server-side.
- **MS-CUSTOMER-QR-RESOLVER-JOIN-002** WHEN a QR is inactive or unknown, THE resolver SHALL show that the loyalty card is unavailable.
- **MS-CUSTOMER-QR-RESOLVER-JOIN-003** WHEN an active QR is scanned, THE system SHALL record `qr_scanned`.
- **MS-CUSTOMER-QR-RESOLVER-JOIN-004** WHEN an unauthenticated customer reaches join, THE app SHALL request phone identity verification using the visitor IP country as the national-number parsing default and GB as fallback.
- **MS-CUSTOMER-QR-RESOLVER-JOIN-005** WHEN a customer accepts loyalty terms and completes identity verification, THE system SHALL create or reuse their customer profile and merchant membership.
- **MS-CUSTOMER-QR-RESOLVER-JOIN-006** WHEN the marketing opt-in checkbox is not selected, THE system SHALL create no opted-in marketing consent.
- **MS-CUSTOMER-QR-RESOLVER-JOIN-007** WHEN marketing opt-in is selected, THE system SHALL record consent with source and policy version.
- **MS-CUSTOMER-QR-RESOLVER-JOIN-008** WHEN a returning member scans the same merchant QR, THE app SHALL take them to their existing card instead of creating a duplicate membership.

## Verification Criteria

Acceptance criteria:

- Active QR opens the correct merchant join flow.
- Unknown/inactive QR does not expose internal details.
- Customer can join with no app download.
- Marketing opt-in is visibly separate from loyalty terms.
- Duplicate memberships are prevented for the same merchant/customer pair.

Manual QA:

- Scan active QR as a new customer.
- Join without marketing consent and confirm no opted-in marketing record.
- Join with marketing consent and confirm consent readback.
- Scan again as the same customer and confirm existing card opens.
- Test inactive QR failure state.

Task breakdown:

- Implement QR resolver.
- Implement customer identity and join UI.
- Persist membership and consent records.
- Verify conversion, duplicate prevention, and events.
