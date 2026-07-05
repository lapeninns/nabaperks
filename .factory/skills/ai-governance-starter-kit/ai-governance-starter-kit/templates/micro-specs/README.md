# AI Governance Index

This folder is the repository's AI delivery contract. It defines how agents
author, validate, execute, and verify Micro-Specs against the current buildable
app. The spine is deliberately small and machine-enforceable: what agents can
implement, which files they may touch, and which gates prove the work.

## Source Documents

- `Instructions_MicroSpecsCreation.md` — how to author a Micro-Spec.
- `Instructions_tdd.md` — Red → Green → Refactor implementation workflow.
- `micro-specs/GLOBAL_CONTEXT.md` — reusable, repo-specific constraints.
- `AGENTS.md` — agent entrypoint and working rules.
- `scripts/check-governance.mjs` — validates metadata, risk gates, blast
  radius, docs drift, and gate-command shape.
- `scripts/run-governance-gates.mjs` — runs the verification gates declared by
  active Micro-Specs.

## Source-of-Truth Hierarchy

When artifacts disagree, use this order:

1. User instructions in the current session.
2. Live app code, migrations, and checked-in configuration.
3. `AGENTS.md` for agent-facing repo rules.
4. `micro-specs/GLOBAL_CONTEXT.md` for reusable constraints.
5. Active Micro-Spec files under `micro-specs/`.
6. `Instructions_MicroSpecsCreation.md` and `Instructions_tdd.md`.

Only current, checked-in files in this hierarchy are implementation truth.

## Micro-Spec Metadata Schema

Every Micro-Spec (except `README.md` and `GLOBAL_CONTEXT.md`) must start with
this YAML frontmatter. Only `status: active` can drive implementation.

```yaml
spec_id: MS-<area>-<slug>
status: draft | active | implemented | verified | superseded
risk_class: docs-tooling | ui-only | data-model | auth-session | billing | webhooks | migrations | infra | security | ai-agent
owner: <person-or-agent>
last_reviewed: YYYY-MM-DD
allowed_blast_radius:
  - <repo-local path or glob>
implementation_surfaces:
  - <repo-local path or glob>
related_tests:
  - <repo-local test path>
verification_gates:
  - <manager> <script>        # e.g. pnpm test, npm run build
required_playwright_projects: []
evidence_required:
  - <command output, artifact, trace, or review evidence>
approved_exceptions: []
```

### Strict Metadata Enforcement

The checker parses frontmatter with a strict YAML subset and refuses to
guess. Supported: `key: scalar` (optionally quoted), `key:` + dash list,
`key: []`, inline flow lists `[a, b]`, comments, and blank lines. Anything
else — wrapped/continuation lines, nested maps, block scalars, tabs,
duplicate keys — fails with a file:line error. Keep every entry on one line.

Additional enforced rules:

- `allowed_blast_radius` / `implementation_surfaces` patterns must be bare
  paths or globs (`**` crosses segments, `*` stays within one, `?` is one
  character) with no whitespace.
- Every `implementation_surfaces` entry must fall inside the spec's own
  `allowed_blast_radius`.
- `related_tests` entries must be literal existing paths (or the
  `not-yet-created` sentinel); `draft` specs are exempt.
- `approved_exceptions` entries must end with `(expires: YYYY-MM-DD)` and
  fail once expired — exceptions are temporary by construction.
- An `active` spec whose `last_reviewed` is older than the configured
  staleness window fails until it is re-reviewed and the date bumped.

## Lifecycle Status Vocabulary

- `draft`: intent can be refined, but implementation must not start.
- `active`: ready for implementation after reconciliation against live code.
- `implemented`: code exists and required checks have run, but final review
  evidence is not complete.
- `verified`: implementation evidence, review notes, and required gates are
  complete.
- `superseded`: non-current and blocked for implementation.

Draft, implemented, verified, and superseded specs are not valid new
implementation inputs.

## Lifecycle Transition Policy

