---
spec_id: MS-ADMIN-BILLING-INTERNAL-ADMIN-SUPPORT-CONSOLE
status: active
risk_class: auth-session
owner: factory-droid
last_reviewed: 2026-06-15
allowed_blast_radius:
  - app/admin/**
  - components/layout/admin-shell.tsx
  - lib/admin/**
  - micro-specs/06-admin-billing/02-internal-admin-support-console.md
  - micro-specs/TRACEABILITY.md
  - micro-specs/traceability.json
  - supabase/migrations/**
implementation_surfaces:
  - app/admin/**
  - lib/admin/**
  - components/layout/admin-shell.tsx
  - supabase/migrations/**
related_docs:
  - docs/PROJECT_SPEC.md
  - docs/ARCHITECTURE.md
  - micro-specs/GLOBAL_CONTEXT.md
  - DESIGN.md
related_tests:
  - manual:billing/admin micro-spec Vitest evidence in retained legacy filename
  - tests/micro-specs/admin-console-redesign.test.ts
verification_gates:
  - pnpm governance
  - pnpm lint
  - pnpm typecheck
  - pnpm test
  - pnpm security:verify
  - pnpm build
approved_exceptions: []
---

# Micro-Spec: Internal Admin Support Console

## Governance Status Evidence

- Lifecycle status: `active` after review against `docs/PROJECT_SPEC.md`, `docs/ARCHITECTURE.md`, and related tests on 2026-06-15.
- Stale/superseded handling: this spec remains current intent; no replacement spec is linked.
- Evidence posture: related tests and verification gates are listed in metadata and traceability for implementation handoff.

## Exact Goal and User-Visible Outcomes

Internal admins can support merchants and customers from a restricted admin console: view merchant accounts, inspect subscription state, look up customer records, adjust stamps, cancel rewards, disable/regenerate QR records, review fraud flags, and inspect audit logs.

## Blast Radius

In scope:

- `/admin`
- `/admin/merchants`
- `/admin/customers`
- `/admin/billing`
- `/admin/fraud`
- `/admin/audit`
- Admin role checks and MFA enforcement hook points.
- Manual support actions with audit logs.

Out of scope:

- Public admin signup.
- Merchant-facing support ticketing system.
- Bulk data export beyond data-request support.
- Automated fraud adjudication.

## Strict Constraints and Assumptions

- Admin access is internal-only.
- MFA is required for admin accounts before production pilot.
- Admin actions must be audited.
- Service-role access must remain server-side.
- Admin pages must not expose unnecessary customer personal data.
- Manual stamp and reward changes must preserve event history rather than silently editing totals.

## Decisions Already Made

Admin MVP features:

- Merchant list and detail.
- Subscription status.
- Customer lookup.
- Manual stamp adjustment.
- Manual reward cancellation.
- QR management.
- Consent log viewer.
- Fraud flags.
- Audit log viewer.

## Behavioral Requirements

- **MS-ADMIN-BILLING-INTERNAL-ADMIN-SUPPORT-CONSOLE-001** WHEN a non-admin accesses `/admin`, THE app SHALL deny access.
- **MS-ADMIN-BILLING-INTERNAL-ADMIN-SUPPORT-CONSOLE-002** WHEN admin MFA enforcement is enabled, THE app SHALL deny admin access unless the Supabase session is at AAL2.
- **MS-ADMIN-BILLING-INTERNAL-ADMIN-SUPPORT-CONSOLE-003** WHEN an admin views merchants, THE app SHALL show searchable merchant account and plan status data.
- **MS-ADMIN-BILLING-INTERNAL-ADMIN-SUPPORT-CONSOLE-004** WHEN an admin performs a manual stamp adjustment, THE system SHALL create an adjustment event and audit log.
- **MS-ADMIN-BILLING-INTERNAL-ADMIN-SUPPORT-CONSOLE-005** WHEN an admin cancels a reward, THE system SHALL update reward state and record why.
- **MS-ADMIN-BILLING-INTERNAL-ADMIN-SUPPORT-CONSOLE-006** WHEN an admin disables a QR code, THE QR SHALL stop resolving for customer entry while history remains visible.
- **MS-ADMIN-BILLING-INTERNAL-ADMIN-SUPPORT-CONSOLE-007** WHEN an admin views audit logs, THE app SHALL show actor, action, merchant/customer context where appropriate, timestamp, and non-sensitive metadata.

## Verification Criteria

Acceptance criteria:

- Non-admin users cannot access admin routes.
- Admin support actions produce audit logs.
- Manual adjustments appear in merchant/customer activity where appropriate.
- QR disable action affects `/q/{qr_id}` resolution.

Manual QA:

- Attempt admin route as merchant and customer.
- View merchant detail as admin.
- Adjust a test stamp and confirm membership/event readback.
- Cancel a test reward and confirm it cannot be redeemed.
- Disable QR and confirm customer-facing failure state.

Task breakdown:

- Implement admin authorization gate.
- Build merchant/customer/billing lookup pages.
- Add manual support actions.
- Add audit/fraud views.
- Verify access control and audit readback.
