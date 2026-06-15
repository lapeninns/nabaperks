# Micro-Spec Traceability

This is the human-readable traceability index for the governance foundation.
The machine-readable companion is `micro-specs/traceability.json`.

## Foundation Scope

Full corpus traceability will be expanded by the spec normalization work. The
foundation scope records the governance contract and validator that later
migration work must obey.

### GOV-GOVERNANCE-FOUNDATION

| Field         | Value                                                         |
| ------------- | ------------------------------------------------------------- |
| Status        | `implemented`                                                 |
| Risk class    | `docs-tooling`                                                |
| Owner         | `factory-droid`                                               |
| Last reviewed | `2026-06-15`                                                  |
| Contract      | `micro-specs/README.md#ai-governance-contract`                |
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

#### Requirements

| Requirement ID                  | Summary                                                                                                         | Evidence                                                                                                                                                  |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GOV-GOVERNANCE-FOUNDATION-001` | Canonical governance hierarchy is documented and validated.                                                     | `micro-specs/README.md`, `tests/micro-specs/ai-governance.test.ts`                                                                                        |
| `GOV-GOVERNANCE-FOUNDATION-002` | Lifecycle status, transition, risk, and gate vocabulary is documented and validated.                            | `micro-specs/README.md`, `tests/micro-specs/ai-governance.test.ts`                                                                                        |
| `GOV-GOVERNANCE-FOUNDATION-003` | Traceability JSON and Markdown are present and synchronized for the foundation scope.                           | `micro-specs/traceability.json`, `micro-specs/TRACEABILITY.md`, `tests/micro-specs/ai-governance.test.ts`                                                 |
| `GOV-GOVERNANCE-FOUNDATION-004` | Governance validation is pnpm aligned, deterministic, read-only, and not soft-failed.                           | `scripts/check-governance.mjs`, `package.json`, `.github/workflows/ci.yml`, `.github/actions/setup/action.yml`, `tests/micro-specs/ai-governance.test.ts` |
| `GOV-GOVERNANCE-FOUNDATION-005` | Governance-only work is CLI-first and browser evidence is required only when product runtime risk calls for it. | `micro-specs/README.md`, `.github/pull_request_template.md`, `tests/micro-specs/ai-governance.test.ts`                                                    |

Handoff evidence:

- Product: `GOV-GOVERNANCE-FOUNDATION` linked the five foundation requirements
  to docs-tooling scope, lifecycle status, owner/date, and bounded intent.
- Engineering: Red → Green → Refactor evidence is recorded per requirement in
  `micro-specs/traceability.json`.
- Reviewer: approved with `pnpm governance` evidence.
- Release: reconciles `pnpm governance` and `pnpm quality`, with risks and
  follow-ups kept separate from completed evidence.

### GOV-HANDOFF-FIXTURES-TESTS

| Field         | Value                                                         |
| ------------- | ------------------------------------------------------------- |
| Status        | `implemented`                                                 |
| Risk class    | `docs-tooling`                                                |
| Owner         | `factory-droid`                                               |
| Last reviewed | `2026-06-15`                                                  |
| Contract      | `micro-specs/README.md#ai-governance-contract`                |
| Tests         | `tests/micro-specs/ai-governance.test.ts`                     |
| Fixtures      | `tests/fixtures/governance/handoff-workflows.json`            |
| Gates         | `pnpm governance`, `pnpm lint`, `pnpm typecheck`, `pnpm test` |

Allowed blast radius:

- `scripts/check-governance.mjs`
- `tests/micro-specs/ai-governance.test.ts`
- `tests/fixtures/governance/**`
- `micro-specs/TRACEABILITY.md`
- `micro-specs/traceability.json`
- `.github/**`

#### Requirements

| Requirement ID                   | Summary                                                                                                                                                                         | Evidence                                                                                                                      |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `GOV-HANDOFF-FIXTURES-TESTS-001` | Malformed lifecycle fixtures fail for missing metadata, invalid status, duplicate IDs, invalid risk class, missing supersession, and stale references.                          | `tests/fixtures/governance/handoff-workflows.json`, `tests/micro-specs/ai-governance.test.ts`, `scripts/check-governance.mjs` |
| `GOV-HANDOFF-FIXTURES-TESTS-002` | Governance automation rejects missing metadata, duplicate IDs, invalid risk class, broken traceability, and soft-fail CI configuration.                                         | `tests/micro-specs/ai-governance.test.ts`, `scripts/check-governance.mjs`, `.github/workflows/ci.yml`                         |
| `GOV-HANDOFF-FIXTURES-TESTS-003` | Compliant handoff fixtures demonstrate Product to Engineering to Reviewer to Release evidence without widening scope.                                                           | `tests/fixtures/governance/handoff-workflows.json`, `tests/micro-specs/ai-governance.test.ts`                                 |
| `GOV-HANDOFF-FIXTURES-TESTS-004` | Malformed workflow fixtures fail for missing handoff fields, missing TDD evidence, missing as-built reconciliation, missing blast-radius confirmation, and broken traceability. | `tests/fixtures/governance/handoff-workflows.json`, `tests/micro-specs/ai-governance.test.ts`, `scripts/check-governance.mjs` |
| `GOV-HANDOFF-FIXTURES-TESTS-005` | Reviewer decisions cite spec IDs, requirement IDs, risk class, and verification output.                                                                                         | `tests/fixtures/governance/handoff-workflows.json`, `scripts/check-governance.mjs`                                            |
| `GOV-HANDOFF-FIXTURES-TESTS-006` | Release handoff evidence reconciles governance, quality, lint, typecheck, tests, and risk-specific gates while keeping risks and follow-ups separate.                           | `tests/fixtures/governance/handoff-workflows.json`, `micro-specs/traceability.json`, `scripts/check-governance.mjs`           |

Handoff evidence:

- Product: `GOV-HANDOFF-FIXTURES-TESTS` records bounded intent, requirement IDs,
  lifecycle status, docs-tooling risk class, owner/date, and scope confirmation.
- Engineering: the fixture records Red → Green → Refactor evidence per
  requirement, as-built reconciliation, files touched, and blast-radius
  confirmation.
- Reviewer: the reviewer decision cites the spec ID, all requirement IDs, risk
  class, and scoped Vitest output.
- Release: the release handoff reconciles `pnpm governance`, `pnpm quality`,
  `pnpm lint`, `pnpm typecheck`, and `pnpm test` with risks and follow-ups in
  distinct fields.
