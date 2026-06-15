# Micro-Spec Traceability

This human-readable index mirrors `micro-specs/traceability.json` and is ordered by stable spec ID and requirement ID.

## GOV-GOVERNANCE-FOUNDATION — Governance contract validator foundation

| Field         | Value                                                         |
| ------------- | ------------------------------------------------------------- |
| Status        | `implemented`                                                 |
| Risk class    | `docs-tooling`                                                |
| Owner         | `factory-droid`                                               |
| Last reviewed | `2026-06-15`                                                  |
| Tests         | `tests/micro-specs/ai-governance.test.ts`                     |
| Gates         | `pnpm governance`, `pnpm lint`, `pnpm typecheck`, `pnpm test` |

Allowed blast radius:

- `AGENTS.md`
- `CLAUDE.md`
- `SKILL.md`
- `Instructions_MircroSpecsCreation.md`
- `Instructions_tdd.md`
- `micro-specs/README.md`
- `micro-specs/GLOBAL_CONTEXT.md`
- `micro-specs/TRACEABILITY.md`
- `micro-specs/traceability.json`
- `scripts/check-governance.mjs`
- `tests/micro-specs/ai-governance.test.ts`
- `package.json`
- `.github/**`

Implementation surfaces:

- `AGENTS.md`
- `CLAUDE.md`
- `SKILL.md`
- `Instructions_MircroSpecsCreation.md`
- `Instructions_tdd.md`
- `micro-specs/README.md`
- `micro-specs/GLOBAL_CONTEXT.md`
- `micro-specs/TRACEABILITY.md`
- `micro-specs/traceability.json`
- `scripts/check-governance.mjs`
- `tests/micro-specs/ai-governance.test.ts`
- `package.json`
- `.github/**`

### Requirements

