# Visual baseline classification prerequisite

PR #326 changes the welcome-offer application and its reviewed PNG baselines.
All nine hosted workload roots passed in CI run `34699110959`, but the final
comparison rejected the candidate's changed application inputs. The planner
classified `tests/e2e/visual.spec.ts-snapshots/` as executable selection code
because its `visual` prefix also matches `visual.spec.ts`.

The prerequisites stage exact replacements for `scripts/ci/plan-checks.mjs`,
the existing `ci-targeted-evidence.test.mjs` expectation and a focused
`ci-snapshot-selection.test.mjs` regression under
`config/ci-qualification-inputs/`. They change no active workflow, planner, test
or merge requirement. The existing Firefox PNG expectation is aligned with
the proposed classifier, and the regression confirms that this unsupported
browser baseline still receives all nine hosted workloads.
The older staged operational-readiness contract is synchronised with its active
target, preserving its `customerDevice` assertion. Every other existing staged
input is byte-aligned with its active target, so activation has exactly the
three intended active-file changes.

The proposed planner excludes only direct `.png` references in the existing
visual snapshot directory from policy qualification. The ordinary classifier
still sends unsupported application changes and their baselines through all nine
hosted roots. Existing qualified public-page baseline rules remain unchanged.
The visual test executable, accessibility tests, CI configuration and paths such
as `reference.png.mjs` still require the reviewed qualification process.

Local verification applied the exact staged planner and both compatible test
files in an isolated activation checkout. The full `pnpm quality:check` gate
passed, including the existing selection assertions and the new baseline
regression. The prerequisite checkout retains its existing active files.
Hosted qualification of the activated planner remains a later, separate
requirement.

After code-owner approval and merge of the prerequisites, apply the three staged
files at their corresponding active paths in a separate PR. That activation
must pass the complete hosted suite and targeted/full comparison using this
reviewed base. Then update #326 onto the installed policy and repeat current-head
checks and review. No failing check or protected approval is bypassed by either
step.

Any rollback must handle the planner and its corresponding regression test
together; reverting only the planner leaves failing assertions in the fast lane.
Changes to active selection code still require a reviewed prerequisite and
qualification, including compatible test expectations. This inert proposal has
no application, database or provider configuration changes.
