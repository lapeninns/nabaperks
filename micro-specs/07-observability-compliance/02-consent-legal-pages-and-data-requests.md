---
spec_id: MS-OBSERVABILITY-COMPLIANCE-CONSENT-LEGAL-DATA-REQUESTS
status: active
risk_class: customer-pii
owner: factory-droid
last_reviewed: 2026-06-15
allowed_blast_radius:
  - app/admin/privacy/**
  - app/merchant/**
  - app/privacy/**
  - app/terms/**
  - lib/customer/consent.ts
  - lib/legal/**
  - micro-specs/07-observability-compliance/02-consent-legal-pages-and-data-requests.md
  - micro-specs/TRACEABILITY.md
  - micro-specs/traceability.json
  - supabase/migrations/**
implementation_surfaces:
  - app/privacy/**
  - app/terms/**
  - app/merchant/**
  - app/admin/privacy/**
  - lib/customer/consent.ts
  - lib/legal/**
  - supabase/migrations/**
related_docs:
  - docs/PROJECT_SPEC.md
  - docs/ARCHITECTURE.md
  - micro-specs/GLOBAL_CONTEXT.md
  - DESIGN.md
related_tests:
  - tests/micro-specs/customer.test.ts
  - tests/micro-specs/home-profile.test.ts
  - tests/micro-specs/customer-legal-sheets.test.ts
  - supabase/tests/customer_marketing_consent.sql
  - tests/micro-specs/admin-console-redesign.test.ts
verification_gates:
  - pnpm governance
  - pnpm lint
  - pnpm typecheck
  - pnpm test
  - pnpm security:verify
approved_exceptions: []
---

# Micro-Spec: Consent, Legal Pages, and Data Requests

## Governance Status Evidence

- Lifecycle status: `active` after review against `docs/PROJECT_SPEC.md`, `docs/ARCHITECTURE.md`, and related tests on 2026-06-15.
- Stale/superseded handling: this spec remains current intent; no replacement spec is linked.
- Evidence posture: related tests and verification gates are listed in metadata and traceability for implementation handoff.

## Exact Goal and User-Visible Outcomes

Customers can join loyalty without marketing consent, merchants can display clear reward terms, and internal admins have a basic path to support privacy, deletion, export, and consent questions before pilot launch.

## Blast Radius

In scope:

- Customer join consent UI.
- `consent_records` writes and admin viewing.
- `/privacy`
- `/terms`
- `/merchant/[merchant_slug]/terms`
- Data request support workflow in admin.
- Transactional email hooks for privacy/data request confirmation where needed.

Out of scope:

- Legal finalisation without human legal review.
- Automated SMS/WhatsApp marketing.
- Advanced consent preference center beyond MVP needs.
- Full self-service data export portal unless explicitly added.

## Strict Constraints and Assumptions

- Loyalty participation and marketing opt-in are separate.
- Customers can collect stamps without marketing consent.
- Consent records must include channel, status, source, timestamp, merchant, customer, and policy version.
- Reward terms must display reward description, earning rules, stamps needed, minimum spend, expiry if any, exclusions, fraud/abuse policy, and merchant contact details where available.
- The MVP must clearly state that legal/compliance pages require review before launch.

## Decisions Already Made

Relevant UK compliance areas:

- UK GDPR data protection.
- PECR electronic marketing consent.
- Promotional reward terms and consumer protection.

Relevant references from the blueprint:

- ICO UK GDPR guidance.
- ICO controller/processor guidance.
- Data Protection Act 2018.
- ICO electronic mail marketing rules.
- PECR guidance.
- ASA CAP Code promotional marketing rules.
- UK consumer protection guidance.

## Behavioral Requirements

- **MS-OBSERVABILITY-COMPLIANCE-CONSENT-LEGAL-DATA-REQUESTS-001** WHEN a customer joins a loyalty card, THE system SHALL request loyalty terms acceptance separately from marketing opt-in.
- **MS-OBSERVABILITY-COMPLIANCE-CONSENT-LEGAL-DATA-REQUESTS-002** WHEN marketing opt-in is not selected, THE system SHALL not treat loyalty participation as marketing consent.
- **MS-OBSERVABILITY-COMPLIANCE-CONSENT-LEGAL-DATA-REQUESTS-003** WHEN marketing opt-in is selected, THE system SHALL record consent status, channel, source, merchant, customer, policy version, and timestamp.
- **MS-OBSERVABILITY-COMPLIANCE-CONSENT-LEGAL-DATA-REQUESTS-004** WHEN a customer opts out later through a supported path, THE system SHALL record the opt-out without deleting historical consent evidence.
- **MS-OBSERVABILITY-COMPLIANCE-CONSENT-LEGAL-DATA-REQUESTS-005** WHEN a merchant has reward terms, THE customer-facing pages SHALL display them before or during participation.
- **MS-OBSERVABILITY-COMPLIANCE-CONSENT-LEGAL-DATA-REQUESTS-006** WHEN an admin receives a data request, THE admin console SHALL provide enough lookup context to identify relevant customer and merchant records.

## Verification Criteria

Acceptance criteria:

- Join flow works with marketing opt-in off.
- Join flow records consent when marketing opt-in is on.
- Privacy, platform terms, and merchant reward terms routes exist.
- Admin can view consent log for support questions.
- Data request support path is documented and auditable.

Manual QA:

- Join with no marketing opt-in and inspect consent records.
- Join with email marketing opt-in and inspect consent records.
- View privacy, terms, and merchant reward terms on mobile.
- Perform admin customer lookup for a data request scenario.

Task breakdown:

- Implement consent UI and persistence.
- Add legal and reward terms pages.
- Add consent/admin support readback.
- Verify no marketing consent is implied by loyalty participation.
