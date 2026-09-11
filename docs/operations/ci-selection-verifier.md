# CI selection verifier foundation

Owner: Lapen Inns product operations.

This foundation adds a comparison verifier for future change-aware CI evidence.
It leaves the current workflow, required checks, browser runners and release
process in place. The page policy is verification data; no planner or workflow
uses it to omit a check in this revision.

The host verifier consumes candidate Git objects and artifacts without importing
candidate code into the host process. It requires:

- Successful full e2e, accessibility, visual and documentation jobs, plus both
  targeted tiers, bound to the same selection plan.
- All 128 full e2e, eight accessibility and eight visual reports, and exactly
  the four targeted browser and two targeted visual project manifests.
- Matching executed test identities, successful outcomes, resolved browser
  settings and immutable container image identities from the candidate workflow.
- Exact tests for each declared page, canonical `ubuntu-latest` runners, and
  visual runs with snapshot updates disabled, including missing baselines.
- The candidate's bounded page policy, including proposed page additions,
  removals and visual-name changes.
- The exact changed Markdown file/blob inventory and the complete eight-case
  documentation qualification corpus. Missing or altered evidence fails.

Report comparison alone returns `reports-matched`. Qualification additionally
executes the candidate's actual documentation checker against the reviewed valid
and broken cases and the changed Markdown files. The reviewed parent process
owns the expected results and observes each container exit status; copied
success constants cannot replace checker execution.

This step requires Docker. A pinned official Node 24 image installs candidate
dependencies as an unprivileged user with install scripts disabled. Runtime
containers have no network, host credentials or Docker socket; their root is
read-only, their resources are bounded, and only the reviewed invocation harness
and fixtures are mounted read-only. Git replacement refs and ambient Git
configuration overrides cannot reinterpret the candidate identities. The output
records the verifier revision and whether its worktree was clean.

This foundation accepts full comparison plans only. A candidate-provided
selective profile, file inventory or digest cannot authorise omitted checks.
The later integration must separately bind selective plans to the immutable
Git difference using its reviewed classifier.

Land this verifier through the existing full CI and code-owner review before
enabling the corresponding producer changes. The later integration must execute
this verifier and its dependencies from the already reviewed base, keep the
candidate checkout as data, and require the comparison before granting selection
authority. A legacy verifier that ignores the documentation artifact cannot
substitute for this prerequisite.

For an operator readback, provide `CI_IMPACT_PLAN`, `CI_COMPARISON_NEEDS`, the
standard repository/base/head/candidate environment identity and
`CI_COMPARISON_CANDIDATE_TREE`, then run:

```bash
node scripts/ci/compare-targeted-evidence.mjs /path/to/downloaded-evidence
```

The evidence directory contains `full-e2e`, `full-a11y`, `full-visual`, `targeted`
and `documentation/documentation.json`. The resulting
`selection-comparison.json` binds its verdict to the candidate. Provider run
identity, review approval and the source checkout remain separately required
evidence; a local comparison does not establish merge or production readiness.
