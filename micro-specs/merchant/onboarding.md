---
spec_id: MS-merchant-onboarding
status: implemented
risk_class: rls-rpc-ledger
owner: claude-code agent (amanshresthaa)
last_reviewed: 2026-06-30
allowed_blast_radius:
  - app/app/onboarding/**
  - lib/merchant/onboarding.ts
  - micro-specs/merchant/**
  - supabase/migrations/20260606142000_initial_schema_rls.sql
  - tests/db/merchant-onboarding*.test.mjs
implementation_surfaces:
  - app/app/onboarding/page.tsx
  - app/app/onboarding/actions.ts
  - lib/merchant/onboarding.ts
  - supabase/migrations/20260606142000_initial_schema_rls.sql
related_docs:
  - micro-specs/GLOBAL_CONTEXT.md
  - micro-specs/merchant/auth.md
  - micro-specs/merchant/launch.md
related_tests:
  - tests/micro-specs/merchant-onboarding-completion.test.mjs
  - app/dev/app-harness/onboarding/page.tsx
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

# MS-merchant-onboarding — Atomic merchant + location + setup via create_merchant_onboarding

## Intent

After signup, a merchant completes a single onboarding form (business name,
type, venue). Submitting it creates the merchant (on a 30-day trial), its
primary venue location, and the audit/analytics rows in **one** RPC call, then
routes them into the launch hub. Re-running onboarding for an existing merchant
is idempotent — it never creates a duplicate merchant.

## Scope (in)

- `/app/onboarding` (the form) and `completeOnboardingAction`.
- The `create_merchant_onboarding` RPC: merchant insert (`status='trial'`),
  primary `merchant_locations` row (timezone `Europe/London`, `is_primary`), the
  `product_events` (`merchant_signed_up`) + `audit_logs` (`merchant_onboarded`)
  writes, and the returned `(merchant_id, location_id)`.
- The business-slug derivation and the completed-onboarding redirect to launch.

## Scope (out)

- Auth/signup (owned by [MS-merchant-auth]); the launch readiness it routes into
  (owned by [MS-merchant-launch]); loyalty card / reward authoring (owned by
  [MS-merchant-card-rewards]). No schema/RLS change.

## Decisions already made

- `create_merchant_onboarding(p_owner_user_id, p_email, p_business_name,
  p_business_slug, p_business_type, p_phone, p_location_name)` returns
  `(merchant_id, location_id)` and is idempotent on the owner/merchant.
- `business_slug` is `${base-slug}-${owner_user_id.slice(0,8)}` (collision-safe).
- A new merchant is created with `status='trial'`; the location is `is_primary`
  with `timezone='Europe/London'`.
- The onboarding page redirects to `/app/launch` when onboarding is already
  complete.

## EARS requirements

- **O-1 (atomic create):** WHEN a merchant submits valid onboarding details, THE
  system SHALL create the merchant (trial), its primary Europe/London location,
  and the `merchant_signed_up` product event + `merchant_onboarded` audit row in
  one RPC call, returning the merchant and location ids.
- **O-2 (idempotent):** IF onboarding is run for a merchant that already exists,
  THEN THE system SHALL return the existing merchant (and create a primary
  location only if one is missing) without creating a duplicate merchant.
- **O-3 (slug):** THE business slug SHALL be derived from the business name plus
  a slice of the owner id so two venues with the same name do not collide.
- **O-4 (validation):** IF the business name, business type, or venue details are
  missing/invalid, THEN THE system SHALL reject the submission before the RPC.
- **O-5 (route on complete):** WHEN onboarding is complete, THE system SHALL route
  the merchant to the launch hub, and revisiting onboarding SHALL redirect there.

## Verification method

Live-DB tier (`tests/db/merchant-onboarding*.test.mjs`, to add): call
`create_merchant_onboarding` in a rolled-back transaction with a fresh owner id
and assert exactly one `merchants` row (trial) + one primary `merchant_locations`
(Europe/London) + the product/audit rows (O-1); call again and assert no
duplicate merchant (O-2). `tests/micro-specs/merchant-onboarding-completion.
test.mjs` covers the completion/redirect contract; `/dev/app-harness/onboarding`
proves the form renders DB-free.

## Gates

`pnpm lint` · `pnpm typecheck` · `pnpm build` · `pnpm test`.
