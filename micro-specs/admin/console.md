---
spec_id: MS-admin-console
status: implemented
risk_class: rls-rpc-ledger
owner: claude-code agent (amanshresthaa)
last_reviewed: 2026-06-30
allowed_blast_radius:
  - app/admin/**
  - lib/admin/**
  - micro-specs/admin/**
implementation_surfaces:
  - app/admin/layout.tsx
  - app/admin/page.tsx
  - app/admin/customers/page.tsx
  - app/admin/merchants/page.tsx
  - app/admin/fraud/page.tsx
  - app/admin/privacy/page.tsx
  - app/admin/pilot/page.tsx
  - app/admin/audit/page.tsx
  - app/admin/actions.ts
  - lib/admin/auth.ts
  - lib/admin/service-role.ts
  - lib/admin/data.ts
  - lib/admin/pilot-report.ts
related_docs:
  - micro-specs/GLOBAL_CONTEXT.md
  - micro-specs/customer/home.md
related_tests:
  - tests/micro-specs/admin-service-role-guards.test.mjs
  - tests/micro-specs/merchant-activity-service-role.test.mjs
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
required_playwright_projects: []
evidence_required:
  - Command output for the declared verification gates and related tests.
approved_exceptions: []
---

# MS-admin-console — Gated internal admin: support, fraud, privacy/GDPR, pilot, audit

## Intent

`/admin/*` is the internal operations console. Every surface is behind a hard
authorization gate (an active `internal_admins` record, plus MFA in production),
and the service-role database client is created **only after** that gate passes.
Each privileged action — adjusting stamps, cancelling rewards, resolving fraud
flags, toggling/regenerating a merchant's QR, recording a consent opt-out,
logging a data request, exporting a customer's data — writes an `audit_logs`
row. Customer contact is masked by default; raw export and erasure are
admin-only, audited paths.

## Scope (in)

- The admin auth gate (`getAdminAccess`/`requireAdminRead`/`requireAdminAction`,
  `internal_admins`, MFA) and the gated `createAdminServiceRoleClient`.
- The admin sub-surfaces (overview, customers, merchants, fraud, privacy, pilot,
  audit, billing) and `app/admin/actions.ts`.
- The GDPR/privacy surface: `admin_export_customer_data`, `admin_log_data_request`,
  `admin_record_consent_opt_out`, the `customers_masked` backstop, and the
  `customer_erasure`-gated contact-change bypass.

## Scope (out)

- Merchant-facing consoles (owned by [MS-merchant-console]); the customer-facing
  data-deletion request (owned by [MS-customer-home]). No RLS/schema change here.

## Decisions already made

- Admin access requires a row in `internal_admins` with `is_active`; in
  production (or `ADMIN_MFA_REQUIRED`) it additionally requires MFA at `aal2`.
- `createAdminServiceRoleClient` calls `requireAdminRead()` before constructing
  the service-role (RLS-bypassing) client; admin data modules must use it, never
  the raw service-role client.
- Privileged mutations go through dedicated `admin_*` security-definer RPCs
  (`admin_adjust_membership_stamps`, `admin_cancel_reward`,
  `admin_resolve_fraud_flag`, `admin_set_qr_active`, `admin_regenerate_qr_code`,
  `admin_record_consent_opt_out`, `admin_log_data_request`,
  `admin_export_customer_data`, `admin_log_pilot_note`), each writing `audit_logs`.
- Customer contact is masked by default via the `customers_masked` view;
  verified-contact mutation is blocked unless the `app.customer_erasure` setting
  is on (the erasure path).

## EARS requirements

- **AD-1 (gate):** IF the signed-in user is not an active internal admin, THEN
  every `/admin/*` surface SHALL deny access.
- **AD-2 (MFA):** WHERE MFA is required (production / `ADMIN_MFA_REQUIRED`), THE
  admin gate SHALL require an `aal2` session.
- **AD-3 (gated service-role):** THE service-role client SHALL be constructed
  only after the admin read gate passes; admin data access SHALL go through it.
- **AD-4 (audited actions):** WHEN an admin performs a privileged mutation, THE
  system SHALL require the action gate and SHALL write an `audit_logs` row
  capturing actor, action, target, and reason.
- **AD-5 (fraud resolution):** WHEN an admin resolves a fraud flag, THE system
  SHALL set its status to `reviewed`/`dismissed` and audit the previous and new
  status with a reason.
- **AD-6 (GDPR export):** WHEN an admin exports a customer's data, THE system
  SHALL return the customer's full record across memberships, stamps, rewards,
  consent, notifications, and events, and SHALL log the request.
- **AD-7 (PII default-masked):** THE customer contact SHALL be masked by default;
  raw contact SHALL be reachable only through the gated admin/erasure paths.
- **AD-8 (consent opt-out):** WHEN an admin records a consent opt-out, THE system
  SHALL write a `consent_records` opt-out and audit it.
- **AD-9 (pilot metrics):** THE pilot report SHALL compute funnel and conversion
  metrics (scan-to-join, second-stamp, paid conversion) from product events and
  audit data without exposing raw PII in the metrics.

## Verification method

`tests/micro-specs/admin-service-role-guards.test.mjs` proves AD-3 (every admin
data module routes through the gated `createAdminServiceRoleClient`, and the gate
calls `requireAdminRead`). The gate (AD-1/AD-2) and audited-action contract
(AD-4/AD-5/AD-8) are deterministic guards. The export/erasure/masking paths
(AD-6/AD-7) are live-DB candidates against `customers_masked` + the `admin_*`
RPCs. Tenant-scoping for the merchant side is covered by
`merchant-activity-service-role.test.mjs`.

## Gates

`pnpm lint` · `pnpm typecheck` · `pnpm build` · `pnpm test`.
