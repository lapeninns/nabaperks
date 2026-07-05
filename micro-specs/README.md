# AI Governance Index

This folder is the repo-local AI governance spine. It defines how agents author,
validate, execute, and verify Micro-Specs against the current buildable app.

## Source Documents

- `Instructions_MircroSpecsCreation.md` - Product-side Micro-Spec authoring
  rules. The filename is retained for compatibility.
- `Instructions_tdd.md` - Engineering-side Red -> Green -> Refactor workflow.
- `micro-specs/GLOBAL_CONTEXT.md` - reusable project rules and constraints.
- `AGENTS.md` - agent entrypoint for the current app and governance routing.
- `DESIGN.md` - Wet Ink design-system source of truth.

## Current State

Active implementation input is limited to Micro-Spec files whose metadata says
`status: active`. The current active docs-tooling spec is:

- `micro-specs/governance/ai-delivery-framework.md`

Keep this folder limited to current governance files and active Micro-Specs
explicitly requested by the user. Do not add planning packs, generated route
docs, screenshot evidence folders, design-source mirrors, or `.omo` evidence
files unless explicitly requested.

## Source-of-Truth Hierarchy

When artifacts disagree, use this order:

1. Live app code, Supabase migrations, and checked-in configuration.
2. `DESIGN.md` for visual language, tokens, and shared component conventions.
3. `AGENTS.md` for agent-facing repo rules.
4. `micro-specs/GLOBAL_CONTEXT.md` for reusable AI governance constraints.
5. Active Micro-Spec files created under `micro-specs/`.
6. `Instructions_MircroSpecsCreation.md` and `Instructions_tdd.md` for
   authoring and implementation workflow.

Only current checked-in files in this hierarchy are implementation truth.

## Micro-Spec Metadata Schema

Every Micro-Spec file must start with this YAML block. Only `status: active`
can drive implementation.

```yaml
spec_id: MS-<area>-<slug>
status: draft | active | implemented | verified | superseded
risk_class: docs-tooling | ui-only | product-analytics | customer-pii | auth-session | billing | webhooks | rls-rpc-ledger | migrations
owner: <person-or-agent>
last_reviewed: YYYY-MM-DD
allowed_blast_radius:
  - <repo-local path or glob>
implementation_surfaces:
  - <repo-local path or glob>
related_docs:
  - <repo-local path>
related_tests:
  - <repo-local test path>
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
required_playwright_projects: []
evidence_required:
  - <CI artifact, command output, trace, screenshot, or review evidence>
approved_exceptions: []
```

`related_tests` must not use `not-yet-created` for an active spec that requires
browser, DB, webhook, RLS, ledger, migration, accessibility, or visual proof.
Add the harness inside the spec blast radius first.

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
  `not-yet-created` sentinel); `draft` specs are exempt from the existence
  check.
- `approved_exceptions` entries must end with `(expires: YYYY-MM-DD)` and
  fail once expired — exceptions are temporary by construction.
- An `active` spec whose `last_reviewed` is more than 30 days old fails until
  it is re-reviewed and the date bumped.
- Docs-drift is bidirectional: the gate list below must equal the gate
  commands `ci.yml` actually runs (`run: |` blocks included), in both
  directions.

## Lifecycle Status Vocabulary

- `draft`: intent can be refined, but implementation must not start.
- `active`: ready for Engineering after reconciliation against live code.
- `implemented`: code exists and required checks have been run, but final
  review evidence is not complete.
- `verified`: implementation evidence, review notes, and required gates are
  complete.
- `superseded`: non-current and blocked for implementation unless a new active
  spec or approved exception says otherwise.

Draft, implemented, verified, and superseded specs are not valid new
implementation inputs.

## Lifecycle Transition Policy

| From          | To            | Required evidence                                                                                              |
| ------------- | ------------- | -------------------------------------------------------------------------------------------------------------- |
| `draft`       | `active`      | Complete metadata, EARS requirements, risk class, blast radius, verification gates, and evidence requirements. |
| `active`      | `implemented` | Requirement IDs mapped to checks, Red -> Green -> Refactor evidence where applicable, and in-scope files only. |
| `implemented` | `verified`    | Passing gates, review notes, CI artifacts, and manual QA evidence when the changed surface is user-visible.    |
| `active`      | `superseded`  | Supersession link or rationale.                                                                                |
| `implemented` | `superseded`  | Replacement spec or explicit product decision.                                                                 |

## Risk Gate Matrix

The governance checker enforces the required gate floor for active specs.