| Requirement ID                  | Summary                                                                                                         | Evidence                                                                                                                                                  |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GOV-GOVERNANCE-FOUNDATION-001` | Canonical governance hierarchy is documented and validated.                                                     | `micro-specs/README.md`, `tests/micro-specs/ai-governance.test.ts`                                                                                        |
| `GOV-GOVERNANCE-FOUNDATION-002` | Lifecycle status, transition, risk, and gate vocabulary is documented and validated.                            | `micro-specs/README.md`, `tests/micro-specs/ai-governance.test.ts`                                                                                        |
| `GOV-GOVERNANCE-FOUNDATION-003` | Traceability JSON and Markdown are present and synchronized for the foundation scope.                           | `micro-specs/traceability.json`, `micro-specs/TRACEABILITY.md`, `tests/micro-specs/ai-governance.test.ts`                                                 |
| `GOV-GOVERNANCE-FOUNDATION-004` | Governance validation is pnpm aligned, deterministic, read-only, and not soft-failed.                           | `scripts/check-governance.mjs`, `package.json`, `.github/workflows/ci.yml`, `.github/actions/setup/action.yml`, `tests/micro-specs/ai-governance.test.ts` |
| `GOV-GOVERNANCE-FOUNDATION-005` | Governance-only work is CLI-first and browser evidence is required only when product runtime risk calls for it. | `micro-specs/README.md`, `.github/pull_request_template.md`, `tests/micro-specs/ai-governance.test.ts`                                                    |

Handoff evidence is captured in `micro-specs/traceability.json`.

## GOV-HANDOFF-FIXTURES-TESTS — Governance handoff fixtures and tests

| Field         | Value                                                                                         |
| ------------- | --------------------------------------------------------------------------------------------- |
| Status        | `implemented`                                                                                 |
| Risk class    | `docs-tooling`                                                                                |
| Owner         | `factory-droid`                                                                               |
| Last reviewed | `2026-06-15`                                                                                  |
| Tests         | `tests/micro-specs/ai-governance.test.ts`, `tests/fixtures/governance/handoff-workflows.json` |
| Gates         | `pnpm governance`, `pnpm lint`, `pnpm typecheck`, `pnpm test`                                 |

Allowed blast radius:

- `scripts/check-governance.mjs`
- `tests/micro-specs/ai-governance.test.ts`
- `tests/fixtures/governance/**`
- `micro-specs/TRACEABILITY.md`
- `micro-specs/traceability.json`
- `.github/**`

Implementation surfaces:

- `scripts/check-governance.mjs`
- `tests/micro-specs/ai-governance.test.ts`
- `tests/fixtures/governance/**`
- `micro-specs/TRACEABILITY.md`
- `micro-specs/traceability.json`
- `.github/**`

### Requirements

| Requirement ID                   | Summary                                                                                                                                                                         | Evidence                                                                                                                      |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `GOV-HANDOFF-FIXTURES-TESTS-001` | Malformed lifecycle fixtures fail for missing metadata, invalid status, duplicate IDs, invalid risk class, missing supersession, and stale references.                          | `tests/fixtures/governance/handoff-workflows.json`, `tests/micro-specs/ai-governance.test.ts`, `scripts/check-governance.mjs` |
| `GOV-HANDOFF-FIXTURES-TESTS-002` | Governance automation rejects missing metadata, duplicate IDs, invalid risk class, broken traceability, and soft-fail CI configuration.                                         | `tests/micro-specs/ai-governance.test.ts`, `scripts/check-governance.mjs`, `.github/workflows/ci.yml`                         |
| `GOV-HANDOFF-FIXTURES-TESTS-003` | Compliant handoff fixtures demonstrate Product to Engineering to Reviewer to Release evidence without widening scope.                                                           | `tests/fixtures/governance/handoff-workflows.json`, `tests/micro-specs/ai-governance.test.ts`                                 |
| `GOV-HANDOFF-FIXTURES-TESTS-004` | Malformed workflow fixtures fail for missing handoff fields, missing TDD evidence, missing as-built reconciliation, missing blast-radius confirmation, and broken traceability. | `tests/fixtures/governance/handoff-workflows.json`, `tests/micro-specs/ai-governance.test.ts`, `scripts/check-governance.mjs` |
| `GOV-HANDOFF-FIXTURES-TESTS-005` | Reviewer decisions cite spec IDs, requirement IDs, risk class, and verification output.                                                                                         | `tests/fixtures/governance/handoff-workflows.json`, `scripts/check-governance.mjs`                                            |
| `GOV-HANDOFF-FIXTURES-TESTS-006` | Release handoff evidence reconciles governance, quality, lint, typecheck, tests, and risk-specific gates while keeping risks and follow-ups separate.                           | `tests/fixtures/governance/handoff-workflows.json`, `micro-specs/traceability.json`, `scripts/check-governance.mjs`           |

Handoff evidence is captured in `micro-specs/traceability.json`.

## MS-ADMIN-BILLING-INTERNAL-ADMIN-SUPPORT-CONSOLE — Internal Admin Support Console

| Field         | Value                                                                                                                             |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Status        | `active`                                                                                                                          |
| Risk class    | `auth-session`                                                                                                                    |
| Owner         | `factory-droid`                                                                                                                   |
| Last reviewed | `2026-06-15`                                                                                                                      |
| Source        | `micro-specs/06-admin-billing/02-internal-admin-support-console.md`                                                               |
| Tests         | `manual:billing/admin micro-spec Vitest evidence in retained legacy filename`, `tests/micro-specs/admin-console-redesign.test.ts` |
| Gates         | `pnpm governance`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm security:verify`, `pnpm build`                               |

Allowed blast radius:

- `app/admin/**`
- `components/layout/admin-shell.tsx`
- `lib/admin/**`
- `micro-specs/06-admin-billing/02-internal-admin-support-console.md`
- `micro-specs/TRACEABILITY.md`
- `micro-specs/traceability.json`
- `supabase/migrations/**`

Implementation surfaces:

- `app/admin/**`
- `lib/admin/**`
- `components/layout/admin-shell.tsx`
- `supabase/migrations/**`

Status evidence:

- Reviewed against docs/PROJECT_SPEC.md and docs/ARCHITECTURE.md on 2026-06-15.
- Related tests were inspected and mapped before status classification.
- No superseding Micro-Spec replaces this current intent.

### Requirements

| Requirement ID                                        | Summary                                                                                                                                               | Evidence                                                                                                                          |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `MS-ADMIN-BILLING-INTERNAL-ADMIN-SUPPORT-CONSOLE-001` | WHEN a non-admin accesses `/admin`, THE app SHALL deny access.                                                                                        | `manual:billing/admin micro-spec Vitest evidence in retained legacy filename`, `tests/micro-specs/admin-console-redesign.test.ts` |
| `MS-ADMIN-BILLING-INTERNAL-ADMIN-SUPPORT-CONSOLE-002` | WHEN admin MFA enforcement is enabled, THE app SHALL deny admin access unless the Supabase session is at AAL2.                                        | `manual:billing/admin micro-spec Vitest evidence in retained legacy filename`, `tests/micro-specs/admin-console-redesign.test.ts` |
| `MS-ADMIN-BILLING-INTERNAL-ADMIN-SUPPORT-CONSOLE-003` | WHEN an admin views merchants, THE app SHALL show searchable merchant account and plan status data.                                                   | `manual:billing/admin micro-spec Vitest evidence in retained legacy filename`, `tests/micro-specs/admin-console-redesign.test.ts` |
| `MS-ADMIN-BILLING-INTERNAL-ADMIN-SUPPORT-CONSOLE-004` | WHEN an admin performs a manual stamp adjustment, THE system SHALL create an adjustment event and audit log.                                          | `manual:billing/admin micro-spec Vitest evidence in retained legacy filename`, `tests/micro-specs/admin-console-redesign.test.ts` |
| `MS-ADMIN-BILLING-INTERNAL-ADMIN-SUPPORT-CONSOLE-005` | WHEN an admin cancels a reward, THE system SHALL update reward state and record why.                                                                  | `manual:billing/admin micro-spec Vitest evidence in retained legacy filename`, `tests/micro-specs/admin-console-redesign.test.ts` |
| `MS-ADMIN-BILLING-INTERNAL-ADMIN-SUPPORT-CONSOLE-006` | WHEN an admin disables a QR code, THE QR SHALL stop resolving for customer entry while history remains visible.                                       | `manual:billing/admin micro-spec Vitest evidence in retained legacy filename`, `tests/micro-specs/admin-console-redesign.test.ts` |
| `MS-ADMIN-BILLING-INTERNAL-ADMIN-SUPPORT-CONSOLE-007` | WHEN an admin views audit logs, THE app SHALL show actor, action, merchant/customer context where appropriate, timestamp, and non-sensitive metadata. | `manual:billing/admin micro-spec Vitest evidence in retained legacy filename`, `tests/micro-specs/admin-console-redesign.test.ts` |

## MS-ADMIN-BILLING-STRIPE-BILLING-ACCESS-CONTROL — Stripe Billing and Access Control

| Field         | Value                                                                                                                                                                 |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status        | `active`                                                                                                                                                              |
| Risk class    | `billing`                                                                                                                                                             |
| Owner         | `factory-droid`                                                                                                                                                       |
| Last reviewed | `2026-06-15`                                                                                                                                                          |
| Source        | `micro-specs/06-admin-billing/01-stripe-billing-and-access-control.md`                                                                                                |
| Tests         | `manual:billing/admin micro-spec Vitest evidence in retained legacy filename`, `tests/micro-specs/marketing-auth-legal.test.ts`, `tests/micro-specs/customer.test.ts` |
| Gates         | `pnpm governance`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm security:verify`, `pnpm build`                                                                   |

Allowed blast radius:

- `app/api/stripe/**`
- `app/app/billing/**`
- `app/pricing/**`
- `lib/customer/**`
- `lib/stripe/**`
- `micro-specs/06-admin-billing/01-stripe-billing-and-access-control.md`
- `micro-specs/TRACEABILITY.md`
- `micro-specs/traceability.json`
- `supabase/migrations/**`

Implementation surfaces:

- `app/pricing/**`
- `app/app/billing/**`
- `app/api/stripe/**`
- `lib/stripe/**`
- `lib/customer/**`
- `supabase/migrations/**`

Status evidence:

- Reviewed against docs/PROJECT_SPEC.md and docs/ARCHITECTURE.md on 2026-06-15.
- Related tests were inspected and mapped before status classification.
- No superseding Micro-Spec replaces this current intent.

### Requirements

| Requirement ID                                       | Summary                                                                                                             | Evidence                                                                                                                                                              |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MS-ADMIN-BILLING-STRIPE-BILLING-ACCESS-CONTROL-001` | WHEN a merchant starts checkout, THE system SHALL create a Stripe Checkout Session for the Growth Plan.             | `manual:billing/admin micro-spec Vitest evidence in retained legacy filename`, `tests/micro-specs/marketing-auth-legal.test.ts`, `tests/micro-specs/customer.test.ts` |
| `MS-ADMIN-BILLING-STRIPE-BILLING-ACCESS-CONTROL-002` | WHEN checkout completes and the webhook is verified, THE system SHALL create or update the merchant billing record. | `manual:billing/admin micro-spec Vitest evidence in retained legacy filename`, `tests/micro-specs/marketing-auth-legal.test.ts`, `tests/micro-specs/customer.test.ts` |
| `MS-ADMIN-BILLING-STRIPE-BILLING-ACCESS-CONTROL-003` | WHEN Stripe sends subscription updates, THE system SHALL sync plan, status, and current period end.                 | `manual:billing/admin micro-spec Vitest evidence in retained legacy filename`, `tests/micro-specs/marketing-auth-legal.test.ts`, `tests/micro-specs/customer.test.ts` |
| `MS-ADMIN-BILLING-STRIPE-BILLING-ACCESS-CONTROL-004` | WHEN payment fails, THE app SHALL show a billing warning and apply the configured grace behaviour.                  | `manual:billing/admin micro-spec Vitest evidence in retained legacy filename`, `tests/micro-specs/marketing-auth-legal.test.ts`, `tests/micro-specs/customer.test.ts` |
| `MS-ADMIN-BILLING-STRIPE-BILLING-ACCESS-CONTROL-005` | WHEN status is cancelled, THE system SHALL block new stamp issuance while preserving dashboard data access.         | `manual:billing/admin micro-spec Vitest evidence in retained legacy filename`, `tests/micro-specs/marketing-auth-legal.test.ts`, `tests/micro-specs/customer.test.ts` |
| `MS-ADMIN-BILLING-STRIPE-BILLING-ACCESS-CONTROL-006` | WHEN status is suspended, THE system SHALL disable customer-facing card use.                                        | `manual:billing/admin micro-spec Vitest evidence in retained legacy filename`, `tests/micro-specs/marketing-auth-legal.test.ts`, `tests/micro-specs/customer.test.ts` |
| `MS-ADMIN-BILLING-STRIPE-BILLING-ACCESS-CONTROL-007` | WHEN webhook verification fails, THE system SHALL reject the event and SHALL not update billing state.              | `manual:billing/admin micro-spec Vitest evidence in retained legacy filename`, `tests/micro-specs/marketing-auth-legal.test.ts`, `tests/micro-specs/customer.test.ts` |

## MS-CUSTOMER-DIGITAL-STAMP-CARD — Digital Stamp Card

| Field         | Value                                                                                                                                                                               |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status        | `active`                                                                                                                                                                            |
| Risk class    | `rls-rpc-ledger`                                                                                                                                                                    |
| Owner         | `factory-droid`                                                                                                                                                                     |
| Last reviewed | `2026-06-15`                                                                                                                                                                        |
| Source        | `micro-specs/03-customer/02-digital-stamp-card.md`                                                                                                                                  |
| Tests         | `tests/micro-specs/customer.test.ts`, `tests/micro-specs/customer-card-stamps.test.ts`, `tests/micro-specs/customer-card-loader.test.ts`, `tests/micro-specs/customer-home.test.ts` |
| Gates         | `pnpm governance`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm db:verify`, `pnpm security:verify`                                                                             |

Allowed blast radius:

- `app/card/**`
- `app/reward/**`
- `components/customer/**`
- `lib/customer/card.ts`
- `lib/customer/experience/**`
- `lib/customer/reward.ts`
- `micro-specs/03-customer/02-digital-stamp-card.md`
- `micro-specs/TRACEABILITY.md`
- `micro-specs/traceability.json`

Implementation surfaces:

- `app/card/**`
- `app/reward/**`
- `components/customer/**`
- `lib/customer/card.ts`
- `lib/customer/reward.ts`
- `lib/customer/experience/**`

Status evidence:

- Reviewed against docs/PROJECT_SPEC.md and docs/ARCHITECTURE.md on 2026-06-15.
- Related tests were inspected and mapped before status classification.
- No superseding Micro-Spec replaces this current intent.

### Requirements

| Requirement ID                       | Summary                                                                                                                                                       | Evidence                                                                                                                                                                            |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MS-CUSTOMER-DIGITAL-STAMP-CARD-001` | WHEN a customer opens their card before unlock, THE app SHALL show current stamp count, target, and locked surprise reward teaser.                            | `tests/micro-specs/customer.test.ts`, `tests/micro-specs/customer-card-stamps.test.ts`, `tests/micro-specs/customer-card-loader.test.ts`, `tests/micro-specs/customer-home.test.ts` |
| `MS-CUSTOMER-DIGITAL-STAMP-CARD-002` | WHEN a reward has been unlocked, THE app SHALL show assigned reward details from `reward_events`, not mutable `loyalty_cards` fields.                         | `tests/micro-specs/customer.test.ts`, `tests/micro-specs/customer-card-stamps.test.ts`, `tests/micro-specs/customer-card-loader.test.ts`, `tests/micro-specs/customer-home.test.ts` |
| `MS-CUSTOMER-DIGITAL-STAMP-CARD-003` | WHEN the customer is not authorized for the membership, THE app SHALL deny access.                                                                            | `tests/micro-specs/customer.test.ts`, `tests/micro-specs/customer-card-stamps.test.ts`, `tests/micro-specs/customer-card-loader.test.ts`, `tests/micro-specs/customer-home.test.ts` |
| `MS-CUSTOMER-DIGITAL-STAMP-CARD-004` | WHEN the customer opens the plain card page, THE app SHALL tell them to scan the venue code before adding a stamp.                                            | `tests/micro-specs/customer.test.ts`, `tests/micro-specs/customer-card-stamps.test.ts`, `tests/micro-specs/customer-card-loader.test.ts`, `tests/micro-specs/customer-home.test.ts` |
| `MS-CUSTOMER-DIGITAL-STAMP-CARD-005` | WHEN the customer opens the stamp route with a valid QR context, THE app SHALL show a self-service add-stamp action.                                          | `tests/micro-specs/customer.test.ts`, `tests/micro-specs/customer-card-stamps.test.ts`, `tests/micro-specs/customer-card-loader.test.ts`, `tests/micro-specs/customer-home.test.ts` |
| `MS-CUSTOMER-DIGITAL-STAMP-CARD-006` | WHEN GPS review is enabled, THE app SHALL request browser location before submit and continue without blocking if location is denied or unavailable.          | `tests/micro-specs/customer.test.ts`, `tests/micro-specs/customer-card-stamps.test.ts`, `tests/micro-specs/customer-card-loader.test.ts`, `tests/micro-specs/customer-home.test.ts` |
| `MS-CUSTOMER-DIGITAL-STAMP-CARD-007` | WHEN the membership has enough stamps for a reward but `redeemable_from` is in the future, THE app SHALL show a come-back message instead of a redeem button. | `tests/micro-specs/customer.test.ts`, `tests/micro-specs/customer-card-stamps.test.ts`, `tests/micro-specs/customer-card-loader.test.ts`, `tests/micro-specs/customer-home.test.ts` |
| `MS-CUSTOMER-DIGITAL-STAMP-CARD-008` | WHEN a reward is ready, THE app SHALL show the reward as ready to redeem.                                                                                     | `tests/micro-specs/customer.test.ts`, `tests/micro-specs/customer-card-stamps.test.ts`, `tests/micro-specs/customer-card-loader.test.ts`, `tests/micro-specs/customer-home.test.ts` |
| `MS-CUSTOMER-DIGITAL-STAMP-CARD-009` | WHEN a reward has already been redeemed, THE app SHALL not show it as redeemable again.                                                                       | `tests/micro-specs/customer.test.ts`, `tests/micro-specs/customer-card-stamps.test.ts`, `tests/micro-specs/customer-card-loader.test.ts`, `tests/micro-specs/customer-home.test.ts` |

## MS-CUSTOMER-QR-RESOLVER-JOIN — QR Resolver and Customer Join

| Field         | Value                                                                                                                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status        | `active`                                                                                                                                                                                    |
| Risk class    | `auth-session`                                                                                                                                                                              |
| Owner         | `factory-droid`                                                                                                                                                                             |
| Last reviewed | `2026-06-15`                                                                                                                                                                                |
| Source        | `micro-specs/03-customer/01-qr-resolver-and-customer-join.md`                                                                                                                               |
| Tests         | `tests/micro-specs/customer.test.ts`, `tests/micro-specs/customer-phone-auth.test.ts`, `tests/micro-specs/returning-qr-redirect.test.ts`, `tests/micro-specs/customer-legal-sheets.test.ts` |
| Gates         | `pnpm governance`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm security:verify`, `pnpm build`                                                                                         |

Allowed blast radius:

- `app/m/**`
- `app/q/**`
- `lib/customer/join.ts`
- `lib/customer/phone.ts`
- `lib/customer/session*.ts`
- `micro-specs/03-customer/01-qr-resolver-and-customer-join.md`
- `micro-specs/TRACEABILITY.md`
- `micro-specs/traceability.json`
- `supabase/migrations/**`

Implementation surfaces:

- `app/q/**`
- `app/m/**`
- `lib/customer/join.ts`
- `lib/customer/phone.ts`
- `lib/customer/session*.ts`
- `supabase/migrations/**`

Status evidence:

- Reviewed against docs/PROJECT_SPEC.md and docs/ARCHITECTURE.md on 2026-06-15.
- Related tests were inspected and mapped before status classification.
- No superseding Micro-Spec replaces this current intent.

### Requirements

| Requirement ID                     | Summary                                                                                                                                                                                  | Evidence                                                                                                                                                                                    |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MS-CUSTOMER-QR-RESOLVER-JOIN-001` | WHEN a customer scans an active QR, THE resolver SHALL look up the QR record server-side.                                                                                                | `tests/micro-specs/customer.test.ts`, `tests/micro-specs/customer-phone-auth.test.ts`, `tests/micro-specs/returning-qr-redirect.test.ts`, `tests/micro-specs/customer-legal-sheets.test.ts` |
| `MS-CUSTOMER-QR-RESOLVER-JOIN-002` | WHEN a QR is inactive or unknown, THE resolver SHALL show that the loyalty card is unavailable.                                                                                          | `tests/micro-specs/customer.test.ts`, `tests/micro-specs/customer-phone-auth.test.ts`, `tests/micro-specs/returning-qr-redirect.test.ts`, `tests/micro-specs/customer-legal-sheets.test.ts` |
| `MS-CUSTOMER-QR-RESOLVER-JOIN-003` | WHEN an active QR is scanned, THE system SHALL record `qr_scanned`.                                                                                                                      | `tests/micro-specs/customer.test.ts`, `tests/micro-specs/customer-phone-auth.test.ts`, `tests/micro-specs/returning-qr-redirect.test.ts`, `tests/micro-specs/customer-legal-sheets.test.ts` |
| `MS-CUSTOMER-QR-RESOLVER-JOIN-004` | WHEN an unauthenticated customer reaches join, THE app SHALL request phone identity verification using the visitor IP country as the national-number parsing default and GB as fallback. | `tests/micro-specs/customer.test.ts`, `tests/micro-specs/customer-phone-auth.test.ts`, `tests/micro-specs/returning-qr-redirect.test.ts`, `tests/micro-specs/customer-legal-sheets.test.ts` |
| `MS-CUSTOMER-QR-RESOLVER-JOIN-005` | WHEN a customer accepts loyalty terms and completes identity verification, THE system SHALL create or reuse their customer profile and merchant membership.                              | `tests/micro-specs/customer.test.ts`, `tests/micro-specs/customer-phone-auth.test.ts`, `tests/micro-specs/returning-qr-redirect.test.ts`, `tests/micro-specs/customer-legal-sheets.test.ts` |
| `MS-CUSTOMER-QR-RESOLVER-JOIN-006` | WHEN the marketing opt-in checkbox is not selected, THE system SHALL create no opted-in marketing consent.                                                                               | `tests/micro-specs/customer.test.ts`, `tests/micro-specs/customer-phone-auth.test.ts`, `tests/micro-specs/returning-qr-redirect.test.ts`, `tests/micro-specs/customer-legal-sheets.test.ts` |
| `MS-CUSTOMER-QR-RESOLVER-JOIN-007` | WHEN marketing opt-in is selected, THE system SHALL record consent with source and policy version.                                                                                       | `tests/micro-specs/customer.test.ts`, `tests/micro-specs/customer-phone-auth.test.ts`, `tests/micro-specs/returning-qr-redirect.test.ts`, `tests/micro-specs/customer-legal-sheets.test.ts` |
| `MS-CUSTOMER-QR-RESOLVER-JOIN-008` | WHEN a returning member scans the same merchant QR, THE app SHALL take them to their existing card instead of creating a duplicate membership.                                           | `tests/micro-specs/customer.test.ts`, `tests/micro-specs/customer-phone-auth.test.ts`, `tests/micro-specs/returning-qr-redirect.test.ts`, `tests/micro-specs/customer-legal-sheets.test.ts` |

## MS-FOUNDATION-PROJECT-SHELL-ENVIRONMENTS — Project Shell and Environments

| Field         | Value                                                                                                                                                                       |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status        | `active`                                                                                                                                                                    |
| Risk class    | `auth-session`                                                                                                                                                              |
| Owner         | `factory-droid`                                                                                                                                                             |
| Last reviewed | `2026-06-15`                                                                                                                                                                |
| Source        | `micro-specs/01-foundation/01-project-shell-and-environments.md`                                                                                                            |
| Tests         | `tests/micro-specs/foundation.test.ts`, `tests/micro-specs/vercel-env-guard.test.ts`, `tests/micro-specs/health-endpoint.test.ts`, `tests/micro-specs/full-app-pwa.test.ts` |
| Gates         | `pnpm governance`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm security:verify`, `pnpm build`                                                                         |

Allowed blast radius:

- `app/**`
- `components/**`
- `config/**`
- `docs/**`
- `lib/env/**`
- `lib/supabase/**`
- `micro-specs/01-foundation/01-project-shell-and-environments.md`
- `micro-specs/TRACEABILITY.md`
- `micro-specs/traceability.json`

Implementation surfaces:

- `app/**`
- `components/**`
- `lib/env/**`
- `lib/supabase/**`
- `config/**`
- `docs/**`

Status evidence:

- Reviewed against docs/PROJECT_SPEC.md and docs/ARCHITECTURE.md on 2026-06-15.
- Related tests were inspected and mapped before status classification.
- No superseding Micro-Spec replaces this current intent.

### Requirements

| Requirement ID                                 | Summary                                                                                                                                     | Evidence                                                                                                                                                                    |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MS-FOUNDATION-PROJECT-SHELL-ENVIRONMENTS-001` | WHEN a developer runs the local app with valid environment variables, THE app SHALL start without setup-specific runtime errors.            | `tests/micro-specs/foundation.test.ts`, `tests/micro-specs/vercel-env-guard.test.ts`, `tests/micro-specs/health-endpoint.test.ts`, `tests/micro-specs/full-app-pwa.test.ts` |
| `MS-FOUNDATION-PROJECT-SHELL-ENVIRONMENTS-002` | WHEN a required server-only secret is missing, THE app SHALL fail with a clear configuration error before a sensitive workflow is used.     | `tests/micro-specs/foundation.test.ts`, `tests/micro-specs/vercel-env-guard.test.ts`, `tests/micro-specs/health-endpoint.test.ts`, `tests/micro-specs/full-app-pwa.test.ts` |
| `MS-FOUNDATION-PROJECT-SHELL-ENVIRONMENTS-003` | WHEN client code is bundled, THE bundle SHALL not include service-role or webhook secrets.                                                  | `tests/micro-specs/foundation.test.ts`, `tests/micro-specs/vercel-env-guard.test.ts`, `tests/micro-specs/health-endpoint.test.ts`, `tests/micro-specs/full-app-pwa.test.ts` |
| `MS-FOUNDATION-PROJECT-SHELL-ENVIRONMENTS-004` | WHEN the app is deployed to Vercel, THE configured route families SHALL be compatible with the App Router structure.                        | `tests/micro-specs/foundation.test.ts`, `tests/micro-specs/vercel-env-guard.test.ts`, `tests/micro-specs/health-endpoint.test.ts`, `tests/micro-specs/full-app-pwa.test.ts` |
| `MS-FOUNDATION-PROJECT-SHELL-ENVIRONMENTS-005` | WHEN setup documentation is followed, THE developer SHALL know which variables are required for local development, preview, and production. | `tests/micro-specs/foundation.test.ts`, `tests/micro-specs/vercel-env-guard.test.ts`, `tests/micro-specs/health-endpoint.test.ts`, `tests/micro-specs/full-app-pwa.test.ts` |

## MS-FOUNDATION-SUPABASE-SCHEMA-RLS-AUDIT — Supabase Schema, RLS, and Audit Backbone

| Field         | Value                                                                                                                                                                                                                                             |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status        | `active`                                                                                                                                                                                                                                          |
| Risk class    | `migrations`                                                                                                                                                                                                                                      |
| Owner         | `factory-droid`                                                                                                                                                                                                                                   |
| Last reviewed | `2026-06-15`                                                                                                                                                                                                                                      |
| Source        | `micro-specs/01-foundation/02-supabase-schema-rls-and-audit.md`                                                                                                                                                                                   |
| Tests         | `tests/micro-specs/foundation.test.ts`, `manual:billing/admin micro-spec Vitest evidence in retained legacy filename`, `tests/micro-specs/customer.test.ts`, `supabase/tests/tenant_isolation.sql`, `supabase/tests/reward_redemption_cycles.sql` |
| Gates         | `pnpm governance`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm db:verify`, `pnpm security:verify`                                                                                                                                           |

Allowed blast radius:

- `lib/**/*.ts`
- `lib/supabase/**`
- `micro-specs/01-foundation/02-supabase-schema-rls-and-audit.md`
- `micro-specs/TRACEABILITY.md`
- `micro-specs/traceability.json`
- `supabase/migrations/**`
- `supabase/tests/**`

Implementation surfaces:

- `supabase/migrations/**`
- `supabase/tests/**`
- `lib/supabase/**`
- `lib/**/*.ts`

Status evidence:

- Reviewed against docs/PROJECT_SPEC.md and docs/ARCHITECTURE.md on 2026-06-15.
- Related tests were inspected and mapped before status classification.
- No superseding Micro-Spec replaces this current intent.

### Requirements

| Requirement ID                                | Summary                                                                                                                                | Evidence                                                                                                                                                                                                                                          |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MS-FOUNDATION-SUPABASE-SCHEMA-RLS-AUDIT-001` | WHEN a merchant owner queries merchant data, THE database SHALL return only records for that merchant.                                 | `tests/micro-specs/foundation.test.ts`, `manual:billing/admin micro-spec Vitest evidence in retained legacy filename`, `tests/micro-specs/customer.test.ts`, `supabase/tests/tenant_isolation.sql`, `supabase/tests/reward_redemption_cycles.sql` |
| `MS-FOUNDATION-SUPABASE-SCHEMA-RLS-AUDIT-002` | WHEN a customer views loyalty data, THE database SHALL return only their own customer profile, memberships, stamps, and rewards.       | `tests/micro-specs/foundation.test.ts`, `manual:billing/admin micro-spec Vitest evidence in retained legacy filename`, `tests/micro-specs/customer.test.ts`, `supabase/tests/tenant_isolation.sql`, `supabase/tests/reward_redemption_cycles.sql` |
| `MS-FOUNDATION-SUPABASE-SCHEMA-RLS-AUDIT-003` | WHEN an internal admin performs a support action, THE system SHALL write an audit log.                                                 | `tests/micro-specs/foundation.test.ts`, `manual:billing/admin micro-spec Vitest evidence in retained legacy filename`, `tests/micro-specs/customer.test.ts`, `supabase/tests/tenant_isolation.sql`, `supabase/tests/reward_redemption_cycles.sql` |
| `MS-FOUNDATION-SUPABASE-SCHEMA-RLS-AUDIT-004` | WHEN a billing, stamp, reward, consent, QR, or admin mutation succeeds, THE system SHALL write the appropriate audit or product event. | `tests/micro-specs/foundation.test.ts`, `manual:billing/admin micro-spec Vitest evidence in retained legacy filename`, `tests/micro-specs/customer.test.ts`, `supabase/tests/tenant_isolation.sql`, `supabase/tests/reward_redemption_cycles.sql` |
| `MS-FOUNDATION-SUPABASE-SCHEMA-RLS-AUDIT-005` | WHEN unauthenticated users access protected tables directly, THE database SHALL deny access.                                           | `tests/micro-specs/foundation.test.ts`, `manual:billing/admin micro-spec Vitest evidence in retained legacy filename`, `tests/micro-specs/customer.test.ts`, `supabase/tests/tenant_isolation.sql`, `supabase/tests/reward_redemption_cycles.sql` |

