---
spec_id: MS-MERCHANT-LOYALTY-CARD-BUILDER
status: active
risk_class: rls-rpc-ledger
owner: factory-droid
last_reviewed: 2026-06-15
allowed_blast_radius:
  - app/app/card/**
  - app/app/launch/**
  - app/dev/launch-preview/**
  - components/loyalty/**
  - components/merchant/**
  - lib/merchant/loyalty-card.ts
  - lib/merchant/venue-address.ts
  - lib/merchant/resolve-venue-address.ts
  - config/env-contract.json
  - scripts/env-keys.mjs
  - docs/ARCHITECTURE.md
  - docs/ENV_KEYS.md
  - docs/QA_MATRIX.md
  - README.md
  - .env.example
  - micro-specs/02-merchant/02-loyalty-card-builder.md
  - micro-specs/TRACEABILITY.md
  - micro-specs/traceability.json
  - supabase/migrations/**
  - tests/micro-specs/**
  - tests/e2e/**
implementation_surfaces:
  - app/app/card/**
  - app/app/launch/**
  - lib/merchant/loyalty-card.ts
  - lib/merchant/venue-address.ts
  - supabase/migrations/**
  - components/loyalty/**
  - components/merchant/**
related_docs:
  - docs/PROJECT_SPEC.md
  - docs/ARCHITECTURE.md
  - micro-specs/GLOBAL_CONTEXT.md
related_tests:
  - tests/micro-specs/merchant-launch-readiness.test.ts
  - tests/micro-specs/merchant-qr.test.ts
  - tests/micro-specs/merchant-qr-mutations.test.ts
  - tests/micro-specs/analytics-dashboard-pilot.test.ts
verification_gates:
  - pnpm governance
  - pnpm lint
  - pnpm typecheck
  - pnpm test
  - pnpm db:verify
  - pnpm security:verify
approved_exceptions: []
---

# Micro-Spec: Loyalty Card Builder

## Governance Status Evidence

- Lifecycle status: `active` after review against `docs/PROJECT_SPEC.md`, `docs/ARCHITECTURE.md`, and related tests on 2026-06-15.
- Stale/superseded handling: this spec remains current intent; no replacement spec is linked.
- Evidence posture: related tests and verification gates are listed in metadata and traceability for implementation handoff.

## Exact Goal and User-Visible Outcomes

A merchant can create and edit one Mystery Visit Card and a custom reward pool. Customers see locked “Surprise reward” copy until visit 3, while the merchant controls the possible rewards, terms, weights, active state, and display order.

## Blast Radius

In scope:

- `/app/card`
- Loyalty card creation and update actions.
- Reward pool create, edit, disable, delete-if-unused, archive-if-used, ordering, and weighting.
- `loyalty_cards` and `reward_pool_items` reads/writes.
- Validation for reward configuration and customer-facing terms.
- Preview UI using `DESIGN.md` stamp-card conventions.

Out of scope:

- Multiple active cards per location.
- Points-based loyalty.
- Referral rewards.
- Automated reward expiry rules unless represented as display-only terms.
- POS spend verification.

## Strict Constraints and Assumptions

- MVP default is 3 visits unlock a surprise reward.
- A merchant may have one active loyalty card in MVP.
- Required card fields: card name, visits to reveal, mystery terms.
- Required reward pool fields: reward name, reward terms, integer weight, active state, display order.
- Optional reward pool field: minimum spend in pence.
- Exact reward odds are not shown to customers in MVP.
- Customer-facing text must be clear enough to support promotions compliance review.
- Inactive cards must not issue new stamps.

## Decisions Already Made

- `loyalty_cards` belongs to merchant and location.
- `stamps_required` is an integer.
- `is_active` controls whether a card can be used.
- `loyalty_cards.reward_name` stores the locked-state teaser and defaults to `Surprise reward`.
- The customer UI displays empty and earned visit stamps as tactile circular marks.

## Behavioral Requirements

- **MS-MERCHANT-LOYALTY-CARD-BUILDER-001** WHEN a merchant opens `/app/card` without a card, THE app SHALL present a default 3-visit Mystery Visit Card setup.
- **MS-MERCHANT-LOYALTY-CARD-BUILDER-002** WHEN a merchant saves a valid card, THE system SHALL persist the card against their merchant and MVP location.
- **MS-MERCHANT-LOYALTY-CARD-BUILDER-003** WHEN a merchant saves a valid reward pool item, THE system SHALL persist it against the same merchant, location, and loyalty card.
- **MS-MERCHANT-LOYALTY-CARD-BUILDER-004** WHEN a merchant tries to save invalid values, THE system SHALL reject the save and explain the invalid fields.
- **MS-MERCHANT-LOYALTY-CARD-BUILDER-005** WHEN a merchant already has one active MVP card, THE system SHALL not create a second active card.
- **MS-MERCHANT-LOYALTY-CARD-BUILDER-006** WHEN a reward pool item has already been assigned to a customer reward, THE system SHALL archive it instead of hard-deleting the historical reward reference.
- **MS-MERCHANT-LOYALTY-CARD-BUILDER-007** WHEN a card is inactive, THE QR resolver and stamp issuing flows SHALL not permit new stamp claims for that card.
- **MS-MERCHANT-LOYALTY-CARD-BUILDER-008** WHEN a card is created or changed, THE system SHALL write an audit log and a `loyalty_card_created` or equivalent product event.
- **MS-MERCHANT-LOYALTY-CARD-BUILDER-009** WHEN a merchant adjusts the venue geofence pin, THE system SHALL persist the manual pin coordinates over the address geocode and record the coordinate provenance as a merchant-placed pin separately from the address source.
- **MS-MERCHANT-LOYALTY-CARD-BUILDER-010** WHEN a merchant selects their venue from Google Places autocomplete during venue setup, THE system SHALL fill the structured UK venue address from the selected place, validate the provider place identity and GB coordinates server-side, and persist the selection as `address_source = "provider_lookup"`, `address_provider = "google_places"`, and `address_provider_id = place.id` while leaving manual address entry, the Nominatim geocode fallback, and a dragged manual pin override unchanged.

## Verification Criteria

Acceptance criteria:

- Merchant can create a 3-visit mystery card.
- Merchant can edit card name, visit count, mystery terms, and active state.
- Merchant can create, edit, disable, delete/archive, reorder, and weight reward pool items.
- Customer preview reflects locked reward copy and active reward count.
- The system enforces one active card per MVP location.

Manual QA:

- Save default card.
- Try stamps required values below 1 and unreasonably high values.
- Confirm another merchant cannot read or edit the card.
- Confirm audit/product event readback after create/update.

Task breakdown:

- Implement card builder UI.
- Implement validation and persistence.
- Implement active-card guard.
- Verify preview, tenant isolation, and events.
