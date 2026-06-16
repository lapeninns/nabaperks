# Micro-Spec Traceability

This human-readable index mirrors `micro-specs/traceability.json` and is ordered by stable spec ID and requirement ID.

## GOV-GOVERNANCE-FOUNDATION — Governance contract validator foundation

| Field         | Value                                                                     |
| ------------- | ------------------------------------------------------------------------- |
| Status        | `implemented`                                                             |
| Risk class    | `docs-tooling`                                                            |
| Change state  | `current`                                                                 |
| Owner         | `factory-droid`                                                           |
| Last reviewed | `2026-06-15`                                                              |
| Tests         | `tests/micro-specs/ai-governance.test.ts`                                 |
| Gates         | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`       |
| Supersession  | `not_superseded`: No superseding Micro-Spec replaces this current intent. |

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

| Requirement ID                  | Status        | Risk           | Test tier                                       | Evidence and rationale                                                                                                                                  | Implementation surfaces                                                                                                                                                                                                                                                                                                                                       | Verification commands                                               | Change state |
| ------------------------------- | ------------- | -------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------ |
| `GOV-GOVERNANCE-FOUNDATION-001` | `implemented` | `docs-tooling` | `governance`<br>`unit`                          | micro-specs/README.md<br>tests/micro-specs/ai-governance.test.ts                                                                                        | `AGENTS.md`<br>`CLAUDE.md`<br>`SKILL.md`<br>`Instructions_MircroSpecsCreation.md`<br>`Instructions_tdd.md`<br>`micro-specs/README.md`<br>`micro-specs/GLOBAL_CONTEXT.md`<br>`micro-specs/TRACEABILITY.md`<br>`micro-specs/traceability.json`<br>`scripts/check-governance.mjs`<br>`tests/micro-specs/ai-governance.test.ts`<br>`package.json`<br>`.github/**` | `pnpm governance`<br>`pnpm test`                                    | `current`    |
| `GOV-GOVERNANCE-FOUNDATION-002` | `implemented` | `docs-tooling` | `governance`<br>`unit`                          | micro-specs/README.md<br>tests/micro-specs/ai-governance.test.ts                                                                                        | `AGENTS.md`<br>`CLAUDE.md`<br>`SKILL.md`<br>`Instructions_MircroSpecsCreation.md`<br>`Instructions_tdd.md`<br>`micro-specs/README.md`<br>`micro-specs/GLOBAL_CONTEXT.md`<br>`micro-specs/TRACEABILITY.md`<br>`micro-specs/traceability.json`<br>`scripts/check-governance.mjs`<br>`tests/micro-specs/ai-governance.test.ts`<br>`package.json`<br>`.github/**` | `pnpm governance`<br>`pnpm test`                                    | `current`    |
| `GOV-GOVERNANCE-FOUNDATION-003` | `implemented` | `docs-tooling` | `governance`<br>`unit`                          | micro-specs/traceability.json<br>micro-specs/TRACEABILITY.md<br>tests/micro-specs/ai-governance.test.ts                                                 | `AGENTS.md`<br>`CLAUDE.md`<br>`SKILL.md`<br>`Instructions_MircroSpecsCreation.md`<br>`Instructions_tdd.md`<br>`micro-specs/README.md`<br>`micro-specs/GLOBAL_CONTEXT.md`<br>`micro-specs/TRACEABILITY.md`<br>`micro-specs/traceability.json`<br>`scripts/check-governance.mjs`<br>`tests/micro-specs/ai-governance.test.ts`<br>`package.json`<br>`.github/**` | `pnpm governance`<br>`pnpm test`                                    | `current`    |
| `GOV-GOVERNANCE-FOUNDATION-004` | `implemented` | `docs-tooling` | `governance`<br>`lint`<br>`typecheck`<br>`unit` | scripts/check-governance.mjs<br>package.json<br>.github/workflows/ci.yml<br>.github/actions/setup/action.yml<br>tests/micro-specs/ai-governance.test.ts | `AGENTS.md`<br>`CLAUDE.md`<br>`SKILL.md`<br>`Instructions_MircroSpecsCreation.md`<br>`Instructions_tdd.md`<br>`micro-specs/README.md`<br>`micro-specs/GLOBAL_CONTEXT.md`<br>`micro-specs/TRACEABILITY.md`<br>`micro-specs/traceability.json`<br>`scripts/check-governance.mjs`<br>`tests/micro-specs/ai-governance.test.ts`<br>`package.json`<br>`.github/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test` | `current`    |
| `GOV-GOVERNANCE-FOUNDATION-005` | `implemented` | `docs-tooling` | `governance`<br>`unit`                          | micro-specs/README.md<br>.github/pull_request_template.md<br>tests/micro-specs/ai-governance.test.ts                                                    | `AGENTS.md`<br>`CLAUDE.md`<br>`SKILL.md`<br>`Instructions_MircroSpecsCreation.md`<br>`Instructions_tdd.md`<br>`micro-specs/README.md`<br>`micro-specs/GLOBAL_CONTEXT.md`<br>`micro-specs/TRACEABILITY.md`<br>`micro-specs/traceability.json`<br>`scripts/check-governance.mjs`<br>`tests/micro-specs/ai-governance.test.ts`<br>`package.json`<br>`.github/**` | `pnpm governance`<br>`pnpm test`                                    | `current`    |

Handoff evidence is captured in `micro-specs/traceability.json`.

## GOV-HANDOFF-FIXTURES-TESTS — Governance handoff fixtures and tests

| Field         | Value                                                                                           |
| ------------- | ----------------------------------------------------------------------------------------------- |
| Status        | `implemented`                                                                                   |
| Risk class    | `docs-tooling`                                                                                  |
| Change state  | `current`                                                                                       |
| Owner         | `factory-droid`                                                                                 |
| Last reviewed | `2026-06-15`                                                                                    |
| Tests         | `tests/micro-specs/ai-governance.test.ts`<br>`tests/fixtures/governance/handoff-workflows.json` |
| Gates         | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`                             |
| Supersession  | `not_superseded`: No superseding Micro-Spec replaces this current intent.                       |

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

| Requirement ID                   | Status        | Risk           | Test tier              | Evidence and rationale                                                                                                      | Implementation surfaces                                                                                                                                                                           | Verification commands            | Change state |
| -------------------------------- | ------------- | -------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | ------------ |
| `GOV-HANDOFF-FIXTURES-TESTS-001` | `implemented` | `docs-tooling` | `governance`<br>`unit` | tests/fixtures/governance/handoff-workflows.json<br>tests/micro-specs/ai-governance.test.ts<br>scripts/check-governance.mjs | `scripts/check-governance.mjs`<br>`tests/micro-specs/ai-governance.test.ts`<br>`tests/fixtures/governance/**`<br>`micro-specs/TRACEABILITY.md`<br>`micro-specs/traceability.json`<br>`.github/**` | `pnpm governance`<br>`pnpm test` | `current`    |
| `GOV-HANDOFF-FIXTURES-TESTS-002` | `implemented` | `docs-tooling` | `governance`<br>`unit` | tests/micro-specs/ai-governance.test.ts<br>scripts/check-governance.mjs<br>.github/workflows/ci.yml                         | `scripts/check-governance.mjs`<br>`tests/micro-specs/ai-governance.test.ts`<br>`tests/fixtures/governance/**`<br>`micro-specs/TRACEABILITY.md`<br>`micro-specs/traceability.json`<br>`.github/**` | `pnpm governance`<br>`pnpm test` | `current`    |
| `GOV-HANDOFF-FIXTURES-TESTS-003` | `implemented` | `docs-tooling` | `governance`<br>`unit` | tests/fixtures/governance/handoff-workflows.json<br>tests/micro-specs/ai-governance.test.ts                                 | `scripts/check-governance.mjs`<br>`tests/micro-specs/ai-governance.test.ts`<br>`tests/fixtures/governance/**`<br>`micro-specs/TRACEABILITY.md`<br>`micro-specs/traceability.json`<br>`.github/**` | `pnpm governance`<br>`pnpm test` | `current`    |
| `GOV-HANDOFF-FIXTURES-TESTS-004` | `implemented` | `docs-tooling` | `governance`<br>`unit` | tests/fixtures/governance/handoff-workflows.json<br>tests/micro-specs/ai-governance.test.ts<br>scripts/check-governance.mjs | `scripts/check-governance.mjs`<br>`tests/micro-specs/ai-governance.test.ts`<br>`tests/fixtures/governance/**`<br>`micro-specs/TRACEABILITY.md`<br>`micro-specs/traceability.json`<br>`.github/**` | `pnpm governance`<br>`pnpm test` | `current`    |
| `GOV-HANDOFF-FIXTURES-TESTS-005` | `implemented` | `docs-tooling` | `governance`<br>`unit` | tests/fixtures/governance/handoff-workflows.json<br>scripts/check-governance.mjs                                            | `scripts/check-governance.mjs`<br>`tests/micro-specs/ai-governance.test.ts`<br>`tests/fixtures/governance/**`<br>`micro-specs/TRACEABILITY.md`<br>`micro-specs/traceability.json`<br>`.github/**` | `pnpm governance`<br>`pnpm test` | `current`    |
| `GOV-HANDOFF-FIXTURES-TESTS-006` | `implemented` | `docs-tooling` | `governance`<br>`unit` | tests/fixtures/governance/handoff-workflows.json<br>micro-specs/traceability.json<br>scripts/check-governance.mjs           | `scripts/check-governance.mjs`<br>`tests/micro-specs/ai-governance.test.ts`<br>`tests/fixtures/governance/**`<br>`micro-specs/TRACEABILITY.md`<br>`micro-specs/traceability.json`<br>`.github/**` | `pnpm governance`<br>`pnpm test` | `current`    |

Handoff evidence is captured in `micro-specs/traceability.json`.

## MS-ADMIN-BILLING-INTERNAL-ADMIN-SUPPORT-CONSOLE — Internal Admin Support Console

| Field         | Value                                                                                                                               |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Status        | `active`                                                                                                                            |
| Risk class    | `auth-session`                                                                                                                      |
| Change state  | `current`                                                                                                                           |
| Owner         | `factory-droid`                                                                                                                     |
| Last reviewed | `2026-06-15`                                                                                                                        |
| Source        | `micro-specs/06-admin-billing/02-internal-admin-support-console.md`                                                                 |
| Tests         | `manual:billing/admin micro-spec Vitest evidence in retained legacy filename`<br>`tests/micro-specs/admin-console-redesign.test.ts` |
| Gates         | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm security:verify`<br>`pnpm build`                       |
| Supersession  | `not_superseded`: No superseding Micro-Spec replaces this current intent.                                                           |

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

| Requirement ID                                        | Status   | Risk           | Test tier                                                                | Evidence and rationale                                                                                                                                                                                                                    | Implementation surfaces                                                                             | Verification commands                                                                                         | Change state |
| ----------------------------------------------------- | -------- | -------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------ |
| `MS-ADMIN-BILLING-INTERNAL-ADMIN-SUPPORT-CONSOLE-001` | `active` | `auth-session` | `build`<br>`governance`<br>`lint`<br>`security`<br>`typecheck`<br>`unit` | manual:billing/admin micro-spec Vitest evidence in retained legacy filename<br>tests/micro-specs/admin-console-redesign.test.ts<br>Approved manual-check rationale: billing/admin micro-spec Vitest evidence in retained legacy filename. | `app/admin/**`<br>`lib/admin/**`<br>`components/layout/admin-shell.tsx`<br>`supabase/migrations/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm security:verify`<br>`pnpm build` | `current`    |
| `MS-ADMIN-BILLING-INTERNAL-ADMIN-SUPPORT-CONSOLE-002` | `active` | `auth-session` | `build`<br>`governance`<br>`lint`<br>`security`<br>`typecheck`<br>`unit` | manual:billing/admin micro-spec Vitest evidence in retained legacy filename<br>tests/micro-specs/admin-console-redesign.test.ts<br>Approved manual-check rationale: billing/admin micro-spec Vitest evidence in retained legacy filename. | `app/admin/**`<br>`lib/admin/**`<br>`components/layout/admin-shell.tsx`<br>`supabase/migrations/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm security:verify`<br>`pnpm build` | `current`    |
| `MS-ADMIN-BILLING-INTERNAL-ADMIN-SUPPORT-CONSOLE-003` | `active` | `auth-session` | `build`<br>`governance`<br>`lint`<br>`security`<br>`typecheck`<br>`unit` | manual:billing/admin micro-spec Vitest evidence in retained legacy filename<br>tests/micro-specs/admin-console-redesign.test.ts<br>Approved manual-check rationale: billing/admin micro-spec Vitest evidence in retained legacy filename. | `app/admin/**`<br>`lib/admin/**`<br>`components/layout/admin-shell.tsx`<br>`supabase/migrations/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm security:verify`<br>`pnpm build` | `current`    |
| `MS-ADMIN-BILLING-INTERNAL-ADMIN-SUPPORT-CONSOLE-004` | `active` | `auth-session` | `build`<br>`governance`<br>`lint`<br>`security`<br>`typecheck`<br>`unit` | manual:billing/admin micro-spec Vitest evidence in retained legacy filename<br>tests/micro-specs/admin-console-redesign.test.ts<br>Approved manual-check rationale: billing/admin micro-spec Vitest evidence in retained legacy filename. | `app/admin/**`<br>`lib/admin/**`<br>`components/layout/admin-shell.tsx`<br>`supabase/migrations/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm security:verify`<br>`pnpm build` | `current`    |
| `MS-ADMIN-BILLING-INTERNAL-ADMIN-SUPPORT-CONSOLE-005` | `active` | `auth-session` | `build`<br>`governance`<br>`lint`<br>`security`<br>`typecheck`<br>`unit` | manual:billing/admin micro-spec Vitest evidence in retained legacy filename<br>tests/micro-specs/admin-console-redesign.test.ts<br>Approved manual-check rationale: billing/admin micro-spec Vitest evidence in retained legacy filename. | `app/admin/**`<br>`lib/admin/**`<br>`components/layout/admin-shell.tsx`<br>`supabase/migrations/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm security:verify`<br>`pnpm build` | `current`    |
| `MS-ADMIN-BILLING-INTERNAL-ADMIN-SUPPORT-CONSOLE-006` | `active` | `auth-session` | `build`<br>`governance`<br>`lint`<br>`security`<br>`typecheck`<br>`unit` | manual:billing/admin micro-spec Vitest evidence in retained legacy filename<br>tests/micro-specs/admin-console-redesign.test.ts<br>Approved manual-check rationale: billing/admin micro-spec Vitest evidence in retained legacy filename. | `app/admin/**`<br>`lib/admin/**`<br>`components/layout/admin-shell.tsx`<br>`supabase/migrations/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm security:verify`<br>`pnpm build` | `current`    |
| `MS-ADMIN-BILLING-INTERNAL-ADMIN-SUPPORT-CONSOLE-007` | `active` | `auth-session` | `build`<br>`governance`<br>`lint`<br>`security`<br>`typecheck`<br>`unit` | manual:billing/admin micro-spec Vitest evidence in retained legacy filename<br>tests/micro-specs/admin-console-redesign.test.ts<br>Approved manual-check rationale: billing/admin micro-spec Vitest evidence in retained legacy filename. | `app/admin/**`<br>`lib/admin/**`<br>`components/layout/admin-shell.tsx`<br>`supabase/migrations/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm security:verify`<br>`pnpm build` | `current`    |

## MS-ADMIN-BILLING-STRIPE-BILLING-ACCESS-CONTROL — Stripe Billing and Access Control

| Field         | Value                                                                                                                                                                     |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status        | `active`                                                                                                                                                                  |
| Risk class    | `billing`                                                                                                                                                                 |
| Change state  | `current`                                                                                                                                                                 |
| Owner         | `factory-droid`                                                                                                                                                           |
| Last reviewed | `2026-06-15`                                                                                                                                                              |
| Source        | `micro-specs/06-admin-billing/01-stripe-billing-and-access-control.md`                                                                                                    |
| Tests         | `manual:billing/admin micro-spec Vitest evidence in retained legacy filename`<br>`tests/micro-specs/marketing-auth-legal.test.ts`<br>`tests/micro-specs/customer.test.ts` |
| Gates         | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm security:verify`<br>`pnpm build`                                                             |
| Supersession  | `not_superseded`: No superseding Micro-Spec replaces this current intent.                                                                                                 |

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

| Requirement ID                                       | Status   | Risk      | Test tier                                                                | Evidence and rationale                                                                                                                                                                                                                                                        | Implementation surfaces                                                                                                             | Verification commands                                                                                         | Change state |
| ---------------------------------------------------- | -------- | --------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------ |
| `MS-ADMIN-BILLING-STRIPE-BILLING-ACCESS-CONTROL-001` | `active` | `billing` | `build`<br>`governance`<br>`lint`<br>`security`<br>`typecheck`<br>`unit` | manual:billing/admin micro-spec Vitest evidence in retained legacy filename<br>tests/micro-specs/marketing-auth-legal.test.ts<br>tests/micro-specs/customer.test.ts<br>Approved manual-check rationale: billing/admin micro-spec Vitest evidence in retained legacy filename. | `app/pricing/**`<br>`app/app/billing/**`<br>`app/api/stripe/**`<br>`lib/stripe/**`<br>`lib/customer/**`<br>`supabase/migrations/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm security:verify`<br>`pnpm build` | `current`    |
| `MS-ADMIN-BILLING-STRIPE-BILLING-ACCESS-CONTROL-002` | `active` | `billing` | `build`<br>`governance`<br>`lint`<br>`security`<br>`typecheck`<br>`unit` | manual:billing/admin micro-spec Vitest evidence in retained legacy filename<br>tests/micro-specs/marketing-auth-legal.test.ts<br>tests/micro-specs/customer.test.ts<br>Approved manual-check rationale: billing/admin micro-spec Vitest evidence in retained legacy filename. | `app/pricing/**`<br>`app/app/billing/**`<br>`app/api/stripe/**`<br>`lib/stripe/**`<br>`lib/customer/**`<br>`supabase/migrations/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm security:verify`<br>`pnpm build` | `current`    |
| `MS-ADMIN-BILLING-STRIPE-BILLING-ACCESS-CONTROL-003` | `active` | `billing` | `build`<br>`governance`<br>`lint`<br>`security`<br>`typecheck`<br>`unit` | manual:billing/admin micro-spec Vitest evidence in retained legacy filename<br>tests/micro-specs/marketing-auth-legal.test.ts<br>tests/micro-specs/customer.test.ts<br>Approved manual-check rationale: billing/admin micro-spec Vitest evidence in retained legacy filename. | `app/pricing/**`<br>`app/app/billing/**`<br>`app/api/stripe/**`<br>`lib/stripe/**`<br>`lib/customer/**`<br>`supabase/migrations/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm security:verify`<br>`pnpm build` | `current`    |
| `MS-ADMIN-BILLING-STRIPE-BILLING-ACCESS-CONTROL-004` | `active` | `billing` | `build`<br>`governance`<br>`lint`<br>`security`<br>`typecheck`<br>`unit` | manual:billing/admin micro-spec Vitest evidence in retained legacy filename<br>tests/micro-specs/marketing-auth-legal.test.ts<br>tests/micro-specs/customer.test.ts<br>Approved manual-check rationale: billing/admin micro-spec Vitest evidence in retained legacy filename. | `app/pricing/**`<br>`app/app/billing/**`<br>`app/api/stripe/**`<br>`lib/stripe/**`<br>`lib/customer/**`<br>`supabase/migrations/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm security:verify`<br>`pnpm build` | `current`    |
| `MS-ADMIN-BILLING-STRIPE-BILLING-ACCESS-CONTROL-005` | `active` | `billing` | `build`<br>`governance`<br>`lint`<br>`security`<br>`typecheck`<br>`unit` | manual:billing/admin micro-spec Vitest evidence in retained legacy filename<br>tests/micro-specs/marketing-auth-legal.test.ts<br>tests/micro-specs/customer.test.ts<br>Approved manual-check rationale: billing/admin micro-spec Vitest evidence in retained legacy filename. | `app/pricing/**`<br>`app/app/billing/**`<br>`app/api/stripe/**`<br>`lib/stripe/**`<br>`lib/customer/**`<br>`supabase/migrations/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm security:verify`<br>`pnpm build` | `current`    |
| `MS-ADMIN-BILLING-STRIPE-BILLING-ACCESS-CONTROL-006` | `active` | `billing` | `build`<br>`governance`<br>`lint`<br>`security`<br>`typecheck`<br>`unit` | manual:billing/admin micro-spec Vitest evidence in retained legacy filename<br>tests/micro-specs/marketing-auth-legal.test.ts<br>tests/micro-specs/customer.test.ts<br>Approved manual-check rationale: billing/admin micro-spec Vitest evidence in retained legacy filename. | `app/pricing/**`<br>`app/app/billing/**`<br>`app/api/stripe/**`<br>`lib/stripe/**`<br>`lib/customer/**`<br>`supabase/migrations/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm security:verify`<br>`pnpm build` | `current`    |
| `MS-ADMIN-BILLING-STRIPE-BILLING-ACCESS-CONTROL-007` | `active` | `billing` | `build`<br>`governance`<br>`lint`<br>`security`<br>`typecheck`<br>`unit` | manual:billing/admin micro-spec Vitest evidence in retained legacy filename<br>tests/micro-specs/marketing-auth-legal.test.ts<br>tests/micro-specs/customer.test.ts<br>Approved manual-check rationale: billing/admin micro-spec Vitest evidence in retained legacy filename. | `app/pricing/**`<br>`app/app/billing/**`<br>`app/api/stripe/**`<br>`lib/stripe/**`<br>`lib/customer/**`<br>`supabase/migrations/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm security:verify`<br>`pnpm build` | `current`    |

## MS-CUSTOMER-DIGITAL-STAMP-CARD — Digital Stamp Card

| Field         | Value                                                                                                                                                                                     |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status        | `active`                                                                                                                                                                                  |
| Risk class    | `rls-rpc-ledger`                                                                                                                                                                          |
| Change state  | `current`                                                                                                                                                                                 |
| Owner         | `factory-droid`                                                                                                                                                                           |
| Last reviewed | `2026-06-15`                                                                                                                                                                              |
| Source        | `micro-specs/03-customer/02-digital-stamp-card.md`                                                                                                                                        |
| Tests         | `tests/micro-specs/customer.test.ts`<br>`tests/micro-specs/customer-card-stamps.test.ts`<br>`tests/micro-specs/customer-card-loader.test.ts`<br>`tests/micro-specs/customer-home.test.ts` |
| Gates         | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm db:verify`<br>`pnpm security:verify`                                                                         |
| Supersession  | `not_superseded`: No superseding Micro-Spec replaces this current intent.                                                                                                                 |

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

| Requirement ID                       | Status   | Risk             | Test tier                                                                  | Evidence and rationale                                                                                                                                                            | Implementation surfaces                                                                                                                            | Verification commands                                                                                             | Change state |
| ------------------------------------ | -------- | ---------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------ |
| `MS-CUSTOMER-DIGITAL-STAMP-CARD-001` | `active` | `rls-rpc-ledger` | `governance`<br>`lint`<br>`security`<br>`sql-rls`<br>`typecheck`<br>`unit` | tests/micro-specs/customer.test.ts<br>tests/micro-specs/customer-card-stamps.test.ts<br>tests/micro-specs/customer-card-loader.test.ts<br>tests/micro-specs/customer-home.test.ts | `app/card/**`<br>`app/reward/**`<br>`components/customer/**`<br>`lib/customer/card.ts`<br>`lib/customer/reward.ts`<br>`lib/customer/experience/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm db:verify`<br>`pnpm security:verify` | `current`    |
| `MS-CUSTOMER-DIGITAL-STAMP-CARD-002` | `active` | `rls-rpc-ledger` | `governance`<br>`lint`<br>`security`<br>`sql-rls`<br>`typecheck`<br>`unit` | tests/micro-specs/customer.test.ts<br>tests/micro-specs/customer-card-stamps.test.ts<br>tests/micro-specs/customer-card-loader.test.ts<br>tests/micro-specs/customer-home.test.ts | `app/card/**`<br>`app/reward/**`<br>`components/customer/**`<br>`lib/customer/card.ts`<br>`lib/customer/reward.ts`<br>`lib/customer/experience/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm db:verify`<br>`pnpm security:verify` | `current`    |
| `MS-CUSTOMER-DIGITAL-STAMP-CARD-003` | `active` | `rls-rpc-ledger` | `governance`<br>`lint`<br>`security`<br>`sql-rls`<br>`typecheck`<br>`unit` | tests/micro-specs/customer.test.ts<br>tests/micro-specs/customer-card-stamps.test.ts<br>tests/micro-specs/customer-card-loader.test.ts<br>tests/micro-specs/customer-home.test.ts | `app/card/**`<br>`app/reward/**`<br>`components/customer/**`<br>`lib/customer/card.ts`<br>`lib/customer/reward.ts`<br>`lib/customer/experience/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm db:verify`<br>`pnpm security:verify` | `current`    |
| `MS-CUSTOMER-DIGITAL-STAMP-CARD-004` | `active` | `rls-rpc-ledger` | `governance`<br>`lint`<br>`security`<br>`sql-rls`<br>`typecheck`<br>`unit` | tests/micro-specs/customer.test.ts<br>tests/micro-specs/customer-card-stamps.test.ts<br>tests/micro-specs/customer-card-loader.test.ts<br>tests/micro-specs/customer-home.test.ts | `app/card/**`<br>`app/reward/**`<br>`components/customer/**`<br>`lib/customer/card.ts`<br>`lib/customer/reward.ts`<br>`lib/customer/experience/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm db:verify`<br>`pnpm security:verify` | `current`    |
| `MS-CUSTOMER-DIGITAL-STAMP-CARD-005` | `active` | `rls-rpc-ledger` | `governance`<br>`lint`<br>`security`<br>`sql-rls`<br>`typecheck`<br>`unit` | tests/micro-specs/customer.test.ts<br>tests/micro-specs/customer-card-stamps.test.ts<br>tests/micro-specs/customer-card-loader.test.ts<br>tests/micro-specs/customer-home.test.ts | `app/card/**`<br>`app/reward/**`<br>`components/customer/**`<br>`lib/customer/card.ts`<br>`lib/customer/reward.ts`<br>`lib/customer/experience/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm db:verify`<br>`pnpm security:verify` | `current`    |
| `MS-CUSTOMER-DIGITAL-STAMP-CARD-006` | `active` | `rls-rpc-ledger` | `governance`<br>`lint`<br>`security`<br>`sql-rls`<br>`typecheck`<br>`unit` | tests/micro-specs/customer.test.ts<br>tests/micro-specs/customer-card-stamps.test.ts<br>tests/micro-specs/customer-card-loader.test.ts<br>tests/micro-specs/customer-home.test.ts | `app/card/**`<br>`app/reward/**`<br>`components/customer/**`<br>`lib/customer/card.ts`<br>`lib/customer/reward.ts`<br>`lib/customer/experience/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm db:verify`<br>`pnpm security:verify` | `current`    |
| `MS-CUSTOMER-DIGITAL-STAMP-CARD-007` | `active` | `rls-rpc-ledger` | `governance`<br>`lint`<br>`security`<br>`sql-rls`<br>`typecheck`<br>`unit` | tests/micro-specs/customer.test.ts<br>tests/micro-specs/customer-card-stamps.test.ts<br>tests/micro-specs/customer-card-loader.test.ts<br>tests/micro-specs/customer-home.test.ts | `app/card/**`<br>`app/reward/**`<br>`components/customer/**`<br>`lib/customer/card.ts`<br>`lib/customer/reward.ts`<br>`lib/customer/experience/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm db:verify`<br>`pnpm security:verify` | `current`    |
| `MS-CUSTOMER-DIGITAL-STAMP-CARD-008` | `active` | `rls-rpc-ledger` | `governance`<br>`lint`<br>`security`<br>`sql-rls`<br>`typecheck`<br>`unit` | tests/micro-specs/customer.test.ts<br>tests/micro-specs/customer-card-stamps.test.ts<br>tests/micro-specs/customer-card-loader.test.ts<br>tests/micro-specs/customer-home.test.ts | `app/card/**`<br>`app/reward/**`<br>`components/customer/**`<br>`lib/customer/card.ts`<br>`lib/customer/reward.ts`<br>`lib/customer/experience/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm db:verify`<br>`pnpm security:verify` | `current`    |
| `MS-CUSTOMER-DIGITAL-STAMP-CARD-009` | `active` | `rls-rpc-ledger` | `governance`<br>`lint`<br>`security`<br>`sql-rls`<br>`typecheck`<br>`unit` | tests/micro-specs/customer.test.ts<br>tests/micro-specs/customer-card-stamps.test.ts<br>tests/micro-specs/customer-card-loader.test.ts<br>tests/micro-specs/customer-home.test.ts | `app/card/**`<br>`app/reward/**`<br>`components/customer/**`<br>`lib/customer/card.ts`<br>`lib/customer/reward.ts`<br>`lib/customer/experience/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm db:verify`<br>`pnpm security:verify` | `current`    |

## MS-CUSTOMER-QR-RESOLVER-JOIN — QR Resolver and Customer Join

| Field         | Value                                                                                                                                                                                             |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status        | `active`                                                                                                                                                                                          |
| Risk class    | `auth-session`                                                                                                                                                                                    |
| Change state  | `current`                                                                                                                                                                                         |
| Owner         | `factory-droid`                                                                                                                                                                                   |
| Last reviewed | `2026-06-15`                                                                                                                                                                                      |
| Source        | `micro-specs/03-customer/01-qr-resolver-and-customer-join.md`                                                                                                                                     |
| Tests         | `tests/micro-specs/customer.test.ts`<br>`tests/micro-specs/customer-phone-auth.test.ts`<br>`tests/micro-specs/returning-qr-redirect.test.ts`<br>`tests/micro-specs/customer-legal-sheets.test.ts` |
| Gates         | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm security:verify`<br>`pnpm build`                                                                                     |
| Supersession  | `not_superseded`: No superseding Micro-Spec replaces this current intent.                                                                                                                         |

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

| Requirement ID                     | Status   | Risk           | Test tier                                                                | Evidence and rationale                                                                                                                                                                    | Implementation surfaces                                                                                                                 | Verification commands                                                                                         | Change state |
| ---------------------------------- | -------- | -------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------ |
| `MS-CUSTOMER-QR-RESOLVER-JOIN-001` | `active` | `auth-session` | `build`<br>`governance`<br>`lint`<br>`security`<br>`typecheck`<br>`unit` | tests/micro-specs/customer.test.ts<br>tests/micro-specs/customer-phone-auth.test.ts<br>tests/micro-specs/returning-qr-redirect.test.ts<br>tests/micro-specs/customer-legal-sheets.test.ts | `app/q/**`<br>`app/m/**`<br>`lib/customer/join.ts`<br>`lib/customer/phone.ts`<br>`lib/customer/session*.ts`<br>`supabase/migrations/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm security:verify`<br>`pnpm build` | `current`    |
| `MS-CUSTOMER-QR-RESOLVER-JOIN-002` | `active` | `auth-session` | `build`<br>`governance`<br>`lint`<br>`security`<br>`typecheck`<br>`unit` | tests/micro-specs/customer.test.ts<br>tests/micro-specs/customer-phone-auth.test.ts<br>tests/micro-specs/returning-qr-redirect.test.ts<br>tests/micro-specs/customer-legal-sheets.test.ts | `app/q/**`<br>`app/m/**`<br>`lib/customer/join.ts`<br>`lib/customer/phone.ts`<br>`lib/customer/session*.ts`<br>`supabase/migrations/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm security:verify`<br>`pnpm build` | `current`    |
| `MS-CUSTOMER-QR-RESOLVER-JOIN-003` | `active` | `auth-session` | `build`<br>`governance`<br>`lint`<br>`security`<br>`typecheck`<br>`unit` | tests/micro-specs/customer.test.ts<br>tests/micro-specs/customer-phone-auth.test.ts<br>tests/micro-specs/returning-qr-redirect.test.ts<br>tests/micro-specs/customer-legal-sheets.test.ts | `app/q/**`<br>`app/m/**`<br>`lib/customer/join.ts`<br>`lib/customer/phone.ts`<br>`lib/customer/session*.ts`<br>`supabase/migrations/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm security:verify`<br>`pnpm build` | `current`    |
| `MS-CUSTOMER-QR-RESOLVER-JOIN-004` | `active` | `auth-session` | `build`<br>`governance`<br>`lint`<br>`security`<br>`typecheck`<br>`unit` | tests/micro-specs/customer.test.ts<br>tests/micro-specs/customer-phone-auth.test.ts<br>tests/micro-specs/returning-qr-redirect.test.ts<br>tests/micro-specs/customer-legal-sheets.test.ts | `app/q/**`<br>`app/m/**`<br>`lib/customer/join.ts`<br>`lib/customer/phone.ts`<br>`lib/customer/session*.ts`<br>`supabase/migrations/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm security:verify`<br>`pnpm build` | `current`    |
| `MS-CUSTOMER-QR-RESOLVER-JOIN-005` | `active` | `auth-session` | `build`<br>`governance`<br>`lint`<br>`security`<br>`typecheck`<br>`unit` | tests/micro-specs/customer.test.ts<br>tests/micro-specs/customer-phone-auth.test.ts<br>tests/micro-specs/returning-qr-redirect.test.ts<br>tests/micro-specs/customer-legal-sheets.test.ts | `app/q/**`<br>`app/m/**`<br>`lib/customer/join.ts`<br>`lib/customer/phone.ts`<br>`lib/customer/session*.ts`<br>`supabase/migrations/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm security:verify`<br>`pnpm build` | `current`    |
| `MS-CUSTOMER-QR-RESOLVER-JOIN-006` | `active` | `auth-session` | `build`<br>`governance`<br>`lint`<br>`security`<br>`typecheck`<br>`unit` | tests/micro-specs/customer.test.ts<br>tests/micro-specs/customer-phone-auth.test.ts<br>tests/micro-specs/returning-qr-redirect.test.ts<br>tests/micro-specs/customer-legal-sheets.test.ts | `app/q/**`<br>`app/m/**`<br>`lib/customer/join.ts`<br>`lib/customer/phone.ts`<br>`lib/customer/session*.ts`<br>`supabase/migrations/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm security:verify`<br>`pnpm build` | `current`    |
| `MS-CUSTOMER-QR-RESOLVER-JOIN-007` | `active` | `auth-session` | `build`<br>`governance`<br>`lint`<br>`security`<br>`typecheck`<br>`unit` | tests/micro-specs/customer.test.ts<br>tests/micro-specs/customer-phone-auth.test.ts<br>tests/micro-specs/returning-qr-redirect.test.ts<br>tests/micro-specs/customer-legal-sheets.test.ts | `app/q/**`<br>`app/m/**`<br>`lib/customer/join.ts`<br>`lib/customer/phone.ts`<br>`lib/customer/session*.ts`<br>`supabase/migrations/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm security:verify`<br>`pnpm build` | `current`    |
| `MS-CUSTOMER-QR-RESOLVER-JOIN-008` | `active` | `auth-session` | `build`<br>`governance`<br>`lint`<br>`security`<br>`typecheck`<br>`unit` | tests/micro-specs/customer.test.ts<br>tests/micro-specs/customer-phone-auth.test.ts<br>tests/micro-specs/returning-qr-redirect.test.ts<br>tests/micro-specs/customer-legal-sheets.test.ts | `app/q/**`<br>`app/m/**`<br>`lib/customer/join.ts`<br>`lib/customer/phone.ts`<br>`lib/customer/session*.ts`<br>`supabase/migrations/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm security:verify`<br>`pnpm build` | `current`    |

## MS-FOUNDATION-PROJECT-SHELL-ENVIRONMENTS — Project Shell and Environments

| Field         | Value                                                                                                                                                                             |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status        | `active`                                                                                                                                                                          |
| Risk class    | `auth-session`                                                                                                                                                                    |
| Change state  | `current`                                                                                                                                                                         |
| Owner         | `factory-droid`                                                                                                                                                                   |
| Last reviewed | `2026-06-15`                                                                                                                                                                      |
| Source        | `micro-specs/01-foundation/01-project-shell-and-environments.md`                                                                                                                  |
| Tests         | `tests/micro-specs/foundation.test.ts`<br>`tests/micro-specs/vercel-env-guard.test.ts`<br>`tests/micro-specs/health-endpoint.test.ts`<br>`tests/micro-specs/full-app-pwa.test.ts` |
| Gates         | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm security:verify`<br>`pnpm build`                                                                     |
| Supersession  | `not_superseded`: No superseding Micro-Spec replaces this current intent.                                                                                                         |

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

| Requirement ID                                 | Status   | Risk           | Test tier                                                                | Evidence and rationale                                                                                                                                                    | Implementation surfaces                                                                      | Verification commands                                                                                         | Change state |
| ---------------------------------------------- | -------- | -------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------ |
| `MS-FOUNDATION-PROJECT-SHELL-ENVIRONMENTS-001` | `active` | `auth-session` | `build`<br>`governance`<br>`lint`<br>`security`<br>`typecheck`<br>`unit` | tests/micro-specs/foundation.test.ts<br>tests/micro-specs/vercel-env-guard.test.ts<br>tests/micro-specs/health-endpoint.test.ts<br>tests/micro-specs/full-app-pwa.test.ts | `app/**`<br>`components/**`<br>`lib/env/**`<br>`lib/supabase/**`<br>`config/**`<br>`docs/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm security:verify`<br>`pnpm build` | `current`    |
| `MS-FOUNDATION-PROJECT-SHELL-ENVIRONMENTS-002` | `active` | `auth-session` | `build`<br>`governance`<br>`lint`<br>`security`<br>`typecheck`<br>`unit` | tests/micro-specs/foundation.test.ts<br>tests/micro-specs/vercel-env-guard.test.ts<br>tests/micro-specs/health-endpoint.test.ts<br>tests/micro-specs/full-app-pwa.test.ts | `app/**`<br>`components/**`<br>`lib/env/**`<br>`lib/supabase/**`<br>`config/**`<br>`docs/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm security:verify`<br>`pnpm build` | `current`    |
| `MS-FOUNDATION-PROJECT-SHELL-ENVIRONMENTS-003` | `active` | `auth-session` | `build`<br>`governance`<br>`lint`<br>`security`<br>`typecheck`<br>`unit` | tests/micro-specs/foundation.test.ts<br>tests/micro-specs/vercel-env-guard.test.ts<br>tests/micro-specs/health-endpoint.test.ts<br>tests/micro-specs/full-app-pwa.test.ts | `app/**`<br>`components/**`<br>`lib/env/**`<br>`lib/supabase/**`<br>`config/**`<br>`docs/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm security:verify`<br>`pnpm build` | `current`    |
| `MS-FOUNDATION-PROJECT-SHELL-ENVIRONMENTS-004` | `active` | `auth-session` | `build`<br>`governance`<br>`lint`<br>`security`<br>`typecheck`<br>`unit` | tests/micro-specs/foundation.test.ts<br>tests/micro-specs/vercel-env-guard.test.ts<br>tests/micro-specs/health-endpoint.test.ts<br>tests/micro-specs/full-app-pwa.test.ts | `app/**`<br>`components/**`<br>`lib/env/**`<br>`lib/supabase/**`<br>`config/**`<br>`docs/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm security:verify`<br>`pnpm build` | `current`    |
| `MS-FOUNDATION-PROJECT-SHELL-ENVIRONMENTS-005` | `active` | `auth-session` | `build`<br>`governance`<br>`lint`<br>`security`<br>`typecheck`<br>`unit` | tests/micro-specs/foundation.test.ts<br>tests/micro-specs/vercel-env-guard.test.ts<br>tests/micro-specs/health-endpoint.test.ts<br>tests/micro-specs/full-app-pwa.test.ts | `app/**`<br>`components/**`<br>`lib/env/**`<br>`lib/supabase/**`<br>`config/**`<br>`docs/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm security:verify`<br>`pnpm build` | `current`    |

## MS-FOUNDATION-SUPABASE-SCHEMA-RLS-AUDIT — Supabase Schema, RLS, and Audit Backbone

| Field         | Value                                                                                                                                                                                                                                                     |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status        | `active`                                                                                                                                                                                                                                                  |
| Risk class    | `migrations`                                                                                                                                                                                                                                              |
| Change state  | `current`                                                                                                                                                                                                                                                 |
| Owner         | `factory-droid`                                                                                                                                                                                                                                           |
| Last reviewed | `2026-06-15`                                                                                                                                                                                                                                              |
| Source        | `micro-specs/01-foundation/02-supabase-schema-rls-and-audit.md`                                                                                                                                                                                           |
| Tests         | `tests/micro-specs/foundation.test.ts`<br>`manual:billing/admin micro-spec Vitest evidence in retained legacy filename`<br>`tests/micro-specs/customer.test.ts`<br>`supabase/tests/tenant_isolation.sql`<br>`supabase/tests/reward_redemption_cycles.sql` |
| Gates         | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm db:verify`<br>`pnpm security:verify`                                                                                                                                         |
| Supersession  | `not_superseded`: No superseding Micro-Spec replaces this current intent.                                                                                                                                                                                 |

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

| Requirement ID                                | Status   | Risk         | Test tier                                                                  | Evidence and rationale                                                                                                                                                                                                                                                                                                                                    | Implementation surfaces                                                               | Verification commands                                                                                             | Change state |
| --------------------------------------------- | -------- | ------------ | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------ |
| `MS-FOUNDATION-SUPABASE-SCHEMA-RLS-AUDIT-001` | `active` | `migrations` | `governance`<br>`lint`<br>`security`<br>`sql-rls`<br>`typecheck`<br>`unit` | tests/micro-specs/foundation.test.ts<br>manual:billing/admin micro-spec Vitest evidence in retained legacy filename<br>tests/micro-specs/customer.test.ts<br>supabase/tests/tenant_isolation.sql<br>supabase/tests/reward_redemption_cycles.sql<br>Approved manual-check rationale: billing/admin micro-spec Vitest evidence in retained legacy filename. | `supabase/migrations/**`<br>`supabase/tests/**`<br>`lib/supabase/**`<br>`lib/**/*.ts` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm db:verify`<br>`pnpm security:verify` | `current`    |
| `MS-FOUNDATION-SUPABASE-SCHEMA-RLS-AUDIT-002` | `active` | `migrations` | `governance`<br>`lint`<br>`security`<br>`sql-rls`<br>`typecheck`<br>`unit` | tests/micro-specs/foundation.test.ts<br>manual:billing/admin micro-spec Vitest evidence in retained legacy filename<br>tests/micro-specs/customer.test.ts<br>supabase/tests/tenant_isolation.sql<br>supabase/tests/reward_redemption_cycles.sql<br>Approved manual-check rationale: billing/admin micro-spec Vitest evidence in retained legacy filename. | `supabase/migrations/**`<br>`supabase/tests/**`<br>`lib/supabase/**`<br>`lib/**/*.ts` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm db:verify`<br>`pnpm security:verify` | `current`    |
| `MS-FOUNDATION-SUPABASE-SCHEMA-RLS-AUDIT-003` | `active` | `migrations` | `governance`<br>`lint`<br>`security`<br>`sql-rls`<br>`typecheck`<br>`unit` | tests/micro-specs/foundation.test.ts<br>manual:billing/admin micro-spec Vitest evidence in retained legacy filename<br>tests/micro-specs/customer.test.ts<br>supabase/tests/tenant_isolation.sql<br>supabase/tests/reward_redemption_cycles.sql<br>Approved manual-check rationale: billing/admin micro-spec Vitest evidence in retained legacy filename. | `supabase/migrations/**`<br>`supabase/tests/**`<br>`lib/supabase/**`<br>`lib/**/*.ts` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm db:verify`<br>`pnpm security:verify` | `current`    |
| `MS-FOUNDATION-SUPABASE-SCHEMA-RLS-AUDIT-004` | `active` | `migrations` | `governance`<br>`lint`<br>`security`<br>`sql-rls`<br>`typecheck`<br>`unit` | tests/micro-specs/foundation.test.ts<br>manual:billing/admin micro-spec Vitest evidence in retained legacy filename<br>tests/micro-specs/customer.test.ts<br>supabase/tests/tenant_isolation.sql<br>supabase/tests/reward_redemption_cycles.sql<br>Approved manual-check rationale: billing/admin micro-spec Vitest evidence in retained legacy filename. | `supabase/migrations/**`<br>`supabase/tests/**`<br>`lib/supabase/**`<br>`lib/**/*.ts` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm db:verify`<br>`pnpm security:verify` | `current`    |
| `MS-FOUNDATION-SUPABASE-SCHEMA-RLS-AUDIT-005` | `active` | `migrations` | `governance`<br>`lint`<br>`security`<br>`sql-rls`<br>`typecheck`<br>`unit` | tests/micro-specs/foundation.test.ts<br>manual:billing/admin micro-spec Vitest evidence in retained legacy filename<br>tests/micro-specs/customer.test.ts<br>supabase/tests/tenant_isolation.sql<br>supabase/tests/reward_redemption_cycles.sql<br>Approved manual-check rationale: billing/admin micro-spec Vitest evidence in retained legacy filename. | `supabase/migrations/**`<br>`supabase/tests/**`<br>`lib/supabase/**`<br>`lib/**/*.ts` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm db:verify`<br>`pnpm security:verify` | `current`    |