| From          | To            | Required evidence                                                                                     |
| ------------- | ------------- | ----------------------------------------------------------------------------------------------------- |
| `draft`       | `active`      | Complete metadata, testable acceptance criteria, risk class, blast radius, gates, evidence needs.     |
| `active`      | `implemented` | Requirements mapped to checks, Red → Green → Refactor evidence where applicable, in-scope files only. |
| `implemented` | `verified`    | Passing gates, review notes, and manual QA evidence when the changed surface is user-visible.         |
| `active`      | `superseded`  | Supersession link or rationale.                                                                        |

## Risk Gate Matrix

The checker enforces a required gate floor for each **active** spec. Floors are
expressed as script *roles*, not fixed commands, so they stay portable. A role
in the "when present" column is required only if your repo actually defines
that script; a repo without, say, a `build` script is not forced to invent one.

| risk_class     | Always required        | Required when the script exists                          | Durable proof |
| -------------- | ---------------------- | -------------------------------------------------------- | ------------- |
| `docs-tooling` | governance:check, test | lint, typecheck                                          | —             |
| `ui-only`      | governance:check, test | lint, typecheck, build, test:e2e, test:a11y, test:visual, bundle:check | —  |
| `data-model`   | governance:check, test | lint, typecheck, build                                   | required      |
| `auth-session` | governance:check, test | lint, typecheck, build, test:e2e                         | required      |
| `billing`      | governance:check, test | lint, typecheck, build, test:e2e                         | required      |
| `webhooks`     | governance:check, test | lint, typecheck, build                                   | required      |
| `migrations`   | governance:check, test | lint, typecheck, build                                   | required      |
| `infra`        | governance:check, test | lint, typecheck, build                                   | —             |
| `security`     | governance:check, test | lint, typecheck, build; plus `manual:security-review`    | —             |
| `ai-agent`     | governance:check, test | lint, typecheck, build                                   | —             |

**Durable proof** means a non-browser-only gate that reads back real behavior:
one of `test:db`, `test:integration`, `test:contract`, `test:e2e`, `db:test`,
`integration`, `e2e`. A high-risk spec must declare one when the repo has it,
or record a dated `approved_exceptions` entry explaining the gap. Browser-only
(Playwright) proof does **not** substitute for data, auth, billing, webhook, or
migration correctness.

Any spec that declares a `test:e2e`, `test:a11y`, or `test:visual` gate must
also list non-empty `required_playwright_projects` and a related test under
`tests/e2e/`, `tests/a11y/`, or `tests/visual/`. Evidence keywords are enforced
too: `a11y`/`accessibility`, `visual`, or `coverage` in `evidence_required`
force the matching gate when that script exists.

## Current Verification Gates

Keep this section synchronized with CI — the checker fails on drift between the
commands your CI workflow runs and the list below.

- {{GOVERNANCE_CHECK_COMMAND}}
- {{GOVERNANCE_RUN_GATES_COMMAND}}
- {{LINT_COMMAND}}
- {{TYPECHECK_COMMAND}}
- {{TEST_COMMAND}}
- {{BUILD_COMMAND}}

`{{GOVERNANCE_CHECK_COMMAND}}` validates metadata, risk gates, blast radius,
docs drift, and gate-command shape. `{{GOVERNANCE_RUN_GATES_COMMAND}}` reads
active Micro-Specs and runs their declared `verification_gates`.

## Active-Spec Rule

If changed files exist and no active Micro-Spec covers them, governance fails.
On pull requests the checker diffs against the base branch
(`origin/<base>...HEAD`), so blast-radius enforcement runs in CI — this requires
a full-history checkout (`fetch-depth: 0`). Create or update an active
Micro-Spec before implementation.

## Evidence Model

- Test output: lint, typecheck, build, unit/integration/DB tests, and browser
  gates when declared.
- CI artifacts: reports, traces, and screenshots on failure when browser gates
  are declared.
- Spec status-transition notes stay inside the Micro-Spec.
- No tracked screenshot or evidence folders unless explicitly requested.

## Working Rule

Before implementing an active Micro-Spec, inspect the live repo and narrow the
task to requirements that are not already satisfied. If the spec conflicts with
buildable code, stop and reconcile the spec before editing production files.

## Approved Exceptions

Exceptions live in `approved_exceptions` on the relevant Micro-Spec. Keep them
specific, dated in the body, and temporary.
