# Visual baseline classification prerequisite

PR #326 changes the welcome-offer application and its reviewed PNG baselines.
All nine hosted workload roots passed in CI run `34699110959`, but the final
comparison rejected the candidate's changed application inputs. The planner
classified `tests/e2e/visual.spec.ts-snapshots/` as executable selection code
because its `visual` prefix also matches `visual.spec.ts`.

This prerequisite stages an exact replacement for `scripts/ci/plan-checks.mjs`
and a focused regression test under `config/ci-qualification-inputs/`. It changes
no active workflow, planner, test or merge requirement.

The proposed planner excludes only direct `.png` references in the existing
visual snapshot directory from policy qualification. The ordinary classifier
still sends unsupported application changes and their baselines through all nine
hosted roots. Existing qualified public-page baseline rules remain unchanged.
The visual test executable, accessibility tests, CI configuration and paths such
as `reference.png.mjs` still require the reviewed qualification process.

Local verification applied the exact staged planner and regression test in an
isolated checkout: all 22 focused planner/impact tests passed. The active files
were then restored before committing the inert proposal. `pnpm quality:check`
also passed on the prerequisite tree. Hosted qualification of the activated
planner remains a later, separate requirement.

After code-owner approval and merge of this prerequisite, apply the two staged
files at their corresponding active paths in a separate PR. That activation
must pass the complete hosted suite and targeted/full comparison using this
reviewed base. Then update #326 onto the installed policy and repeat current-head
checks and review. No failing check or protected approval is bypassed by either
step.

Rollback is to revert the activated planner through the normal reviewed process.
This proposal has no application, database or provider configuration changes.
