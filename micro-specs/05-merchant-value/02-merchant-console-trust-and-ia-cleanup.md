---
spec_id: MS-MERCHANT-VALUE-CONSOLE-TRUST-IA-CLEANUP
status: active
risk_class: customer-pii
owner: factory-droid
last_reviewed: 2026-06-15
allowed_blast_radius:
  - app/app/**
  - components/layout/merchant-app-shell.tsx
  - components/merchant/**
  - lib/merchant/**
  - micro-specs/05-merchant-value/02-merchant-console-trust-and-ia-cleanup.md
  - micro-specs/TRACEABILITY.md
  - micro-specs/traceability.json
implementation_surfaces:
  - app/app/**
  - components/layout/merchant-app-shell.tsx
  - components/merchant/**
  - lib/merchant/**
related_docs:
  - docs/PROJECT_SPEC.md
  - docs/ARCHITECTURE.md
  - micro-specs/GLOBAL_CONTEXT.md
  - DESIGN.md
related_tests:
  - tests/micro-specs/merchant-console-trust-ia.test.ts
verification_gates:
  - pnpm governance
  - pnpm lint
  - pnpm typecheck
  - pnpm test
  - pnpm security:verify
approved_exceptions: []
---

# Micro-Spec: Merchant Console Trust and IA Cleanup

## Governance Status Evidence

- Lifecycle status: `active` after review against `docs/PROJECT_SPEC.md`, `docs/ARCHITECTURE.md`, and related tests on 2026-06-15.
- Stale/superseded handling: this spec remains current intent; no replacement spec is linked.
- Evidence posture: related tests and verification gates are listed in metadata and traceability for implementation handoff.

## Exact Goal and User-Visible Outcomes

Merchants can find Activity from the main console navigation, see billing only
where it needs action or management, and review customer/activity readbacks
without raw customer email addresses or full phone numbers appearing in merchant
UI or activity search text.

## Blast Radius

In scope:

- `/app` dashboard summary and billing notice behavior.
- `/app/activity` navigation entry.
- `/app/billing` billing status copy.
- `/app/customers` customer identifier display.
- Merchant activity row display and search text.
- Dashboard readback queries that directly support the rendered dashboard.

Out of scope:

- New schema, migrations, or customer identity collection changes.
- Alternate stamp verification mechanics or staff secrets.
- Invoice history, Stripe portal redesign, or billing plan changes.
- CRM segmentation, campaigns, exports, or advanced analytics.
- Redesigning QR, card, reward, or customer-facing flows.

## Strict Constraints and Assumptions

- Use live code and the as-built docs (`docs/ARCHITECTURE.md`,
  `docs/PROJECT_SPEC.md`) as the source of truth for this work. Older specs
  do not override current code.
- Preserve the permanent venue QR and self-service customer flow.
- Merchant pages must not expose raw full phone numbers or raw email addresses
  by default.
- Browser storage remains cache only; server readbacks remain authoritative.
- Billing copy can be shared, but `/app/billing` remains the place to manage
  Stripe checkout and portal access.
- No new dependencies.

## Decisions Already Made

- Activity is a primary merchant navigation item.
- Settings is labelled as `Settings`, not `ROI settings`, in account navigation.
- Healthy billing states are not dashboard noise. The dashboard only shows a
  billing notice when the state needs setup, review, or payment attention.
- Billing page and dashboard billing notices use the same status copy source.
- Customer identifiers are masked for merchant display and activity search.

## Behavioral Requirements

- **MS-MERCHANT-VALUE-CONSOLE-TRUST-IA-CLEANUP-001** WHEN merchant navigation renders, THE system SHALL include `/app/activity` in
  primary navigation.
- **MS-MERCHANT-VALUE-CONSOLE-TRUST-IA-CLEANUP-002** WHEN account navigation renders, THE system SHALL label `/app/settings` as
  `Settings`.
- **MS-MERCHANT-VALUE-CONSOLE-TRUST-IA-CLEANUP-003** WHEN a merchant customer readback has an email, THE system SHALL display a
  masked email identifier and SHALL NOT display the raw email address.
- **MS-MERCHANT-VALUE-CONSOLE-TRUST-IA-CLEANUP-004** WHEN a merchant customer readback has only a phone number, THE system SHALL
  display only the last four digits and SHALL NOT display the raw phone number.
- **MS-MERCHANT-VALUE-CONSOLE-TRUST-IA-CLEANUP-005** WHEN merchant activity rows are built, THE system SHALL use the same masked
  customer identifier in headlines, actor details, and search text.
- **MS-MERCHANT-VALUE-CONSOLE-TRUST-IA-CLEANUP-006** WHEN merchant activity search text is built, THE system SHALL NOT include raw
  email addresses or full phone numbers from customer identity data.
- **MS-MERCHANT-VALUE-CONSOLE-TRUST-IA-CLEANUP-007** WHEN dashboard billing status is `active` or `trialing`, THE dashboard SHALL
  omit the billing notice and SHALL NOT render billing status as a KPI tile.
- **MS-MERCHANT-VALUE-CONSOLE-TRUST-IA-CLEANUP-008** WHEN dashboard billing status is `not_started`, `past_due`, `cancelled`,
  `suspended`, or unknown, THE dashboard SHALL render an action-oriented billing
  notice.
- **MS-MERCHANT-VALUE-CONSOLE-TRUST-IA-CLEANUP-009** WHEN billing status copy is rendered on `/app` or `/app/billing`, THE system
  SHALL use one shared status-copy model.
- **MS-MERCHANT-VALUE-CONSOLE-TRUST-IA-CLEANUP-010** WHEN dashboard data loads, THE system SHALL NOT fetch recent activity inside
  `getMerchantDashboardData` because the dashboard already loads enriched
  activity separately.

## Verification Criteria

Acceptance criteria:

- Merchant shell shows Home, Launch, Customers, Activity, Billing, and Settings.
- Raw customer emails and raw phone numbers are absent from merchant customer
  identifiers and enriched activity rows.
- Dashboard has no `Billing status` KPI tile.
- Healthy billing states do not produce a dashboard billing notice.
- Action-needed billing states still produce clear dashboard copy.
- Dashboard metrics no longer make an unused recent-activity query.

Manual QA:

- Open `/app` with an active or trialing merchant and confirm billing does not
  dominate the dashboard.
- Open `/app` with a billing state that needs action and confirm the billing
  notice links to `/app/billing`.
- Open `/app/customers` and `/app/activity` with customers that have email and
  phone data; confirm raw identifiers are not visible.
- Open the merchant menu on mobile and confirm Activity is present.

Task breakdown:

- Add failing tests for navigation, billing noise, privacy-safe identifiers,
  activity search text, and the unused dashboard fetch.
- Extract shared customer identifier masking.
- Extract shared billing status copy/components.
- Update merchant shell, dashboard, billing, customer table, activity rows, and
  dashboard data loading.
- Run targeted micro-spec tests, then broader checks as feasible.
