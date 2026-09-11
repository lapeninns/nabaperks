# CI selection verifier foundation

Owner: Lapen Inns product operations.

This foundation adds a comparison verifier for future change-aware CI evidence.
It leaves the current workflow, required checks, browser runners and release
process in place. The page policy is verification data; no planner or workflow
uses it to omit a check in this revision.

The verifier consumes candidate Git objects and artifacts without importing the
candidate's runner or verifier code. It requires:

- Successful full e2e, accessibility, visual and documentation jobs, plus both
  targeted tiers, bound to the same selection plan.
- All 128 full e2e, eight accessibility and eight visual reports, and exactly
  the four targeted browser and two targeted visual project manifests.
- Matching executed test identities, successful outcomes, resolved browser
  settings and immutable container image identities from the candidate workflow.
- The candidate's bounded page policy, including proposed page additions,
  removals and visual-name changes.
- The exact changed Markdown file/blob inventory and the complete eight-case
  documentation qualification corpus. Missing or altered evidence fails.

Public-page plan validation uses the reviewed policy in this checkout. A
candidate-provided qualification page list does not grant selection authority.

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
