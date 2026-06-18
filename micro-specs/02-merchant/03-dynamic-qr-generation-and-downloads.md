---
spec_id: MS-MERCHANT-DYNAMIC-QR-GENERATION-DOWNLOADS
status: active
risk_class: rls-rpc-ledger
owner: factory-droid
last_reviewed: 2026-06-15
allowed_blast_radius:
  - app/app/qr/**
  - app/q/**
  - lib/merchant/qr-code.ts
  - lib/qr/**
  - micro-specs/02-merchant/03-dynamic-qr-generation-and-downloads.md
  - micro-specs/TRACEABILITY.md
  - micro-specs/traceability.json
  - supabase/migrations/**
implementation_surfaces:
  - app/app/qr/**
  - app/q/**
  - lib/merchant/qr-code.ts
  - lib/qr/**
  - supabase/migrations/**
related_docs:
  - docs/PROJECT_SPEC.md
  - docs/ARCHITECTURE.md
  - micro-specs/GLOBAL_CONTEXT.md
related_tests:
  - tests/micro-specs/merchant-qr.test.ts
  - tests/micro-specs/merchant-qr-mutations.test.ts
  - tests/micro-specs/customer.test.ts
  - tests/micro-specs/self-service-stamping.test.ts
verification_gates:
  - pnpm governance
  - pnpm lint
  - pnpm typecheck
  - pnpm test
  - pnpm db:verify
  - pnpm security:verify
approved_exceptions: []
---

# Micro-Spec: Dynamic QR Generation and Downloads

## Governance Status Evidence

- Lifecycle status: `active` after review against `docs/PROJECT_SPEC.md`, `docs/ARCHITECTURE.md`, and related tests on 2026-06-15.
- Stale/superseded handling: this spec remains current intent; no replacement spec is linked.
- Evidence posture: related tests and verification gates are listed in metadata and traceability for implementation handoff.

## Exact Goal and User-Visible Outcomes

A merchant can generate one permanent customer join QR for the venue and download practical in-store assets: counter poster PDF, till card PNG, small sticker PNG, and shareable URL.

## Blast Radius

In scope:

- `/app/qr`
- `qr_codes` creation, activation, and lookup support.
- QR rendering and downloadable asset generation.
- Product event logging for QR creation and downloads.
- Merchant controls to view, copy, download, and disable QR records.

Out of scope:

- Third-party QR management platforms.
- Table QR, receipt QR, staff QR, or campaign QR variants beyond data-model-ready destination values.
- Print fulfilment.
- Design studio customization beyond MVP brand-safe assets.

## Strict Constraints and Assumptions

- QR URLs use `/q/{qr_id}` on the Nabaperks domain.
- QR codes must be dynamic records controlled by the app.
- QR images must render on a high-contrast white background for scan reliability.
- `qr_id` must not expose sequential merchant IDs.
- Disabled QR codes must stop customer entry without deleting historical events.

## Decisions Already Made

- Dynamic QR records point to merchant, location, and loyalty card.
- QR destination types may include join, stamp, redeem, and staff, but MVP customer entry uses one active join QR per merchant/location.
- Merchants need downloadable poster, till-card, sticker, and shareable URL assets.

## Behavioral Requirements

- **MS-MERCHANT-DYNAMIC-QR-GENERATION-DOWNLOADS-001** WHEN a merchant with an active card and at least three active reward pool items opens `/app/qr`, THE app SHALL show their active QR code and shareable URL.
- **MS-MERCHANT-DYNAMIC-QR-GENERATION-DOWNLOADS-002** WHEN no active venue join QR exists, THE system SHALL create one or guide the merchant to generate one.
- **MS-MERCHANT-DYNAMIC-QR-GENERATION-DOWNLOADS-003** WHEN an active venue join QR already exists, THE system SHALL reuse it instead of creating a campaign-specific QR.
- **MS-MERCHANT-DYNAMIC-QR-GENERATION-DOWNLOADS-004** WHEN fewer than three active reward pool items exist, THE system SHALL block QR launch and direct the merchant back to reward setup.
- **MS-MERCHANT-DYNAMIC-QR-GENERATION-DOWNLOADS-005** WHEN a merchant downloads a QR asset, THE system SHALL provide a scannable file with the correct `/q/{qr_id}` URL.
- **MS-MERCHANT-DYNAMIC-QR-GENERATION-DOWNLOADS-006** WHEN a QR is disabled, THE system SHALL keep historical scan records and SHALL prevent new customer entry through that QR.
- **MS-MERCHANT-DYNAMIC-QR-GENERATION-DOWNLOADS-007** WHEN a QR is generated or downloaded, THE system SHALL record `qr_created` or `qr_downloaded` product events.

## Verification Criteria

Acceptance criteria:

- QR URL resolves to the app-controlled `/q/{qr_id}` format.
- The rendered QR scans from a phone camera.
- Downloaded assets are visually branded and include “Scan to collect visit stamps” and surprise-reward copy.
- Disabled QR state is visible to the merchant.

Manual QA:

- Create a QR for a saved card.
- Scan the QR from a device or QR scanner tool.
- Download all MVP asset formats.
- Disable QR and confirm `/q/{qr_id}` no longer proceeds to join/card flow.

Task breakdown:

- Implement QR record generation.
- Implement QR rendering and asset downloads.
- Add disabled-state controls.
- Verify scan reliability and event logging.
