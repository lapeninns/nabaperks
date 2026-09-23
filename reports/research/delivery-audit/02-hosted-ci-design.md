# 02 — The change-aware hosted CI selection model, end to end

Audit date: 2026-09-21. Repository: `lapeninns/nabaperks` (public, default branch `main`).
Local checkout: branch `codex/console-l8-sweep` (1919a3df), 32 commits ahead of `origin/main` (17c3094be).

**Divergence check (per assignment):** `git diff origin/main...HEAD --stat` for every
behaviour-relevant selection file — `.github/workflows/ci.yml`, `config/ci-workloads.json`,
`config/ci-impact-policy.json`, `config/ci-qualification-workflow.yml`,
`config/ci-qualification-inputs/**`, `scripts/ci/**`, `docs/operations/change-aware-ci.md`,
`docs/operations/ci-selection-verifier.md` — is **empty**: the selection model is identical
on the local branch and `origin/main`. All `path:line` citations below are therefore valid
for `origin/main` (local checkout lines cited). Nothing in this audit modified any tracked
file; the only writes are these research files. Empirical runs used a `git clone --shared`
mirror under `/tmp` (removed afterwards; its commits never touched the main repository's
object store or refs).

Method: full read of `.github/workflows/ci.yml` (805 lines), `config/ci-workloads.json`,
`config/ci-impact-policy.json`, `config/ci-qualification-workflow.yml`, all 41 files in
`scripts/ci/`, the 19 staged `.source` files under `config/ci-qualification-inputs/`,
both operations docs, and the locking unit/contract tests; plus **35 dry-run executions of
the real classifier** (`planChecks`) against synthetic merge candidates built inside the
`/tmp` mirror, and 5 dry-run executions of the qualification-source verifier
(`verifyQualificationSource`). Labels: **EMPIRICAL** = executed here; **STATIC-ANALYSIS**
= derived from reading code.

---

## (a) How a PR's changed files are detected and classified

**Triggering events.** `on: push: branches: [main]` and `on: pull_request: branches: [main]`
(`ci.yml:4-8`). The run name records head and base SHAs (`ci.yml:2`).

**Identity plumbing.** Workflow-level env (`ci.yml:39-41`):

- `CI_BASE_SHA` = `github.event.pull_request.base.sha` on PRs, `github.event.before` on push.
- `CI_HEAD_SHA` = PR head SHA, push SHA on push.
- `CI_HEAD_REPOSITORY` = PR head repo full name (fork detection).

`expectedIdentity` (`scripts/ci/impact-plan-contract.mjs:33-62`) pins the repository to
`lapeninns/nabaperks`, allows only `pull_request`/`push`, requires full 40-hex SHAs, and on
push additionally requires `GITHUB_REF == refs/heads/main` with head == candidate. The same
contract is duplicated for the comparison verifier in `scripts/ci/impact-comparison-plan.mjs:16-45`.

**Merge semantics — a two-tree diff, not a merge-base diff.** On `pull_request` events
`github.sha` is GitHub's auto-created merge commit (`refs/pull/N/merge`). The `selection` job
checks out `github.sha` with `fetch-depth: 0`, then **detaches to `CI_BASE_SHA`** so the
classifier code is the already-reviewed base policy, never the PR's ("The PR cannot edit the
classifier that judges its own scope", `ci.yml:78-90`; enforced in code at
`scripts/ci/plan-checks.mjs:50-53`: `git rev-parse HEAD` must equal the policy revision).
`planChecks` then asserts the candidate is a two-parent commit whose parents are exactly
`[CI_BASE_SHA, CI_HEAD_SHA]` (`plan-checks.mjs:57-66`) — the PR cannot substitute a
hand-made candidate shape. Because parent 0 is the current base tip, the change inventory
`git diff --raw -z --no-renames --no-abbrev <base> <candidate>` (`readChanges`,
`scripts/ci/impact-git.mjs:139-174`) is exactly the difference merging would land on `main`.
Rename detection is deliberately off so both sides of a move appear (`impact-git.mjs:136-138`).
On `push`, base is `github.event.before` and the same two-tree diff runs, but the profile is
forced to `full` regardless (below).

