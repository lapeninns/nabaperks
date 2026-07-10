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
  radius, docs drift, evidence ledgers, and gate-command shape.
- `scripts/run-governance-gates.mjs` — runs the verification gates declared by
  active Micro-Specs (`--spec <id>` selects an explicit spec, repeat it to
  batch a deduplicated union, and add `--record` to write per-spec ledgers).
- `scripts/new-spec.mjs` — scaffolds a floor-satisfying draft Micro-Spec
  (`governance:new-spec`).
- `scripts/advance-spec.mjs` — the only sanctioned way to change a spec's
  status (`governance:advance`).
- `scripts/governance-evidence.mjs` — the evidence-ledger module
  (`show <spec-id>` / `backfill --by <who>`).

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
status: draft | active | implemented | verified | closed | superseded
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
- `closed`: the terminal happy status. The work shipped and was verified, and
  the spec body has been rewritten from a build plan into a durable rationale
  record (why it exists, invariants, code pointers, dead ends) that the
  checker machine-validates on every run. Closed specs are reference, not
  implementation input.
- `superseded`: non-current and blocked for implementation.

Draft, implemented, verified, closed, and superseded specs are not valid new
implementation inputs.

## Lifecycle Transition Policy

Status lines are rewritten by `governance:advance`, never by hand — once
evidence enforcement is on, a hand-flipped implemented/verified status has no
recorded transition and fails the checker.

| From          | To            | Machine enforcement (`governance:advance <spec-id> --to <status>`)                                              |
| ------------- | ------------- | ---------------------------------------------------------------------------------------------------------------- |
| `draft`       | `active`      | Six numbered sections present; full metadata + risk-floor validation of the activated spec (reverts on failure). |
| `active`      | `implemented` | Clean tree (or `--allow-dirty --note` + waiver); branch diff inside this spec's radius; fresh all-pass gate run recorded. |
| `implemented` | `verified`    | Everything above, plus `--attest` per declared `manual:*` gate and `--ack` per `evidence_required` item (exact text). |
| `verified`    | `closed`      | Everything above, plus the spec body satisfies the closed-record contract (validated before gates run; see below).   |
| `active`/`implemented`/`verified`/`closed` | `superseded` | `--superseded-by <spec-id>` (must exist) XOR `--reason "<text>"`; inserts `superseded_by:`.        |

## Closed-Record Contract

Closing is the archive station: the body is rewritten from a build plan into
a durable rationale record — the why, the invariants, and a pointer map into
the code — and the engine validates the RESULT, both at `--to closed` and on
every subsequent governance-check run:

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
`governance:run-gates --spec <spec-id> --record` and commit the spec and
ledger together.

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

Browser gates are scoped by default: an **active** spec's `test:e2e` gate must
carry a `--grep` filter selecting the spec's own tests (multiple `--project`
flags are fine — projects pick devices, not tests), e.g.
`pnpm test:e2e -- --project=chromium --grep "@MS-<area>-<slug>"`. A grep-less
browser gate on an active spec fails the checker, because whole-suite runs
surface failures from surfaces the spec never touched. A spec that
deliberately changes global browser behavior may keep a broad gate by
recording a dated approved exception:
`broad-browser-gate: <why global coverage is the point> (expires: YYYY-MM-DD)`.
Wrapper scripts that already embed a tag filter (for example `test:a11y`
defined as `playwright test --grep @a11y`) are exempt via
`SCOPED_BROWSER_GATE_SCRIPTS` in `scripts/governance-constants.mjs`; forks
tune that list. The `--grep` pattern must also compile as a regular
expression and match the content of at least one of the spec's declared
related browser tests — a tag that selects someone else's tests proves the
wrong thing.

Two more cross-checks keep active-spec declarations honest. Implementation
surfaces matching a configured risk-radius hint (`RISK_RADIUS_HINTS`, empty
by default — add repo-specific entries like
`{ pattern: "db/migrations/**", classes: ["migrations"] }`) force one of the
hinted risk classes, because the gate floor keys off the declared class. And
a blast radius claiming more exact broad roots (`app/**`, `lib/**`, `src/**`,
…) than `BROAD_RADIUS_LIMIT` allows requires a dated
`broad-blast-radius: <why> (expires: YYYY-MM-DD)` approved exception — one
repo-wide active spec otherwise makes blast-radius enforcement vacuous.

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
- Machine-readable gate-run ledgers under `micro-specs/evidence/` ARE tracked
  (see below). Binary evidence — screenshots, traces, recordings — is never
  committed unless explicitly requested.

## Evidence Ledger

One JSON file per spec at `micro-specs/evidence/<spec_id>.json` records gate
`runs` (newest last, capped history), lifecycle `transitions`, and
`manual_attestations`. Written by `governance:run-gates --record` and
`governance:advance`; committed alongside the code they prove.

Once `EVIDENCE_ADOPTION_DATE` is set in `scripts/governance-constants.mjs`
(fresh installs stamp the install date), the checker enforces for every
implemented/verified/closed spec:

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
is a regression being reported, not a bookkeeping error; fix the code and
re-record rather than deleting history. Pre-adoption specs may carry a
grandfather stub (`governance-evidence.mjs backfill`), valid only until the
spec's first machine transition. Orphan ledgers (no matching spec) fail.

`node scripts/governance-status.mjs` prints a read-only portfolio dashboard
(per-spec lifecycle/evidence table, an attention list of implemented and
verified specs awaiting their next step, current checker failures); it
enforces nothing and always exits 0.

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
provenance, dirty-tree, and attestation rules stay enforced. Tune or disable
staleness via `EVIDENCE_STALENESS_STATUSES` in
`scripts/governance-constants.mjs`.

### Gate Cadence and Batched Proof

- During Red -> Green -> Refactor, run the narrowest tests that cover the
  requirement and directly affected contract. Git commit frequency does not
  define verification frequency.
- For an active spec ready to move lifecycle, `governance:advance` is the
  complete recorded boundary. Do not immediately pre-run the same suite with
  `run-gates --record`.
- Use `run-gates --record` for a genuinely separate intermediate checkpoint or
  to re-prove implemented/verified specs whose owned surfaces changed.
- When a shared change makes several specs stale, re-prove them together:
  `governance:run-gates --spec MS-one --spec MS-two --record`. Identical exact
  commands execute once; each ledger receives only that spec's declared gate
  results.
- The runner is fail-fast. A failed recorded batch writes honest partial/red
  runs for every selected spec; fix the root cause and re-run the same batch
  rather than deleting the failed evidence.
- Before release, run the project-level CI/final-proof lane once. This is
  complementary portfolio evidence, not a reason to repeat it after every
  implementation commit.

## Working Rule

Before implementing an active Micro-Spec, inspect the live repo and narrow the
task to requirements that are not already satisfied. If the spec conflicts with
buildable code, stop and reconcile the spec before editing production files.

## Approved Exceptions

Exceptions live in `approved_exceptions` on the relevant Micro-Spec. Keep them
specific, dated in the body, and temporary.
