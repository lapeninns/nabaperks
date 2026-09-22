# Nightly QA hardening

Owner: Lapen Inns product operations.

This page owns `.github/workflows/nightly.yml`, the hosted `Nightly QA
hardening` workflow. It describes the workflow after the September 2026
notification and scope-down change: weekly mutation testing, 16 cross-browser
shards per project, no authenticated race job, and a standing incident issue
on failure. If this page and the workflow disagree, the workflow is
authoritative and this page needs correcting.

## Purpose

The workflow runs hardening checks that are too slow or too costly for every
pull request: the complete cross-browser Playwright suite, mutation testing, a
k6 load check of the public routes and a full ZAP scan. Every job runs against
the checked-out revision with the workflow's literal fixture environment; the
load and ZAP jobs build and serve it on the runner. No job reads a repository
secret or reaches production.

## Schedule and triggers

- **Schedule:** `cron: "24 2 * * *"`, which is 02:24 UTC every day (03:24 in
  Britain during summer time). GitHub can delay or drop scheduled runs under
  load, so the declared cadence is not a delivery guarantee.
- **Manual:** `workflow_dispatch` from the Actions tab or
  `gh workflow run nightly.yml --ref <branch>`.
- **Concurrency:** group `nightly-qa-${{ github.ref }}` with
  `cancel-in-progress: true`. A newer run on the same ref supersedes an older
  one; a cancelled run is normal supersession, not a test failure.

## Jobs

| Job                  | Cadence                   | What it checks                                                                                                                                                                                 | Timeout |
| -------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `cross-browser`      | Every run                 | `pnpm test:e2e` with `--grep-invert @visual` for `chromium`, `mobile-safari`, `desktop-firefox` and `desktop-safari`, each split into 16 shards (64 jobs). Failed shards upload their reports. | 45 min  |
| `cross-browser-gate` | Every run                 | `Full cross-browser Playwright`: passes only when every shard of every project succeeded.                                                                                                      | 1 min   |
| `mutation`           | Weekly, Monday's schedule | `pnpm mutation:check` (Stryker, `stryker.conf.json`). Chromium is installed because four unit tests render PDFs through a real browser. The `stryker-report` artefact is kept for seven days.  | 90 min  |
| `load`               | Every run                 | `k6 run tests/load/public-routes.js` against `pnpm start` on `127.0.0.1:3000` after a production build.                                                                                        | 20 min  |
| `zap-full`           | Every run                 | ZAP full scan of the local production build with `.zap/rules.tsv`. `allow_issue_writing: false`, so the scan action itself never opens issues.                                                 | 30 min  |
| `notify`             | Every run                 | `Reconcile nightly incident`: runs after the four observation results above, including when they fail, and opens or closes the standing issue. It is the only job with `issues: write`.        | 2 min   |

Every other job keeps `contents: read`.

**Sharding.** The cross-browser suite is sharded for memory, not speed. Run
unsharded, the webpack dev server accumulates heap until it fails with a
JavaScript heap out-of-memory error and every later navigation is refused (run
30196429475). Each shard gets its own runner and a fresh dev server. Moving
from 32 to 16 shards halves the job count but doubles the tests, and therefore
the heap pressure, carried by each shard. If out-of-memory failures return,
restore more shards rather than dropping a browser project.

**Removed scope.** The authenticated stamp and redeem race job (`load-race`)
was removed. It was gated on repository variables that were never set, so it
never executed, and it was the workflow's only reference to a repository
secret. Mutation testing moved from nightly to weekly. Together with the shard
reduction, this was estimated to remove about 61% of the workflow's billed job
minutes.

## Advisory status

Nightly gates nothing. It is not a required check, `Release gate` does not
depend on it, and no merge, database promotion or deployment waits for it. A
red nightly is a signal to triage, not a release blocker. Pull request and
exact-main CI remain the merge authority; see
[change-aware CI](change-aware-ci.md).

## Failure policy

The `notify` job reuses the watchdog incident pattern in
`scripts/watchdog-incidents.mjs`, which also serves
[the local CI watchdog](local-ci-watchdog.md).

- A run is healthy only when the cross-browser gate, load and ZAP jobs pass
  and mutation passes whenever it runs. A mutation job skipped by the weekly
  schedule does not make a run unhealthy.
- The first unhealthy run opens exactly one issue titled
  `[Watchdog] Nightly QA hardening failed`, authored by `github-actions[bot]`,
  assigned to `lapeninns`, with the body marker
  `<!-- nabaperks-watchdog:nightly:v1 -->` and a link to the first failing
  run.
- Later unhealthy runs leave that issue open without a new issue or comment.
- The first healthy run closes the issue as completed and appends
  `Recovery observed: <run URL>` to its body.
- Nightly reports only its own incident kind. It passes no observation for the
  local-CI heartbeat or public-health monitors, so it never opens or closes
  their incidents.
- Closing the issue by hand does not silence it: the next unhealthy run opens a
  new one.

Delivery depends on GitHub scheduling and notifications. A dropped schedule
opens no issue, so the absence of an issue is not proof of a green night;
check the workflow's run history.

**Triage.** Open the linked run and find the failing job. Cross-browser
failures upload `nightly-playwright-report-<project>-<index>` with
`playwright-report/` and `test-results/`; mutation uploads `stryker-report`.
Fix the cause on a reviewed branch. The issue closes itself at the next
healthy run, scheduled or dispatched.

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
