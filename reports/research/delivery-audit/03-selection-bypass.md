# 03 — Adversarial correctness analysis: can a behaviour-altering change reach main without a full run?

Audit date: 2026-09-21. Repository `lapeninns/nabaperks`; analysis base `origin/main`
@ 17c3094be (the local branch `codex/console-l8-sweep` @ 1919a3df is byte-identical to it
for every selection-relevant file — `git diff origin/main...HEAD --stat` empty for
`scripts/ci/**`, `config/ci-*`, `.github/workflows/ci.yml`, both ops docs). READ-ONLY
audit of the real repo; all experiments ran in a `git clone --shared` mirror under
`/tmp/np-sel-audit` (removed afterwards; its synthetic commits never entered the main
repository). Git author identity for the synthetic commits was the environment's own
configured identity (not overridden).

Evidence labels: **EMPIRICAL** = the real classifier (`planChecks`, 35 synthetic merge
candidates), the real qualification verifier (`verifyQualificationSource`, 5 candidates),
the live ruleset (`gh api` read-only), or executed diff/parity checks. **STATIC-ANALYSIS**
= derived from reading the code. **UNVERIFIED** = listed at the end.

The central question: _can a change that alters test or qualification BEHAVIOUR reach
main without a full run?_ Recap of the mechanism under attack (details + citations in
`02-hosted-ci-design.md`):

- Classification is a **strict path allowlist**, executed from the reviewed base against
  the immutable merge candidate (`scripts/ci/plan-checks.mjs:46-118`;
  `scripts/ci/change-impact.mjs:39-104`). Everything outside the allowlist is `full`.
- `full` = the nine roots (`fast, quality, build, e2e, a11y, visual, lighthouse,
zap-baseline, db`), enforced at merge by the required `Release gate` check, which
  **recomputes** the plan from Git with base policy and deep-equals the published plan
  (`scripts/ci/verify-impact-evidence.mjs:58-77`; `.github/workflows/ci.yml:742-805`).
- Selection-graph changes additionally force the **targeted/full comparison**
  (`needsSelectionComparison`, `plan-checks.mjs:16-45`), whose verifier runs from the
  reviewed base and binds the candidate's entire tracked input tree to reviewed bytes
  (`scripts/ci/qualification-source.mjs:127-170`).
- Post-merge, every exact-main push re-runs full CI (`plan-checks.mjs:91-93`) — a
  targeted-merge mistake cannot survive past the merge commit's own push run.

---

## Candidate 1 — a test-only helper moved to a non-classified path

**Model verdict: FULL. No bypass. (EMPIRICAL)**

- There is **no transitive import analysis for test selection** — there is no test
  selection at all. The only page-scoped roots (`targeted-browser`, `targeted-visual`)
  run inside `public-pages`/comparison profiles, which require _every_ changed path to be
  in the allowlist. A shared-lib helper used only by tests is simply an unclassified path:
  EMPIRICAL `components/brand/logo.tsx` edit → `full` ("Unqualified change"); new
  `lib/audit-probe.ts` → `full`; `tests/unit/ci-change-impact.test.mjs` edit → `full`;
  `tests/support/register-alias.mjs` edit → `full`. The right roots are selected because
  `full` is the default, not because an import graph is traced.
- The transitive analysis that _does_ exist serves two narrow purposes, with the
  TypeScript compiler API (`ts.createSourceFile`, `ScriptTarget.Latest`) as the only parser:
  1. `findPageConsumers` (`scripts/ci/impact-presentation.mjs:121-176`) — parses **the whole
     candidate application source tree** (all `.[cm][jt]sx?` outside tooling paths, via one
     bounded `git cat-file --batch`, `scripts/ci/impact-git.mjs:48-115`) to _reject_ a
     `public-pages` profile when any other source imports the page; `@/*` alias and
     relative resolution only, computed/`#` imports fatal, tsconfig pinned to
     `{"@/*": ["./*"]}` (`impact-presentation.mjs:99-118`).
  2. `comparisonDependencies` (`scripts/ci/impact-dependencies.mjs:7-104`) — the 41-module
     import closure (EMPIRICAL size) of the 14 planner/verifier/runner/test entrypoints
     over the **reviewed base** tree, used only to trigger the comparison. This closure is
     what catches `scripts/ci/qualification-source.mjs` (in no regex but imported by
     `compare-targeted-evidence.mjs`): EMPIRICAL edit → `full` + `comparison=true`.