**Git hardening.** All Git access goes through one wrapper (`impact-git.mjs:17-42`):
`--no-replace-objects`, `GIT_CONFIG_NOSYSTEM=1`, `GIT_CONFIG_GLOBAL=/dev/null`,
`GIT_GRAFT_FILE=/dev/null`, ambient `GIT_*` stripped — replacements/grafts/ambient config
cannot reinterpret the named revisions (`docs/operations/ci-selection-verifier.md:52-53`).
SHAs must resolve exactly (`requireCommit`, `impact-git.mjs:116-122`); blobs are capped at
1 MB and must be UTF-8 text (`readBlob`, `impact-git.mjs:177-188`); paths must pass
`safePath` (charset `A-Za-z0-9_.()[\]/-`, no absolute/`.`/`..`, `impact-git.mjs:128-135`).

**Classification categories.** `classifyChanges` (`scripts/ci/change-impact.mjs:39-104`)
walks every changed record against `config/ci-impact-policy.json`
(schema `nabaperks.ci-impact-policy.v1`):

| Category                             | Exact rule from code/config                                                                                                                                                                       | Result                                                                                                                                                                                                                      |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unsafe path / deletion / mode change | `!safePath`, status `D`, `newMode !== "100644"`, or `oldMode` not in `["000000","100644"]`                                                                                                        | full — "Deletion, file mode or unsupported path requires full validation" (`change-impact.mjs:51-58`)                                                                                                                       |
| Documentation                        | path ends `.md` **and** (prefix `docs/operations/` or `docs/decisions/`, or file `README.md`) (`impact-documentation.mjs:17-24`; `config/ci-impact-policy.json:3-6`); blob read must succeed      | eligible, contributes to `documentation` profile                                                                                                                                                                            |
| Canonical visual baseline            | `tests/e2e/visual.spec.ts-snapshots/<visualName>-(chromium                                                                                                                                        | mobile-safari)-linux.png`for a`visualName` in the policy (`impact-snapshots.mjs:3-17`); **status `M`only**, old mode`100644`; must pair with a qualifying change to its own page in the same PR (`change-impact.mjs:64-89`) | eligible rider; unpaired/add/delete/mode → full |
| Qualified public page                | exact key of `publicPages` — `app/about/page.tsx`, `app/faq/page.tsx`, `app/how-it-works/page.tsx` (`config/ci-impact-policy.json:7-16`); status `M` only; old/new blobs presentation-shape equal | eligible page                                                                                                                                                                                                               |
| Everything else                      | no `publicPages` entry or status ≠ `M`                                                                                                                                                            | full — "Unqualified change: <path>" (`change-impact.mjs:71-73`)                                                                                                                                                             |
| Empty/failed inventory               | empty list, or any read/parse throw                                                                                                                                                               | full, fail-closed (`change-impact.mjs:42-46,105-125`; `plan-checks.mjs:67-76,77-87`)                                                                                                                                        |

**Presentation-only proof** (`impact-presentation.mjs:49-96`): both page versions are parsed
with the TypeScript compiler API (`ts.createSourceFile`, `impact-presentation.mjs:53-57`;
parse diagnostics are fatal). Only JSX _text_ children whose parent tag is in the
`TEXT_PARENTS` allowlist (a, b, blockquote, button, div, em, h1–h4, label, li, p, section,
small, span, strong, summary, Button, Link, MarketingSignupLink, MonoTag,
`impact-presentation.mjs:6-28`) are masked to `__CI_TEXT__`; and only literal string props
`className/title/description/eyebrow/aria-label` — `className` only on intrinsic elements
via the cosmetic-class rules, others only on `PageTitle`/`SectionHeader` — are masked
(`impact-presentation.mjs:30-37,66-84`). Everything else — imports, links, handlers,
expressions, structure, arbitrary component props — must be identical after masking.
`className` masking drops only reviewed cosmetic utilities (spacing/text/font/case/leading/
tracking/rounded/border/shadow/colour, `scripts/ci/impact-classes.mjs:4-30`); interaction,
visibility, positioning, custom classes, arbitrary values/selectors and _all_ variant
suffixes stay in the comparison.

**Leaf-page consumer proof** (`impact-presentation.mjs:121-176`): `tsconfig.json` at the
candidate must resolve to the reviewed literal form — no `extends`/`references`/`baseUrl`/
`rootDirs`/`moduleSuffixes`, `paths` exactly `{"@/*": ["./*"]}` (`impact-presentation.mjs:99-118`).
`findPageConsumers` parses **the entire candidate application source tree** (all
`.[cm][jt]sx?` files outside tooling paths, read in one bounded `git cat-file --batch`,
symlinks/submodules fatal — `impact-git.mjs:48-115`) for import/export/require/dynamic-import
references to the page modules. `#` package imports, computed dynamic imports, unresolved
specifiers, and an application import _into_ excluded tooling all fail to full
(`impact-presentation.mjs:154-175`; tooling set `.design-sync/.github/.husky/ops/scripts/
supabase/tests/config\/ci-qualification-inputs` + tool config files, `impact-git.mjs:6-15`).
Any consumer → "Public page has other source consumers" → full (`change-impact.mjs:94-95`).