## MS-MERCHANT-AUTH-ONBOARDING-BUSINESS-PROFILE — Merchant Auth, Onboarding, and Business Profile

| Field         | Value                                                                                                                                           |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Status        | `active`                                                                                                                                        |
| Risk class    | `auth-session`                                                                                                                                  |
| Owner         | `factory-droid`                                                                                                                                 |
| Last reviewed | `2026-06-15`                                                                                                                                    |
| Source        | `micro-specs/02-merchant/01-merchant-auth-onboarding-and-business-profile.md`                                                                   |
| Tests         | `tests/micro-specs/marketing-auth-legal.test.ts`, `tests/micro-specs/merchant-launch-readiness.test.ts`, `tests/micro-specs/foundation.test.ts` |
| Gates         | `pnpm governance`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm security:verify`, `pnpm build`                                             |

Allowed blast radius:

- `app/(auth)/**`
- `app/app/onboarding/**`
- `app/auth/**`
- `lib/auth/**`
- `lib/merchant/onboarding.ts`
- `micro-specs/02-merchant/01-merchant-auth-onboarding-and-business-profile.md`
- `micro-specs/TRACEABILITY.md`
- `micro-specs/traceability.json`

Implementation surfaces:

- `app/(auth)/**`
- `app/auth/**`
- `app/app/onboarding/**`
- `lib/auth/**`
- `lib/merchant/onboarding.ts`

Status evidence:

- Reviewed against docs/PROJECT_SPEC.md and docs/ARCHITECTURE.md on 2026-06-15.
- Related tests were inspected and mapped before status classification.
- No superseding Micro-Spec replaces this current intent.

### Requirements

| Requirement ID                                     | Summary                                                                                                                                                                                  | Evidence                                                                                                                                        |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `MS-MERCHANT-AUTH-ONBOARDING-BUSINESS-PROFILE-001` | WHEN a new merchant signs up successfully, THE system SHALL create or link a merchant owner account.                                                                                     | `tests/micro-specs/marketing-auth-legal.test.ts`, `tests/micro-specs/merchant-launch-readiness.test.ts`, `tests/micro-specs/foundation.test.ts` |
| `MS-MERCHANT-AUTH-ONBOARDING-BUSINESS-PROFILE-002` | WHEN a merchant verifies auth and has no completed profile, THE app SHALL route them to onboarding.                                                                                      | `tests/micro-specs/marketing-auth-legal.test.ts`, `tests/micro-specs/merchant-launch-readiness.test.ts`, `tests/micro-specs/foundation.test.ts` |
| `MS-MERCHANT-AUTH-ONBOARDING-BUSINESS-PROFILE-003` | WHEN the merchant submits required business fields, THE system SHALL create the merchant profile and first location.                                                                     | `tests/micro-specs/marketing-auth-legal.test.ts`, `tests/micro-specs/merchant-launch-readiness.test.ts`, `tests/micro-specs/foundation.test.ts` |
| `MS-MERCHANT-AUTH-ONBOARDING-BUSINESS-PROFILE-004` | WHEN required fields are missing or invalid, THE system SHALL preserve entered values and show field-level errors.                                                                       | `tests/micro-specs/marketing-auth-legal.test.ts`, `tests/micro-specs/merchant-launch-readiness.test.ts`, `tests/micro-specs/foundation.test.ts` |
| `MS-MERCHANT-AUTH-ONBOARDING-BUSINESS-PROFILE-005` | WHEN a merchant has a saved profile but no first location, THE app SHALL route them back to onboarding with saved business fields and SHALL create the missing first location on submit. | `tests/micro-specs/marketing-auth-legal.test.ts`, `tests/micro-specs/merchant-launch-readiness.test.ts`, `tests/micro-specs/foundation.test.ts` |
| `MS-MERCHANT-AUTH-ONBOARDING-BUSINESS-PROFILE-006` | WHEN a merchant returns after completing onboarding, THE app SHALL route them to the dashboard or next incomplete setup step.                                                            | `tests/micro-specs/marketing-auth-legal.test.ts`, `tests/micro-specs/merchant-launch-readiness.test.ts`, `tests/micro-specs/foundation.test.ts` |
| `MS-MERCHANT-AUTH-ONBOARDING-BUSINESS-PROFILE-007` | WHEN onboarding creates or updates merchant records, THE system SHALL record `merchant_signed_up` or equivalent product/audit events.                                                    | `tests/micro-specs/marketing-auth-legal.test.ts`, `tests/micro-specs/merchant-launch-readiness.test.ts`, `tests/micro-specs/foundation.test.ts` |

## MS-MERCHANT-DYNAMIC-QR-GENERATION-DOWNLOADS — Dynamic QR Generation and Downloads

| Field         | Value                                                                                                                                                                               |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status        | `active`                                                                                                                                                                            |
| Risk class    | `rls-rpc-ledger`                                                                                                                                                                    |
| Owner         | `factory-droid`                                                                                                                                                                     |
| Last reviewed | `2026-06-15`                                                                                                                                                                        |
| Source        | `micro-specs/02-merchant/03-dynamic-qr-generation-and-downloads.md`                                                                                                                 |
| Tests         | `tests/micro-specs/merchant-qr.test.ts`, `tests/micro-specs/merchant-qr-mutations.test.ts`, `tests/micro-specs/customer.test.ts`, `tests/micro-specs/self-service-stamping.test.ts` |
| Gates         | `pnpm governance`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm db:verify`, `pnpm security:verify`                                                                             |

Allowed blast radius:

- `app/app/qr/**`
- `app/q/**`
- `lib/merchant/qr-code.ts`
- `lib/qr/**`
- `micro-specs/02-merchant/03-dynamic-qr-generation-and-downloads.md`
- `micro-specs/TRACEABILITY.md`
- `micro-specs/traceability.json`
- `supabase/migrations/**`

Implementation surfaces:

- `app/app/qr/**`
- `app/q/**`
- `lib/merchant/qr-code.ts`
- `lib/qr/**`
- `supabase/migrations/**`

Status evidence:

- Reviewed against docs/PROJECT_SPEC.md and docs/ARCHITECTURE.md on 2026-06-15.
- Related tests were inspected and mapped before status classification.
- No superseding Micro-Spec replaces this current intent.

### Requirements

| Requirement ID                                    | Summary                                                                                                                                                  | Evidence                                                                                                                                                                            |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MS-MERCHANT-DYNAMIC-QR-GENERATION-DOWNLOADS-001` | WHEN a merchant with an active card and at least one active reward pool item opens `/app/qr`, THE app SHALL show their active QR code and shareable URL. | `tests/micro-specs/merchant-qr.test.ts`, `tests/micro-specs/merchant-qr-mutations.test.ts`, `tests/micro-specs/customer.test.ts`, `tests/micro-specs/self-service-stamping.test.ts` |
| `MS-MERCHANT-DYNAMIC-QR-GENERATION-DOWNLOADS-002` | WHEN no active venue join QR exists, THE system SHALL create one or guide the merchant to generate one.                                                  | `tests/micro-specs/merchant-qr.test.ts`, `tests/micro-specs/merchant-qr-mutations.test.ts`, `tests/micro-specs/customer.test.ts`, `tests/micro-specs/self-service-stamping.test.ts` |
| `MS-MERCHANT-DYNAMIC-QR-GENERATION-DOWNLOADS-003` | WHEN an active venue join QR already exists, THE system SHALL reuse it instead of creating a campaign-specific QR.                                       | `tests/micro-specs/merchant-qr.test.ts`, `tests/micro-specs/merchant-qr-mutations.test.ts`, `tests/micro-specs/customer.test.ts`, `tests/micro-specs/self-service-stamping.test.ts` |
| `MS-MERCHANT-DYNAMIC-QR-GENERATION-DOWNLOADS-004` | WHEN no active reward pool item exists, THE system SHALL block QR launch and direct the merchant back to reward setup.                                   | `tests/micro-specs/merchant-qr.test.ts`, `tests/micro-specs/merchant-qr-mutations.test.ts`, `tests/micro-specs/customer.test.ts`, `tests/micro-specs/self-service-stamping.test.ts` |
| `MS-MERCHANT-DYNAMIC-QR-GENERATION-DOWNLOADS-005` | WHEN a merchant downloads a QR asset, THE system SHALL provide a scannable file with the correct `/q/{qr_id}` URL.                                       | `tests/micro-specs/merchant-qr.test.ts`, `tests/micro-specs/merchant-qr-mutations.test.ts`, `tests/micro-specs/customer.test.ts`, `tests/micro-specs/self-service-stamping.test.ts` |
| `MS-MERCHANT-DYNAMIC-QR-GENERATION-DOWNLOADS-006` | WHEN a QR is disabled, THE system SHALL keep historical scan records and SHALL prevent new customer entry through that QR.                               | `tests/micro-specs/merchant-qr.test.ts`, `tests/micro-specs/merchant-qr-mutations.test.ts`, `tests/micro-specs/customer.test.ts`, `tests/micro-specs/self-service-stamping.test.ts` |
| `MS-MERCHANT-DYNAMIC-QR-GENERATION-DOWNLOADS-007` | WHEN a QR is generated or downloaded, THE system SHALL record `qr_created` or `qr_downloaded` product events.                                            | `tests/micro-specs/merchant-qr.test.ts`, `tests/micro-specs/merchant-qr-mutations.test.ts`, `tests/micro-specs/customer.test.ts`, `tests/micro-specs/self-service-stamping.test.ts` |

## MS-MERCHANT-LOYALTY-CARD-BUILDER — Loyalty Card Builder

| Field         | Value                                                                                                                                                                                                    |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status        | `active`                                                                                                                                                                                                 |
| Risk class    | `rls-rpc-ledger`                                                                                                                                                                                         |
| Owner         | `factory-droid`                                                                                                                                                                                          |
| Last reviewed | `2026-06-15`                                                                                                                                                                                             |
| Source        | `micro-specs/02-merchant/02-loyalty-card-builder.md`                                                                                                                                                     |
| Tests         | `tests/micro-specs/merchant-launch-readiness.test.ts`, `tests/micro-specs/merchant-qr.test.ts`, `tests/micro-specs/merchant-qr-mutations.test.ts`, `tests/micro-specs/analytics-dashboard-pilot.test.ts` |
| Gates         | `pnpm governance`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm db:verify`, `pnpm security:verify`                                                                                                  |

Allowed blast radius:

- `app/app/card/**`
- `app/app/launch/**`
- `components/loyalty/**`
- `lib/merchant/loyalty-card.ts`
- `micro-specs/02-merchant/02-loyalty-card-builder.md`
- `micro-specs/TRACEABILITY.md`
- `micro-specs/traceability.json`
- `supabase/migrations/**`

Implementation surfaces:

- `app/app/card/**`
- `app/app/launch/**`
- `lib/merchant/loyalty-card.ts`
- `supabase/migrations/**`
- `components/loyalty/**`

Status evidence:

- Reviewed against docs/PROJECT_SPEC.md and docs/ARCHITECTURE.md on 2026-06-15.
- Related tests were inspected and mapped before status classification.
- No superseding Micro-Spec replaces this current intent.

### Requirements

| Requirement ID                         | Summary                                                                                                                                                       | Evidence                                                                                                                                                                                                 |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MS-MERCHANT-LOYALTY-CARD-BUILDER-001` | WHEN a merchant opens `/app/card` without a card, THE app SHALL present a default 3-visit Mystery Visit Card setup.                                           | `tests/micro-specs/merchant-launch-readiness.test.ts`, `tests/micro-specs/merchant-qr.test.ts`, `tests/micro-specs/merchant-qr-mutations.test.ts`, `tests/micro-specs/analytics-dashboard-pilot.test.ts` |
| `MS-MERCHANT-LOYALTY-CARD-BUILDER-002` | WHEN a merchant saves a valid card, THE system SHALL persist the card against their merchant and MVP location.                                                | `tests/micro-specs/merchant-launch-readiness.test.ts`, `tests/micro-specs/merchant-qr.test.ts`, `tests/micro-specs/merchant-qr-mutations.test.ts`, `tests/micro-specs/analytics-dashboard-pilot.test.ts` |
| `MS-MERCHANT-LOYALTY-CARD-BUILDER-003` | WHEN a merchant saves a valid reward pool item, THE system SHALL persist it against the same merchant, location, and loyalty card.                            | `tests/micro-specs/merchant-launch-readiness.test.ts`, `tests/micro-specs/merchant-qr.test.ts`, `tests/micro-specs/merchant-qr-mutations.test.ts`, `tests/micro-specs/analytics-dashboard-pilot.test.ts` |
| `MS-MERCHANT-LOYALTY-CARD-BUILDER-004` | WHEN a merchant tries to save invalid values, THE system SHALL reject the save and explain the invalid fields.                                                | `tests/micro-specs/merchant-launch-readiness.test.ts`, `tests/micro-specs/merchant-qr.test.ts`, `tests/micro-specs/merchant-qr-mutations.test.ts`, `tests/micro-specs/analytics-dashboard-pilot.test.ts` |
| `MS-MERCHANT-LOYALTY-CARD-BUILDER-005` | WHEN a merchant already has one active MVP card, THE system SHALL not create a second active card.                                                            | `tests/micro-specs/merchant-launch-readiness.test.ts`, `tests/micro-specs/merchant-qr.test.ts`, `tests/micro-specs/merchant-qr-mutations.test.ts`, `tests/micro-specs/analytics-dashboard-pilot.test.ts` |
| `MS-MERCHANT-LOYALTY-CARD-BUILDER-006` | WHEN a reward pool item has already been assigned to a customer reward, THE system SHALL archive it instead of hard-deleting the historical reward reference. | `tests/micro-specs/merchant-launch-readiness.test.ts`, `tests/micro-specs/merchant-qr.test.ts`, `tests/micro-specs/merchant-qr-mutations.test.ts`, `tests/micro-specs/analytics-dashboard-pilot.test.ts` |
| `MS-MERCHANT-LOYALTY-CARD-BUILDER-007` | WHEN a card is inactive, THE QR resolver and stamp issuing flows SHALL not permit new stamp claims for that card.                                             | `tests/micro-specs/merchant-launch-readiness.test.ts`, `tests/micro-specs/merchant-qr.test.ts`, `tests/micro-specs/merchant-qr-mutations.test.ts`, `tests/micro-specs/analytics-dashboard-pilot.test.ts` |
| `MS-MERCHANT-LOYALTY-CARD-BUILDER-008` | WHEN a card is created or changed, THE system SHALL write an audit log and a `loyalty_card_created` or equivalent product event.                              | `tests/micro-specs/merchant-launch-readiness.test.ts`, `tests/micro-specs/merchant-qr.test.ts`, `tests/micro-specs/merchant-qr-mutations.test.ts`, `tests/micro-specs/analytics-dashboard-pilot.test.ts` |

## MS-MERCHANT-VALUE-CONSOLE-TRUST-IA-CLEANUP — Merchant Console Trust and IA Cleanup

| Field         | Value                                                                                 |
| ------------- | ------------------------------------------------------------------------------------- |
| Status        | `active`                                                                              |
| Risk class    | `customer-pii`                                                                        |
| Owner         | `factory-droid`                                                                       |
| Last reviewed | `2026-06-15`                                                                          |
| Source        | `micro-specs/05-merchant-value/02-merchant-console-trust-and-ia-cleanup.md`           |
| Tests         | `tests/micro-specs/merchant-console-trust-ia.test.ts`                                 |
| Gates         | `pnpm governance`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm security:verify` |

Allowed blast radius:

- `app/app/**`
- `components/layout/merchant-app-shell.tsx`
- `components/merchant/**`
- `lib/merchant/**`
- `micro-specs/05-merchant-value/02-merchant-console-trust-and-ia-cleanup.md`
- `micro-specs/TRACEABILITY.md`
- `micro-specs/traceability.json`

Implementation surfaces:

- `app/app/**`
- `components/layout/merchant-app-shell.tsx`
- `components/merchant/**`
- `lib/merchant/**`

Status evidence:

- Reviewed against docs/PROJECT_SPEC.md and docs/ARCHITECTURE.md on 2026-06-15.
- Related tests were inspected and mapped before status classification.
- No superseding Micro-Spec replaces this current intent.

### Requirements

| Requirement ID                                   | Summary                                                                                                                                                                   | Evidence                                              |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `MS-MERCHANT-VALUE-CONSOLE-TRUST-IA-CLEANUP-001` | WHEN merchant navigation renders, THE system SHALL include `/app/activity` in primary navigation.                                                                         | `tests/micro-specs/merchant-console-trust-ia.test.ts` |
| `MS-MERCHANT-VALUE-CONSOLE-TRUST-IA-CLEANUP-002` | WHEN account navigation renders, THE system SHALL label `/app/settings` as `Settings`.                                                                                    | `tests/micro-specs/merchant-console-trust-ia.test.ts` |
| `MS-MERCHANT-VALUE-CONSOLE-TRUST-IA-CLEANUP-003` | WHEN a merchant customer readback has an email, THE system SHALL display a masked email identifier and SHALL NOT display the raw email address.                           | `tests/micro-specs/merchant-console-trust-ia.test.ts` |
| `MS-MERCHANT-VALUE-CONSOLE-TRUST-IA-CLEANUP-004` | WHEN a merchant customer readback has only a phone number, THE system SHALL display only the last four digits and SHALL NOT display the raw phone number.                 | `tests/micro-specs/merchant-console-trust-ia.test.ts` |
| `MS-MERCHANT-VALUE-CONSOLE-TRUST-IA-CLEANUP-005` | WHEN merchant activity rows are built, THE system SHALL use the same masked customer identifier in headlines, actor details, and search text.                             | `tests/micro-specs/merchant-console-trust-ia.test.ts` |
| `MS-MERCHANT-VALUE-CONSOLE-TRUST-IA-CLEANUP-006` | WHEN merchant activity search text is built, THE system SHALL NOT include raw email addresses or full phone numbers from customer identity data.                          | `tests/micro-specs/merchant-console-trust-ia.test.ts` |
| `MS-MERCHANT-VALUE-CONSOLE-TRUST-IA-CLEANUP-007` | WHEN dashboard billing status is `active` or `trialing`, THE dashboard SHALL omit the billing notice and SHALL NOT render billing status as a KPI tile.                   | `tests/micro-specs/merchant-console-trust-ia.test.ts` |
| `MS-MERCHANT-VALUE-CONSOLE-TRUST-IA-CLEANUP-008` | WHEN dashboard billing status is `not_started`, `past_due`, `cancelled`, `suspended`, or unknown, THE dashboard SHALL render an action-oriented billing notice.           | `tests/micro-specs/merchant-console-trust-ia.test.ts` |
| `MS-MERCHANT-VALUE-CONSOLE-TRUST-IA-CLEANUP-009` | WHEN billing status copy is rendered on `/app` or `/app/billing`, THE system SHALL use one shared status-copy model.                                                      | `tests/micro-specs/merchant-console-trust-ia.test.ts` |
| `MS-MERCHANT-VALUE-CONSOLE-TRUST-IA-CLEANUP-010` | WHEN dashboard data loads, THE system SHALL NOT fetch recent activity inside `getMerchantDashboardData` because the dashboard already loads enriched activity separately. | `tests/micro-specs/merchant-console-trust-ia.test.ts` |

## MS-MERCHANT-VALUE-DASHBOARD-ACTIVITY-ROI — Merchant Dashboard, Activity, and ROI

| Field         | Value                                                                                                                                                                                                                   |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status        | `active`                                                                                                                                                                                                                |
| Risk class    | `product-analytics`                                                                                                                                                                                                     |
| Owner         | `factory-droid`                                                                                                                                                                                                         |
| Last reviewed | `2026-06-15`                                                                                                                                                                                                            |
| Source        | `micro-specs/05-merchant-value/01-merchant-dashboard-activity-and-roi.md`                                                                                                                                               |
| Tests         | `tests/micro-specs/analytics-dashboard-pilot.test.ts`, `tests/micro-specs/perf-rpc-consolidation.test.ts`, `tests/micro-specs/merchant-console-trust-ia.test.ts`, `tests/micro-specs/merchant-launch-readiness.test.ts` |
| Gates         | `pnpm governance`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:coverage`                                                                                                                                     |

Allowed blast radius:

- `app/app/**`
- `components/merchant/**`
- `lib/admin/pilot-report*.ts`
- `lib/merchant/activity.ts`
- `lib/merchant/dashboard.ts`
- `micro-specs/05-merchant-value/01-merchant-dashboard-activity-and-roi.md`
- `micro-specs/TRACEABILITY.md`
- `micro-specs/traceability.json`

Implementation surfaces:

- `app/app/**`
- `components/merchant/**`
- `lib/merchant/dashboard.ts`
- `lib/merchant/activity.ts`
- `lib/admin/pilot-report*.ts`

Status evidence:

- Reviewed against docs/PROJECT_SPEC.md and docs/ARCHITECTURE.md on 2026-06-15.
- Related tests were inspected and mapped before status classification.
- No superseding Micro-Spec replaces this current intent.

### Requirements

| Requirement ID                                 | Summary                                                                                                                           | Evidence                                                                                                                                                                                                                |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MS-MERCHANT-VALUE-DASHBOARD-ACTIVITY-ROI-001` | WHEN a merchant opens `/app`, THE dashboard SHALL show current MVP metrics for only their merchant.                               | `tests/micro-specs/analytics-dashboard-pilot.test.ts`, `tests/micro-specs/perf-rpc-consolidation.test.ts`, `tests/micro-specs/merchant-console-trust-ia.test.ts`, `tests/micro-specs/merchant-launch-readiness.test.ts` |
| `MS-MERCHANT-VALUE-DASHBOARD-ACTIVITY-ROI-002` | WHEN no customers have joined, THE dashboard SHALL show useful zero states and QR launch prompts.                                 | `tests/micro-specs/analytics-dashboard-pilot.test.ts`, `tests/micro-specs/perf-rpc-consolidation.test.ts`, `tests/micro-specs/merchant-console-trust-ia.test.ts`, `tests/micro-specs/merchant-launch-readiness.test.ts` |
| `MS-MERCHANT-VALUE-DASHBOARD-ACTIVITY-ROI-003` | WHEN stamps or rewards are recorded, THE dashboard SHALL reflect updated totals after refresh.                                    | `tests/micro-specs/analytics-dashboard-pilot.test.ts`, `tests/micro-specs/perf-rpc-consolidation.test.ts`, `tests/micro-specs/merchant-console-trust-ia.test.ts`, `tests/micro-specs/merchant-launch-readiness.test.ts` |
| `MS-MERCHANT-VALUE-DASHBOARD-ACTIVITY-ROI-004` | WHEN a merchant sets average order value, THE ROI estimate SHALL update and remain labelled as estimated.                         | `tests/micro-specs/analytics-dashboard-pilot.test.ts`, `tests/micro-specs/perf-rpc-consolidation.test.ts`, `tests/micro-specs/merchant-console-trust-ia.test.ts`, `tests/micro-specs/merchant-launch-readiness.test.ts` |
| `MS-MERCHANT-VALUE-DASHBOARD-ACTIVITY-ROI-005` | WHEN the billing status is past_due, cancelled, or suspended, THE dashboard SHALL surface the correct warning or disabled state.  | `tests/micro-specs/analytics-dashboard-pilot.test.ts`, `tests/micro-specs/perf-rpc-consolidation.test.ts`, `tests/micro-specs/merchant-console-trust-ia.test.ts`, `tests/micro-specs/merchant-launch-readiness.test.ts` |
| `MS-MERCHANT-VALUE-DASHBOARD-ACTIVITY-ROI-006` | WHEN a merchant views activity, THE feed SHALL list recent stamps, redemptions, joins, and QR downloads with readable timestamps. | `tests/micro-specs/analytics-dashboard-pilot.test.ts`, `tests/micro-specs/perf-rpc-consolidation.test.ts`, `tests/micro-specs/merchant-console-trust-ia.test.ts`, `tests/micro-specs/merchant-launch-readiness.test.ts` |

## MS-MVP-SCOPE-RELEASE-GATES — MVP Scope and Release Gates

| Field         | Value                                                                                                                                                                                                                         |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status        | `active`                                                                                                                                                                                                                      |
| Risk class    | `docs-tooling`                                                                                                                                                                                                                |
| Owner         | `factory-droid`                                                                                                                                                                                                               |
| Last reviewed | `2026-06-15`                                                                                                                                                                                                                  |
| Source        | `micro-specs/00-mvp-scope/01-scope-and-release-gates.md`                                                                                                                                                                      |
| Tests         | `tests/micro-specs/analytics-dashboard-pilot.test.ts`, `tests/micro-specs/customer.test.ts`, `tests/micro-specs/self-service-stamping.test.ts`, `manual:billing/admin micro-spec Vitest evidence in retained legacy filename` |
| Gates         | `pnpm governance`, `pnpm lint`, `pnpm typecheck`, `pnpm test`                                                                                                                                                                 |

Allowed blast radius:

- `docs/ARCHITECTURE.md`
- `docs/PROJECT_SPEC.md`
- `micro-specs/**`
- `micro-specs/00-mvp-scope/01-scope-and-release-gates.md`
- `micro-specs/TRACEABILITY.md`
- `micro-specs/traceability.json`

Implementation surfaces:

- `micro-specs/**`
- `docs/PROJECT_SPEC.md`
- `docs/ARCHITECTURE.md`

Status evidence:

- Reviewed against docs/PROJECT_SPEC.md and docs/ARCHITECTURE.md on 2026-06-15.
- Related tests were inspected and mapped before status classification.
- No superseding Micro-Spec replaces this current intent.

### Requirements

| Requirement ID                   | Summary                                                                                                                                                         | Evidence                                                                                                                                                                                                                      |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MS-MVP-SCOPE-RELEASE-GATES-001` | WHEN an implementation agent proposes a feature outside the MVP boundary, THE product plan SHALL reject it unless a new approved micro-spec explicitly adds it. | `tests/micro-specs/analytics-dashboard-pilot.test.ts`, `tests/micro-specs/customer.test.ts`, `tests/micro-specs/self-service-stamping.test.ts`, `manual:billing/admin micro-spec Vitest evidence in retained legacy filename` |
| `MS-MVP-SCOPE-RELEASE-GATES-002` | WHEN a merchant completes onboarding, THE system SHALL support one active location and one active loyalty card for MVP.                                         | `tests/micro-specs/analytics-dashboard-pilot.test.ts`, `tests/micro-specs/customer.test.ts`, `tests/micro-specs/self-service-stamping.test.ts`, `manual:billing/admin micro-spec Vitest evidence in retained legacy filename` |
| `MS-MVP-SCOPE-RELEASE-GATES-003` | WHEN a customer joins a card, THE system SHALL not require a mobile app download.                                                                               | `tests/micro-specs/analytics-dashboard-pilot.test.ts`, `tests/micro-specs/customer.test.ts`, `tests/micro-specs/self-service-stamping.test.ts`, `manual:billing/admin micro-spec Vitest evidence in retained legacy filename` |
| `MS-MVP-SCOPE-RELEASE-GATES-004` | WHEN customers add stamps, THE system SHALL require a valid venue QR context, enforce one earned stamp per membership/location/UK date, and record the action.  | `tests/micro-specs/analytics-dashboard-pilot.test.ts`, `tests/micro-specs/customer.test.ts`, `tests/micro-specs/self-service-stamping.test.ts`, `manual:billing/admin micro-spec Vitest evidence in retained legacy filename` |
| `MS-MVP-SCOPE-RELEASE-GATES-005` | WHEN the third visit stamp is issued, THE system SHALL assign exactly one active reward pool item and persist the assigned reward details.                      | `tests/micro-specs/analytics-dashboard-pilot.test.ts`, `tests/micro-specs/customer.test.ts`, `tests/micro-specs/self-service-stamping.test.ts`, `manual:billing/admin micro-spec Vitest evidence in retained legacy filename` |
| `MS-MVP-SCOPE-RELEASE-GATES-006` | WHEN a reward is revealed, THE system SHALL block redemption until the next UK business day.                                                                    | `tests/micro-specs/analytics-dashboard-pilot.test.ts`, `tests/micro-specs/customer.test.ts`, `tests/micro-specs/self-service-stamping.test.ts`, `manual:billing/admin micro-spec Vitest evidence in retained legacy filename` |
| `MS-MVP-SCOPE-RELEASE-GATES-007` | WHEN the MVP is evaluated for pilot readiness, THE project SHALL check every release gate in this spec.                                                         | `tests/micro-specs/analytics-dashboard-pilot.test.ts`, `tests/micro-specs/customer.test.ts`, `tests/micro-specs/self-service-stamping.test.ts`, `manual:billing/admin micro-spec Vitest evidence in retained legacy filename` |

## MS-OBSERVABILITY-COMPLIANCE-CONSENT-LEGAL-DATA-REQUESTS — Consent, Legal Pages, and Data Requests

| Field         | Value                                                                                                                                                                                                                                  |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status        | `active`                                                                                                                                                                                                                               |
| Risk class    | `customer-pii`                                                                                                                                                                                                                         |
| Owner         | `factory-droid`                                                                                                                                                                                                                        |
| Last reviewed | `2026-06-15`                                                                                                                                                                                                                           |
| Source        | `micro-specs/07-observability-compliance/02-consent-legal-pages-and-data-requests.md`                                                                                                                                                  |
| Tests         | `tests/micro-specs/customer.test.ts`, `tests/micro-specs/home-profile.test.ts`, `tests/micro-specs/customer-legal-sheets.test.ts`, `supabase/tests/customer_marketing_consent.sql`, `tests/micro-specs/admin-console-redesign.test.ts` |
| Gates         | `pnpm governance`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm security:verify`                                                                                                                                                  |

Allowed blast radius:

- `app/admin/privacy/**`
- `app/merchant/**`
- `app/privacy/**`
- `app/terms/**`
- `lib/customer/consent.ts`
- `lib/legal/**`
- `micro-specs/07-observability-compliance/02-consent-legal-pages-and-data-requests.md`
- `micro-specs/TRACEABILITY.md`
- `micro-specs/traceability.json`
- `supabase/migrations/**`

Implementation surfaces:

- `app/privacy/**`
- `app/terms/**`
- `app/merchant/**`
- `app/admin/privacy/**`
- `lib/customer/consent.ts`
- `lib/legal/**`
- `supabase/migrations/**`

Status evidence:

- Reviewed against docs/PROJECT_SPEC.md and docs/ARCHITECTURE.md on 2026-06-15.
- Related tests were inspected and mapped before status classification.
- No superseding Micro-Spec replaces this current intent.

### Requirements

| Requirement ID                                                | Summary                                                                                                                                          | Evidence                                                                                                                                                                                                                               |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MS-OBSERVABILITY-COMPLIANCE-CONSENT-LEGAL-DATA-REQUESTS-001` | WHEN a customer joins a loyalty card, THE system SHALL request loyalty terms acceptance separately from marketing opt-in.                        | `tests/micro-specs/customer.test.ts`, `tests/micro-specs/home-profile.test.ts`, `tests/micro-specs/customer-legal-sheets.test.ts`, `supabase/tests/customer_marketing_consent.sql`, `tests/micro-specs/admin-console-redesign.test.ts` |
| `MS-OBSERVABILITY-COMPLIANCE-CONSENT-LEGAL-DATA-REQUESTS-002` | WHEN marketing opt-in is not selected, THE system SHALL not treat loyalty participation as marketing consent.                                    | `tests/micro-specs/customer.test.ts`, `tests/micro-specs/home-profile.test.ts`, `tests/micro-specs/customer-legal-sheets.test.ts`, `supabase/tests/customer_marketing_consent.sql`, `tests/micro-specs/admin-console-redesign.test.ts` |
| `MS-OBSERVABILITY-COMPLIANCE-CONSENT-LEGAL-DATA-REQUESTS-003` | WHEN marketing opt-in is selected, THE system SHALL record consent status, channel, source, merchant, customer, policy version, and timestamp.   | `tests/micro-specs/customer.test.ts`, `tests/micro-specs/home-profile.test.ts`, `tests/micro-specs/customer-legal-sheets.test.ts`, `supabase/tests/customer_marketing_consent.sql`, `tests/micro-specs/admin-console-redesign.test.ts` |
| `MS-OBSERVABILITY-COMPLIANCE-CONSENT-LEGAL-DATA-REQUESTS-004` | WHEN a customer opts out later through a supported path, THE system SHALL record the opt-out without deleting historical consent evidence.       | `tests/micro-specs/customer.test.ts`, `tests/micro-specs/home-profile.test.ts`, `tests/micro-specs/customer-legal-sheets.test.ts`, `supabase/tests/customer_marketing_consent.sql`, `tests/micro-specs/admin-console-redesign.test.ts` |
| `MS-OBSERVABILITY-COMPLIANCE-CONSENT-LEGAL-DATA-REQUESTS-005` | WHEN a merchant has reward terms, THE customer-facing pages SHALL display them before or during participation.                                   | `tests/micro-specs/customer.test.ts`, `tests/micro-specs/home-profile.test.ts`, `tests/micro-specs/customer-legal-sheets.test.ts`, `supabase/tests/customer_marketing_consent.sql`, `tests/micro-specs/admin-console-redesign.test.ts` |
| `MS-OBSERVABILITY-COMPLIANCE-CONSENT-LEGAL-DATA-REQUESTS-006` | WHEN an admin receives a data request, THE admin console SHALL provide enough lookup context to identify relevant customer and merchant records. | `tests/micro-specs/customer.test.ts`, `tests/micro-specs/home-profile.test.ts`, `tests/micro-specs/customer-legal-sheets.test.ts`, `supabase/tests/customer_marketing_consent.sql`, `tests/micro-specs/admin-console-redesign.test.ts` |

## MS-OBSERVABILITY-COMPLIANCE-EVENTS-ANALYTICS-FUNNELS — Events, Analytics, and Funnels

| Field         | Value                                                                                                                                                |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status        | `active`                                                                                                                                             |
| Risk class    | `product-analytics`                                                                                                                                  |
| Owner         | `factory-droid`                                                                                                                                      |
| Last reviewed | `2026-06-15`                                                                                                                                         |
| Source        | `micro-specs/07-observability-compliance/01-events-analytics-and-funnels.md`                                                                         |
| Tests         | `tests/micro-specs/analytics-dashboard-pilot.test.ts`, `tests/micro-specs/observability.test.ts`, `tests/micro-specs/perf-rpc-consolidation.test.ts` |
| Gates         | `pnpm governance`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:coverage`                                                                  |

Allowed blast radius:

- `app/**`
- `lib/admin/pilot-report*.ts`
- `lib/analytics/**`
- `lib/merchant/**`
- `micro-specs/07-observability-compliance/01-events-analytics-and-funnels.md`
- `micro-specs/TRACEABILITY.md`
- `micro-specs/traceability.json`
- `supabase/migrations/**`

Implementation surfaces:

- `lib/analytics/**`
- `lib/merchant/**`
- `lib/admin/pilot-report*.ts`
- `app/**`
- `supabase/migrations/**`

Status evidence:

- Reviewed against docs/PROJECT_SPEC.md and docs/ARCHITECTURE.md on 2026-06-15.
- Related tests were inspected and mapped before status classification.
- No superseding Micro-Spec replaces this current intent.

### Requirements

| Requirement ID                                             | Summary                                                                                                                       | Evidence                                                                                                                                             |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MS-OBSERVABILITY-COMPLIANCE-EVENTS-ANALYTICS-FUNNELS-001` | WHEN a business-critical MVP event occurs, THE system SHALL write a Supabase product event with tenant context and timestamp. | `tests/micro-specs/analytics-dashboard-pilot.test.ts`, `tests/micro-specs/observability.test.ts`, `tests/micro-specs/perf-rpc-consolidation.test.ts` |
| `MS-OBSERVABILITY-COMPLIANCE-EVENTS-ANALYTICS-FUNNELS-002` | WHEN a funnel-relevant action occurs, THE system SHALL send a corresponding PostHog event where configured.                   | `tests/micro-specs/analytics-dashboard-pilot.test.ts`, `tests/micro-specs/observability.test.ts`, `tests/micro-specs/perf-rpc-consolidation.test.ts` |
| `MS-OBSERVABILITY-COMPLIANCE-EVENTS-ANALYTICS-FUNNELS-003` | WHEN PostHog is unavailable, THE source-of-truth Supabase event write SHALL still occur.                                      | `tests/micro-specs/analytics-dashboard-pilot.test.ts`, `tests/micro-specs/observability.test.ts`, `tests/micro-specs/perf-rpc-consolidation.test.ts` |
| `MS-OBSERVABILITY-COMPLIANCE-EVENTS-ANALYTICS-FUNNELS-004` | WHEN events include customer context, THE payload SHALL avoid unnecessary personal data.                                      | `tests/micro-specs/analytics-dashboard-pilot.test.ts`, `tests/micro-specs/observability.test.ts`, `tests/micro-specs/perf-rpc-consolidation.test.ts` |
| `MS-OBSERVABILITY-COMPLIANCE-EVENTS-ANALYTICS-FUNNELS-005` | WHEN a pilot report is generated, THE system SHALL use source-of-truth events for core counts.                                | `tests/micro-specs/analytics-dashboard-pilot.test.ts`, `tests/micro-specs/observability.test.ts`, `tests/micro-specs/perf-rpc-consolidation.test.ts` |

## MS-OBSERVABILITY-COMPLIANCE-SECURITY-FRAUD-RATE-LIMITS — Security, Fraud, and Rate Limits

| Field         | Value                                                                                                                                                                                                                                                                                                            |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status        | `active`                                                                                                                                                                                                                                                                                                         |
| Risk class    | `webhooks`                                                                                                                                                                                                                                                                                                       |
| Owner         | `factory-droid`                                                                                                                                                                                                                                                                                                  |
| Last reviewed | `2026-06-15`                                                                                                                                                                                                                                                                                                     |
| Source        | `micro-specs/07-observability-compliance/03-security-fraud-and-rate-limits.md`                                                                                                                                                                                                                                   |
| Tests         | `tests/micro-specs/customer.test.ts`, `tests/micro-specs/self-service-stamping.test.ts`, `manual:billing/admin micro-spec Vitest evidence in retained legacy filename`, `tests/micro-specs/admin-console-redesign.test.ts`, `supabase/tests/tenant_isolation.sql`, `supabase/tests/reward_redemption_cycles.sql` |
| Gates         | `pnpm governance`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm security:verify`, `pnpm db:verify`                                                                                                                                                                                                          |

Allowed blast radius:

- `app/admin/**`
- `app/api/stripe/**`
- `lib/admin/**`
- `lib/customer/**`
- `lib/security/**`
- `micro-specs/07-observability-compliance/03-security-fraud-and-rate-limits.md`
- `micro-specs/TRACEABILITY.md`
- `micro-specs/traceability.json`
- `supabase/migrations/**`
- `supabase/tests/**`

Implementation surfaces:

- `lib/security/**`
- `app/api/stripe/**`
- `app/admin/**`
- `lib/admin/**`
- `lib/customer/**`
- `supabase/migrations/**`
- `supabase/tests/**`

Status evidence:

- Reviewed against docs/PROJECT_SPEC.md and docs/ARCHITECTURE.md on 2026-06-15.
- Related tests were inspected and mapped before status classification.
- No superseding Micro-Spec replaces this current intent.

### Requirements

| Requirement ID                                               | Summary                                                                                                                                        | Evidence                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MS-OBSERVABILITY-COMPLIANCE-SECURITY-FRAUD-RATE-LIMITS-001` | WHEN self-service stamp attempts are repeated too quickly, THE system SHALL rate-limit further attempts.                                       | `tests/micro-specs/customer.test.ts`, `tests/micro-specs/self-service-stamping.test.ts`, `manual:billing/admin micro-spec Vitest evidence in retained legacy filename`, `tests/micro-specs/admin-console-redesign.test.ts`, `supabase/tests/tenant_isolation.sql`, `supabase/tests/reward_redemption_cycles.sql` |
| `MS-OBSERVABILITY-COMPLIANCE-SECURITY-FRAUD-RATE-LIMITS-002` | WHEN QR scans or customer identity requests are rate-limited, THE system SHALL store hashed bucket keys in durable server-side storage.        | `tests/micro-specs/customer.test.ts`, `tests/micro-specs/self-service-stamping.test.ts`, `manual:billing/admin micro-spec Vitest evidence in retained legacy filename`, `tests/micro-specs/admin-console-redesign.test.ts`, `supabase/tests/tenant_isolation.sql`, `supabase/tests/reward_redemption_cycles.sql` |
| `MS-OBSERVABILITY-COMPLIANCE-SECURITY-FRAUD-RATE-LIMITS-003` | WHEN a customer requests multiple stamps inside the cooldown window, THE system SHALL reject duplicates.                                       | `tests/micro-specs/customer.test.ts`, `tests/micro-specs/self-service-stamping.test.ts`, `manual:billing/admin micro-spec Vitest evidence in retained legacy filename`, `tests/micro-specs/admin-console-redesign.test.ts`, `supabase/tests/tenant_isolation.sql`, `supabase/tests/reward_redemption_cycles.sql` |
| `MS-OBSERVABILITY-COMPLIANCE-SECURITY-FRAUD-RATE-LIMITS-004` | WHEN stamp volume is unusually high for a merchant or time window, THE system SHALL create a fraud flag for admin review.                      | `tests/micro-specs/customer.test.ts`, `tests/micro-specs/self-service-stamping.test.ts`, `manual:billing/admin micro-spec Vitest evidence in retained legacy filename`, `tests/micro-specs/admin-console-redesign.test.ts`, `supabase/tests/tenant_isolation.sql`, `supabase/tests/reward_redemption_cycles.sql` |
| `MS-OBSERVABILITY-COMPLIANCE-SECURITY-FRAUD-RATE-LIMITS-005` | WHEN reward redemption is attempted concurrently, THE system SHALL allow at most one successful redemption.                                    | `tests/micro-specs/customer.test.ts`, `tests/micro-specs/self-service-stamping.test.ts`, `manual:billing/admin micro-spec Vitest evidence in retained legacy filename`, `tests/micro-specs/admin-console-redesign.test.ts`, `supabase/tests/tenant_isolation.sql`, `supabase/tests/reward_redemption_cycles.sql` |
| `MS-OBSERVABILITY-COMPLIANCE-SECURITY-FRAUD-RATE-LIMITS-006` | WHEN a QR code is disabled, THE system SHALL block future scan-to-join flows and keep historical scan data.                                    | `tests/micro-specs/customer.test.ts`, `tests/micro-specs/self-service-stamping.test.ts`, `manual:billing/admin micro-spec Vitest evidence in retained legacy filename`, `tests/micro-specs/admin-console-redesign.test.ts`, `supabase/tests/tenant_isolation.sql`, `supabase/tests/reward_redemption_cycles.sql` |
| `MS-OBSERVABILITY-COMPLIANCE-SECURITY-FRAUD-RATE-LIMITS-007` | WHEN admin MFA enforcement is enabled, THE system SHALL require a Supabase AAL2 session before serving internal admin routes or actions.       | `tests/micro-specs/customer.test.ts`, `tests/micro-specs/self-service-stamping.test.ts`, `manual:billing/admin micro-spec Vitest evidence in retained legacy filename`, `tests/micro-specs/admin-console-redesign.test.ts`, `supabase/tests/tenant_isolation.sql`, `supabase/tests/reward_redemption_cycles.sql` |
| `MS-OBSERVABILITY-COMPLIANCE-SECURITY-FRAUD-RATE-LIMITS-008` | WHEN an unauthorised role attempts a privileged action, THE system SHALL deny it and record a security-relevant audit event where appropriate. | `tests/micro-specs/customer.test.ts`, `tests/micro-specs/self-service-stamping.test.ts`, `manual:billing/admin micro-spec Vitest evidence in retained legacy filename`, `tests/micro-specs/admin-console-redesign.test.ts`, `supabase/tests/tenant_isolation.sql`, `supabase/tests/reward_redemption_cycles.sql` |
| `MS-OBSERVABILITY-COMPLIANCE-SECURITY-FRAUD-RATE-LIMITS-009` | WHEN a Stripe webhook signature is invalid, THE system SHALL reject the webhook without mutating billing state.                                | `tests/micro-specs/customer.test.ts`, `tests/micro-specs/self-service-stamping.test.ts`, `manual:billing/admin micro-spec Vitest evidence in retained legacy filename`, `tests/micro-specs/admin-console-redesign.test.ts`, `supabase/tests/tenant_isolation.sql`, `supabase/tests/reward_redemption_cycles.sql` |

## MS-PILOT-READINESS-VALIDATION — Pilot Readiness and Validation

| Field         | Value                                                                                                                                                                                                                                        |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status        | `active`                                                                                                                                                                                                                                     |
| Risk class    | `product-analytics`                                                                                                                                                                                                                          |
| Owner         | `factory-droid`                                                                                                                                                                                                                              |
| Last reviewed | `2026-06-15`                                                                                                                                                                                                                                 |
| Source        | `micro-specs/08-pilot/01-pilot-readiness-and-validation.md`                                                                                                                                                                                  |
| Tests         | `tests/micro-specs/analytics-dashboard-pilot.test.ts`, `tests/micro-specs/perf-rpc-consolidation.test.ts`, `manual:billing/admin micro-spec Vitest evidence in retained legacy filename`, `tests/micro-specs/admin-console-redesign.test.ts` |
| Gates         | `pnpm governance`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:coverage`                                                                                                                                                          |

Allowed blast radius:

- `app/admin/pilot/**`
- `docs/**`
- `lib/admin/pilot-report*.ts`
- `lib/merchant/dashboard*.ts`
- `micro-specs/**`
- `micro-specs/08-pilot/01-pilot-readiness-and-validation.md`
- `micro-specs/TRACEABILITY.md`
- `micro-specs/traceability.json`

Implementation surfaces:

- `app/admin/pilot/**`
- `lib/admin/pilot-report*.ts`
- `lib/merchant/dashboard*.ts`
- `docs/**`
- `micro-specs/**`

Status evidence:

- Reviewed against docs/PROJECT_SPEC.md and docs/ARCHITECTURE.md on 2026-06-15.
- Related tests were inspected and mapped before status classification.
- No superseding Micro-Spec replaces this current intent.

### Requirements

| Requirement ID                      | Summary                                                                                                                                                            | Evidence                                                                                                                                                                                                                                     |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MS-PILOT-READINESS-VALIDATION-001` | WHEN a merchant starts pilot onboarding, THE system SHALL support setup completion in under 5 minutes.                                                             | `tests/micro-specs/analytics-dashboard-pilot.test.ts`, `tests/micro-specs/perf-rpc-consolidation.test.ts`, `manual:billing/admin micro-spec Vitest evidence in retained legacy filename`, `tests/micro-specs/admin-console-redesign.test.ts` |
| `MS-PILOT-READINESS-VALIDATION-002` | WHEN staff are trained, THE instructions SHALL be short enough to complete in under 3 minutes.                                                                     | `tests/micro-specs/analytics-dashboard-pilot.test.ts`, `tests/micro-specs/perf-rpc-consolidation.test.ts`, `manual:billing/admin micro-spec Vitest evidence in retained legacy filename`, `tests/micro-specs/admin-console-redesign.test.ts` |
| `MS-PILOT-READINESS-VALIDATION-003` | WHEN staff training is timed for pilot readiness, THE admin report SHALL store the proof as a structured audited note with a 1-3 minute duration.                  | `tests/micro-specs/analytics-dashboard-pilot.test.ts`, `tests/micro-specs/perf-rpc-consolidation.test.ts`, `manual:billing/admin micro-spec Vitest evidence in retained legacy filename`, `tests/micro-specs/admin-console-redesign.test.ts` |
| `MS-PILOT-READINESS-VALIDATION-004` | WHEN pilot metrics are reviewed, THE report SHALL show launch, scan, join, repeat, redemption, support, and paid-conversion metrics.                               | `tests/micro-specs/analytics-dashboard-pilot.test.ts`, `tests/micro-specs/perf-rpc-consolidation.test.ts`, `manual:billing/admin micro-spec Vitest evidence in retained legacy filename`, `tests/micro-specs/admin-console-redesign.test.ts` |
| `MS-PILOT-READINESS-VALIDATION-005` | WHEN paid pilot proof is reviewed, THE report SHALL count only active-billing merchants that also have source-of-truth launch, join, stamp, and redemption events. | `tests/micro-specs/analytics-dashboard-pilot.test.ts`, `tests/micro-specs/perf-rpc-consolidation.test.ts`, `manual:billing/admin micro-spec Vitest evidence in retained legacy filename`, `tests/micro-specs/admin-console-redesign.test.ts` |
| `MS-PILOT-READINESS-VALIDATION-006` | WHEN a merchant cancels or declines payment, THE team SHALL be able to record cancellation reason or interview notes.                                              | `tests/micro-specs/analytics-dashboard-pilot.test.ts`, `tests/micro-specs/perf-rpc-consolidation.test.ts`, `manual:billing/admin micro-spec Vitest evidence in retained legacy filename`, `tests/micro-specs/admin-console-redesign.test.ts` |
| `MS-PILOT-READINESS-VALIDATION-007` | WHEN reward disputes occur, THE admin console SHALL expose reward, stamp, and audit history needed for support.                                                    | `tests/micro-specs/analytics-dashboard-pilot.test.ts`, `tests/micro-specs/perf-rpc-consolidation.test.ts`, `manual:billing/admin micro-spec Vitest evidence in retained legacy filename`, `tests/micro-specs/admin-console-redesign.test.ts` |
| `MS-PILOT-READINESS-VALIDATION-008` | WHEN pilot results are exported or summarized, THE report SHALL distinguish source-of-truth event counts from estimates and interview notes.                       | `tests/micro-specs/analytics-dashboard-pilot.test.ts`, `tests/micro-specs/perf-rpc-consolidation.test.ts`, `manual:billing/admin micro-spec Vitest evidence in retained legacy filename`, `tests/micro-specs/admin-console-redesign.test.ts` |

## MS-STAFF-REWARDS-REWARD-UNLOCK-REDEMPTION — Reward Unlock and Redemption

| Field         | Value                                                                                                                                                                                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status        | `active`                                                                                                                                                                                                                                                |
| Risk class    | `rls-rpc-ledger`                                                                                                                                                                                                                                        |
| Owner         | `factory-droid`                                                                                                                                                                                                                                         |
| Last reviewed | `2026-06-15`                                                                                                                                                                                                                                            |
| Source        | `micro-specs/04-staff-rewards/02-reward-unlock-and-redemption.md`                                                                                                                                                                                       |
| Tests         | `tests/micro-specs/merchant-scanned-reward.test.ts`, `tests/micro-specs/reward-redemption-cycles.test.ts`, `tests/micro-specs/reward-profile-gate.test.ts`, `supabase/tests/reward_redemption_cycles.sql`, `supabase/tests/profile_completion_gate.sql` |
| Gates         | `pnpm governance`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm db:verify`, `pnpm security:verify`                                                                                                                                                 |

Allowed blast radius:

- `app/app/rewards/**`
- `app/reward/**`
- `lib/customer/reward.ts`
- `lib/merchant/reward-collection.ts`
- `micro-specs/04-staff-rewards/02-reward-unlock-and-redemption.md`
- `micro-specs/TRACEABILITY.md`
- `micro-specs/traceability.json`
- `supabase/migrations/**`
- `supabase/tests/**`

Implementation surfaces:

- `app/reward/**`
- `app/app/rewards/**`
- `lib/customer/reward.ts`
- `lib/merchant/reward-collection.ts`
- `supabase/migrations/**`
- `supabase/tests/**`

Status evidence:

- Reviewed against docs/PROJECT_SPEC.md and docs/ARCHITECTURE.md on 2026-06-15.
- Related tests were inspected and mapped before status classification.
- No superseding Micro-Spec replaces this current intent.

### Requirements

| Requirement ID                                  | Summary                                                                                                                                                    | Evidence                                                                                                                                                                                                                                                |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MS-STAFF-REWARDS-REWARD-UNLOCK-REDEMPTION-001` | WHEN a membership reaches the required stamp count, THE system SHALL create exactly one reward event with assigned reward details.                         | `tests/micro-specs/merchant-scanned-reward.test.ts`, `tests/micro-specs/reward-redemption-cycles.test.ts`, `tests/micro-specs/reward-profile-gate.test.ts`, `supabase/tests/reward_redemption_cycles.sql`, `supabase/tests/profile_completion_gate.sql` |
| `MS-STAFF-REWARDS-REWARD-UNLOCK-REDEMPTION-002` | WHEN a customer opens an unlocked reward before `redeemable_from`, THE app SHALL show the assigned reward and a come-back message without a redeem action. | `tests/micro-specs/merchant-scanned-reward.test.ts`, `tests/micro-specs/reward-redemption-cycles.test.ts`, `tests/micro-specs/reward-profile-gate.test.ts`, `supabase/tests/reward_redemption_cycles.sql`, `supabase/tests/profile_completion_gate.sql` |
| `MS-STAFF-REWARDS-REWARD-UNLOCK-REDEMPTION-003` | WHEN a customer opens a redeemable reward, THE app SHALL show assigned reward name, terms, and self-service redeem action.                                 | `tests/micro-specs/merchant-scanned-reward.test.ts`, `tests/micro-specs/reward-redemption-cycles.test.ts`, `tests/micro-specs/reward-profile-gate.test.ts`, `supabase/tests/reward_redemption_cycles.sql`, `supabase/tests/profile_completion_gate.sql` |
| `MS-STAFF-REWARDS-REWARD-UNLOCK-REDEMPTION-004` | WHEN the merchant edits the reward pool after assignment, THE existing customer reward SHALL keep its persisted details unchanged.                         | `tests/micro-specs/merchant-scanned-reward.test.ts`, `tests/micro-specs/reward-redemption-cycles.test.ts`, `tests/micro-specs/reward-profile-gate.test.ts`, `supabase/tests/reward_redemption_cycles.sql`, `supabase/tests/profile_completion_gate.sql` |
| `MS-STAFF-REWARDS-REWARD-UNLOCK-REDEMPTION-005` | WHEN the customer taps redeem and all server checks pass, THE system SHALL mark the reward as redeemed once.                                               | `tests/micro-specs/merchant-scanned-reward.test.ts`, `tests/micro-specs/reward-redemption-cycles.test.ts`, `tests/micro-specs/reward-profile-gate.test.ts`, `supabase/tests/reward_redemption_cycles.sql`, `supabase/tests/profile_completion_gate.sql` |
| `MS-STAFF-REWARDS-REWARD-UNLOCK-REDEMPTION-006` | WHEN the same reward redemption is attempted again, THE system SHALL reject or replay the duplicate safely without creating another redemption.            | `tests/micro-specs/merchant-scanned-reward.test.ts`, `tests/micro-specs/reward-redemption-cycles.test.ts`, `tests/micro-specs/reward-profile-gate.test.ts`, `supabase/tests/reward_redemption_cycles.sql`, `supabase/tests/profile_completion_gate.sql` |
| `MS-STAFF-REWARDS-REWARD-UNLOCK-REDEMPTION-007` | WHEN redemption succeeds, THE system SHALL update membership reward totals and start the next visible stamp cycle.                                         | `tests/micro-specs/merchant-scanned-reward.test.ts`, `tests/micro-specs/reward-redemption-cycles.test.ts`, `tests/micro-specs/reward-profile-gate.test.ts`, `supabase/tests/reward_redemption_cycles.sql`, `supabase/tests/profile_completion_gate.sql` |
| `MS-STAFF-REWARDS-REWARD-UNLOCK-REDEMPTION-008` | WHEN reward redemption succeeds or fails for a security reason, THE system SHALL record audit/product events.                                              | `tests/micro-specs/merchant-scanned-reward.test.ts`, `tests/micro-specs/reward-redemption-cycles.test.ts`, `tests/micro-specs/reward-profile-gate.test.ts`, `supabase/tests/reward_redemption_cycles.sql`, `supabase/tests/profile_completion_gate.sql` |

## MS-STAFF-REWARDS-SELF-SERVICE-STAMP-ISSUING — Self-Service Stamp Issuing

| Field         | Value                                                                                                                                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Status        | `active`                                                                                                                                                                                               |
| Risk class    | `rls-rpc-ledger`                                                                                                                                                                                       |
| Owner         | `factory-droid`                                                                                                                                                                                        |
| Last reviewed | `2026-06-15`                                                                                                                                                                                           |
| Source        | `micro-specs/04-staff-rewards/01-self-service-stamp-issuing.md`                                                                                                                                        |
| Tests         | `tests/micro-specs/self-service-stamping.test.ts`, `tests/micro-specs/returning-qr-redirect.test.ts`, `tests/micro-specs/customer-stamp-loader.test.ts`, `supabase/tests/reward_redemption_cycles.sql` |
| Gates         | `pnpm governance`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm db:verify`, `pnpm security:verify`                                                                                                |

Allowed blast radius:

- `app/card/**`
- `app/q/**`
- `lib/customer/returning-qr-redirect.ts`
- `lib/customer/stamp.ts`
- `micro-specs/04-staff-rewards/01-self-service-stamp-issuing.md`
- `micro-specs/TRACEABILITY.md`
- `micro-specs/traceability.json`
- `supabase/migrations/**`
- `supabase/tests/**`

Implementation surfaces:

- `app/q/**`
- `app/card/**`
- `lib/customer/stamp.ts`
- `lib/customer/returning-qr-redirect.ts`
- `supabase/migrations/**`
- `supabase/tests/**`

Status evidence:

- Reviewed against docs/PROJECT_SPEC.md and docs/ARCHITECTURE.md on 2026-06-15.
- Related tests were inspected and mapped before status classification.
- No superseding Micro-Spec replaces this current intent.
- The changelog marks staff-mediated stamp approval as historical; v2 static-QR self-service stamping is the current active intent.

### Requirements

| Requirement ID                                    | Summary                                                                                                                                                            | Evidence                                                                                                                                                                                               |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `MS-STAFF-REWARDS-SELF-SERVICE-STAMP-ISSUING-001` | WHEN an existing member scans the venue QR, THE app SHALL route to the stamp-confirm screen with QR context.                                                       | `tests/micro-specs/self-service-stamping.test.ts`, `tests/micro-specs/returning-qr-redirect.test.ts`, `tests/micro-specs/customer-stamp-loader.test.ts`, `supabase/tests/reward_redemption_cycles.sql` |
| `MS-STAFF-REWARDS-SELF-SERVICE-STAMP-ISSUING-002` | WHEN the customer taps add stamp and all server checks pass, THE system SHALL create a `stamp_events` record and increment membership progress.                    | `tests/micro-specs/self-service-stamping.test.ts`, `tests/micro-specs/returning-qr-redirect.test.ts`, `tests/micro-specs/customer-stamp-loader.test.ts`, `supabase/tests/reward_redemption_cycles.sql` |
| `MS-STAFF-REWARDS-SELF-SERVICE-STAMP-ISSUING-003` | WHEN location is in range, THE system SHALL issue the stamp without creating a geofence fraud flag.                                                                | `tests/micro-specs/self-service-stamping.test.ts`, `tests/micro-specs/returning-qr-redirect.test.ts`, `tests/micro-specs/customer-stamp-loader.test.ts`, `supabase/tests/reward_redemption_cycles.sql` |
| `MS-STAFF-REWARDS-SELF-SERVICE-STAMP-ISSUING-004` | WHEN location is outside the configured radius, THE system SHALL issue the stamp and create a fraud flag.                                                          | `tests/micro-specs/self-service-stamping.test.ts`, `tests/micro-specs/returning-qr-redirect.test.ts`, `tests/micro-specs/customer-stamp-loader.test.ts`, `supabase/tests/reward_redemption_cycles.sql` |
| `MS-STAFF-REWARDS-SELF-SERVICE-STAMP-ISSUING-005` | WHEN location is denied or unavailable, THE system SHALL issue the stamp and create a fraud flag.                                                                  | `tests/micro-specs/self-service-stamping.test.ts`, `tests/micro-specs/returning-qr-redirect.test.ts`, `tests/micro-specs/customer-stamp-loader.test.ts`, `supabase/tests/reward_redemption_cycles.sql` |
| `MS-STAFF-REWARDS-SELF-SERVICE-STAMP-ISSUING-006` | WHEN the customer has already received a stamp for the membership/location/UK date, THE system SHALL reject the duplicate attempt with safe copy.                  | `tests/micro-specs/self-service-stamping.test.ts`, `tests/micro-specs/returning-qr-redirect.test.ts`, `tests/micro-specs/customer-stamp-loader.test.ts`, `supabase/tests/reward_redemption_cycles.sql` |
| `MS-STAFF-REWARDS-SELF-SERVICE-STAMP-ISSUING-007` | WHEN the stamp completes the visit target, THE system SHALL select one active reward pool item using integer weights and persist its details into `reward_events`. | `tests/micro-specs/self-service-stamping.test.ts`, `tests/micro-specs/returning-qr-redirect.test.ts`, `tests/micro-specs/customer-stamp-loader.test.ts`, `supabase/tests/reward_redemption_cycles.sql` |
| `MS-STAFF-REWARDS-SELF-SERVICE-STAMP-ISSUING-008` | WHEN the merchant billing state is cancelled or suspended, THE system SHALL block new stamp issuance according to billing rules.                                   | `tests/micro-specs/self-service-stamping.test.ts`, `tests/micro-specs/returning-qr-redirect.test.ts`, `tests/micro-specs/customer-stamp-loader.test.ts`, `supabase/tests/reward_redemption_cycles.sql` |
| `MS-STAFF-REWARDS-SELF-SERVICE-STAMP-ISSUING-009` | WHEN a stamp is issued, THE system SHALL write `stamp_issued` to product events and an audit entry with non-sensitive metadata.                                    | `tests/micro-specs/self-service-stamping.test.ts`, `tests/micro-specs/returning-qr-redirect.test.ts`, `tests/micro-specs/customer-stamp-loader.test.ts`, `supabase/tests/reward_redemption_cycles.sql` |
