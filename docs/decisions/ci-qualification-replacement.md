# Replace exact-tree CI qualification with full validation and owner review

Status: accepted in the repository, pending activation (see "Landing sequence").
Date: 30 September 2026. Findings: R01, R02, R03, R05 (original report F1, F6).

## Context

Since change-aware CI landed, any pull request that touched a CI input
(`needsSelectionComparison` in `scripts/ci/plan-checks.mjs`: the workflow,
dependency manifests, the selection verifier's import closure and the browser
harness) set `comparisonRequired`. The reviewed gate then required the
`Verify targeted and full outcomes` job, whose verifier
(`scripts/ci/qualification-source.mjs`) demanded that the candidate's whole
tracked tree equal the base plus the staged copies under
`config/ci-qualification-inputs/`, and that `ci.yml` equal
`config/ci-qualification-workflow.yml` byte for byte.

Verified on 30 September 2026 at `89406771`:

- Five of the 27 staged copies were older than the live files (lockfile,
  workspace, `plan-checks.mjs`, `visual.spec.ts`, `a11y-sweep.ts`), so an
  ordinary dependency PR could only qualify by reverting them.
- #411 and #413 merged with `Release gate` = failure. No ruleset bypass actor
  exists; each time the required check was replaced in the ruleset by a manual
  commit status for about seven seconds (ruleset versions 51367657/51367664 and
  51397256/51397267) and then restored.
- The `pull_request` workflow definition comes from the candidate merge ref.
  The verifier code runs from the base SHA, but the steps that invoke it are
  candidate YAML, so a candidate can omit or replace them and still publish a
  green `Release gate`. Required checks have no `integration_id`. Qualification
  therefore bound only candidates that kept invoking it; it never protected the
  gate's definition.
- `CODEOWNERS` assigns `*` to the owners and the main ruleset requires
  code-owner review with stale-approval dismissal, so every CI-input change is
  already reviewed by an owner.
- The targeted profiles (documentation, public pages) were selected in 0 of 98
  pull-request runs, so the comparison qualified a path that never executed.

## Decision

1. A pull request that changes a CI input runs every one of the nine roots
   (profile `full`) and no longer requires the targeted/full comparison
   (`comparisonRequired` is always `false`). Fork pull requests and main
   pushes were already `full`.
2. Code-owner review, enforced by the live ruleset, is the binding control for
   CI-input changes. The selection policy, verifier and their tests still run
   in full CI.
3. The comparison jobs stay in `ci.yml` (skipped) so the verifier's expected
   job set is unchanged; their deletion is a separate, later change.

## Consequences

- Dependency and CI pull requests can pass `Release gate` honestly, so the
  ruleset swap is no longer needed. Using it again is a governance incident.
- Lost: one targeted-versus-full agreement sample per CI-input PR. That sample
  never proved coverage equivalence, and targeted authority for later PRs still
  comes only from reviewed base policy with every uncertain case falling back to
  `full` (`change-impact.mjs`, `plan-checks.mjs`).
- Not solved by this change (R02): a candidate can still edit `ci.yml` to
  publish a same-named green check. Detection is owner review of the visible
  workflow diff. The structural fix needs live settings and is prepared below.

## Trusted gate producer (prepared, not active)

Target design, requiring repository administration:

1. A `workflow_run` workflow on `CI` completion (definition always from the
   default branch) re-reads the run's jobs through the API, verifies them with
   main's policy and posts the verdict as a check run.
2. The verdict is posted with a dedicated GitHub App token held in an
   environment whose deployment branch policy allows only `main`, so a pull
   request workflow cannot read it.
3. The ruleset requires that check with the App's `integration_id`.

Until those three exist together, a same-named check from `github-actions`
remains forgeable by a writer's candidate workflow. Do not require a new check
name before its producer is proven, or merges block.

## Governance drift found (not changed)

- `scripts/github-governance/checks.mjs` expects
  `require_last_push_approval: true`; the live ruleset has `false`.
- Neither the contract nor the checker pins an `integration_id`.
- Every environment has `can_admins_bypass: true`, which the contract does not
  model.

## Landing sequence

The current base policy still requires exact-tree qualification for this very
change, so it lands through the existing stage and activate protocol rather
than a ruleset swap:

1. Stage PR: all non-CI-input changes, plus `config/ci-qualification-inputs/`
   rewritten to hold exactly the activation PR's CI-input files, plus
   `config/ci-qualification-workflow.yml` equal to the new `ci.yml`. It runs
   the full nine roots without comparison.
2. Activation PR: exactly the staged files. The base verifier's comparison
   passes because the candidate equals base plus staged copies.
3. Cleanup PR (after activation is on main and one main run is green): delete
   `selection-comparison`, `qualification-source.mjs`,
   `compare-targeted-evidence.mjs`, `reviewed-documentation.mjs`, the staged
   inputs and the workflow copy, and update the verifier's expected job set.

Rollback of step 2 is a reviewed revert, which re-enables the comparison
requirement; it does not require re-staging.