EMPIRICAL confirmations of classification (dry run of the real classifier at base 17c3094be):
`docs/operations/change-aware-ci.md` edit → `documentation`; `README.md` edit →
`documentation`; `AGENTS.md` edit → `full` (root AGENTS.md is **outside** the documentation
allowlist, exactly as `AGENTS.md` states); `app/about/page.tsx` JSX-text edit →
`public-pages`; byte-flip of `app/icon.png` → `full`; symlink addition → `full` (mode);
doc rename → `full` (delete+add); `docs/api/README.md` (generated) → `full`.

---

## (b) `full` vs `targeted` profile choice

Exactly three profiles exist (`PROFILE_WORKLOADS`, `impact-plan-contract.mjs:21-31`;
`requiredRoots` throws otherwise, `change-impact.mjs:36-37`):

| Profile         | Required roots                                                                                                                                             |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `documentation` | `documentation` only (`change-impact.mjs:23`)                                                                                                              |
| `public-pages`  | `fast`, `quality`, `build`, `targeted-browser`, `targeted-visual` (+ `documentation` iff any changed path is allowlisted docs — `change-impact.mjs:24-34`) |
| `full`          | the nine roots `fast, quality, build, e2e, a11y, visual, lighthouse, zap-baseline, db` (`FULL_ROOTS`, `change-impact.mjs:10-18,35`)                        |

Selection flow (`plan-checks.mjs:46-118`): classify → then force `full` when (i) the event
is `push` ("Exact-main release qualification always runs every workload", `plan-checks.mjs:91-93`);
(ii) the PR head repository ≠ `lapeninns/nabaperks` ("Fork changes retain full hosted
validation", `plan-checks.mjs:94-101`); (iii) any changed path is in the comparison graph
("CI selection changes require full and targeted comparison", `plan-checks.mjs:94-101`);
(iv) the change inventory or the comparison-dependency graph could not be read
(`plan-checks.mjs:67-87`). `validatePlan` re-asserts the profile/required binding and forbids
a selective plan that still requires comparison (`impact-plan-contract.mjs:73-133`,
"Selection changes must retain the full comparison" at `impact-plan-contract.mjs:124-129`).
Eligibility is therefore: **documentation allowlist** (`docs/operations/**`, `docs/decisions/**`,
`README.md`), or **literal public-page presentation PRs** (`/about`, `/faq`, `/how-it-works`
with optional paired canonical baselines) — everything else, including root `AGENTS.md`
(explicitly excluded by both the code allowlist and the guide text), is `full`.

EMPIRICAL: page-text edit → `public-pages` with `required` `[fast, quality, build,
targeted-browser, targeted-visual]`; page+paired baseline PNG → `public-pages`; baseline
PNG alone → `full` ("Visual baseline has no matching qualified page change").

---

## (c) The qualification comparison

**What triggers it.** `needsSelectionComparison(path)` (`plan-checks.mjs:16-45`) — see (d).
When true: profile forced `full` **plus** `comparisonRequired: true`, and the plan carries
`qualificationPages` read from the **candidate's** `config/ci-impact-policy.json`
(`candidateQualificationPages`, `plan-checks.mjs:113-116`; `impact-qualification-scope.mjs:22-27`)
so adding/removing/renaming a qualified page qualifies the _proposed_ page set, not the
base's older one.

**What it compares.** The `selection-comparison` job ("Verify targeted and full outcomes",
`ci.yml:207-296`) runs `scripts/ci/compare-targeted-evidence.mjs` **from the reviewed base
checkout** (the job first checks out the base, asserts the verifier files exist
(`ci.yml:225-247`), and only reads the candidate as pure Git data via a subdirectory
checkout `CI_COMPARISON_CANDIDATE_TREE`). The verifier then binds:

1. **Source identity** — `verifyQualificationSource` (`scripts/ci/qualification-source.mjs:127-170`):
   the candidate's whole **tracked input tree** (every tracked file except allowlisted
   documentation content and the CI workflow itself — `executionInput`/`inputs`,
   `qualification-source.mjs:32-56`) must be byte-identical (Git blob + mode) to the
   reviewed base's, **except** files whose exact replacement was pre-staged on main under
   `config/ci-qualification-inputs/<path>.source` (`expectedInputs`, `qualification-source.mjs:58-84`:
   the staged blob defines the only accepted candidate replacement, and the staged copy
   itself must survive unchanged). The candidate's `.github/workflows/ci.yml` must equal the
   reviewed base's `config/ci-qualification-workflow.yml` byte for byte
   (`qualification-source.mjs:132-143`; currently **identical** — verified `diff` clean).
   Live reviewed inputs are re-verified on disk with `O_NOFOLLOW|O_NONBLOCK`, fstat on the
   same descriptor, sha1 blob hash and mode check (`verifyLiveInputs`,
   `qualification-source.mjs:88-125`) so a substituted symlink/FIFO cannot spoof the verifier.
   EMPIRICAL (dry run against origin/main): candidate adopting the staged
   `AGENTS.md.source` bytes → **PASSED** (`staged=19`, `executionInputs=2802`); rogue
   `AGENTS.md` → **FAILED**; `scripts/ci/plan-checks.mjs` edit → **FAILED**; `ci.yml` edit →
   **FAILED** ("Qualification workflow differs from the reviewed command wiring"); brand-new
   tracked file → **FAILED** (additions cannot qualify).
