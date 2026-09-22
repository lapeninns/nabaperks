# Nightly QA hardening

Owner: Lapen Inns product operations.

This page owns `.github/workflows/nightly.yml`, the hosted `Nightly QA
hardening` workflow. It describes the workflow after the September 2026
notification and scope-down change: mutation testing on Mondays only, 16
cross-browser shards per project, no authenticated race job, and two standing
incident issues. If this page and the workflow disagree, the workflow is
authoritative and this page needs correcting.

## Purpose

The workflow runs hardening checks that are too slow or too costly for every
pull request: the complete cross-browser Playwright suite, mutation testing, a
k6 load check of the public routes and a full ZAP scan. Every job runs against
the checked-out revision with the workflow's literal fixture environment; the
load and ZAP jobs build and serve it on the runner. No job reads a repository
secret or reaches production.

## Schedule and triggers

- **Daily except Monday:** `cron: "24 2 * * 0,2-6"` runs cross-browser, load
  and ZAP.
- **Monday:** `cron: "24 2 * * 1"` runs the same jobs plus mutation testing.
  The two schedules never fire together, so neither run cancels the other.
- **Manual:** `workflow_dispatch` from the Actions tab or
  `gh workflow run nightly.yml --ref <branch>`. A dispatch runs every job,
  including mutation testing.
- **Timing:** both schedules run at 02:24 UTC (03:24 in Britain during summer
  time). GitHub can delay or drop scheduled runs under load, so the declared
  cadence is not a delivery guarantee.
- **Concurrency:** group `nightly-qa-${{ github.ref }}` with
  `cancel-in-progress: true`. A newer run on the same ref supersedes an older
  one; a cancelled run is normal supersession, not a test failure.

## Jobs

| Job                  | Runs on                           | What it checks                                                                                                                                                                                                                 | Timeout |
| -------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| `cross-browser`      | Every run                         | `pnpm test:e2e` with `--grep-invert @visual` for `chromium`, `mobile-safari`, `desktop-firefox` and `desktop-safari`, each split into 16 shards (64 jobs). Failed shards upload their reports.                                 | 45 min  |
| `cross-browser-gate` | Every run                         | `Full cross-browser Playwright`: passes only when every shard of every project succeeded.                                                                                                                                      | 1 min   |
| `mutation`           | Monday schedule and dispatch      | `pnpm mutation:check` (Stryker, `stryker.conf.json`). Chromium is installed because four unit tests render PDFs through a real browser. The `stryker-report` artefact is kept for seven days. Skipped on other scheduled runs. | 90 min  |
| `load`               | Every run                         | `k6 run tests/load/public-routes.js` against `pnpm start` on `127.0.0.1:3000` after a production build.                                                                                                                        | 20 min  |
| `zap-full`           | Every run                         | ZAP full scan of the local production build with `.zap/rules.tsv`. `allow_issue_writing: false`, so the scan action itself never opens issues.                                                                                 | 30 min  |
| `notify`             | Every scheduled or dispatched run | `Reconcile nightly incident`: runs after the observation jobs, including when they fail or mutation is skipped, and opens or closes the standing issues. It is the only job with `issues: write`.                              | 2 min   |

Every other job keeps `contents: read`. The `notify` job checks out without
persisted credentials and reads each job's result only through environment
variables.

**Sharding.** The cross-browser suite is sharded for memory, not speed. Run
unsharded, the webpack dev server accumulates heap until it fails with a
JavaScript heap out-of-memory error and every later navigation is refused (run
30196429475). Each shard gets its own runner and a fresh dev server. Moving
from 32 to 16 shards halves the fixed per-shard setup cost but doubles each
shard's share of the suite, and so its dev-server heap growth. If
out-of-memory failures return, restore more shards rather than dropping a
browser project.

