# CI selection verifier foundation

Owner: Lapen Inns product operations.

This foundation stages the reviewed CI toolchain and a proposed workflow contract
before enabling selective checks. The active workflow and release process retain
all required workloads. Browser evidence gains configuration metadata; the staged
planner, targeted runner and selective gate have no active workflow callers yet.

The verifier accepts full qualification plans only. It requires all 128 full e2e,
eight accessibility and eight visual reports, and the four targeted browser plus
two targeted visual manifests. Each targeted test must match its declared page,
successful outcome, resolved browser settings and immutable image identity.
Qualification runners must be literal `ubuntu-latest`; visual snapshot updates
must be disabled, including creation of missing baselines.

Before considering reports, qualification checks the candidate against
`config/ci-qualification-workflow.yml`, a reviewable proposal rather than an
active GitHub workflow. The whole workflow must match, including commands,
conditions, environment, actions and artifact wiring. Every other tracked input
must match the reviewed base's Git objects, including all workload scripts, unit,
contract and database tests, fixtures, application modules, configuration and binary
assets. Qualified internal Markdown is checked separately as content. This avoids
assuming that a file outside a known tooling directory cannot influence validation.
Additions, removals, replacements, mode changes or dirty reviewed inputs fail.

The foundation can stage a future input under `config/ci-qualification-inputs/`,
preserving its repository path and appending `.source` so tools treat the copy as
inert review data. The reviewed copy's exact
Git blob and mode then define the accepted candidate input. This lets the existing
workflow retain its current checks while the prerequisite explicitly reviews the
future test or executable. The staged copies themselves must also remain identical
in the candidate, and cannot replace the workflow's separate complete comparison.
All live reviewed files are verified as regular files with matching modes and
binary-safe Git blob hashes. Candidate-provided staged copies cannot change the
expected inventory.

A producer or imported application module cannot omit a required process and
substitute copied reports or constant execution records. Qualification changes
must have their complete input tree reviewed in a prerequisite; ordinary PRs that
do not change selection retain their normal selected or full profile.

Documentation validation executes the checker, formatter, plugins and configuration
from the reviewed checkout against a temporary archive of regular candidate files.
Candidate checkers, formatter configurations, package managers and hooks never
execute. The reference checks the exact changed Markdown inventory and eight
reviewed valid/broken cases, even if the candidate contains no checker module.
Inputs, subprocess output, memory and duration are bounded. Candidate symlinks,
submodules and unsafe archive paths fail before extraction. Git replacements,
grafts and ambient Git overrides cannot reinterpret the named revisions.

Report comparison alone returns `reports-matched`. The CLI returns `passed` only
after source wiring and independently reviewed documentation validation also pass.
It records both revisions, executable and workflow digests, page outcomes and the
reference checker results. Its selection gate separately recomputes the complete
plan from immutable Git objects before allowing any workload to be omitted.

Land this foundation through full CI and code-owner approval first. The integration
must execute its verifier and dependency lock from that reviewed base. Missing
foundation code stops the integration before application jobs start. There is no
legacy verifier fallback, candidate execution sandbox or Docker requirement.

For an operator readback, provide `CI_IMPACT_PLAN`, `CI_COMPARISON_NEEDS`, the
standard repository/base/head/candidate environment identity and
`CI_COMPARISON_CANDIDATE_TREE`, then run:

```bash
node scripts/ci/compare-targeted-evidence.mjs /path/to/downloaded-evidence
```

The evidence directory contains `full-e2e`, `full-a11y`, `full-visual`, `targeted`
and `documentation/documentation.json`. The resulting `selection-comparison.json`
binds its verdict to the candidate. Provider run identity, review approval and
the source checkout remain separate evidence; local comparison cannot establish
merge or production readiness.