- Consequence for "helper moved to a non-classified path": the _move_ is delete+add
  (rename detection off, `impact-git.mjs:136-139`) → deletion guard → `full` ("Deletion,
  file mode or unsupported path requires full validation", EMPIRICAL for a doc rename). And
  the tests that consume the helper still run — `full` includes the coverage workload.

## Candidate 2 — a test fixture change

**Model verdict: FULL. No bypass. (EMPIRICAL)**

- No `fixtures` path appears in any allowlist: `isDocumentationPath` requires `.md` under
  `docs/operations/`/`docs/decisions/` or `README.md` (`scripts/ci/impact-documentation.mjs:17-24`);
  `publicPages` lists exactly three page files (`config/ci-impact-policy.json:7-16`). EMPIRICAL:
  new `tests/e2e/fixtures/audit-probe.json` → `full`.
- The only fixture-shaped exception is the canonical visual baseline family
  (`scripts/ci/impact-snapshots.mjs:3-17`): `<visualName>-(chromium|mobile-safari)-linux.png`,
  status `M` only, and **paired** with a qualifying change to its own page in the same PR
  (`change-impact.mjs:64-89`). EMPIRICAL: baseline-only byte-flip → `full` ("Visual
  baseline has no matching qualified page change"); page-text + paired baseline →
  `public-pages`. A fixture therefore cannot select a targeted profile on its own, and it
  never triggers the comparison either (PNG exclusion, `plan-checks.mjs:19-21`) — but the
  only thing that exclusion buys is skipping a _duplicate_ tier; the profile is still `full`.

## Candidate 3 — a binary/asset change (images, fonts, `public/`)

**Model verdict: FULL. No bypass. (EMPIRICAL)**

- Any unlisted path → `full` before content is read (`change-impact.mjs:71-73`). EMPIRICAL:
  byte-flip of `app/icon.png` → `full` (no comparison). `public/**`, fonts, any new
  extension behave identically.
- Smuggling binary _as documentation_ fails closed: the docs branch reads the blob
  (`change-impact.mjs:60-63` → `readBlob`, `impact-git.mjs:177-188`) which rejects NUL,
  non-UTF-8 and >1 MB → classification throws → caught → `full`
  (`change-impact.mjs:105-125`).
- Smuggling binary _as a page change_ fails closed: `isPresentationOnly` TypeScript-parses
  both blobs; binary fails the parse ("Unparseable public page") → `full`.
- Could an asset alter **qualification behaviour** while landing in a targeted profile?
  No: a `public-pages` PR's changed-path set is exactly {page.tsx, optional paired PNG};
  any additional asset path makes the whole PR `full`. Could a **documentation** PR carry
  an asset? Only `.md` under the two prefixes/`README.md` qualify (content is additionally
  prettier-checked and link-checked); a non-`.md` file anywhere → `full`.
- One nuance worth stating: an unpaired baseline PNG edit lands as `full` **without**
  comparison. That is not a bypass — the full visual tier runs against the edited baseline
  on the canonical host runner, and an "expected image update" is explicitly still subject
  to visual comparison + review (`docs/operations/change-aware-ci.md:60-66`).

## Candidate 4 — a workflow env change (`.github/workflows/ci.yml` env blocks, `.github/actions/*`)

**Model verdict: every `.github/**` change → FULL; comparison additionally for `ci.yml`
and `setup`/`playwright` actions. No targeted escape. (EMPIRICAL)**

- EMPIRICAL matrix: `.github/workflows/ci.yml` (comment append, same as an env-block edit)
  → `full` + `comparison=true`; `.github/actions/setup/action.yml` and
  `.github/actions/playwright/action.yml` → `full` + `comparison=true` (prefix rules,
  `plan-checks.mjs:39-40`); a **new** `.github/actions/rogue/action.yml` → `full`,
  `comparison=false`; `.github/workflows/production-database.yml` → `full`,
  `comparison=false`. So no, not every `.github/**` change forces the comparison — but
  none can escape `full`, because `.github/**` is outside every allowlist.
- What the comparison then enforces on a `ci.yml` change: the candidate workflow must be
  **byte-identical** to the reviewed base's `config/ci-qualification-workflow.yml` proposal
  (`qualification-source.mjs:132-143`; currently `diff`-clean identical), every other
  tracked input must match reviewed bytes, the browser environment layer re-parses the
  candidate workflow as data and requires literal `ubuntu-latest`, digest-pinned images
  and matching runner/container identity across the five browser jobs
  (`impact-browser-environment.mjs:41-109`), and the active workflow's container pins are
  additionally guarded by a unit test that runs in the full lane
  (`tests/unit/ci-browser-performance.test.mjs:360-388` asserts pins for **both** the
  active `ci.yml` and the proposal).
- **Residual trust boundary (STATIC-ANALYSIS):** for `pull_request` events GitHub executes
  the _candidate's_ workflow file (the merge ref). The enforcement chain above — proposal
  byte-match, input-tree binding, artifact-count checks — runs inside steps of that
  candidate-controlled workflow. A malicious PR could in principle gut the
  `selection-comparison`/`release-gate` steps so nothing verifies, and keep a job _named_
  "Release gate" that trivially passes. Nothing inside the pipeline can catch that, because
  the pipeline _is_ the tampered artifact. The compensating controls are all outside the
  candidate: (1) the live "Main delivery policy" ruleset enforces
  `require_code_owner_review: true` plus a second approval for unattributed changes
  (EMPIRICAL `gh api` read), and `CODEOWNERS` routes `/.github/` to
  `@lapeninns @amanshresthaa` — a workflow change cannot merge without those owners; (2)
  the merge commit's own exact-main push re-runs the (now merged, visible-to-all) workflow
  with a forced `full` profile. This is the standard GitHub Actions self-reference property,
  not a defect unique to this design; the design's _mitigations_ (byte-exact proposal,
  reviewed-base execution of all policy scripts, code-owner ruleset) are the strongest
  available inside the platform.

## Candidate 5 — self-modification of the selection graph

**Model verdict: FULL + comparison; the staged-inputs mechanism is the only accepted
route, and it is two-PR-by-construction. No automated bypass found. (EMPIRICAL)**

Trigger coverage (EMPIRICAL, real classifier): `scripts/ci/plan-checks.mjs`,
`scripts/ci/qualification-source.mjs` (regex gap closed by the 41-module closure),
`config/ci-impact-policy.json`, `config/ci-workloads.json`, `playwright.config.ts`,
`package.json`, `pnpm-lock.yaml`, `.nvmrc`, `tests/e2e/visual.spec.ts`,
`tests/e2e/helpers/a11y-sweep.ts`, and **deleting** `scripts/ci/plan-checks.mjs` → all
`full` + `comparison=true`.

Staged-inputs semantics (`qualification-source.mjs:58-84`) and what they protect against:

1. **The PR never classifies itself.** Selection executes at the reviewed base
   (`ci.yml:85-90`; `plan-checks.mjs:50-53`); the gate recomputes the plan with base's
   verifier and rejects divergence (`verify-impact-evidence.mjs:58-77`). EMPIRICAL:
   release-gate recomputation logic read and its assertions exercised by
   `tests/unit/ci-reviewed-execution.test.mjs:207-260` in the suite I did not re-run here —
   the recomputation path itself is STATIC-ANALYSIS, the classifier inputs to it EMPIRICAL.
2. **The candidate tree is bound, file by file, to reviewed bytes.** During the
   comparison, `verifyQualificationSource(candidateSha)` requires _every_ tracked
   non-documentation input to match the reviewed base's Git blob+mode, the candidate
   `ci.yml` to match the proposal, and allows exactly one divergence: a file whose
   replacement was pre-staged on main as `config/ci-qualification-inputs/<path>.source`
   — and even then only at the staged blob's exact bytes, with the staged copy itself
   unchanged. EMPIRICAL dry runs against the real base:
   - candidate adopting the staged `AGENTS.md.source` bytes → **PASSED**
     (`staged=19`, `executionInputs=2802`);
   - candidate with rogue `AGENTS.md` bytes → **FAILED** ("Qualification executables,
     dependencies or test inputs differ from reviewed source: AGENTS.md");
   - candidate editing `scripts/ci/plan-checks.mjs` → **FAILED** (lists
     `AGENTS.md, scripts/ci/plan-checks.mjs` — see finding below);
   - candidate editing `.github/workflows/ci.yml` → **FAILED** ("Qualification workflow
     differs from the reviewed command wiring");
   - candidate adding `brand-new-rogue-file.txt` → **FAILED** (additions cannot qualify).
     These semantics are pinned by `tests/unit/ci-reviewed-execution.test.mjs:48-160`
     ("qualification rejects omitted commands, forged producers and changed install
     inputs", "qualification binds all required workload inputs regardless of path or
     extension" — 26 path classes from `scripts/**` to `patches/**`, deletions, mode
     changes, new files) and `:162-205` ("staged inputs bind future checkers and tests to
     separately reviewed exact blobs" — tampering with the activated file **or** the staged
     copy fails; a dirty verifier worktree fails `verifyLiveInputs`).
3. **A quiet policy rewrite therefore needs two reviewed PRs.** The staging PR (touching
   only `config/ci-qualification-inputs/**`) runs the full nine roots but **no**
   comparison (EMPIRICAL: `staged-source` scenario → `full`, `comparison=false`; pinned at
   `ci-reviewed-execution.test.mjs:207-260`). The activation PR must then match the
   staged bytes exactly _and_ survive the full comparison. Between the two lies code-owner
   review — both PRs touch paths owned by the repo owners, and the activation PR
   additionally changes files in the 41-module closure. Nothing lets a single PR both
   rewrite policy and qualify it.
4. **Current-tree observation (EMPIRICAL, notable):** the staged
   `config/ci-qualification-inputs/AGENTS.md.source` differs from the live `AGENTS.md`
   (the only one of the 19 staged inputs that does). Because `expectedInputs` _replaces_
   the expected entry at the target path with the staged blob
   (`qualification-source.mjs:78`), **every comparison-requiring PR today must adopt the
   staged AGENTS.md bytes or the comparison fails on AGENTS.md** — my plan-checks-edit
   candidate failed listing `AGENTS.md` first even though it never touched it. This
   matches the documented semantics ("its immutable blob and mode define the only
   accepted candidate replacement", `docs/operations/ci-selection-verifier.md:23-31`),
   i.e. staged inputs are **mandatory pending activations** for the next qualifying PR,
   not optional menu items. Operationally: the next selection-graph PR must bundle the
   AGENTS.md activation or it cannot pass its own comparison.
5. **What the comparison itself cannot prove:** outcome parity on the qualified pages
   only — "not proof for unqualified files or future policy changes"
   (`compare-targeted-evidence.mjs:230-232`). Future-selection safety therefore rests on
   the _review_ of staged content, by design (`change-aware-ci.md:70-79`).

## Candidate 6 — other gaps probed

All EMPIRICAL unless noted:

| Change                                                      | Profile | Comparison | Assessment                                                                                                                                                                                                                                                                                                                                                                                                    |
| ----------------------------------------------------------- | ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rename (any, incl. docs)                                    | `full`  | false      | delete+add; deletion guard fires ("Deletion, file mode or unsupported path")                                                                                                                                                                                                                                                                                                                                  |
| Symlink add (e.g. `public/link`)                            | `full`  | false      | `newMode 120000` fails the mode guard; app-tree symlinks also make consumer analysis fatal                                                                                                                                                                                                                                                                                                                    |
| Submodule-ish entries in app source                         | `full`  | —          | `readSourceTree` throws on mode `160000` → fail-closed (STATIC-ANALYSIS)                                                                                                                                                                                                                                                                                                                                      |
| `AGENTS.md` (root)                                          | `full`  | false      | outside the docs allowlist; the guide's "root AGENTS.md changes are outside that documentation allowlist" is enforced by the code allowlist, not by words                                                                                                                                                                                                                                                     |
| `docs/api/README.md` (generated)                            | `full`  | false      | generated docs are _not_ the allowlist's `README.md`; correct — they ride with the OpenAPI source review                                                                                                                                                                                                                                                                                                      |
| `tsconfig.json`                                             | `full`  | false      | unclassified; and any future `public-pages` claim would hit the pinned-resolution check (`impact-presentation.mjs:99-118`), so alias games cannot quietly re-open the page allowlist                                                                                                                                                                                                                          |
| `package.json` script change                                | `full`  | true       | explicit list (`plan-checks.mjs:25-30`)                                                                                                                                                                                                                                                                                                                                                                       |
| `pnpm-lock.yaml`                                            | `full`  | true       | explicit list                                                                                                                                                                                                                                                                                                                                                                                                 |
| `.nvmrc`                                                    | `full`  | true       | explicit list; EMPIRICAL (`24`→`22`)                                                                                                                                                                                                                                                                                                                                                                          |
| `config/ci-qualification-workflow.yml` (the proposal)       | `full`  | **false**  | inert data; a weakened proposal still needs a _second_ PR (ci.yml activation) that must pass full+comparison, code-owner review on `/.github/`-adjacent content, and the browser-environment parser's literalness checks. Staging-then-activating is the documented mechanism, so this is by-design surface, not a hole — but it does mean proposal review is the only gate on _future_ comparison acceptance |
| `scripts/ci/factory-status.mjs` (scripts/ci but non-policy) | `full`  | false      | not in regexes or closure; harmless for selection since `full` runs everything and it is observation tooling                                                                                                                                                                                                                                                                                                  |
| `tests/unit/**`, `tests/support/**`                         | `full`  | false      | unit tests always run in `full` via the coverage workload                                                                                                                                                                                                                                                                                                                                                     |
| Deleting `scripts/ci/plan-checks.mjs`                       | `full`  | true       | deletion + regex; and if it _did_ merge, the bootstrap fallback re-arms full validation (`ci.yml:92-115`)                                                                                                                                                                                                                                                                                                     |
| Workflow _env-block_ values                                 | `full`  | true       | same path as any `ci.yml` edit                                                                                                                                                                                                                                                                                                                                                                                |

**Documentation-profile residual gap (EMPIRICAL-adjacent, worth naming):** a
`documentation` PR runs **only** the `documentation` root (`secrets:check`,
`test:contracts`, `docs:check`, `agents:check`, changed-file prettier + links). Unit
tests do **not** run in that profile, yet at least one unit test reads allowlisted docs
(`tests/unit/check-installed-revision.test.mjs:110` reads
`docs/operations/production-runbook.md`). A Markdown edit that broke such a unit test
would merge (its required check is `Release gate`, satisfied by the documentation root
plus the docs checks) and only be caught by the post-merge exact-main full run. This is
detection-lag, not a behaviour escape — Markdown under the allowlist cannot alter
application runtime or CI execution, and the contract tests that _do_ gate releases
(`production-release-controls.test.mjs` also reads runbook/incident docs) **are** in the
documentation root via `pnpm test:contracts`. No fix is proposed here (assignment is
analysis); noted as the narrowest residual.

---

## Verdict

**No working content-level bypass was found.** Every constructed scenario that could
alter test or qualification behaviour — shared helpers, unit tests, fixtures, binaries,
renames, symlinks, generated files, lockfile/package/Node version, workflow files and
actions, the classifier/verifier/policy files themselves — resolves to `full`, verified
EMPIRICALLY through the real classifier, and the selection-graph subset additionally
forces the targeted/full comparison whose reviewed-base verifier binds the entire
tracked input tree to reviewed bytes except pre-staged, separately reviewed replacements.
The two residual trust boundaries are structural, not mechanical gaps:

1. **The PR-controlled workflow file** (GitHub executes the candidate's `ci.yml` for
   same-repo PRs): the pipeline's own enforcement steps are candidate-hosted, so the
   design leans on code-owner review (ruleset `require_code_owner_review: true`,
   EMPIRICAL) + the byte-exact proposal + the post-merge forced-full push run. A
   workflow PR that _also_ compromised its code-owner review could defeat the machinery —
   this is a review-integrity boundary inherent to the platform, outside what any
   selection model can enforce on itself.
2. **Staged-input review quality**: staging PRs run full nine roots but no comparison
   (documented, EMPIRICAL), so the bytes that a future activation may carry are gated by
   human review alone. The mechanism guarantees a _second, fully-qualified_ PR must adopt
   them; it cannot guarantee the staged content was good — no automated mechanism could.

Additionally, any targeted merge that did sneak through is bounded by the exact-main
push run, which unconditionally re-runs all nine roots (`plan-checks.mjs:91-93`) — worst
case is a red main run after a bad merge, not a silent escape.

## UNVERIFIED

- **Live GitHub PR-run workflow semantics** (candidate `ci.yml` executing for
  `pull_request` events) — asserted from platform knowledge, not demonstrated against
  this repository in this session.
- **Hosted execution of the comparison**: I did not (and per assignment could not) run the
  nine-root hosted suite or the full `compare-targeted-evidence.mjs` CLI against real
  artifacts; report-parity behaviour is cited from code and unit tests, not from a live
  hosted run.
- **`tests/unit/ci-*` suites were not re-executed** in this session (they run in the repo's
  own `pnpm test` lanes; the behaviours they pin were instead re-derived EMPIRICALLY via
  direct classifier/verifier dry runs, which is stronger evidence for the current tree
  but is not the hosted proof).
- **Ruleset target conditions** (branch/actor filters beyond the parameters read) were not
  dumped; only name, enforcement, rule types, and the pull_request/required_status_checks
  parameters were read (read-only `gh api`).
- **`hosted-evidence.mjs` / local-CI observation tooling** was read but not executed; its
  lane-mapping claims (job-name templates, step-name derivations) are STATIC-ANALYSIS.
- **Timing claims** in `run-browser-pack.mjs`/`browser-pack.mjs` comments (modelled
  minutes from run 34290952137) are historical notes, not re-measured.
