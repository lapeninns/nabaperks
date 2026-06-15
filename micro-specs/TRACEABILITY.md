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
