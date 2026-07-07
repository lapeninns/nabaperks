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
- `scripts/new-spec.mjs` (`pnpm governance:new-spec`) - scaffolds a
  floor-satisfying draft Micro-Spec.
- `scripts/advance-spec.mjs` (`pnpm governance:advance`) - the only sanctioned
  way to change a spec's status; runs gates fresh and records evidence.
- `scripts/governance-evidence.mjs` - the evidence-ledger module
  (`show <spec-id>` / `backfill --by <who>`).
- `scripts/governance-status.mjs` (`pnpm governance:status`) - read-only
  portfolio dashboard: per-spec lifecycle/evidence table, an attention list
  of implemented/verified specs awaiting their next step, and the checker's
  current failures. Enforces nothing (always exits 0).

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
status: draft | active | implemented | verified | closed | superseded
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
- Active specs must scope browser-suite gates: a `test:e2e` gate needs a
  `--grep` filter that selects this spec's own tests, unless the spec carries
  a dated `broad-browser-gate:` approved exception (see "Scoped Browser
  Gates" below). The `--grep` pattern must compile as a regular expression
  and match the content of at least one of the spec's declared
  `tests/e2e|a11y|visual` related tests — a tag that selects someone else's
  tests proves the wrong thing.
- Active specs' `implementation_surfaces` are cross-checked against the
  risk-radius hints in `scripts/governance-constants.mjs`: a surface matching
  a hinted high-risk path (for example `supabase/migrations/**` or
  `app/api/stripe/webhook/**`) forces one of that hint's risk classes — the
  gate floor keys off risk_class, so high-risk paths must not ride under a
  weaker class.
- Active specs may claim at most one exact broad radius root (`app/**`,
  `components/**`, `lib/**`, `scripts/**`, …). Beyond the limit the spec must
  carry a dated `broad-blast-radius: <why> (expires: YYYY-MM-DD)` approved
  exception — one repo-wide spec otherwise makes blast-radius enforcement
  vacuous for every file. Scoped subpaths (`components/pwa/**`) never count
  as broad.
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
- `closed`: the terminal happy status. The work shipped and was verified, and
  the spec body has been rewritten from a build plan into a durable rationale
  record (why it exists, invariants, code pointers, dead ends) that the
  checker machine-validates on every run. Closed specs are reference, not
  implementation input.
- `superseded`: non-current and blocked for implementation unless a new active
  spec or approved exception says otherwise.

Draft, implemented, verified, closed, and superseded specs are not valid new
implementation inputs.

## Lifecycle Transition Policy

Status lines are rewritten by `pnpm governance:advance`, never by hand — a
hand-flipped implemented/verified status has no recorded ledger transition and
fails `pnpm governance:check` (evidence enforcement is on as of 2026-07-05).

| From          | To            | Machine enforcement (`pnpm governance:advance <spec-id> --to <status>`)                                           |
| ------------- | ------------- | ------------------------------------------------------------------------------------------------------------------ |
| `draft`       | `active`      | Six numbered sections present; full metadata + risk-floor validation of the activated spec (reverts on failure).   |
| `active`      | `implemented` | Clean tree (or `--allow-dirty --note` + dated `evidence-waiver` exception); branch diff inside this spec's radius; fresh all-pass gate run recorded. |
| `implemented` | `verified`    | Everything above, plus `--attest` per declared `manual:*` gate and `--ack` per `evidence_required` item (exact text). |
| `verified`    | `closed`      | Everything above, plus the spec body satisfies the closed-record contract (validated before gates run; see below).   |
| `active`/`implemented`/`verified`/`closed` | `superseded` | `--superseded-by <spec-id>` (must exist) XOR `--reason "<text>"`; inserts `superseded_by:`.       |

## Closed-Record Contract

Closing is the archive station: the body is rewritten from a build plan into
a durable rationale record — the why, the invariants, and a pointer map into
the code — and the engine validates the RESULT, both at `--to closed` and on
every subsequent `pnpm governance:check` run:

- Required headings: `## Why It Exists`, `## Invariants`, `## Code Pointers`,
  and `## Dead Ends` (required even when the content is "None." — the
  attestation is the point).
- None of the six numbered build-plan headings may remain — a body that still
  says "will" through an activation heading is still a plan.
- Every `- ` line under `## Code Pointers` must carry at least one
  backtick-wrapped repo path (at least one `/`, no whitespace or globs, no
  leading slash) that resolves to an existing file **or directory**.
  Directory pointers are the sanctioned valve for volatile file names; a
  stale pointer is a failure, not a warning. Bare symbol names and URLs in
  backticks read as prose.
- `related_tests` may not keep the `not-yet-created` sentinel.

Healing a rotted record (for example after a rename): hand-edit the body —
the `status:` line stays machine-owned — then re-prove with
`pnpm governance:run-gates --spec <spec-id> --record` and commit the spec
and ledger together.

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

## Scoped Browser Gates

The gate floor names script *roles*; the declared command should be the
narrowest run that proves this spec's own surfaces. A whole-suite browser run
drags unrelated failures (for example marketing visual-baseline drift) into a
spec's gate and its recorded evidence, so the checker enforces scoping on
active specs:

- A `pnpm test:e2e` gate MUST carry a `--grep` filter owned by the spec — tag
  the spec's Playwright test titles and reference the tag, e.g.
  `pnpm test:e2e -- --project=chromium --project=mobile-safari --grep "@merchant-launch-save-flow"`.
  Multiple `--project` flags remain supported; projects select devices, not
  tests, so they do not substitute for `--grep`.
- Bare `pnpm test:e2e`, all-project visual sweeps, and other whole-suite
  browser runs are reserved for specs that intentionally change global or
  browser-wide behavior (navigation shell, service worker, design tokens).
  Such a spec must record a dated approved exception —
  `broad-browser-gate: <why global coverage is the point> (expires: YYYY-MM-DD)`
  — or the checker rejects the gate at activation and on every run.
- `pnpm test:a11y` and `pnpm test:visual` are already tag-scoped wrapper
  scripts (`--grep @a11y` / `--grep @visual`) and stay valid as declared; they
  are appropriate whenever the spec touches user-visible surfaces those tags
  cover. Add `--project` flags when the spec's device matrix is narrower than
  the default.
- The node tiers (`pnpm test`, `pnpm test:coverage`, `pnpm test:db`) run the
  whole hermetic suite by construction and stay whole-suite. The file-level
  focus for unit, Micro-Spec, and DB proof is declared in `related_tests` —
  name the spec's exact `tests/micro-specs/*.test.mjs` files, unit test
  files, and (whenever the spec touches DB/RLS/RPC behavior) the specific
  `tests/db/**` files that prove it — and in Section 6's focused red -> green
  commands.

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
- Green: the spec's declared scoped gate, e.g.
  `pnpm test:e2e -- --project=chromium --project=mobile-safari --grep "@<spec-tag>"`.
  Bare `pnpm test:e2e` is only for specs carrying a `broad-browser-gate`
  exception (see "Scoped Browser Gates").
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
- Machine-readable gate-run ledgers under `micro-specs/evidence/` ARE tracked
  (see below). Binary evidence — screenshots, traces, recordings — is never
  committed unless explicitly requested.

## Evidence Ledger

One JSON file per spec at `micro-specs/evidence/<spec_id>.json` records gate
`runs` (newest last, capped history), lifecycle `transitions`, and
`manual_attestations`. Written by `pnpm governance:run-gates --record` and
`pnpm governance:advance`; committed alongside the code they prove.

`EVIDENCE_ADOPTION_DATE` is `2026-07-05` in `scripts/governance-constants.mjs`.
For every implemented/verified/closed spec the checker enforces:

- the ledger exists, parses, and matches the spec_id;
- the status was reached by a recorded transition (provenance — hand-edited
  status lines fail);
- the LATEST run covers every currently declared runnable gate with exit 0,
  compared by exact command string — editing `verification_gates` invalidates
  old evidence and forces a re-proof;
- `all_passed` agrees with the recorded exit codes (hand-doctored flags fail);
- the latest transition was not recorded on a dirty tree, unless the spec
  carries a dated `evidence-waiver` approved exception;
- verified and closed specs carry an attestation per declared
  manual-inspection gate and a `gate:"evidence"` acknowledgement matching
  each current `evidence_required` item exactly — a hand-assembled ledger
  cannot skip the human step.

A red run recorded on an implemented spec correctly fails the checker — that
is a regression being reported, not a bookkeeping error; fix and re-record
rather than deleting history. The 32 specs implemented before adoption carry
grandfather stubs (`node scripts/governance-evidence.mjs backfill`), each
valid only until its spec's first machine transition. Orphan ledgers fail.

Evidence also goes stale: an implemented or verified spec whose
`implementation_surfaces` changed in commits made after its latest recorded
run fails the checker until re-proven (`governance:run-gates --spec <id>
--record`, or the next lifecycle advance). Committed history only; the
spec's own document and its ledger are excluded (status flips are
bookkeeping, not drift); a recorded sha that no longer resolves or is not an
ancestor of HEAD (a squash-merged branch commit) is skipped — the check
never invents staleness it cannot prove. Re-proving runs carry
`GOVERNANCE_REPROVING_SPECS` on every gate they execute, exempting exactly
the staleness and run-freshness (red/non-covering latest run) rules for the
specs being re-proven — the cure is never blocked by the disease, while
provenance, dirty-tree, and attestation rules stay enforced. The standalone
check keeps full enforcement.

## Working Rule

Before implementing any active Micro-Spec, inspect the live repo and narrow the
task to requirements that are not already satisfied. If the spec conflicts with
buildable code, stop and reconcile the spec before editing production files.