## MS-MERCHANT-AUTH-ONBOARDING-BUSINESS-PROFILE — Merchant Auth, Onboarding, and Business Profile

| Field         | Value                                                                                                                                               |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status        | `active`                                                                                                                                            |
| Risk class    | `auth-session`                                                                                                                                      |
| Change state  | `current`                                                                                                                                           |
| Owner         | `factory-droid`                                                                                                                                     |
| Last reviewed | `2026-06-15`                                                                                                                                        |
| Source        | `micro-specs/02-merchant/01-merchant-auth-onboarding-and-business-profile.md`                                                                       |
| Tests         | `tests/micro-specs/marketing-auth-legal.test.ts`<br>`tests/micro-specs/merchant-launch-readiness.test.ts`<br>`tests/micro-specs/foundation.test.ts` |
| Gates         | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm security:verify`<br>`pnpm build`                                       |
| Supersession  | `not_superseded`: No superseding Micro-Spec replaces this current intent.                                                                           |

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

| Requirement ID                                     | Status   | Risk           | Test tier                                                                | Evidence and rationale                                                                                                                        | Implementation surfaces                                                                                      | Verification commands                                                                                         | Change state |
| -------------------------------------------------- | -------- | -------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | ------------ |
| `MS-MERCHANT-AUTH-ONBOARDING-BUSINESS-PROFILE-001` | `active` | `auth-session` | `build`<br>`governance`<br>`lint`<br>`security`<br>`typecheck`<br>`unit` | tests/micro-specs/marketing-auth-legal.test.ts<br>tests/micro-specs/merchant-launch-readiness.test.ts<br>tests/micro-specs/foundation.test.ts | `app/(auth)/**`<br>`app/auth/**`<br>`app/app/onboarding/**`<br>`lib/auth/**`<br>`lib/merchant/onboarding.ts` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm security:verify`<br>`pnpm build` | `current`    |
| `MS-MERCHANT-AUTH-ONBOARDING-BUSINESS-PROFILE-002` | `active` | `auth-session` | `build`<br>`governance`<br>`lint`<br>`security`<br>`typecheck`<br>`unit` | tests/micro-specs/marketing-auth-legal.test.ts<br>tests/micro-specs/merchant-launch-readiness.test.ts<br>tests/micro-specs/foundation.test.ts | `app/(auth)/**`<br>`app/auth/**`<br>`app/app/onboarding/**`<br>`lib/auth/**`<br>`lib/merchant/onboarding.ts` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm security:verify`<br>`pnpm build` | `current`    |
| `MS-MERCHANT-AUTH-ONBOARDING-BUSINESS-PROFILE-003` | `active` | `auth-session` | `build`<br>`governance`<br>`lint`<br>`security`<br>`typecheck`<br>`unit` | tests/micro-specs/marketing-auth-legal.test.ts<br>tests/micro-specs/merchant-launch-readiness.test.ts<br>tests/micro-specs/foundation.test.ts | `app/(auth)/**`<br>`app/auth/**`<br>`app/app/onboarding/**`<br>`lib/auth/**`<br>`lib/merchant/onboarding.ts` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm security:verify`<br>`pnpm build` | `current`    |
| `MS-MERCHANT-AUTH-ONBOARDING-BUSINESS-PROFILE-004` | `active` | `auth-session` | `build`<br>`governance`<br>`lint`<br>`security`<br>`typecheck`<br>`unit` | tests/micro-specs/marketing-auth-legal.test.ts<br>tests/micro-specs/merchant-launch-readiness.test.ts<br>tests/micro-specs/foundation.test.ts | `app/(auth)/**`<br>`app/auth/**`<br>`app/app/onboarding/**`<br>`lib/auth/**`<br>`lib/merchant/onboarding.ts` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm security:verify`<br>`pnpm build` | `current`    |
| `MS-MERCHANT-AUTH-ONBOARDING-BUSINESS-PROFILE-005` | `active` | `auth-session` | `build`<br>`governance`<br>`lint`<br>`security`<br>`typecheck`<br>`unit` | tests/micro-specs/marketing-auth-legal.test.ts<br>tests/micro-specs/merchant-launch-readiness.test.ts<br>tests/micro-specs/foundation.test.ts | `app/(auth)/**`<br>`app/auth/**`<br>`app/app/onboarding/**`<br>`lib/auth/**`<br>`lib/merchant/onboarding.ts` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm security:verify`<br>`pnpm build` | `current`    |
| `MS-MERCHANT-AUTH-ONBOARDING-BUSINESS-PROFILE-006` | `active` | `auth-session` | `build`<br>`governance`<br>`lint`<br>`security`<br>`typecheck`<br>`unit` | tests/micro-specs/marketing-auth-legal.test.ts<br>tests/micro-specs/merchant-launch-readiness.test.ts<br>tests/micro-specs/foundation.test.ts | `app/(auth)/**`<br>`app/auth/**`<br>`app/app/onboarding/**`<br>`lib/auth/**`<br>`lib/merchant/onboarding.ts` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm security:verify`<br>`pnpm build` | `current`    |
| `MS-MERCHANT-AUTH-ONBOARDING-BUSINESS-PROFILE-007` | `active` | `auth-session` | `build`<br>`governance`<br>`lint`<br>`security`<br>`typecheck`<br>`unit` | tests/micro-specs/marketing-auth-legal.test.ts<br>tests/micro-specs/merchant-launch-readiness.test.ts<br>tests/micro-specs/foundation.test.ts | `app/(auth)/**`<br>`app/auth/**`<br>`app/app/onboarding/**`<br>`lib/auth/**`<br>`lib/merchant/onboarding.ts` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm security:verify`<br>`pnpm build` | `current`    |

## MS-MERCHANT-DYNAMIC-QR-GENERATION-DOWNLOADS — Dynamic QR Generation and Downloads

| Field         | Value                                                                                                                                                                                     |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status        | `active`                                                                                                                                                                                  |
| Risk class    | `rls-rpc-ledger`                                                                                                                                                                          |
| Change state  | `current`                                                                                                                                                                                 |
| Owner         | `factory-droid`                                                                                                                                                                           |
| Last reviewed | `2026-06-15`                                                                                                                                                                              |
| Source        | `micro-specs/02-merchant/03-dynamic-qr-generation-and-downloads.md`                                                                                                                       |
| Tests         | `tests/micro-specs/merchant-qr.test.ts`<br>`tests/micro-specs/merchant-qr-mutations.test.ts`<br>`tests/micro-specs/customer.test.ts`<br>`tests/micro-specs/self-service-stamping.test.ts` |
| Gates         | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm db:verify`<br>`pnpm security:verify`                                                                         |
| Supersession  | `not_superseded`: No superseding Micro-Spec replaces this current intent.                                                                                                                 |

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

| Requirement ID                                    | Status   | Risk             | Test tier                                                                  | Evidence and rationale                                                                                                                                                            | Implementation surfaces                                                                               | Verification commands                                                                                             | Change state |
| ------------------------------------------------- | -------- | ---------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------ |
| `MS-MERCHANT-DYNAMIC-QR-GENERATION-DOWNLOADS-001` | `active` | `rls-rpc-ledger` | `governance`<br>`lint`<br>`security`<br>`sql-rls`<br>`typecheck`<br>`unit` | tests/micro-specs/merchant-qr.test.ts<br>tests/micro-specs/merchant-qr-mutations.test.ts<br>tests/micro-specs/customer.test.ts<br>tests/micro-specs/self-service-stamping.test.ts | `app/app/qr/**`<br>`app/q/**`<br>`lib/merchant/qr-code.ts`<br>`lib/qr/**`<br>`supabase/migrations/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm db:verify`<br>`pnpm security:verify` | `current`    |
| `MS-MERCHANT-DYNAMIC-QR-GENERATION-DOWNLOADS-002` | `active` | `rls-rpc-ledger` | `governance`<br>`lint`<br>`security`<br>`sql-rls`<br>`typecheck`<br>`unit` | tests/micro-specs/merchant-qr.test.ts<br>tests/micro-specs/merchant-qr-mutations.test.ts<br>tests/micro-specs/customer.test.ts<br>tests/micro-specs/self-service-stamping.test.ts | `app/app/qr/**`<br>`app/q/**`<br>`lib/merchant/qr-code.ts`<br>`lib/qr/**`<br>`supabase/migrations/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm db:verify`<br>`pnpm security:verify` | `current`    |
| `MS-MERCHANT-DYNAMIC-QR-GENERATION-DOWNLOADS-003` | `active` | `rls-rpc-ledger` | `governance`<br>`lint`<br>`security`<br>`sql-rls`<br>`typecheck`<br>`unit` | tests/micro-specs/merchant-qr.test.ts<br>tests/micro-specs/merchant-qr-mutations.test.ts<br>tests/micro-specs/customer.test.ts<br>tests/micro-specs/self-service-stamping.test.ts | `app/app/qr/**`<br>`app/q/**`<br>`lib/merchant/qr-code.ts`<br>`lib/qr/**`<br>`supabase/migrations/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm db:verify`<br>`pnpm security:verify` | `current`    |
| `MS-MERCHANT-DYNAMIC-QR-GENERATION-DOWNLOADS-004` | `active` | `rls-rpc-ledger` | `governance`<br>`lint`<br>`security`<br>`sql-rls`<br>`typecheck`<br>`unit` | tests/micro-specs/merchant-qr.test.ts<br>tests/micro-specs/merchant-qr-mutations.test.ts<br>tests/micro-specs/customer.test.ts<br>tests/micro-specs/self-service-stamping.test.ts | `app/app/qr/**`<br>`app/q/**`<br>`lib/merchant/qr-code.ts`<br>`lib/qr/**`<br>`supabase/migrations/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm db:verify`<br>`pnpm security:verify` | `current`    |
| `MS-MERCHANT-DYNAMIC-QR-GENERATION-DOWNLOADS-005` | `active` | `rls-rpc-ledger` | `governance`<br>`lint`<br>`security`<br>`sql-rls`<br>`typecheck`<br>`unit` | tests/micro-specs/merchant-qr.test.ts<br>tests/micro-specs/merchant-qr-mutations.test.ts<br>tests/micro-specs/customer.test.ts<br>tests/micro-specs/self-service-stamping.test.ts | `app/app/qr/**`<br>`app/q/**`<br>`lib/merchant/qr-code.ts`<br>`lib/qr/**`<br>`supabase/migrations/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm db:verify`<br>`pnpm security:verify` | `current`    |
| `MS-MERCHANT-DYNAMIC-QR-GENERATION-DOWNLOADS-006` | `active` | `rls-rpc-ledger` | `governance`<br>`lint`<br>`security`<br>`sql-rls`<br>`typecheck`<br>`unit` | tests/micro-specs/merchant-qr.test.ts<br>tests/micro-specs/merchant-qr-mutations.test.ts<br>tests/micro-specs/customer.test.ts<br>tests/micro-specs/self-service-stamping.test.ts | `app/app/qr/**`<br>`app/q/**`<br>`lib/merchant/qr-code.ts`<br>`lib/qr/**`<br>`supabase/migrations/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm db:verify`<br>`pnpm security:verify` | `current`    |
| `MS-MERCHANT-DYNAMIC-QR-GENERATION-DOWNLOADS-007` | `active` | `rls-rpc-ledger` | `governance`<br>`lint`<br>`security`<br>`sql-rls`<br>`typecheck`<br>`unit` | tests/micro-specs/merchant-qr.test.ts<br>tests/micro-specs/merchant-qr-mutations.test.ts<br>tests/micro-specs/customer.test.ts<br>tests/micro-specs/self-service-stamping.test.ts | `app/app/qr/**`<br>`app/q/**`<br>`lib/merchant/qr-code.ts`<br>`lib/qr/**`<br>`supabase/migrations/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm db:verify`<br>`pnpm security:verify` | `current`    |

## MS-MERCHANT-LOYALTY-CARD-BUILDER — Loyalty Card Builder

| Field         | Value                                                                                                                                                                                                          |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status        | `active`                                                                                                                                                                                                       |
| Risk class    | `rls-rpc-ledger`                                                                                                                                                                                               |
| Change state  | `current`                                                                                                                                                                                                      |
| Owner         | `factory-droid`                                                                                                                                                                                                |
| Last reviewed | `2026-06-15`                                                                                                                                                                                                   |
| Source        | `micro-specs/02-merchant/02-loyalty-card-builder.md`                                                                                                                                                           |
| Tests         | `tests/micro-specs/merchant-launch-readiness.test.ts`<br>`tests/micro-specs/merchant-qr.test.ts`<br>`tests/micro-specs/merchant-qr-mutations.test.ts`<br>`tests/micro-specs/analytics-dashboard-pilot.test.ts` |
| Gates         | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm db:verify`<br>`pnpm security:verify`                                                                                              |
| Supersession  | `not_superseded`: No superseding Micro-Spec replaces this current intent.                                                                                                                                      |

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

| Requirement ID                         | Status   | Risk             | Test tier                                                                  | Evidence and rationale                                                                                                                                                                                 | Implementation surfaces                                                                                                           | Verification commands                                                                                             | Change state |
| -------------------------------------- | -------- | ---------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------ |
| `MS-MERCHANT-LOYALTY-CARD-BUILDER-001` | `active` | `rls-rpc-ledger` | `governance`<br>`lint`<br>`security`<br>`sql-rls`<br>`typecheck`<br>`unit` | tests/micro-specs/merchant-launch-readiness.test.ts<br>tests/micro-specs/merchant-qr.test.ts<br>tests/micro-specs/merchant-qr-mutations.test.ts<br>tests/micro-specs/analytics-dashboard-pilot.test.ts | `app/app/card/**`<br>`app/app/launch/**`<br>`lib/merchant/loyalty-card.ts`<br>`supabase/migrations/**`<br>`components/loyalty/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm db:verify`<br>`pnpm security:verify` | `current`    |
| `MS-MERCHANT-LOYALTY-CARD-BUILDER-002` | `active` | `rls-rpc-ledger` | `governance`<br>`lint`<br>`security`<br>`sql-rls`<br>`typecheck`<br>`unit` | tests/micro-specs/merchant-launch-readiness.test.ts<br>tests/micro-specs/merchant-qr.test.ts<br>tests/micro-specs/merchant-qr-mutations.test.ts<br>tests/micro-specs/analytics-dashboard-pilot.test.ts | `app/app/card/**`<br>`app/app/launch/**`<br>`lib/merchant/loyalty-card.ts`<br>`supabase/migrations/**`<br>`components/loyalty/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm db:verify`<br>`pnpm security:verify` | `current`    |
| `MS-MERCHANT-LOYALTY-CARD-BUILDER-003` | `active` | `rls-rpc-ledger` | `governance`<br>`lint`<br>`security`<br>`sql-rls`<br>`typecheck`<br>`unit` | tests/micro-specs/merchant-launch-readiness.test.ts<br>tests/micro-specs/merchant-qr.test.ts<br>tests/micro-specs/merchant-qr-mutations.test.ts<br>tests/micro-specs/analytics-dashboard-pilot.test.ts | `app/app/card/**`<br>`app/app/launch/**`<br>`lib/merchant/loyalty-card.ts`<br>`supabase/migrations/**`<br>`components/loyalty/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm db:verify`<br>`pnpm security:verify` | `current`    |
| `MS-MERCHANT-LOYALTY-CARD-BUILDER-004` | `active` | `rls-rpc-ledger` | `governance`<br>`lint`<br>`security`<br>`sql-rls`<br>`typecheck`<br>`unit` | tests/micro-specs/merchant-launch-readiness.test.ts<br>tests/micro-specs/merchant-qr.test.ts<br>tests/micro-specs/merchant-qr-mutations.test.ts<br>tests/micro-specs/analytics-dashboard-pilot.test.ts | `app/app/card/**`<br>`app/app/launch/**`<br>`lib/merchant/loyalty-card.ts`<br>`supabase/migrations/**`<br>`components/loyalty/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm db:verify`<br>`pnpm security:verify` | `current`    |
| `MS-MERCHANT-LOYALTY-CARD-BUILDER-005` | `active` | `rls-rpc-ledger` | `governance`<br>`lint`<br>`security`<br>`sql-rls`<br>`typecheck`<br>`unit` | tests/micro-specs/merchant-launch-readiness.test.ts<br>tests/micro-specs/merchant-qr.test.ts<br>tests/micro-specs/merchant-qr-mutations.test.ts<br>tests/micro-specs/analytics-dashboard-pilot.test.ts | `app/app/card/**`<br>`app/app/launch/**`<br>`lib/merchant/loyalty-card.ts`<br>`supabase/migrations/**`<br>`components/loyalty/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm db:verify`<br>`pnpm security:verify` | `current`    |
| `MS-MERCHANT-LOYALTY-CARD-BUILDER-006` | `active` | `rls-rpc-ledger` | `governance`<br>`lint`<br>`security`<br>`sql-rls`<br>`typecheck`<br>`unit` | tests/micro-specs/merchant-launch-readiness.test.ts<br>tests/micro-specs/merchant-qr.test.ts<br>tests/micro-specs/merchant-qr-mutations.test.ts<br>tests/micro-specs/analytics-dashboard-pilot.test.ts | `app/app/card/**`<br>`app/app/launch/**`<br>`lib/merchant/loyalty-card.ts`<br>`supabase/migrations/**`<br>`components/loyalty/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm db:verify`<br>`pnpm security:verify` | `current`    |
| `MS-MERCHANT-LOYALTY-CARD-BUILDER-007` | `active` | `rls-rpc-ledger` | `governance`<br>`lint`<br>`security`<br>`sql-rls`<br>`typecheck`<br>`unit` | tests/micro-specs/merchant-launch-readiness.test.ts<br>tests/micro-specs/merchant-qr.test.ts<br>tests/micro-specs/merchant-qr-mutations.test.ts<br>tests/micro-specs/analytics-dashboard-pilot.test.ts | `app/app/card/**`<br>`app/app/launch/**`<br>`lib/merchant/loyalty-card.ts`<br>`supabase/migrations/**`<br>`components/loyalty/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm db:verify`<br>`pnpm security:verify` | `current`    |
| `MS-MERCHANT-LOYALTY-CARD-BUILDER-008` | `active` | `rls-rpc-ledger` | `governance`<br>`lint`<br>`security`<br>`sql-rls`<br>`typecheck`<br>`unit` | tests/micro-specs/merchant-launch-readiness.test.ts<br>tests/micro-specs/merchant-qr.test.ts<br>tests/micro-specs/merchant-qr-mutations.test.ts<br>tests/micro-specs/analytics-dashboard-pilot.test.ts | `app/app/card/**`<br>`app/app/launch/**`<br>`lib/merchant/loyalty-card.ts`<br>`supabase/migrations/**`<br>`components/loyalty/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm db:verify`<br>`pnpm security:verify` | `current`    |

## MS-MERCHANT-VALUE-CONSOLE-TRUST-IA-CLEANUP — Merchant Console Trust and IA Cleanup

| Field         | Value                                                                                         |
| ------------- | --------------------------------------------------------------------------------------------- |
| Status        | `active`                                                                                      |
| Risk class    | `customer-pii`                                                                                |
| Change state  | `current`                                                                                     |
| Owner         | `factory-droid`                                                                               |
| Last reviewed | `2026-06-15`                                                                                  |
| Source        | `micro-specs/05-merchant-value/02-merchant-console-trust-and-ia-cleanup.md`                   |
| Tests         | `tests/micro-specs/merchant-console-trust-ia.test.ts`                                         |
| Gates         | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm security:verify` |
| Supersession  | `not_superseded`: No superseding Micro-Spec replaces this current intent.                     |

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

| Requirement ID                                   | Status   | Risk           | Test tier                                                     | Evidence and rationale                              | Implementation surfaces                                                                                     | Verification commands                                                                         | Change state |
| ------------------------------------------------ | -------- | -------------- | ------------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------ |
| `MS-MERCHANT-VALUE-CONSOLE-TRUST-IA-CLEANUP-001` | `active` | `customer-pii` | `governance`<br>`lint`<br>`security`<br>`typecheck`<br>`unit` | tests/micro-specs/merchant-console-trust-ia.test.ts | `app/app/**`<br>`components/layout/merchant-app-shell.tsx`<br>`components/merchant/**`<br>`lib/merchant/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm security:verify` | `current`    |
| `MS-MERCHANT-VALUE-CONSOLE-TRUST-IA-CLEANUP-002` | `active` | `customer-pii` | `governance`<br>`lint`<br>`security`<br>`typecheck`<br>`unit` | tests/micro-specs/merchant-console-trust-ia.test.ts | `app/app/**`<br>`components/layout/merchant-app-shell.tsx`<br>`components/merchant/**`<br>`lib/merchant/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm security:verify` | `current`    |
| `MS-MERCHANT-VALUE-CONSOLE-TRUST-IA-CLEANUP-003` | `active` | `customer-pii` | `governance`<br>`lint`<br>`security`<br>`typecheck`<br>`unit` | tests/micro-specs/merchant-console-trust-ia.test.ts | `app/app/**`<br>`components/layout/merchant-app-shell.tsx`<br>`components/merchant/**`<br>`lib/merchant/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm security:verify` | `current`    |
| `MS-MERCHANT-VALUE-CONSOLE-TRUST-IA-CLEANUP-004` | `active` | `customer-pii` | `governance`<br>`lint`<br>`security`<br>`typecheck`<br>`unit` | tests/micro-specs/merchant-console-trust-ia.test.ts | `app/app/**`<br>`components/layout/merchant-app-shell.tsx`<br>`components/merchant/**`<br>`lib/merchant/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm security:verify` | `current`    |
| `MS-MERCHANT-VALUE-CONSOLE-TRUST-IA-CLEANUP-005` | `active` | `customer-pii` | `governance`<br>`lint`<br>`security`<br>`typecheck`<br>`unit` | tests/micro-specs/merchant-console-trust-ia.test.ts | `app/app/**`<br>`components/layout/merchant-app-shell.tsx`<br>`components/merchant/**`<br>`lib/merchant/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm security:verify` | `current`    |
| `MS-MERCHANT-VALUE-CONSOLE-TRUST-IA-CLEANUP-006` | `active` | `customer-pii` | `governance`<br>`lint`<br>`security`<br>`typecheck`<br>`unit` | tests/micro-specs/merchant-console-trust-ia.test.ts | `app/app/**`<br>`components/layout/merchant-app-shell.tsx`<br>`components/merchant/**`<br>`lib/merchant/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm security:verify` | `current`    |
| `MS-MERCHANT-VALUE-CONSOLE-TRUST-IA-CLEANUP-007` | `active` | `customer-pii` | `governance`<br>`lint`<br>`security`<br>`typecheck`<br>`unit` | tests/micro-specs/merchant-console-trust-ia.test.ts | `app/app/**`<br>`components/layout/merchant-app-shell.tsx`<br>`components/merchant/**`<br>`lib/merchant/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm security:verify` | `current`    |
| `MS-MERCHANT-VALUE-CONSOLE-TRUST-IA-CLEANUP-008` | `active` | `customer-pii` | `governance`<br>`lint`<br>`security`<br>`typecheck`<br>`unit` | tests/micro-specs/merchant-console-trust-ia.test.ts | `app/app/**`<br>`components/layout/merchant-app-shell.tsx`<br>`components/merchant/**`<br>`lib/merchant/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm security:verify` | `current`    |
| `MS-MERCHANT-VALUE-CONSOLE-TRUST-IA-CLEANUP-009` | `active` | `customer-pii` | `governance`<br>`lint`<br>`security`<br>`typecheck`<br>`unit` | tests/micro-specs/merchant-console-trust-ia.test.ts | `app/app/**`<br>`components/layout/merchant-app-shell.tsx`<br>`components/merchant/**`<br>`lib/merchant/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm security:verify` | `current`    |
| `MS-MERCHANT-VALUE-CONSOLE-TRUST-IA-CLEANUP-010` | `active` | `customer-pii` | `governance`<br>`lint`<br>`security`<br>`typecheck`<br>`unit` | tests/micro-specs/merchant-console-trust-ia.test.ts | `app/app/**`<br>`components/layout/merchant-app-shell.tsx`<br>`components/merchant/**`<br>`lib/merchant/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm security:verify` | `current`    |

## MS-MERCHANT-VALUE-DASHBOARD-ACTIVITY-ROI — Merchant Dashboard, Activity, and ROI

| Field         | Value                                                                                                                                                                                                                         |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status        | `active`                                                                                                                                                                                                                      |
| Risk class    | `product-analytics`                                                                                                                                                                                                           |
| Change state  | `current`                                                                                                                                                                                                                     |
| Owner         | `factory-droid`                                                                                                                                                                                                               |
| Last reviewed | `2026-06-15`                                                                                                                                                                                                                  |
| Source        | `micro-specs/05-merchant-value/01-merchant-dashboard-activity-and-roi.md`                                                                                                                                                     |
| Tests         | `tests/micro-specs/analytics-dashboard-pilot.test.ts`<br>`tests/micro-specs/perf-rpc-consolidation.test.ts`<br>`tests/micro-specs/merchant-console-trust-ia.test.ts`<br>`tests/micro-specs/merchant-launch-readiness.test.ts` |
| Gates         | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm test:coverage`                                                                                                                                   |
| Supersession  | `not_superseded`: No superseding Micro-Spec replaces this current intent.                                                                                                                                                     |

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

| Requirement ID                                 | Status   | Risk                | Test tier                                                     | Evidence and rationale                                                                                                                                                                                                | Implementation surfaces                                                                                                               | Verification commands                                                                       | Change state |
| ---------------------------------------------- | -------- | ------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------ |
| `MS-MERCHANT-VALUE-DASHBOARD-ACTIVITY-ROI-001` | `active` | `product-analytics` | `coverage`<br>`governance`<br>`lint`<br>`typecheck`<br>`unit` | tests/micro-specs/analytics-dashboard-pilot.test.ts<br>tests/micro-specs/perf-rpc-consolidation.test.ts<br>tests/micro-specs/merchant-console-trust-ia.test.ts<br>tests/micro-specs/merchant-launch-readiness.test.ts | `app/app/**`<br>`components/merchant/**`<br>`lib/merchant/dashboard.ts`<br>`lib/merchant/activity.ts`<br>`lib/admin/pilot-report*.ts` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm test:coverage` | `current`    |
| `MS-MERCHANT-VALUE-DASHBOARD-ACTIVITY-ROI-002` | `active` | `product-analytics` | `coverage`<br>`governance`<br>`lint`<br>`typecheck`<br>`unit` | tests/micro-specs/analytics-dashboard-pilot.test.ts<br>tests/micro-specs/perf-rpc-consolidation.test.ts<br>tests/micro-specs/merchant-console-trust-ia.test.ts<br>tests/micro-specs/merchant-launch-readiness.test.ts | `app/app/**`<br>`components/merchant/**`<br>`lib/merchant/dashboard.ts`<br>`lib/merchant/activity.ts`<br>`lib/admin/pilot-report*.ts` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm test:coverage` | `current`    |
| `MS-MERCHANT-VALUE-DASHBOARD-ACTIVITY-ROI-003` | `active` | `product-analytics` | `coverage`<br>`governance`<br>`lint`<br>`typecheck`<br>`unit` | tests/micro-specs/analytics-dashboard-pilot.test.ts<br>tests/micro-specs/perf-rpc-consolidation.test.ts<br>tests/micro-specs/merchant-console-trust-ia.test.ts<br>tests/micro-specs/merchant-launch-readiness.test.ts | `app/app/**`<br>`components/merchant/**`<br>`lib/merchant/dashboard.ts`<br>`lib/merchant/activity.ts`<br>`lib/admin/pilot-report*.ts` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm test:coverage` | `current`    |
| `MS-MERCHANT-VALUE-DASHBOARD-ACTIVITY-ROI-004` | `active` | `product-analytics` | `coverage`<br>`governance`<br>`lint`<br>`typecheck`<br>`unit` | tests/micro-specs/analytics-dashboard-pilot.test.ts<br>tests/micro-specs/perf-rpc-consolidation.test.ts<br>tests/micro-specs/merchant-console-trust-ia.test.ts<br>tests/micro-specs/merchant-launch-readiness.test.ts | `app/app/**`<br>`components/merchant/**`<br>`lib/merchant/dashboard.ts`<br>`lib/merchant/activity.ts`<br>`lib/admin/pilot-report*.ts` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm test:coverage` | `current`    |
| `MS-MERCHANT-VALUE-DASHBOARD-ACTIVITY-ROI-005` | `active` | `product-analytics` | `coverage`<br>`governance`<br>`lint`<br>`typecheck`<br>`unit` | tests/micro-specs/analytics-dashboard-pilot.test.ts<br>tests/micro-specs/perf-rpc-consolidation.test.ts<br>tests/micro-specs/merchant-console-trust-ia.test.ts<br>tests/micro-specs/merchant-launch-readiness.test.ts | `app/app/**`<br>`components/merchant/**`<br>`lib/merchant/dashboard.ts`<br>`lib/merchant/activity.ts`<br>`lib/admin/pilot-report*.ts` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm test:coverage` | `current`    |
| `MS-MERCHANT-VALUE-DASHBOARD-ACTIVITY-ROI-006` | `active` | `product-analytics` | `coverage`<br>`governance`<br>`lint`<br>`typecheck`<br>`unit` | tests/micro-specs/analytics-dashboard-pilot.test.ts<br>tests/micro-specs/perf-rpc-consolidation.test.ts<br>tests/micro-specs/merchant-console-trust-ia.test.ts<br>tests/micro-specs/merchant-launch-readiness.test.ts | `app/app/**`<br>`components/merchant/**`<br>`lib/merchant/dashboard.ts`<br>`lib/merchant/activity.ts`<br>`lib/admin/pilot-report*.ts` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm test:coverage` | `current`    |

## MS-MVP-SCOPE-RELEASE-GATES — MVP Scope and Release Gates

| Field         | Value                                                                                                                                                                                                                               |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status        | `active`                                                                                                                                                                                                                            |
| Risk class    | `docs-tooling`                                                                                                                                                                                                                      |
| Change state  | `current`                                                                                                                                                                                                                           |
| Owner         | `factory-droid`                                                                                                                                                                                                                     |
| Last reviewed | `2026-06-15`                                                                                                                                                                                                                        |
| Source        | `micro-specs/00-mvp-scope/01-scope-and-release-gates.md`                                                                                                                                                                            |
| Tests         | `tests/micro-specs/analytics-dashboard-pilot.test.ts`<br>`tests/micro-specs/customer.test.ts`<br>`tests/micro-specs/self-service-stamping.test.ts`<br>`manual:billing/admin micro-spec Vitest evidence in retained legacy filename` |
| Gates         | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`                                                                                                                                                                 |
| Supersession  | `not_superseded`: No superseding Micro-Spec replaces this current intent.                                                                                                                                                           |

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

| Requirement ID                   | Status   | Risk           | Test tier                                       | Evidence and rationale                                                                                                                                                                                                                                                                                                                | Implementation surfaces                                              | Verification commands                                               | Change state |
| -------------------------------- | -------- | -------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------ |
| `MS-MVP-SCOPE-RELEASE-GATES-001` | `active` | `docs-tooling` | `governance`<br>`lint`<br>`typecheck`<br>`unit` | tests/micro-specs/analytics-dashboard-pilot.test.ts<br>tests/micro-specs/customer.test.ts<br>tests/micro-specs/self-service-stamping.test.ts<br>manual:billing/admin micro-spec Vitest evidence in retained legacy filename<br>Approved manual-check rationale: billing/admin micro-spec Vitest evidence in retained legacy filename. | `micro-specs/**`<br>`docs/PROJECT_SPEC.md`<br>`docs/ARCHITECTURE.md` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test` | `current`    |
| `MS-MVP-SCOPE-RELEASE-GATES-002` | `active` | `docs-tooling` | `governance`<br>`lint`<br>`typecheck`<br>`unit` | tests/micro-specs/analytics-dashboard-pilot.test.ts<br>tests/micro-specs/customer.test.ts<br>tests/micro-specs/self-service-stamping.test.ts<br>manual:billing/admin micro-spec Vitest evidence in retained legacy filename<br>Approved manual-check rationale: billing/admin micro-spec Vitest evidence in retained legacy filename. | `micro-specs/**`<br>`docs/PROJECT_SPEC.md`<br>`docs/ARCHITECTURE.md` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test` | `current`    |
| `MS-MVP-SCOPE-RELEASE-GATES-003` | `active` | `docs-tooling` | `governance`<br>`lint`<br>`typecheck`<br>`unit` | tests/micro-specs/analytics-dashboard-pilot.test.ts<br>tests/micro-specs/customer.test.ts<br>tests/micro-specs/self-service-stamping.test.ts<br>manual:billing/admin micro-spec Vitest evidence in retained legacy filename<br>Approved manual-check rationale: billing/admin micro-spec Vitest evidence in retained legacy filename. | `micro-specs/**`<br>`docs/PROJECT_SPEC.md`<br>`docs/ARCHITECTURE.md` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test` | `current`    |
| `MS-MVP-SCOPE-RELEASE-GATES-004` | `active` | `docs-tooling` | `governance`<br>`lint`<br>`typecheck`<br>`unit` | tests/micro-specs/analytics-dashboard-pilot.test.ts<br>tests/micro-specs/customer.test.ts<br>tests/micro-specs/self-service-stamping.test.ts<br>manual:billing/admin micro-spec Vitest evidence in retained legacy filename<br>Approved manual-check rationale: billing/admin micro-spec Vitest evidence in retained legacy filename. | `micro-specs/**`<br>`docs/PROJECT_SPEC.md`<br>`docs/ARCHITECTURE.md` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test` | `current`    |
| `MS-MVP-SCOPE-RELEASE-GATES-005` | `active` | `docs-tooling` | `governance`<br>`lint`<br>`typecheck`<br>`unit` | tests/micro-specs/analytics-dashboard-pilot.test.ts<br>tests/micro-specs/customer.test.ts<br>tests/micro-specs/self-service-stamping.test.ts<br>manual:billing/admin micro-spec Vitest evidence in retained legacy filename<br>Approved manual-check rationale: billing/admin micro-spec Vitest evidence in retained legacy filename. | `micro-specs/**`<br>`docs/PROJECT_SPEC.md`<br>`docs/ARCHITECTURE.md` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test` | `current`    |
| `MS-MVP-SCOPE-RELEASE-GATES-006` | `active` | `docs-tooling` | `governance`<br>`lint`<br>`typecheck`<br>`unit` | tests/micro-specs/analytics-dashboard-pilot.test.ts<br>tests/micro-specs/customer.test.ts<br>tests/micro-specs/self-service-stamping.test.ts<br>manual:billing/admin micro-spec Vitest evidence in retained legacy filename<br>Approved manual-check rationale: billing/admin micro-spec Vitest evidence in retained legacy filename. | `micro-specs/**`<br>`docs/PROJECT_SPEC.md`<br>`docs/ARCHITECTURE.md` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test` | `current`    |
| `MS-MVP-SCOPE-RELEASE-GATES-007` | `active` | `docs-tooling` | `governance`<br>`lint`<br>`typecheck`<br>`unit` | tests/micro-specs/analytics-dashboard-pilot.test.ts<br>tests/micro-specs/customer.test.ts<br>tests/micro-specs/self-service-stamping.test.ts<br>manual:billing/admin micro-spec Vitest evidence in retained legacy filename<br>Approved manual-check rationale: billing/admin micro-spec Vitest evidence in retained legacy filename. | `micro-specs/**`<br>`docs/PROJECT_SPEC.md`<br>`docs/ARCHITECTURE.md` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test` | `current`    |

## MS-OBSERVABILITY-COMPLIANCE-CONSENT-LEGAL-DATA-REQUESTS — Consent, Legal Pages, and Data Requests

| Field         | Value                                                                                                                                                                                                                                          |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status        | `active`                                                                                                                                                                                                                                       |
| Risk class    | `customer-pii`                                                                                                                                                                                                                                 |
| Change state  | `current`                                                                                                                                                                                                                                      |
| Owner         | `factory-droid`                                                                                                                                                                                                                                |
| Last reviewed | `2026-06-15`                                                                                                                                                                                                                                   |
| Source        | `micro-specs/07-observability-compliance/02-consent-legal-pages-and-data-requests.md`                                                                                                                                                          |
| Tests         | `tests/micro-specs/customer.test.ts`<br>`tests/micro-specs/home-profile.test.ts`<br>`tests/micro-specs/customer-legal-sheets.test.ts`<br>`supabase/tests/customer_marketing_consent.sql`<br>`tests/micro-specs/admin-console-redesign.test.ts` |
| Gates         | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm security:verify`                                                                                                                                                  |
| Supersession  | `not_superseded`: No superseding Micro-Spec replaces this current intent.                                                                                                                                                                      |

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

| Requirement ID                                                | Status   | Risk           | Test tier                                                     | Evidence and rationale                                                                                                                                                                                                               | Implementation surfaces                                                                                                                                      | Verification commands                                                                         | Change state |
| ------------------------------------------------------------- | -------- | -------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- | ------------ |
| `MS-OBSERVABILITY-COMPLIANCE-CONSENT-LEGAL-DATA-REQUESTS-001` | `active` | `customer-pii` | `governance`<br>`lint`<br>`security`<br>`typecheck`<br>`unit` | tests/micro-specs/customer.test.ts<br>tests/micro-specs/home-profile.test.ts<br>tests/micro-specs/customer-legal-sheets.test.ts<br>supabase/tests/customer_marketing_consent.sql<br>tests/micro-specs/admin-console-redesign.test.ts | `app/privacy/**`<br>`app/terms/**`<br>`app/merchant/**`<br>`app/admin/privacy/**`<br>`lib/customer/consent.ts`<br>`lib/legal/**`<br>`supabase/migrations/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm security:verify` | `current`    |
| `MS-OBSERVABILITY-COMPLIANCE-CONSENT-LEGAL-DATA-REQUESTS-002` | `active` | `customer-pii` | `governance`<br>`lint`<br>`security`<br>`typecheck`<br>`unit` | tests/micro-specs/customer.test.ts<br>tests/micro-specs/home-profile.test.ts<br>tests/micro-specs/customer-legal-sheets.test.ts<br>supabase/tests/customer_marketing_consent.sql<br>tests/micro-specs/admin-console-redesign.test.ts | `app/privacy/**`<br>`app/terms/**`<br>`app/merchant/**`<br>`app/admin/privacy/**`<br>`lib/customer/consent.ts`<br>`lib/legal/**`<br>`supabase/migrations/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm security:verify` | `current`    |
| `MS-OBSERVABILITY-COMPLIANCE-CONSENT-LEGAL-DATA-REQUESTS-003` | `active` | `customer-pii` | `governance`<br>`lint`<br>`security`<br>`typecheck`<br>`unit` | tests/micro-specs/customer.test.ts<br>tests/micro-specs/home-profile.test.ts<br>tests/micro-specs/customer-legal-sheets.test.ts<br>supabase/tests/customer_marketing_consent.sql<br>tests/micro-specs/admin-console-redesign.test.ts | `app/privacy/**`<br>`app/terms/**`<br>`app/merchant/**`<br>`app/admin/privacy/**`<br>`lib/customer/consent.ts`<br>`lib/legal/**`<br>`supabase/migrations/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm security:verify` | `current`    |
| `MS-OBSERVABILITY-COMPLIANCE-CONSENT-LEGAL-DATA-REQUESTS-004` | `active` | `customer-pii` | `governance`<br>`lint`<br>`security`<br>`typecheck`<br>`unit` | tests/micro-specs/customer.test.ts<br>tests/micro-specs/home-profile.test.ts<br>tests/micro-specs/customer-legal-sheets.test.ts<br>supabase/tests/customer_marketing_consent.sql<br>tests/micro-specs/admin-console-redesign.test.ts | `app/privacy/**`<br>`app/terms/**`<br>`app/merchant/**`<br>`app/admin/privacy/**`<br>`lib/customer/consent.ts`<br>`lib/legal/**`<br>`supabase/migrations/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm security:verify` | `current`    |
| `MS-OBSERVABILITY-COMPLIANCE-CONSENT-LEGAL-DATA-REQUESTS-005` | `active` | `customer-pii` | `governance`<br>`lint`<br>`security`<br>`typecheck`<br>`unit` | tests/micro-specs/customer.test.ts<br>tests/micro-specs/home-profile.test.ts<br>tests/micro-specs/customer-legal-sheets.test.ts<br>supabase/tests/customer_marketing_consent.sql<br>tests/micro-specs/admin-console-redesign.test.ts | `app/privacy/**`<br>`app/terms/**`<br>`app/merchant/**`<br>`app/admin/privacy/**`<br>`lib/customer/consent.ts`<br>`lib/legal/**`<br>`supabase/migrations/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm security:verify` | `current`    |
| `MS-OBSERVABILITY-COMPLIANCE-CONSENT-LEGAL-DATA-REQUESTS-006` | `active` | `customer-pii` | `governance`<br>`lint`<br>`security`<br>`typecheck`<br>`unit` | tests/micro-specs/customer.test.ts<br>tests/micro-specs/home-profile.test.ts<br>tests/micro-specs/customer-legal-sheets.test.ts<br>supabase/tests/customer_marketing_consent.sql<br>tests/micro-specs/admin-console-redesign.test.ts | `app/privacy/**`<br>`app/terms/**`<br>`app/merchant/**`<br>`app/admin/privacy/**`<br>`lib/customer/consent.ts`<br>`lib/legal/**`<br>`supabase/migrations/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm security:verify` | `current`    |

## MS-OBSERVABILITY-COMPLIANCE-EVENTS-ANALYTICS-FUNNELS — Events, Analytics, and Funnels

| Field         | Value                                                                                                                                                    |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status        | `active`                                                                                                                                                 |
| Risk class    | `product-analytics`                                                                                                                                      |
| Change state  | `current`                                                                                                                                                |
| Owner         | `factory-droid`                                                                                                                                          |
| Last reviewed | `2026-06-15`                                                                                                                                             |
| Source        | `micro-specs/07-observability-compliance/01-events-analytics-and-funnels.md`                                                                             |
| Tests         | `tests/micro-specs/analytics-dashboard-pilot.test.ts`<br>`tests/micro-specs/observability.test.ts`<br>`tests/micro-specs/perf-rpc-consolidation.test.ts` |
| Gates         | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm test:coverage`                                                              |
| Supersession  | `not_superseded`: No superseding Micro-Spec replaces this current intent.                                                                                |

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

| Requirement ID                                             | Status   | Risk                | Test tier                                                     | Evidence and rationale                                                                                                                             | Implementation surfaces                                                                                         | Verification commands                                                                       | Change state |
| ---------------------------------------------------------- | -------- | ------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------ |
| `MS-OBSERVABILITY-COMPLIANCE-EVENTS-ANALYTICS-FUNNELS-001` | `active` | `product-analytics` | `coverage`<br>`governance`<br>`lint`<br>`typecheck`<br>`unit` | tests/micro-specs/analytics-dashboard-pilot.test.ts<br>tests/micro-specs/observability.test.ts<br>tests/micro-specs/perf-rpc-consolidation.test.ts | `lib/analytics/**`<br>`lib/merchant/**`<br>`lib/admin/pilot-report*.ts`<br>`app/**`<br>`supabase/migrations/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm test:coverage` | `current`    |
| `MS-OBSERVABILITY-COMPLIANCE-EVENTS-ANALYTICS-FUNNELS-002` | `active` | `product-analytics` | `coverage`<br>`governance`<br>`lint`<br>`typecheck`<br>`unit` | tests/micro-specs/analytics-dashboard-pilot.test.ts<br>tests/micro-specs/observability.test.ts<br>tests/micro-specs/perf-rpc-consolidation.test.ts | `lib/analytics/**`<br>`lib/merchant/**`<br>`lib/admin/pilot-report*.ts`<br>`app/**`<br>`supabase/migrations/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm test:coverage` | `current`    |
| `MS-OBSERVABILITY-COMPLIANCE-EVENTS-ANALYTICS-FUNNELS-003` | `active` | `product-analytics` | `coverage`<br>`governance`<br>`lint`<br>`typecheck`<br>`unit` | tests/micro-specs/analytics-dashboard-pilot.test.ts<br>tests/micro-specs/observability.test.ts<br>tests/micro-specs/perf-rpc-consolidation.test.ts | `lib/analytics/**`<br>`lib/merchant/**`<br>`lib/admin/pilot-report*.ts`<br>`app/**`<br>`supabase/migrations/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm test:coverage` | `current`    |
| `MS-OBSERVABILITY-COMPLIANCE-EVENTS-ANALYTICS-FUNNELS-004` | `active` | `product-analytics` | `coverage`<br>`governance`<br>`lint`<br>`typecheck`<br>`unit` | tests/micro-specs/analytics-dashboard-pilot.test.ts<br>tests/micro-specs/observability.test.ts<br>tests/micro-specs/perf-rpc-consolidation.test.ts | `lib/analytics/**`<br>`lib/merchant/**`<br>`lib/admin/pilot-report*.ts`<br>`app/**`<br>`supabase/migrations/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm test:coverage` | `current`    |
| `MS-OBSERVABILITY-COMPLIANCE-EVENTS-ANALYTICS-FUNNELS-005` | `active` | `product-analytics` | `coverage`<br>`governance`<br>`lint`<br>`typecheck`<br>`unit` | tests/micro-specs/analytics-dashboard-pilot.test.ts<br>tests/micro-specs/observability.test.ts<br>tests/micro-specs/perf-rpc-consolidation.test.ts | `lib/analytics/**`<br>`lib/merchant/**`<br>`lib/admin/pilot-report*.ts`<br>`app/**`<br>`supabase/migrations/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm test:coverage` | `current`    |

## MS-OBSERVABILITY-COMPLIANCE-SECURITY-FRAUD-RATE-LIMITS — Security, Fraud, and Rate Limits

| Field         | Value                                                                                                                                                                                                                                                                                                                      |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status        | `active`                                                                                                                                                                                                                                                                                                                   |
| Risk class    | `webhooks`                                                                                                                                                                                                                                                                                                                 |
| Change state  | `current`                                                                                                                                                                                                                                                                                                                  |
| Owner         | `factory-droid`                                                                                                                                                                                                                                                                                                            |
| Last reviewed | `2026-06-15`                                                                                                                                                                                                                                                                                                               |
| Source        | `micro-specs/07-observability-compliance/03-security-fraud-and-rate-limits.md`                                                                                                                                                                                                                                             |
| Tests         | `tests/micro-specs/customer.test.ts`<br>`tests/micro-specs/self-service-stamping.test.ts`<br>`manual:billing/admin micro-spec Vitest evidence in retained legacy filename`<br>`tests/micro-specs/admin-console-redesign.test.ts`<br>`supabase/tests/tenant_isolation.sql`<br>`supabase/tests/reward_redemption_cycles.sql` |
| Gates         | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm security:verify`<br>`pnpm db:verify`                                                                                                                                                                                                          |
| Supersession  | `not_superseded`: No superseding Micro-Spec replaces this current intent.                                                                                                                                                                                                                                                  |

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

| Requirement ID                                               | Status   | Risk       | Test tier                                                                  | Evidence and rationale                                                                                                                                                                                                                                                                                                                                                                                                   | Implementation surfaces                                                                                                                              | Verification commands                                                                                             | Change state |
| ------------------------------------------------------------ | -------- | ---------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------ |
| `MS-OBSERVABILITY-COMPLIANCE-SECURITY-FRAUD-RATE-LIMITS-001` | `active` | `webhooks` | `governance`<br>`lint`<br>`security`<br>`sql-rls`<br>`typecheck`<br>`unit` | tests/micro-specs/customer.test.ts<br>tests/micro-specs/self-service-stamping.test.ts<br>manual:billing/admin micro-spec Vitest evidence in retained legacy filename<br>tests/micro-specs/admin-console-redesign.test.ts<br>supabase/tests/tenant_isolation.sql<br>supabase/tests/reward_redemption_cycles.sql<br>Approved manual-check rationale: billing/admin micro-spec Vitest evidence in retained legacy filename. | `lib/security/**`<br>`app/api/stripe/**`<br>`app/admin/**`<br>`lib/admin/**`<br>`lib/customer/**`<br>`supabase/migrations/**`<br>`supabase/tests/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm security:verify`<br>`pnpm db:verify` | `current`    |
| `MS-OBSERVABILITY-COMPLIANCE-SECURITY-FRAUD-RATE-LIMITS-002` | `active` | `webhooks` | `governance`<br>`lint`<br>`security`<br>`sql-rls`<br>`typecheck`<br>`unit` | tests/micro-specs/customer.test.ts<br>tests/micro-specs/self-service-stamping.test.ts<br>manual:billing/admin micro-spec Vitest evidence in retained legacy filename<br>tests/micro-specs/admin-console-redesign.test.ts<br>supabase/tests/tenant_isolation.sql<br>supabase/tests/reward_redemption_cycles.sql<br>Approved manual-check rationale: billing/admin micro-spec Vitest evidence in retained legacy filename. | `lib/security/**`<br>`app/api/stripe/**`<br>`app/admin/**`<br>`lib/admin/**`<br>`lib/customer/**`<br>`supabase/migrations/**`<br>`supabase/tests/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm security:verify`<br>`pnpm db:verify` | `current`    |
| `MS-OBSERVABILITY-COMPLIANCE-SECURITY-FRAUD-RATE-LIMITS-003` | `active` | `webhooks` | `governance`<br>`lint`<br>`security`<br>`sql-rls`<br>`typecheck`<br>`unit` | tests/micro-specs/customer.test.ts<br>tests/micro-specs/self-service-stamping.test.ts<br>manual:billing/admin micro-spec Vitest evidence in retained legacy filename<br>tests/micro-specs/admin-console-redesign.test.ts<br>supabase/tests/tenant_isolation.sql<br>supabase/tests/reward_redemption_cycles.sql<br>Approved manual-check rationale: billing/admin micro-spec Vitest evidence in retained legacy filename. | `lib/security/**`<br>`app/api/stripe/**`<br>`app/admin/**`<br>`lib/admin/**`<br>`lib/customer/**`<br>`supabase/migrations/**`<br>`supabase/tests/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm security:verify`<br>`pnpm db:verify` | `current`    |
| `MS-OBSERVABILITY-COMPLIANCE-SECURITY-FRAUD-RATE-LIMITS-004` | `active` | `webhooks` | `governance`<br>`lint`<br>`security`<br>`sql-rls`<br>`typecheck`<br>`unit` | tests/micro-specs/customer.test.ts<br>tests/micro-specs/self-service-stamping.test.ts<br>manual:billing/admin micro-spec Vitest evidence in retained legacy filename<br>tests/micro-specs/admin-console-redesign.test.ts<br>supabase/tests/tenant_isolation.sql<br>supabase/tests/reward_redemption_cycles.sql<br>Approved manual-check rationale: billing/admin micro-spec Vitest evidence in retained legacy filename. | `lib/security/**`<br>`app/api/stripe/**`<br>`app/admin/**`<br>`lib/admin/**`<br>`lib/customer/**`<br>`supabase/migrations/**`<br>`supabase/tests/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm security:verify`<br>`pnpm db:verify` | `current`    |
| `MS-OBSERVABILITY-COMPLIANCE-SECURITY-FRAUD-RATE-LIMITS-005` | `active` | `webhooks` | `governance`<br>`lint`<br>`security`<br>`sql-rls`<br>`typecheck`<br>`unit` | tests/micro-specs/customer.test.ts<br>tests/micro-specs/self-service-stamping.test.ts<br>manual:billing/admin micro-spec Vitest evidence in retained legacy filename<br>tests/micro-specs/admin-console-redesign.test.ts<br>supabase/tests/tenant_isolation.sql<br>supabase/tests/reward_redemption_cycles.sql<br>Approved manual-check rationale: billing/admin micro-spec Vitest evidence in retained legacy filename. | `lib/security/**`<br>`app/api/stripe/**`<br>`app/admin/**`<br>`lib/admin/**`<br>`lib/customer/**`<br>`supabase/migrations/**`<br>`supabase/tests/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm security:verify`<br>`pnpm db:verify` | `current`    |
| `MS-OBSERVABILITY-COMPLIANCE-SECURITY-FRAUD-RATE-LIMITS-006` | `active` | `webhooks` | `governance`<br>`lint`<br>`security`<br>`sql-rls`<br>`typecheck`<br>`unit` | tests/micro-specs/customer.test.ts<br>tests/micro-specs/self-service-stamping.test.ts<br>manual:billing/admin micro-spec Vitest evidence in retained legacy filename<br>tests/micro-specs/admin-console-redesign.test.ts<br>supabase/tests/tenant_isolation.sql<br>supabase/tests/reward_redemption_cycles.sql<br>Approved manual-check rationale: billing/admin micro-spec Vitest evidence in retained legacy filename. | `lib/security/**`<br>`app/api/stripe/**`<br>`app/admin/**`<br>`lib/admin/**`<br>`lib/customer/**`<br>`supabase/migrations/**`<br>`supabase/tests/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm security:verify`<br>`pnpm db:verify` | `current`    |
| `MS-OBSERVABILITY-COMPLIANCE-SECURITY-FRAUD-RATE-LIMITS-007` | `active` | `webhooks` | `governance`<br>`lint`<br>`security`<br>`sql-rls`<br>`typecheck`<br>`unit` | tests/micro-specs/customer.test.ts<br>tests/micro-specs/self-service-stamping.test.ts<br>manual:billing/admin micro-spec Vitest evidence in retained legacy filename<br>tests/micro-specs/admin-console-redesign.test.ts<br>supabase/tests/tenant_isolation.sql<br>supabase/tests/reward_redemption_cycles.sql<br>Approved manual-check rationale: billing/admin micro-spec Vitest evidence in retained legacy filename. | `lib/security/**`<br>`app/api/stripe/**`<br>`app/admin/**`<br>`lib/admin/**`<br>`lib/customer/**`<br>`supabase/migrations/**`<br>`supabase/tests/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm security:verify`<br>`pnpm db:verify` | `current`    |
| `MS-OBSERVABILITY-COMPLIANCE-SECURITY-FRAUD-RATE-LIMITS-008` | `active` | `webhooks` | `governance`<br>`lint`<br>`security`<br>`sql-rls`<br>`typecheck`<br>`unit` | tests/micro-specs/customer.test.ts<br>tests/micro-specs/self-service-stamping.test.ts<br>manual:billing/admin micro-spec Vitest evidence in retained legacy filename<br>tests/micro-specs/admin-console-redesign.test.ts<br>supabase/tests/tenant_isolation.sql<br>supabase/tests/reward_redemption_cycles.sql<br>Approved manual-check rationale: billing/admin micro-spec Vitest evidence in retained legacy filename. | `lib/security/**`<br>`app/api/stripe/**`<br>`app/admin/**`<br>`lib/admin/**`<br>`lib/customer/**`<br>`supabase/migrations/**`<br>`supabase/tests/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm security:verify`<br>`pnpm db:verify` | `current`    |
| `MS-OBSERVABILITY-COMPLIANCE-SECURITY-FRAUD-RATE-LIMITS-009` | `active` | `webhooks` | `governance`<br>`lint`<br>`security`<br>`sql-rls`<br>`typecheck`<br>`unit` | tests/micro-specs/customer.test.ts<br>tests/micro-specs/self-service-stamping.test.ts<br>manual:billing/admin micro-spec Vitest evidence in retained legacy filename<br>tests/micro-specs/admin-console-redesign.test.ts<br>supabase/tests/tenant_isolation.sql<br>supabase/tests/reward_redemption_cycles.sql<br>Approved manual-check rationale: billing/admin micro-spec Vitest evidence in retained legacy filename. | `lib/security/**`<br>`app/api/stripe/**`<br>`app/admin/**`<br>`lib/admin/**`<br>`lib/customer/**`<br>`supabase/migrations/**`<br>`supabase/tests/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm security:verify`<br>`pnpm db:verify` | `current`    |

## MS-PILOT-READINESS-VALIDATION — Pilot Readiness and Validation

| Field         | Value                                                                                                                                                                                                                                              |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status        | `active`                                                                                                                                                                                                                                           |
| Risk class    | `product-analytics`                                                                                                                                                                                                                                |
| Change state  | `current`                                                                                                                                                                                                                                          |
| Owner         | `factory-droid`                                                                                                                                                                                                                                    |
| Last reviewed | `2026-06-15`                                                                                                                                                                                                                                       |
| Source        | `micro-specs/08-pilot/01-pilot-readiness-and-validation.md`                                                                                                                                                                                        |
| Tests         | `tests/micro-specs/analytics-dashboard-pilot.test.ts`<br>`tests/micro-specs/perf-rpc-consolidation.test.ts`<br>`manual:billing/admin micro-spec Vitest evidence in retained legacy filename`<br>`tests/micro-specs/admin-console-redesign.test.ts` |
| Gates         | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm test:coverage`                                                                                                                                                        |
| Supersession  | `not_superseded`: No superseding Micro-Spec replaces this current intent.                                                                                                                                                                          |

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

| Requirement ID                      | Status   | Risk                | Test tier                                                     | Evidence and rationale                                                                                                                                                                                                                                                                                                                               | Implementation surfaces                                                                                               | Verification commands                                                                       | Change state |
| ----------------------------------- | -------- | ------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------ |
| `MS-PILOT-READINESS-VALIDATION-001` | `active` | `product-analytics` | `coverage`<br>`governance`<br>`lint`<br>`typecheck`<br>`unit` | tests/micro-specs/analytics-dashboard-pilot.test.ts<br>tests/micro-specs/perf-rpc-consolidation.test.ts<br>manual:billing/admin micro-spec Vitest evidence in retained legacy filename<br>tests/micro-specs/admin-console-redesign.test.ts<br>Approved manual-check rationale: billing/admin micro-spec Vitest evidence in retained legacy filename. | `app/admin/pilot/**`<br>`lib/admin/pilot-report*.ts`<br>`lib/merchant/dashboard*.ts`<br>`docs/**`<br>`micro-specs/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm test:coverage` | `current`    |
| `MS-PILOT-READINESS-VALIDATION-002` | `active` | `product-analytics` | `coverage`<br>`governance`<br>`lint`<br>`typecheck`<br>`unit` | tests/micro-specs/analytics-dashboard-pilot.test.ts<br>tests/micro-specs/perf-rpc-consolidation.test.ts<br>manual:billing/admin micro-spec Vitest evidence in retained legacy filename<br>tests/micro-specs/admin-console-redesign.test.ts<br>Approved manual-check rationale: billing/admin micro-spec Vitest evidence in retained legacy filename. | `app/admin/pilot/**`<br>`lib/admin/pilot-report*.ts`<br>`lib/merchant/dashboard*.ts`<br>`docs/**`<br>`micro-specs/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm test:coverage` | `current`    |
| `MS-PILOT-READINESS-VALIDATION-003` | `active` | `product-analytics` | `coverage`<br>`governance`<br>`lint`<br>`typecheck`<br>`unit` | tests/micro-specs/analytics-dashboard-pilot.test.ts<br>tests/micro-specs/perf-rpc-consolidation.test.ts<br>manual:billing/admin micro-spec Vitest evidence in retained legacy filename<br>tests/micro-specs/admin-console-redesign.test.ts<br>Approved manual-check rationale: billing/admin micro-spec Vitest evidence in retained legacy filename. | `app/admin/pilot/**`<br>`lib/admin/pilot-report*.ts`<br>`lib/merchant/dashboard*.ts`<br>`docs/**`<br>`micro-specs/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm test:coverage` | `current`    |
| `MS-PILOT-READINESS-VALIDATION-004` | `active` | `product-analytics` | `coverage`<br>`governance`<br>`lint`<br>`typecheck`<br>`unit` | tests/micro-specs/analytics-dashboard-pilot.test.ts<br>tests/micro-specs/perf-rpc-consolidation.test.ts<br>manual:billing/admin micro-spec Vitest evidence in retained legacy filename<br>tests/micro-specs/admin-console-redesign.test.ts<br>Approved manual-check rationale: billing/admin micro-spec Vitest evidence in retained legacy filename. | `app/admin/pilot/**`<br>`lib/admin/pilot-report*.ts`<br>`lib/merchant/dashboard*.ts`<br>`docs/**`<br>`micro-specs/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm test:coverage` | `current`    |
| `MS-PILOT-READINESS-VALIDATION-005` | `active` | `product-analytics` | `coverage`<br>`governance`<br>`lint`<br>`typecheck`<br>`unit` | tests/micro-specs/analytics-dashboard-pilot.test.ts<br>tests/micro-specs/perf-rpc-consolidation.test.ts<br>manual:billing/admin micro-spec Vitest evidence in retained legacy filename<br>tests/micro-specs/admin-console-redesign.test.ts<br>Approved manual-check rationale: billing/admin micro-spec Vitest evidence in retained legacy filename. | `app/admin/pilot/**`<br>`lib/admin/pilot-report*.ts`<br>`lib/merchant/dashboard*.ts`<br>`docs/**`<br>`micro-specs/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm test:coverage` | `current`    |
| `MS-PILOT-READINESS-VALIDATION-006` | `active` | `product-analytics` | `coverage`<br>`governance`<br>`lint`<br>`typecheck`<br>`unit` | tests/micro-specs/analytics-dashboard-pilot.test.ts<br>tests/micro-specs/perf-rpc-consolidation.test.ts<br>manual:billing/admin micro-spec Vitest evidence in retained legacy filename<br>tests/micro-specs/admin-console-redesign.test.ts<br>Approved manual-check rationale: billing/admin micro-spec Vitest evidence in retained legacy filename. | `app/admin/pilot/**`<br>`lib/admin/pilot-report*.ts`<br>`lib/merchant/dashboard*.ts`<br>`docs/**`<br>`micro-specs/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm test:coverage` | `current`    |
| `MS-PILOT-READINESS-VALIDATION-007` | `active` | `product-analytics` | `coverage`<br>`governance`<br>`lint`<br>`typecheck`<br>`unit` | tests/micro-specs/analytics-dashboard-pilot.test.ts<br>tests/micro-specs/perf-rpc-consolidation.test.ts<br>manual:billing/admin micro-spec Vitest evidence in retained legacy filename<br>tests/micro-specs/admin-console-redesign.test.ts<br>Approved manual-check rationale: billing/admin micro-spec Vitest evidence in retained legacy filename. | `app/admin/pilot/**`<br>`lib/admin/pilot-report*.ts`<br>`lib/merchant/dashboard*.ts`<br>`docs/**`<br>`micro-specs/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm test:coverage` | `current`    |
| `MS-PILOT-READINESS-VALIDATION-008` | `active` | `product-analytics` | `coverage`<br>`governance`<br>`lint`<br>`typecheck`<br>`unit` | tests/micro-specs/analytics-dashboard-pilot.test.ts<br>tests/micro-specs/perf-rpc-consolidation.test.ts<br>manual:billing/admin micro-spec Vitest evidence in retained legacy filename<br>tests/micro-specs/admin-console-redesign.test.ts<br>Approved manual-check rationale: billing/admin micro-spec Vitest evidence in retained legacy filename. | `app/admin/pilot/**`<br>`lib/admin/pilot-report*.ts`<br>`lib/merchant/dashboard*.ts`<br>`docs/**`<br>`micro-specs/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm test:coverage` | `current`    |

## MS-STAFF-REWARDS-REWARD-UNLOCK-REDEMPTION — Reward Unlock and Redemption

| Field         | Value                                                                                                                                                                                                                                                           |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status        | `active`                                                                                                                                                                                                                                                        |
| Risk class    | `rls-rpc-ledger`                                                                                                                                                                                                                                                |
| Change state  | `current`                                                                                                                                                                                                                                                       |
| Owner         | `factory-droid`                                                                                                                                                                                                                                                 |
| Last reviewed | `2026-06-15`                                                                                                                                                                                                                                                    |
| Source        | `micro-specs/04-staff-rewards/02-reward-unlock-and-redemption.md`                                                                                                                                                                                               |
| Tests         | `tests/micro-specs/merchant-scanned-reward.test.ts`<br>`tests/micro-specs/reward-redemption-cycles.test.ts`<br>`tests/micro-specs/reward-profile-gate.test.ts`<br>`supabase/tests/reward_redemption_cycles.sql`<br>`supabase/tests/profile_completion_gate.sql` |
| Gates         | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm db:verify`<br>`pnpm security:verify`                                                                                                                                               |
| Supersession  | `not_superseded`: No superseding Micro-Spec replaces this current intent.                                                                                                                                                                                       |

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

| Requirement ID                                  | Status   | Risk             | Test tier                                                                  | Evidence and rationale                                                                                                                                                                                                                                | Implementation surfaces                                                                                                                                       | Verification commands                                                                                             | Change state |
| ----------------------------------------------- | -------- | ---------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------ |
| `MS-STAFF-REWARDS-REWARD-UNLOCK-REDEMPTION-001` | `active` | `rls-rpc-ledger` | `governance`<br>`lint`<br>`security`<br>`sql-rls`<br>`typecheck`<br>`unit` | tests/micro-specs/merchant-scanned-reward.test.ts<br>tests/micro-specs/reward-redemption-cycles.test.ts<br>tests/micro-specs/reward-profile-gate.test.ts<br>supabase/tests/reward_redemption_cycles.sql<br>supabase/tests/profile_completion_gate.sql | `app/reward/**`<br>`app/app/rewards/**`<br>`lib/customer/reward.ts`<br>`lib/merchant/reward-collection.ts`<br>`supabase/migrations/**`<br>`supabase/tests/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm db:verify`<br>`pnpm security:verify` | `current`    |
| `MS-STAFF-REWARDS-REWARD-UNLOCK-REDEMPTION-002` | `active` | `rls-rpc-ledger` | `governance`<br>`lint`<br>`security`<br>`sql-rls`<br>`typecheck`<br>`unit` | tests/micro-specs/merchant-scanned-reward.test.ts<br>tests/micro-specs/reward-redemption-cycles.test.ts<br>tests/micro-specs/reward-profile-gate.test.ts<br>supabase/tests/reward_redemption_cycles.sql<br>supabase/tests/profile_completion_gate.sql | `app/reward/**`<br>`app/app/rewards/**`<br>`lib/customer/reward.ts`<br>`lib/merchant/reward-collection.ts`<br>`supabase/migrations/**`<br>`supabase/tests/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm db:verify`<br>`pnpm security:verify` | `current`    |
| `MS-STAFF-REWARDS-REWARD-UNLOCK-REDEMPTION-003` | `active` | `rls-rpc-ledger` | `governance`<br>`lint`<br>`security`<br>`sql-rls`<br>`typecheck`<br>`unit` | tests/micro-specs/merchant-scanned-reward.test.ts<br>tests/micro-specs/reward-redemption-cycles.test.ts<br>tests/micro-specs/reward-profile-gate.test.ts<br>supabase/tests/reward_redemption_cycles.sql<br>supabase/tests/profile_completion_gate.sql | `app/reward/**`<br>`app/app/rewards/**`<br>`lib/customer/reward.ts`<br>`lib/merchant/reward-collection.ts`<br>`supabase/migrations/**`<br>`supabase/tests/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm db:verify`<br>`pnpm security:verify` | `current`    |
| `MS-STAFF-REWARDS-REWARD-UNLOCK-REDEMPTION-004` | `active` | `rls-rpc-ledger` | `governance`<br>`lint`<br>`security`<br>`sql-rls`<br>`typecheck`<br>`unit` | tests/micro-specs/merchant-scanned-reward.test.ts<br>tests/micro-specs/reward-redemption-cycles.test.ts<br>tests/micro-specs/reward-profile-gate.test.ts<br>supabase/tests/reward_redemption_cycles.sql<br>supabase/tests/profile_completion_gate.sql | `app/reward/**`<br>`app/app/rewards/**`<br>`lib/customer/reward.ts`<br>`lib/merchant/reward-collection.ts`<br>`supabase/migrations/**`<br>`supabase/tests/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm db:verify`<br>`pnpm security:verify` | `current`    |
| `MS-STAFF-REWARDS-REWARD-UNLOCK-REDEMPTION-005` | `active` | `rls-rpc-ledger` | `governance`<br>`lint`<br>`security`<br>`sql-rls`<br>`typecheck`<br>`unit` | tests/micro-specs/merchant-scanned-reward.test.ts<br>tests/micro-specs/reward-redemption-cycles.test.ts<br>tests/micro-specs/reward-profile-gate.test.ts<br>supabase/tests/reward_redemption_cycles.sql<br>supabase/tests/profile_completion_gate.sql | `app/reward/**`<br>`app/app/rewards/**`<br>`lib/customer/reward.ts`<br>`lib/merchant/reward-collection.ts`<br>`supabase/migrations/**`<br>`supabase/tests/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm db:verify`<br>`pnpm security:verify` | `current`    |
| `MS-STAFF-REWARDS-REWARD-UNLOCK-REDEMPTION-006` | `active` | `rls-rpc-ledger` | `governance`<br>`lint`<br>`security`<br>`sql-rls`<br>`typecheck`<br>`unit` | tests/micro-specs/merchant-scanned-reward.test.ts<br>tests/micro-specs/reward-redemption-cycles.test.ts<br>tests/micro-specs/reward-profile-gate.test.ts<br>supabase/tests/reward_redemption_cycles.sql<br>supabase/tests/profile_completion_gate.sql | `app/reward/**`<br>`app/app/rewards/**`<br>`lib/customer/reward.ts`<br>`lib/merchant/reward-collection.ts`<br>`supabase/migrations/**`<br>`supabase/tests/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm db:verify`<br>`pnpm security:verify` | `current`    |
| `MS-STAFF-REWARDS-REWARD-UNLOCK-REDEMPTION-007` | `active` | `rls-rpc-ledger` | `governance`<br>`lint`<br>`security`<br>`sql-rls`<br>`typecheck`<br>`unit` | tests/micro-specs/merchant-scanned-reward.test.ts<br>tests/micro-specs/reward-redemption-cycles.test.ts<br>tests/micro-specs/reward-profile-gate.test.ts<br>supabase/tests/reward_redemption_cycles.sql<br>supabase/tests/profile_completion_gate.sql | `app/reward/**`<br>`app/app/rewards/**`<br>`lib/customer/reward.ts`<br>`lib/merchant/reward-collection.ts`<br>`supabase/migrations/**`<br>`supabase/tests/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm db:verify`<br>`pnpm security:verify` | `current`    |
| `MS-STAFF-REWARDS-REWARD-UNLOCK-REDEMPTION-008` | `active` | `rls-rpc-ledger` | `governance`<br>`lint`<br>`security`<br>`sql-rls`<br>`typecheck`<br>`unit` | tests/micro-specs/merchant-scanned-reward.test.ts<br>tests/micro-specs/reward-redemption-cycles.test.ts<br>tests/micro-specs/reward-profile-gate.test.ts<br>supabase/tests/reward_redemption_cycles.sql<br>supabase/tests/profile_completion_gate.sql | `app/reward/**`<br>`app/app/rewards/**`<br>`lib/customer/reward.ts`<br>`lib/merchant/reward-collection.ts`<br>`supabase/migrations/**`<br>`supabase/tests/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm db:verify`<br>`pnpm security:verify` | `current`    |

## MS-STAFF-REWARDS-SELF-SERVICE-STAMP-ISSUING — Self-Service Stamp Issuing

| Field         | Value                                                                                                                                                                                                        |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Status        | `active`                                                                                                                                                                                                     |
| Risk class    | `rls-rpc-ledger`                                                                                                                                                                                             |
| Change state  | `current`                                                                                                                                                                                                    |
| Owner         | `factory-droid`                                                                                                                                                                                              |
| Last reviewed | `2026-06-15`                                                                                                                                                                                                 |
| Source        | `micro-specs/04-staff-rewards/01-self-service-stamp-issuing.md`                                                                                                                                              |
| Tests         | `tests/micro-specs/self-service-stamping.test.ts`<br>`tests/micro-specs/returning-qr-redirect.test.ts`<br>`tests/micro-specs/customer-stamp-loader.test.ts`<br>`supabase/tests/reward_redemption_cycles.sql` |
| Gates         | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm db:verify`<br>`pnpm security:verify`                                                                                            |
| Supersession  | `not_superseded`: No superseding Micro-Spec replaces this current intent.                                                                                                                                    |

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

| Requirement ID                                    | Status   | Risk             | Test tier                                                                  | Evidence and rationale                                                                                                                                                                               | Implementation surfaces                                                                                                                              | Verification commands                                                                                             | Change state |
| ------------------------------------------------- | -------- | ---------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------ |
| `MS-STAFF-REWARDS-SELF-SERVICE-STAMP-ISSUING-001` | `active` | `rls-rpc-ledger` | `governance`<br>`lint`<br>`security`<br>`sql-rls`<br>`typecheck`<br>`unit` | tests/micro-specs/self-service-stamping.test.ts<br>tests/micro-specs/returning-qr-redirect.test.ts<br>tests/micro-specs/customer-stamp-loader.test.ts<br>supabase/tests/reward_redemption_cycles.sql | `app/q/**`<br>`app/card/**`<br>`lib/customer/stamp.ts`<br>`lib/customer/returning-qr-redirect.ts`<br>`supabase/migrations/**`<br>`supabase/tests/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm db:verify`<br>`pnpm security:verify` | `current`    |
| `MS-STAFF-REWARDS-SELF-SERVICE-STAMP-ISSUING-002` | `active` | `rls-rpc-ledger` | `governance`<br>`lint`<br>`security`<br>`sql-rls`<br>`typecheck`<br>`unit` | tests/micro-specs/self-service-stamping.test.ts<br>tests/micro-specs/returning-qr-redirect.test.ts<br>tests/micro-specs/customer-stamp-loader.test.ts<br>supabase/tests/reward_redemption_cycles.sql | `app/q/**`<br>`app/card/**`<br>`lib/customer/stamp.ts`<br>`lib/customer/returning-qr-redirect.ts`<br>`supabase/migrations/**`<br>`supabase/tests/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm db:verify`<br>`pnpm security:verify` | `current`    |
| `MS-STAFF-REWARDS-SELF-SERVICE-STAMP-ISSUING-003` | `active` | `rls-rpc-ledger` | `governance`<br>`lint`<br>`security`<br>`sql-rls`<br>`typecheck`<br>`unit` | tests/micro-specs/self-service-stamping.test.ts<br>tests/micro-specs/returning-qr-redirect.test.ts<br>tests/micro-specs/customer-stamp-loader.test.ts<br>supabase/tests/reward_redemption_cycles.sql | `app/q/**`<br>`app/card/**`<br>`lib/customer/stamp.ts`<br>`lib/customer/returning-qr-redirect.ts`<br>`supabase/migrations/**`<br>`supabase/tests/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm db:verify`<br>`pnpm security:verify` | `current`    |
| `MS-STAFF-REWARDS-SELF-SERVICE-STAMP-ISSUING-004` | `active` | `rls-rpc-ledger` | `governance`<br>`lint`<br>`security`<br>`sql-rls`<br>`typecheck`<br>`unit` | tests/micro-specs/self-service-stamping.test.ts<br>tests/micro-specs/returning-qr-redirect.test.ts<br>tests/micro-specs/customer-stamp-loader.test.ts<br>supabase/tests/reward_redemption_cycles.sql | `app/q/**`<br>`app/card/**`<br>`lib/customer/stamp.ts`<br>`lib/customer/returning-qr-redirect.ts`<br>`supabase/migrations/**`<br>`supabase/tests/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm db:verify`<br>`pnpm security:verify` | `current`    |
| `MS-STAFF-REWARDS-SELF-SERVICE-STAMP-ISSUING-005` | `active` | `rls-rpc-ledger` | `governance`<br>`lint`<br>`security`<br>`sql-rls`<br>`typecheck`<br>`unit` | tests/micro-specs/self-service-stamping.test.ts<br>tests/micro-specs/returning-qr-redirect.test.ts<br>tests/micro-specs/customer-stamp-loader.test.ts<br>supabase/tests/reward_redemption_cycles.sql | `app/q/**`<br>`app/card/**`<br>`lib/customer/stamp.ts`<br>`lib/customer/returning-qr-redirect.ts`<br>`supabase/migrations/**`<br>`supabase/tests/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm db:verify`<br>`pnpm security:verify` | `current`    |
| `MS-STAFF-REWARDS-SELF-SERVICE-STAMP-ISSUING-006` | `active` | `rls-rpc-ledger` | `governance`<br>`lint`<br>`security`<br>`sql-rls`<br>`typecheck`<br>`unit` | tests/micro-specs/self-service-stamping.test.ts<br>tests/micro-specs/returning-qr-redirect.test.ts<br>tests/micro-specs/customer-stamp-loader.test.ts<br>supabase/tests/reward_redemption_cycles.sql | `app/q/**`<br>`app/card/**`<br>`lib/customer/stamp.ts`<br>`lib/customer/returning-qr-redirect.ts`<br>`supabase/migrations/**`<br>`supabase/tests/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm db:verify`<br>`pnpm security:verify` | `current`    |
| `MS-STAFF-REWARDS-SELF-SERVICE-STAMP-ISSUING-007` | `active` | `rls-rpc-ledger` | `governance`<br>`lint`<br>`security`<br>`sql-rls`<br>`typecheck`<br>`unit` | tests/micro-specs/self-service-stamping.test.ts<br>tests/micro-specs/returning-qr-redirect.test.ts<br>tests/micro-specs/customer-stamp-loader.test.ts<br>supabase/tests/reward_redemption_cycles.sql | `app/q/**`<br>`app/card/**`<br>`lib/customer/stamp.ts`<br>`lib/customer/returning-qr-redirect.ts`<br>`supabase/migrations/**`<br>`supabase/tests/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm db:verify`<br>`pnpm security:verify` | `current`    |
| `MS-STAFF-REWARDS-SELF-SERVICE-STAMP-ISSUING-008` | `active` | `rls-rpc-ledger` | `governance`<br>`lint`<br>`security`<br>`sql-rls`<br>`typecheck`<br>`unit` | tests/micro-specs/self-service-stamping.test.ts<br>tests/micro-specs/returning-qr-redirect.test.ts<br>tests/micro-specs/customer-stamp-loader.test.ts<br>supabase/tests/reward_redemption_cycles.sql | `app/q/**`<br>`app/card/**`<br>`lib/customer/stamp.ts`<br>`lib/customer/returning-qr-redirect.ts`<br>`supabase/migrations/**`<br>`supabase/tests/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm db:verify`<br>`pnpm security:verify` | `current`    |
| `MS-STAFF-REWARDS-SELF-SERVICE-STAMP-ISSUING-009` | `active` | `rls-rpc-ledger` | `governance`<br>`lint`<br>`security`<br>`sql-rls`<br>`typecheck`<br>`unit` | tests/micro-specs/self-service-stamping.test.ts<br>tests/micro-specs/returning-qr-redirect.test.ts<br>tests/micro-specs/customer-stamp-loader.test.ts<br>supabase/tests/reward_redemption_cycles.sql | `app/q/**`<br>`app/card/**`<br>`lib/customer/stamp.ts`<br>`lib/customer/returning-qr-redirect.ts`<br>`supabase/migrations/**`<br>`supabase/tests/**` | `pnpm governance`<br>`pnpm lint`<br>`pnpm typecheck`<br>`pnpm test`<br>`pnpm db:verify`<br>`pnpm security:verify` | `current`    |