**Removed scope.** The authenticated stamp and redeem race job (`load-race`)
was removed. It was gated on repository variables that were never set, so it
never executed, and it held the workflow's only repository secret reference.
Mutation testing moved from nightly to weekly, and cross-browser moved from 32
to 16 shards. Rebuilt from four sampled runs, the change was estimated to
remove about 42% of the workflow's billed job minutes. Test work is conserved,
so halving the shard count removes only the per-shard setup and billing
round-up, not half of the cross-browser minutes.

## Advisory status

Nightly gates nothing. It is not a required check, `Release gate` does not
depend on it, and no merge, database promotion or deployment waits for it. A
red nightly is a signal to triage, not a release blocker. Pull request and
exact-main CI remain the merge authority; see
[change-aware CI](change-aware-ci.md).

## Failure policy

The `notify` job reuses the watchdog incident reconciler in
`scripts/watchdog-incidents.mjs`, which also serves
[the local CI watchdog](local-ci-watchdog.md). It keeps two standing issues,
both authored by `github-actions[bot]` and assigned to the contract's
`agentLiveness.notificationAssignee` (`lapeninns`):

| Issue title                                 | Body marker                               | Healthy when                                                   |
| ------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------- |
| `[Watchdog] Nightly QA hardening failed`    | `<!-- nabaperks-watchdog:nightly:v1 -->`  | The cross-browser gate, load and ZAP jobs all succeed          |
| `[Watchdog] Weekly mutation testing failed` | `<!-- nabaperks-watchdog:mutation:v1 -->` | The mutation job succeeds, on a run where mutation testing ran |

- The nightly issue does not read the mutation result, so a weekly skip never
  keeps it open and a mutation failure never opens it.
- The mutation issue is reconciled only on runs where mutation testing ran.
  A skipped mutation job is reported as not monitored, so it neither opens nor
  closes that issue; a Tuesday run cannot close a Monday mutation failure.
- The first unhealthy observation opens exactly one issue of that kind, with
  the marker and a link to the first failing run.
- Later unhealthy observations leave the issue unchanged: no new issue, no
  comment and no edit.
- The first healthy observation closes the issue as completed and appends
  `Recovery observed: <run URL>` to the issue body. It does not post a comment.
- A cancelled (superseded) run is not an observation; the reconcile step does
  not run.
- Nightly reports the local-CI heartbeat and public-health monitors as not
  monitored, so it never opens or closes their incidents, and
  `agent-watchdog.yml` likewise leaves both nightly issues alone.
- Closing an issue by hand does not silence it: the next unhealthy observation
  opens a new one.

**Branch dispatches share the same issues.** A `workflow_dispatch` from any
branch reconciles the same standing issues as scheduled runs on `main`, so a
green run on a branch can close an incident that `main` still has. Confirm a
recovery by dispatching from `main`.

Delivery depends on GitHub scheduling and notifications. A dropped schedule
opens no issue, so the absence of an issue is not proof of a green night;
check the workflow's run history.

**Triage.** Open the linked run and find the failing job. Cross-browser
failures upload `nightly-playwright-report-<project>-<index>` with
`playwright-report/` and `test-results/`; mutation uploads `stryker-report`.
Fix the cause on a reviewed branch. The issue closes itself at the next healthy
observation from `main`, scheduled or dispatched.

## Local CI nightly profile

`ops/local-ci/profiles/nightly.json` is a different artefact. It is the
advisory local-CI profile the Mac agent runs in the Lima VM: every `main`
profile lane plus mutation testing, the k6 public-route load check, a database
concurrency stress lane (`db-stress`) and the full ZAP scan, which is x64-only
and skipped on the ARM64 plane. Its results reach GitHub as the
`Nabaperks Local CI (nightly)` check, and its freshness is monitored by
`.github/workflows/nightly-proof.yml`; see [local CI](local-ci.md).

The hosted workflow has no `db-stress` job. Failures such as
`Cannot find package 'postgres'` in that lane belong to the local profile, not
to `nightly.yml`. The local profile's notes transcribe some commands from
`nightly.yml`, so review that transcription when a hosted job's command
changes; the two do not otherwise share configuration or incident issues.