2. **Report parity** — `compareTargetedReports` (`compare-targeted-evidence.mjs:85-233`):
   requires successful `selection, e2e, a11y, visual, documentation, targeted-browser,
targeted-visual` jobs, then matches **128 e2e part reports** (`\d+-of-32.json` under
   `runtime/`), **8 a11y** and **8 visual** full-run JSON reports, and **6 targeted
   manifests** (`browser/{chromium,mobile-safari,desktop-firefox,desktop-safari}` +
   `visual/{chromium,mobile-safari}`) — `readFullReports` asserts exact counts
   (`compare-targeted-evidence.mjs:47-80`). Each targeted test identity must match the
   declared page and the full tier exactly, with status `passed`, 0 retries, not flaky
   (`affectedPageTests`/`compareAffectedOutcomes`, `impact-browser-evidence.mjs:4-94`);
   browser policy (workers=1, forbidOnly, failOnFlakyTests, retries=1, fresh webServer) and
   resolved per-project `use` digests must be identical between targeted and full
   (`browserPolicy`, `impact-browser-evidence.mjs:35-65`; `browser-configuration.mjs:25-52`,
   captured by the shared `browser-configuration-reporter.mjs`). Visual stays
   `--update-snapshots=none` on Linux x64 (`compare-targeted-evidence.mjs:166-179`);
   the target/runner environment is parsed from the candidate workflow itself as data
   (`candidateBrowserEnvironment`, `impact-browser-environment.mjs:102-109`) and every
   manifest must match it (`compare-targeted-evidence.mjs:131-165`).
3. **Documentation corpus** — the producer runs eight fixed positive/negative Markdown
   cases plus changed-file checks (`documentation-evidence.mjs:16-80`;
   `DOCUMENTATION_CASES`, `documentation-evidence-contract.mjs:5-30`), and the verifier
   independently re-runs the reviewed checker/formatter against an extracted candidate
   archive (`reviewed-documentation.mjs:150-197`) — candidate prettier configs, package
   managers and hooks never execute.

**Drift guarded against**: any change to selection, browser execution, test mapping or
browser policy — including transitive runner/verifier/test helpers, locks, Node version,
setup actions (`docs/operations/change-aware-ci.md:80-93`).

**Pass/fail action.** The verifier writes `selection-comparison.json` (uploaded as the
`ci-selection-comparison` artifact, 90-day retention, `ci.yml:279-283`) and stamps the
verifier revision into it (`ci.yml:265-278`). `release-gate` requires the
`selection-comparison` job result to be `success` when `comparisonRequired`
(`verify-impact-evidence.mjs:44-47`), and `validateComparisonPlan` accepts **full plans
only** ("Comparison requires all application workloads", `impact-comparison-plan.mjs:48-62`).
Any assertion failure fails the `selection-comparison` job, blocking merge via the required
`Release gate` check.

---

## (d) Selection-graph files (whose change forces full + comparison)

`needsSelectionComparison` (`plan-checks.mjs:16-45`), the exact set:

