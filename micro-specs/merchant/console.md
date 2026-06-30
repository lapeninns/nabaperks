---
spec_id: MS-merchant-console
status: implemented
risk_class: rls-rpc-ledger
owner: claude-code agent (amanshresthaa)
last_reviewed: 2026-06-30
allowed_blast_radius:
  - app/app/page.tsx
  - app/app/customers/**
  - app/app/activity/**
  - app/app/account/**
  - lib/merchant/dashboard.ts
  - lib/merchant/customer-readback.ts
  - lib/merchant/activity.ts
  - micro-specs/merchant/**
implementation_surfaces:
  - app/app/page.tsx
  - app/app/customers/page.tsx
  - app/app/activity/page.tsx
  - app/app/account/page.tsx
  - lib/merchant/dashboard.ts
  - lib/merchant/customer-readback.ts
  - lib/merchant/activity.ts
related_docs:
  - micro-specs/GLOBAL_CONTEXT.md
  - micro-specs/merchant/reward-scan.md
related_tests:
  - tests/unit/customer-readback.test.mjs
  - tests/micro-specs/merchant-activity-service-role.test.mjs
  - app/dev/app-harness/dashboard/page.tsx
  - app/dev/app-harness/customers/page.tsx
  - app/dev/app-harness/activity/page.tsx
  - app/dev/app-harness/account/page.tsx
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:e2e
required_playwright_projects:
  - chromium
  - mobile-chromium
evidence_required:
  - Command output for the declared verification gates and related tests.
approved_exceptions: []
---

# MS-merchant-console — Dashboard KPIs, Members, Activity, staff/PIN

## Intent

The signed-in merchant's console: a dashboard of KPIs and a stamps-vs-joins
trend, a Members list that shows each customer with their contact **masked**, an
Activity feed of ledger events, and an Account area for profile, billing, and
staff/PIN management. Every surface is strictly scoped to the merchant's own
tenant, and no surface ever exposes raw customer PII to the operator.

## Scope (in)

- `/app` (dashboard), `/app/customers` (Members), `/app/activity`,
  `/app/account` (profile + billing + staff/PIN).
- Data loaders `lib/merchant/dashboard.ts`, `lib/merchant/customer-readback.ts`,
  `lib/merchant/activity.ts`, and staff management.

## Scope (out)

- Billing internals (owned by [MS-billing]); the reward-scan POS (owned by
  [MS-merchant-scan-pos]); admin surfaces (owned by [MS-admin-console]). No
  schema/RLS change.

## Decisions already made

- Dashboard KPIs: Members, New (7d), Stamps (7d), Rewards (7d), plus a
  daily stamps-vs-joins trend over the last fortnight, and a "Do next"
  panel (rewards-ready / quiet-members).
- Members shows a customer-readback row with masked contact (phone last digits /
  masked email) — never raw phone/email.
- Staff PINs are 4–12 digits, stored hashed (bcrypt via pgcrypto) plus an
  encrypted `pin_ciphertext` for owner reveal, set via `upsert_merchant_staff_pin`
  and rotated daily by the system-only `rotate_staff_pin_system`; failed entries
  are tracked in `staff_pin_attempts`. The shared-PIN surfaces were removed
  (`20260613130000_remove_shared_pin_surfaces`).
- Console nav vocabulary: Customers→Members, Launch→Setup, QR→Poster.

## EARS requirements

- **MC-1 (KPIs):** WHEN the dashboard loads, THE system SHALL show the Members /
  New / Stamps / Rewards KPIs and a daily stamps-vs-joins trend for the merchant.
- **MC-2 (do next):** THE dashboard SHALL surface the next operator actions
  (rewards ready to redeem, members gone quiet) derived from the merchant's data.
- **MC-3 (PII masking):** THE Members and Activity surfaces SHALL only ever show
  a masked customer contact (e.g. phone ending NNN), never a raw phone or email.
- **MC-4 (activity):** THE Activity feed SHALL show the merchant's ledger events
  (joins, stamps, redemptions, QR/asset events).
- **MC-5 (tenant scope):** Every console surface SHALL show only the signed-in
  merchant's own data.
- **MC-6 (staff management):** THE Account area SHALL let an owner add, activate,
  and deactivate staff; staff PINs SHALL be stored hashed and verified with a
  failed-attempt lockout, and a revoked staff member SHALL no longer authenticate.
- **MC-7 (empty/loading/error):** WHEN a console surface has no data, is loading,
  or errors, THE system SHALL render the corresponding Wet Ink state, never a
  blank region.

## Verification method

DB-free harness tier: `/dev/app-harness/{dashboard,customers,activity,account}`
mount the real bodies; an e2e spec asserts the KPIs/feed render and that the
Members surface shows masked contact (MC-3). Masking logic is unit-covered by
`tests/unit/customer-readback.test.mjs`; tenant-scoped activity by
`tests/micro-specs/merchant-activity-service-role.test.mjs`. Staff lockout (MC-6)
is a live-DB candidate (`staff_pin_attempts`).

## Gates

`pnpm lint` · `pnpm typecheck` · `pnpm build` · `pnpm test` · `pnpm test:e2e`.
