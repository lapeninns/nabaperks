---
spec_id: MS-MERCHANT-VALUE-DASHBOARD-ACTIVITY-ROI
status: active
risk_class: product-analytics
owner: factory-droid
last_reviewed: 2026-06-15
allowed_blast_radius:
  - app/app/**
  - components/merchant/**
  - lib/admin/pilot-report*.ts
  - lib/merchant/activity.ts
  - lib/merchant/dashboard.ts
  - micro-specs/05-merchant-value/01-merchant-dashboard-activity-and-roi.md
  - micro-specs/TRACEABILITY.md
  - micro-specs/traceability.json
implementation_surfaces:
  - app/app/**
  - components/merchant/**
  - lib/merchant/dashboard.ts
  - lib/merchant/activity.ts
  - lib/admin/pilot-report*.ts
related_docs:
  - docs/PROJECT_SPEC.md
  - docs/ARCHITECTURE.md
  - micro-specs/GLOBAL_CONTEXT.md
related_tests:
  - tests/micro-specs/analytics-dashboard-pilot.test.ts
  - tests/micro-specs/perf-rpc-consolidation.test.ts
  - tests/micro-specs/merchant-console-trust-ia.test.ts
  - tests/micro-specs/merchant-launch-readiness.test.ts
verification_gates:
  - pnpm governance
  - pnpm lint
  - pnpm typecheck
  - pnpm test
  - pnpm test:coverage
approved_exceptions: []
---

# Micro-Spec: Merchant Dashboard, Activity, and ROI

## Governance Status Evidence

- Lifecycle status: `active` after review against `docs/PROJECT_SPEC.md`, `docs/ARCHITECTURE.md`, and related tests on 2026-06-15.
- Stale/superseded handling: this spec remains current intent; no replacement spec is linked.
- Evidence posture: related tests and verification gates are listed in metadata and traceability for implementation handoff.

## Exact Goal and User-Visible Outcomes

A merchant can open their dashboard and see whether Nabaperks is working: members, new members, stamps issued, repeat customers, rewards unlocked/redeemed, recent activity, QR downloads, billing status, and a clearly labelled estimated repeat revenue figure.

## Blast Radius

In scope:

- `/app`
- `/app/customers`
- `/app/activity`
- `/app/settings`
- Dashboard widgets and summary queries.
- Average order value, estimated gross margin, and reward cost settings.
- Activity feed for stamps, redemptions, QR downloads, and key account events.

Out of scope:

- Advanced CRM segmentation.
- Automated campaigns.
- Guaranteed revenue attribution claims.
- Export-heavy reporting unless needed for pilot readback.

## Strict Constraints and Assumptions

- Dashboard metrics must be tenant-isolated.
- Estimated repeat revenue must be labelled as an estimate, not guaranteed attribution.
- Repeat customers are customers with more than one visit/stamp cycle signal.
- Merchant-facing pages use wider but still restrained dashboard layouts from `DESIGN.md`.
- Empty states must guide the next merchant action without marketing-page fluff.

## Decisions Already Made

MVP dashboard widgets:

- Members
- New members
- Stamps issued
- Repeat customers
- Rewards redeemed
- Recent activity
- Estimated ROI/repeat revenue
- QR downloads
- Billing status

ROI formula:

```text
Estimated repeat revenue = repeat customers x average order value
```

## Behavioral Requirements

- **MS-MERCHANT-VALUE-DASHBOARD-ACTIVITY-ROI-001** WHEN a merchant opens `/app`, THE dashboard SHALL show current MVP metrics for only their merchant.
- **MS-MERCHANT-VALUE-DASHBOARD-ACTIVITY-ROI-002** WHEN no customers have joined, THE dashboard SHALL show useful zero states and QR launch prompts.
- **MS-MERCHANT-VALUE-DASHBOARD-ACTIVITY-ROI-003** WHEN stamps or rewards are recorded, THE dashboard SHALL reflect updated totals after refresh.
- **MS-MERCHANT-VALUE-DASHBOARD-ACTIVITY-ROI-004** WHEN a merchant sets average order value, THE ROI estimate SHALL update and remain labelled as estimated.
- **MS-MERCHANT-VALUE-DASHBOARD-ACTIVITY-ROI-005** WHEN the billing status is past_due, cancelled, or suspended, THE dashboard SHALL surface the correct warning or disabled state.
- **MS-MERCHANT-VALUE-DASHBOARD-ACTIVITY-ROI-006** WHEN a merchant views activity, THE feed SHALL list recent stamps, redemptions, joins, and QR downloads with readable timestamps.

## Verification Criteria

Acceptance criteria:

- Dashboard renders all MVP widgets.
- Tenant isolation prevents cross-merchant metrics.
- Activity feed matches event table readback.
- ROI estimate uses merchant-configured average order value.

Manual QA:

- View dashboard before QR launch.
- Join as a customer, issue stamps, redeem reward, then refresh dashboard.
- Change average order value and confirm estimate changes.
- Confirm no wording claims guaranteed revenue.

Task breakdown:

- Build dashboard metric queries.
- Build dashboard and activity UI.
- Add ROI settings.
- Verify tenant isolation, event alignment, and empty states.