| risk_class          | Applies to                                                        | Required gate floor                                                                                                                                                                                                     |
| ------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs-tooling`      | Governance docs, scripts, CI, templates, and review records.      | `pnpm lint`, `pnpm typecheck`, `pnpm governance:check`, `pnpm test`, `pnpm test:coverage`.                                                                                                                              |
| `ui-only`           | Visual or copy changes without data mutation changes.             | `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test`, `pnpm test:coverage`, `pnpm bundle:check`, `pnpm test:e2e`, `pnpm test:a11y`, `pnpm test:visual`, plus Playwright evidence for changed user-visible surfaces. |
| `product-analytics` | Event naming, funnels, reports, and PostHog mirrors.              | `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test`, `pnpm test:coverage`, and event-contract assertions.                                                                                                          |
| `customer-pii`      | Customer phone, consent, identity, profile, or privacy surfaces.  | `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test`, `pnpm test:coverage`, `pnpm test:e2e`, plus evidence that unnecessary personal data is not exposed.                                                           |
| `auth-session`      | Merchant, customer, admin, cookie, OTP, or session behavior.      | `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test`, `pnpm test:coverage`, `pnpm test:e2e`, plus server/session assertions.                                                                                        |
| `billing`           | Stripe checkout, portal, subscription sync, or entitlement gates. | `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test`, `pnpm test:coverage`, `pnpm test:db`, `pnpm test:e2e`; checkout/portal UX plus Stripe webhook/db assertions.                                                  |
| `webhooks`          | Stripe or future inbound webhook handlers.                        | `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test`, `pnpm test:coverage`, `pnpm test:db`; signature, idempotency, and database readback assertions.                                                               |
| `rls-rpc-ledger`    | Supabase RLS, RPCs, loyalty ledger, fraud, or audit invariants.   | `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test`, `pnpm test:coverage`, `pnpm test:db`, `pnpm test:e2e`; DB behavioral tests are primary and Playwright is secondary journey proof.                             |
| `migrations`        | Supabase migrations or schema changes.                            | `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test`, `pnpm test:coverage`, `pnpm test:db`; replay/idempotency on a disposable database.                                                                            |

Accessibility-sensitive UI must declare `pnpm test:a11y`. Visual-sensitive UI
must declare `pnpm test:visual`. Playwright DB-free harness routes are useful
for UI proof, but they are not proof of RLS, billing, webhook, or ledger
correctness.

## Current Verification Gates

The current CI-enforced baseline is:

```bash
pnpm lint
pnpm typecheck
pnpm governance:check
pnpm governance:run-gates
pnpm tokens:check
pnpm claims:check
pnpm test
pnpm test:coverage
pnpm build
pnpm bundle:check
pnpm e2e:install
pnpm test:e2e -- --project=chromium --project=mobile-safari --grep "@governance|@a11y|PWA offline fallback|architecture remediation harness gate"
pnpm test:a11y -- --project=chromium --project=mobile-safari
pnpm test:visual -- --project=chromium --project=mobile-safari
pnpm lighthouse
pnpm db:seed
pnpm test:db
pnpm jsonld:check
```

`pnpm test` runs the repo's node Micro-Spec tests.
`pnpm governance:run-gates` reads active Micro-Specs and runs their declared
`verification_gates` after `pnpm governance:check` validates metadata, risk
gates, blast radius, docs drift, and command shape.

`pnpm test:e2e`, `pnpm test:a11y`, and `pnpm test:visual` run through
Playwright against `playwright.config.ts`. The CI DB-free browser tier runs the
governance landing smoke, accessibility, PWA offline fallback, visual, and
architecture harness checks on `chromium` and `mobile-safari`. Product-specific
Micro-Specs must add targeted tests for the changed journey.

`pnpm test:coverage` enforces node coverage thresholds for `lib/**` in the unit
tier. `pnpm bundle:check` enforces the checked-in Next.js bundle budget after
`pnpm build`. `pnpm lighthouse` runs Lighthouse CI as a non-blocking performance
and SEO signal in CI. ZAP baseline and nightly full scans run as workflow jobs,
not package-script gates.

`pnpm test:db` is a live database gate. It requires `SUPABASE_DB_URL` and fails
clearly when no database URL is present. CI runs it only when that environment
variable is available, and active `billing`, `webhooks`, `rls-rpc-ledger`, and
`migrations` specs must declare it so missing DB runtime proof becomes a
blocking failure.

## Playwright CLI Workflow

When browser evidence is required, the Micro-Spec must declare
`required_playwright_projects` and related tests under `tests/e2e/`,
`tests/a11y/`, or `tests/visual/`. Use these commands:

- Red: `pnpm test:e2e -- --grep "<tag-or-title>"` to prove the targeted
  browser requirement fails for the right reason.
- Green: `pnpm test:e2e -- --project=<project>` for the affected browser/device
  project, then `pnpm test:e2e` for the full e2e gate.
- Refactor: `pnpm test:e2e:headed` for interaction debugging and
  `pnpm test:e2e:ui` for local traceable exploration.
- Review: `pnpm exec playwright show-report` for the HTML report and
  `pnpm exec playwright show-trace <trace.zip>` for failed or high-risk flows.
- Accessibility: `pnpm test:a11y` when the spec is a11y-sensitive.
- Visual: `pnpm test:visual` when the spec is visual-sensitive.

## Evidence Model

- CI artifacts: Playwright report, traces, and screenshots on failure when
  Playwright gates are declared.
- Test output: lint, typecheck, build, node tests, DB tests, e2e, a11y, visual,
  token checks, claims checks, JSON-LD checks, and governance checks.
- Spec status transition notes stay inside the Micro-Spec.
- No tracked screenshot evidence folders unless explicitly requested.

## Working Rule

Before implementing any active Micro-Spec, inspect the live repo and narrow the
task to requirements that are not already satisfied. If the spec conflicts with
buildable code, stop and reconcile the spec before editing production files.