- `.github/workflows/ci.yml` (literal path).
- `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.nvmrc` (all present in the tree).
- `config/ci-impact-policy.json`, `config/ci-workloads.json`.
- Regex `^scripts/ci/(impact-|change-impact|plan-checks|verify-impact|run-targeted|compare-targeted)/` — i.e. `change-impact.mjs`, `impact-*.mjs`, `plan-checks.mjs`, `verify-impact-evidence.mjs`, `run-targeted-checks.mjs`, `compare-targeted-evidence.mjs`.
- `playwright.config.ts`.
- Regex `^tests/e2e/(a11y|visual|helpers\/a11y)/` — the a11y/visual spec surface.
- Regex `^scripts/ci/(browser-|run-browser|run-bounded)/` — browser-pack/workload/configuration/parity + `run-browser-pack.mjs` + `run-bounded-command.mjs`.
- `scripts/run-playwright.mjs`.
- `.github/actions/playwright/**` and `.github/actions/setup/**`.
- **Plus the import closure of 14 ENTRYPOINTS** (`comparisonDependencies`,
  `impact-dependencies.mjs:7-51`): `plan-checks`, `verify-impact-evidence`,
  `compare-targeted-evidence`, `run-targeted-checks`, `browser-workload`, `run-browser-pack`,
  `check-browser-image`, `browser-configuration-reporter`, `scripts/run-playwright.mjs`,
  `playwright.config.ts`, `tests/e2e/{a11y,a11y.desktop,visual}.spec.ts`. The closure is
  resolved from the **reviewed base checkout** with the TypeScript parser (`./` and `@/`
  specifiers only, computed imports rejected, ≤500 modules, 1 MB/file). Measured on the
  real tree: **41 modules** (EMPIRICAL), which closes the gaps the regexes leave — e.g.
  `scripts/ci/qualification-source.mjs` (EMPIRICAL: edit → comparison `true`) and
  `ops/local-ci/core/process-tree.mjs` (via `run-bounded-command.mjs`).
- **Excluded on purpose**: canonical baseline PNGs
  `^tests/e2e/visual.spec.ts-snapshots/[^/]+\.png$` (`plan-checks.mjs:19-21`) — expected
  image updates do not execute test selection.

EMPIRICAL probe results: `ci.yml`, `package.json`, `pnpm-lock.yaml`, `.nvmrc`,
`playwright.config.ts`, `config/ci-impact-policy.json`, `config/ci-workloads.json`,
`scripts/ci/plan-checks.mjs`, `scripts/ci/qualification-source.mjs`,
`tests/e2e/visual.spec.ts`, `tests/e2e/helpers/a11y-sweep.ts`,
`.github/actions/setup/action.yml`, `.github/actions/playwright/action.yml`, and deletion
of `scripts/ci/plan-checks.mjs` → **full + comparison**. Not comparison-triggering (still
`full` by classification): `scripts/ci/factory-status.mjs`, `tsconfig.json`,
`.github/actions/rogue/action.yml` (a new action dir), `.github/workflows/production-database.yml`,
`config/ci-qualification-workflow.yml` (the proposal), `config/ci-qualification-inputs/**`
(staging), `tests/support/register-alias.mjs`, `tests/unit/**`, `lib/**`, `components/**`,
binary assets.

---

## (e) The "Policy bootstrap: full validation" state

**Where encoded.** Two conditional fallbacks in `ci.yml`:

- `selection` job: if the **reviewed base** has no `scripts/ci/plan-checks.mjs`, the job
  emits a hardcoded full plan with reason **"Policy bootstrap: full validation and
  selection comparison required"** and all nine roots plus `comparisonRequired: true`
  (`ci.yml:92-115`, bootstrap JSON at `ci.yml:114-115`). It also hard-fails if the base
  lacks the verifier foundation (`compare-targeted-evidence.mjs` /
  `documentation-evidence-contract.mjs`) before scheduling application jobs (`ci.yml:97-101`).
- `release-gate`: if the base has no `verify-impact-evidence.mjs`, the bootstrap inline
  module validates the old nine roots via `verify-required-evidence.mjs`
  (`REQUIRED_HOSTED_JOBS`, `verify-required-evidence.mjs:6-17`) **plus** all new
  qualification jobs and asserts `plan.profile === 'full'` and `comparisonRequired === true`
  (`ci.yml:776-805`).

**Is it permanent?** No — it is a **conditional fallback for a base that predates the
classifier**. On current `origin/main`, `scripts/ci/plan-checks.mjs` **exists**, so the
real classifier executes and the `documentation`/`public-pages` profiles are **live and
selectable today** (EMPIRICAL: dry runs at base 17c3094be returned `documentation` and
`public-pages` profiles). The bootstrap text is retained only so a hypothetical
classifier-removal PR cannot silently degrade: removing `plan-checks.mjs` is itself a
deletion (→ full + comparison), and the fallback keeps the pipeline green-lit only into a
full run.

**Documented path to/away from targeted profiles.** The profiles and their eligibility are
first-class product behaviour (`docs/operations/change-aware-ci.md:10-22`), not a flag.
Policy evolution follows the staged-inputs sequence: an inert staging PR under
`config/ci-qualification-inputs/` (full nine roots, **no** comparison — EMPIRICAL:
`staged-source` scenario → `full`, `comparison=false`; pinned by
`tests/unit/ci-reviewed-execution.test.mjs:207-260` "inert proposal updates retain all
required checks before later activation is qualified"), then an activation PR that must
pass full + the byte-exact comparison. Expanding eligible files "requires another reviewed
qualification" (`change-aware-ci.md:75-76`). Rollback: "return the planner's profile to
`full` for all PRs while keeping the stable gate and all hosted workloads"
(`change-aware-ci.md:151-153`). `AGENTS.md` correctly calls the staged `.source` proposals
"inert reference data" for instruction purposes — in CI terms they are inert until an
activation PR adopts their exact bytes.

---

## (f) The nine hosted roots → jobs, names, and root→path mapping

`FULL_ROOTS` = `fast, quality, build, e2e, a11y, visual, lighthouse, zap-baseline, db`
(`change-impact.mjs:10-18`). Job wiring in `ci.yml`:

| Root           | Job(s)                                                      | Condition (`ci.yml`)                                                                               | Notes                                          |
| -------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| —              | `selection` ("Select required checks")                      | always                                                                                             | computes the plan                              |
| `fast`         | `fast` ("Fast lane (lint, typecheck, unit)") + coverage     | `profile in [full, public-pages]` (`ci.yml:302-344`)                                               | `run-workload.mjs fast` then `coverage`        |
| `quality`      | `quality` ("Quality lane (hygiene sweeps)")                 | `profile in [full, public-pages]` (`ci.yml:346-397`)                                               | + poster PDF proofs                            |
| `build`        | `build` ("Production build")                                | `profile in [full, public-pages]` (`ci.yml:399-435`)                                               | shares `.next` artifact with Lighthouse/ZAP    |
| `e2e`          | `e2e` ("E2E (<project>, pack N)") 4 projects × 4 packs      | `profile == full` (`ci.yml:437-500`)                                                               | rollup `e2e-gate` "E2E (DB-free harness tier)" |
| `a11y`         | `a11y` ("Accessibility (<project>, shard N/4)") 2 × 4       | `profile == full` (`ci.yml:502-560`)                                                               | rollup `a11y-gate` "Accessibility sweep"       |
| `visual`       | `visual` ("Visual regression (<project>, shard N/4)") 2 × 4 | `profile == full` (`ci.yml:562-621`)                                                               | rollup `visual-gate` "Visual regression"       |
| `lighthouse`   | `lighthouse` ("Lighthouse (<route>)") 4 routes              | `profile == full` (`ci.yml:623-669`)                                                               | rollup `lighthouse-gate` "Lighthouse CI"       |
| `zap-baseline` | `zap-baseline` ("ZAP baseline")                             | `profile == full` (`ci.yml:671-700`)                                                               | reuses build artifact                          |
| `db`           | `db` ("DB behavioral moat")                                 | `profile == full` (`ci.yml:702-740`)                                                               | rollup `db-gate` "DB behavioral moat gate"     |
| —              | `documentation`                                             | `profile == documentation` OR (`public-pages` AND docs changed) OR `comparison` (`ci.yml:125-144`) | targeted root                                  |
| —              | `targeted-browser` / `targeted-visual`                      | `profile == public-pages` OR `comparison` (`ci.yml:146-205`)                                       | targeted roots                                 |
| —              | `selection-comparison`                                      | `always() && comparison == true` (`ci.yml:207-296`)                                                | qualification                                  |
| —              | `build-gate`                                                | full/public-pages rollups (`ci.yml:437`-area, `e2e-gate` `ci.yml:502`-area)                        | stable names                                   |
| —              | `release-gate` ("Release gate")                             | `always()` (`ci.yml:742-805`)                                                                      | final verifier                                 |

**Root→changed-path mapping**: `documentation` profile PRs run only the `documentation`
root; `public-pages` PRs run the shared `fast/quality/build` baseline plus the two
page-scoped browser roots; everything else runs all nine. The rollup `*-gate` jobs exist so
branch protection can require **stable names** (the matrix jobs get generated names).
EMPIRICAL (live ruleset read via `gh api`, read-only): the active "Main delivery policy"
ruleset enforces exactly three required status checks — **`Release gate`**, **`Analyze
(javascript-typescript)`** (CodeQL), **`Review dependency changes`** — with
`require_code_owner_review: true`, `dismiss_stale_reviews_on_push: true`,
`require_extra_approval_for_unattributed_changes: true`, linear history, deletion and
non-fast-forward blocks. `CODEOWNERS` routes `/.github/` to `@lapeninns @amanshresthaa`.
`Release gate` then enforces the per-plan success/skip matrix
(`verify-impact-evidence.mjs:12-50`): every required workload must be `success`, every
unselected one explicitly `skipped` ("not required (not executed)"), the comparison job
must match `comparisonRequired`, and the published plan must deep-equal a **recomputed**
plan (below).

Root commands come from `config/ci-workloads.json` via `run-workload.mjs`
(`fast`: env:check:production, security:audit, lint, typecheck, test:contracts;
`coverage`; `quality`: deadcode/duplicates/debt/docs/agents/tokens/claims; `build`:
build, bundle:check, jsonld:check). The `documentation` root runs
`secrets:check, test:contracts, docs:check, agents:check` + changed-file prettier + local
Markdown links (`documentation-checks.mjs:93-131`).

---

## (g) How the plan is surfaced and machine-checked

- **Job outputs**: `selection` publishes `plan` (full JSON), `profile`, `comparison`
  (`ci.yml:71-74`), consumed by every downstream `if:` and by `run-targeted-checks.mjs`
  via `CI_IMPACT_PLAN`.
- **Step summary**: `publishPlan` appends a "CI selection" section with profile, reason,
  candidate SHA, required checks, and the disclaimer "Unselected checks … have not
  passed" (`plan-checks.mjs:121-137`). The comparison appends its own summary
  (`compare-targeted-evidence.mjs:268-277`).
- **Artifacts**: `ci-selection-comparison` (90-day retention, includes verifier revision
  `ci.yml:265-283`), `ci-documentation-evidence`, `targeted-browser`/`targeted-visual`
  evidence trees, plus the full-run JSON reports consumed by the comparison.
- **PR comments**: there is **no** PR-comment mechanism in the CI workflow — the plan is
  surfaced only through job outputs, step summaries and artifacts.
- **Machine-checked later, twice**: (1) the `selection-comparison` job validates the plan
  against evidence artifacts and independently re-reads the candidate policy/workflow
  (`verifyQualificationScope`, `verifyQualificationSource`,
  `compare-targeted-evidence.mjs:235-246`); (2) at merge time the `release-gate` job
  checks out `github.sha`, detaches to the **reviewed base**, and **recomputes the entire
  plan from the immutable Git difference** with the base's verifier, asserting the
  published plan deep-equals it (`verify-impact-evidence.mjs:58-77` "Selection plan
  differs from the reviewed immutable Git classification"; wiring `ci.yml:742-805`).
  There is no separate "ci-selection-verifier" workflow file: the verifier _is_ the
  `selection-comparison` job inside `ci.yml`, as `docs/operations/ci-selection-verifier.md`
  (the "verifier foundation" doc) describes; only `ci.yml` references
  `CI_IMPACT_PLAN`/selection among all workflow files (grep-verified).
- Post-merge, every exact-`main` push re-runs the complete suite (`ci.yml:4-8`;
  `plan-checks.mjs:91-93`), so targeted PR evidence never substitutes for release evidence
  (`docs/operations/change-aware-ci.md:96-100`).

---

## (h) Browser pack and shard enumeration

- **Workload definitions** (`config/ci-workloads.json:26-50`): `test:e2e` — projects
  `chromium, mobile-safari, desktop-firefox, desktop-safari`, `hostedShards: 32`,
  `grepInvert: "@visual"`; `test:a11y` — `chromium, mobile-safari`, `hostedShards: 4`,
  `grep: "@a11y"`; `test:visual` — `chromium, mobile-safari`, `hostedShards: 4`,
  `grep: "@visual"`. `browserArguments` (`browser-workload.mjs:8-32`) validates the
  plane/suite/project/shard against these numbers and builds the Playwright args; the
  matrix jobs call `browser-workload.mjs hosted <suite> --project=… --shard=…`
  (e.g. a11y at `ci.yml:544-546`), and `parseBrowserRequest` rejects any flags that differ
  from the reviewed workload (`browser-workload.mjs:34-47`).
- **Packs** (`scripts/ci/run-browser-pack.mjs`): `PACK_COUNT = 4`, `PACK_SHARD_COUNT = 8`,
  `BROWSER_SHARD_TOTAL = 32` (`run-browser-pack.mjs:38-40`), with a load-time tiling
  assertion (`run-browser-pack.mjs:45-46`). `packShards(pack)` returns the 8 consecutive
  shards `(pack-1)*8+1 … pack*8` of the untouched `/32` denominator
  (`run-browser-pack.mjs:48-56`) — so Playwright's spec-to-shard distribution is
  byte-identical to the old 32-job matrix; only the job grouping changed. Each `e2e` matrix
  job (project × pack 1-4, `ci.yml:458-465`) runs `run-browser-pack.mjs <project> <pack>`,
  which executes each shard **sequentially with a fresh Playwright server and verified
  wrapper teardown** (`browser-pack.mjs:39-138`, `run-bounded-command.mjs`), first in
  `--list` mode then for real, and asserts the executed inventory equals the listed one
  (`run-browser-pack.mjs:76-88`). 16 jobs × 8 shards = the same 128 shard reports the
  comparison expects (`readFullReports`, `compare-targeted-evidence.mjs:47-80`).
- **Projects → where**: e2e runs all four projects in the pinned Playwright container
  `mcr.microsoft.com/playwright:v1.62.1-noble@sha256:dcc5531e…` with
  `--init --ipc=host --user 1001` (`ci.yml:441-444`); a11y runs `chromium` and
  `mobile-safari` in the same container; **visual runs `chromium`/`mobile-safari` on the
  bare `ubuntu-latest` host** (no container — the canonical pixel platform,
  `impact-browser-environment.mjs:41-100` requires the host runner for visual jobs).
  `check-browser-image.mjs` verifies the installed Playwright/browsers inside the
  container (`check-browser-image.mjs:5-22`).
- **Targeted tiers** for `public-pages` PRs: `targeted-browser` runs the four projects'
  a11y page tests for the selected routes (`targetedArguments`,
  `run-targeted-checks.mjs:30-58`: grep `no axe violations: (/about|…)$`, mobile-safari →
  `a11y.spec.ts`, others → `a11y.desktop.spec.ts`), and `targeted-visual` runs the
  selected pages' `@visual` tests with `--update-snapshots=none` on `chromium`/
  `mobile-safari` (`run-targeted-checks.mjs:48-58`). Each targeted run executes twice —
  `--list` then runtime — and the manifest asserts inventory parity, fresh servers, no
  `.env` files, and teardown verification (`runTargetedBrowser`,
  `run-targeted-checks.mjs:86-205`).

---

## Other `scripts/ci/` files (roles, for completeness)

Read in full; those not part of selection: `hosted-evidence.mjs` (read-only GitHub reader
producing the local-plane comparison envelope; classifies CI jobs into lanes and treats
`selection`/`targeted-*`/`selection-comparison` as deliberate non-lanes,
`hosted-evidence.mjs:88-130`), `check-installed-revision.mjs` (local-CI install drift
classifier; execution surface = `ops/local-ci/`, `scripts/ci/`, contract/workload configs,
`check-installed-revision.mjs:26-36`), `collect-usage.mjs` (job-usage sampler),
`factory-status.mjs`/`factory-action.mjs` (software-factory status/repair tooling),
`observe-trusted-local-proof.mjs` (read-only local-proof observer that never grants
merge authority), `pr-feedback-time.mjs` (PR check-latency metric), `installed-execution-surface.mjs`
(release-file/image inspection inputs), `process-exit.mjs` (signal→exit-code convention),
`node-test-runner.mjs` (Node test runner wrapper with concurrency bounds — the alias loader
needed by unit tests). `documentation-evidence.mjs`/`-contract.mjs`, `documentation-checks.mjs`,
`reviewed-documentation.mjs` implement the documentation root and its reviewed-content
qualification (above). `impact-comparison-plan.mjs` duplicates the identity/full-plan contract
for the comparison CLI so it cannot be reused to authorize selective plans.
