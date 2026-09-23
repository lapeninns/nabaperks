# 06 — Hosted Actions usage and run statistics (30-day evidence window)

- Repository: `lapeninns/nabaperks` (public), default branch `main`.
- Window: runs **created** 2026-08-22T00:00:00Z .. 2026-09-21T23:59:59Z (API filter `created=2026-08-22..2026-09-22`, inclusive end).
- Fetched: 2026-09-21 ~19:10–19:50 UTC via `gh api` (gh 2.88.1, jq 1.7.1, node 22.23.1). All reads; no reruns, no dispatches, no mutations.
- Raw evidence: `research/delivery-audit/data/` (see Method for file map).

## Headline numbers

| Metric                                             | Value                                                                                     |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Total workflow runs in window                      | **3,182** (all `status=completed`; 0 still running)                                       |
| Total run wall-clock (`updated_at − created_at`)   | **35,527 min ≈ 592 h ≈ 24.7 days**                                                        |
| Estimated job-minutes, raw sum                     | **≈ 64,272 min ≈ 1,071 h** (ESTIMATED)                                                    |
| Estimated job-minutes, billed-round (ceil per job) | **≈ 71,641 min ≈ 1,194 h** (ESTIMATED)                                                    |
| Success / failure / cancelled / skipped            | 2,213 (69.5%) / 541 (17.0%) / 335 (10.5%) / 93 (2.9%)                                     |
| Rerun runs (`run_attempt > 1`)                     | 49 (1.5%); attempts 1=3,133 · 2=42 · 3=6 · 4=1                                            |
| Runners used                                       | `ubuntu-latest` only (all 107 sampled runs) → public-repo standard runners, **free tier** |

TOTALS ARE FULLY COVERED (see Method): the sum of per-workflow counts equals the repo-wide `total_count` (3,182). Every number in this file is computed from the complete run census, not the 1,000-run capped sample.

## 1. Per-workflow table

Duration columns use run wall-clock = `updated_at − created_at` (median / p95 in minutes, 1 dp). Estimated job minutes are **ESTIMATED** via the per-workflow job:wall ratio from a documented sample (Section 4); `hosted-staging.yml` has no eligible sample (single 0-minute run, ratio assumed 1.0 — see caveat).

| Workflow path                                      | Runs | By trigger                                                                     | Success % | Cancelled | Reruns | Median min | P95 min | Wall min | Est raw job min | Est billed min |
| -------------------------------------------------- | ---- | ------------------------------------------------------------------------------ | --------- | --------- | ------ | ---------- | ------- | -------- | --------------- | -------------- |
| `.github/workflows/factory-status.yml`             | 837  | schedule 86 · workflow_run 534 · workflow_dispatch 1 · pull_request_target 216 | 71.9      | 181       | 1      | 0.7        | 1.6     | 866.0    | 24.9            | 39             |
| `.github/workflows/production-smoke.yml`           | 464  | schedule 343 · workflow_run 112 · workflow_dispatch 9                          | 28.9      | 1         | 0      | 0.5        | 1.2     | 260.4    | 40.2            | 146            |
| `.github/workflows/codeql.yml`                     | 412  | push 90 · pull_request 317 · schedule 5                                        | 98.5      | 5         | 3      | 2.0        | 5.7     | 1,336.8  | 64.6            | 79             |
| `.github/workflows/ci.yml`                         | 407  | push 90 · pull_request 317                                                     | 59.7      | 92        | 38     | 10.8       | 75.2    | 8,961.0  | 35,996.2        | 41,160         |
| `.github/workflows/dependency-review.yml`          | 317  | pull_request 317                                                               | 99.4      | 0         | 2      | 0.2        | 4.7     | 460.0    | 2.7             | 17             |
| `.github/workflows/local-ci-shadow.yml`            | 249  | push 50 · pull_request 199                                                     | 100.0     | 0         | 1      | 0.2        | 1.8     | 347.8    | 2.4             | 13             |
| `.github/workflows/agent-watchdog.yml`             | 125  | schedule 113 · workflow_dispatch 12                                            | 83.2      | 0         | 0      | 0.4        | 1.1     | 59.6     | 17.5            | 183            |
| `.github/workflows/production-database.yml`        | 105  | workflow_run 99 · workflow_dispatch 6                                          | 20.0      | 41        | 4      | 20.4       | 237.7   | 20,313.0 | 15,212.4        | 15,243         |
| `.github/workflows/release-notes.yml`              | 90   | push 90                                                                        | 100.0     | 0         | 0      | 0.1        | 2.2     | 36.5     | 1.5             | 17             |
| `.github/workflows/production-deploy.yml`          | 48   | workflow_run 46 · workflow_dispatch 2                                          | 12.5      | 1         | 0      | 0.1        | 11.5    | 97.2     | 90.0            | 102            |
| `dynamic/dependabot/dependabot-updates` (built-in) | 41   | dynamic 41                                                                     | 58.5      | 0         | 0      | 3.7        | 5.4     | 137.2    | 131.4           | 140            |
| `.github/workflows/nightly.yml`                    | 36   | schedule 31 · workflow_dispatch 5                                              | 5.6       | 14        | 0      | 87.5       | 99.7    | 2,616.6  | 12,676.7        | 14,475         |
| `.github/workflows/slo-report.yml`                 | 31   | schedule 31                                                                    | 0.0       | 0         | 0      | 0.5        | 0.7     | 23.9     | 4.7             | 9              |
| `.github/workflows/nightly-proof.yml`              | 16   | schedule 16                                                                    | 100.0     | 0         | 0      | 0.3        | 0.6     | 4.8      | 3.6             | 13             |
| `.github/workflows/admin-mfa-bootstrap.yml`        | 3    | workflow_dispatch 3                                                            | 33.3      | 0         | 0      | 1.8        | 2.3     | 5.7      | 3.2             | 5              |
| `.github/workflows/hosted-staging.yml`             | 1    | push 1                                                                         | 0.0       | 0         | 0      | 0.0        | 0.0     | 0.0      | 0.0             | 0              |
| `.github/workflows/admin-mfa-activation.yml`       | 0    | —                                                                              | —         | 0         | 0      | —          | —       | 0.0      | 0.0             | 0              |
| `.github/workflows/local-ci-trusted-observer.yml`  | 0    | —                                                                              | —         | 0         | 0      | —          | —       | 0.0      | 0.0             | 0              |
| `.github/workflows/recovery-drill.yml`             | 0    | —                                                                              | —         | 0         | 0      | —          | —       | 0.0      | 0.0             | 0              |

### By-trigger totals (all workflows)

| Trigger              | Runs      | Wall min     | Est raw job min | Est billed min |
| -------------------- | --------- | ------------ | --------------- | -------------- |
| pull_request         | 1,150     | 8,849.2      | 28,026.5        | 32,075         |
| workflow_run         | 791       | 20,722.6     | 15,210.7        | 15,272         |
| schedule             | 625       | 2,755.0      | 11,672.5        | 13,562         |
| push                 | 321       | 2,281.4      | 8,040.2         | 9,211          |
| pull_request_target  | 216       | 393.5        | 11.3            | 18             |
| workflow_dispatch    | 38        | 387.9        | 1,179.2         | 1,363          |
| dynamic (dependabot) | 41        | 137.2        | 131.4           | 140            |
| **Total**            | **3,182** | **35,526.8** | **64,271.8**    | **71,641**     |

Biggest consumers by estimated job-minutes: **ci.yml** (≈36.0k raw, 41.2k billed — 56% of window) → **production-database.yml** (15.2k raw) → **nightly.yml** (12.7k raw). By wall-clock, production-database (20,313 min) dominates because a handful of "Database promotion" jobs occupy a runner continuously for days before being cancelled (see Section 4); ci.yml follows (8,961 min); nightly is third (2,616.6 min).

## 2. Weekly series (ISO weeks, Mon–Sun; window edges truncated to 08-22 and 09-21)

| Week                             | Runs  | Wall min | Est raw job min | Est billed min | Families by est billed job-min                                                                |
| -------------------------------- | ----- | -------- | --------------- | -------------- | --------------------------------------------------------------------------------------------- |
| 2026-W34 (08-22..08-28, partial) | 96    | 225.9    | 864.9           | 1,006          | nightly 979 · production-smoke 27                                                             |
| 2026-W35 (08-29..09-04)          | 143   | 718.4    | 2,951.5         | 3,399          | nightly 3,216 · production-smoke 42 · ci-pr 87 · ci-push 28 · production-deploy 11 · other 12 |
| 2026-W36 (09-05..09-11)          | 643   | 9,231.7  | 27,764.4        | 31,576         | ci-pr 19,438 · ci-push 5,389 · nightly 4,754 · prod-db 1,708 · prod-deploy 81                 |
| 2026-W37 (09-12..09-18)          | 1,699 | 17,648.7 | 23,054.6        | 25,080         | prod-db 9,865 · ci-pr 9,290 · nightly 3,013 · ci-push 2,699 · factory-status 19               |
| 2026-W38 (09-14..09-20)          | 438   | 5,815.1  | 7,476.0         | 8,123          | nightly 2,013 · ci-pr 1,673 · ci-push 937 · prod-db 3,407 · factory-status 7                  |
| 2026-W39 (09-21, 1 day)          | 163   | 1,886.9  | 2,160.4         | 2,457          | ci-pr 1,494 · nightly 500 · ci-push 126 · prod-db 263 · factory-status 14                     |

Full per-family breakdown (runs, wall, raw, billed for ci-push / ci-pr / codeql / production-smoke / local-ci-shadow / nightly / production-database / production-deploy / dependency-review / agent-watchdog / slo-report / release-notes / factory-status / other) is in `data/stats-jobs.json` under `.weekly`.

**Trend:** usage was quiet in W34–W35 (≈1.0–3.4k billed job-min), exploded in W36 (31.6k) and W37 (25.1k) — the two weeks that drove 79% of the window's job-minutes — then receded (W38 8.1k, W39 2.5k). The W36 peak is CI volume (105 CI PR runs + 30 CI push runs that week alone); the W37 peak is dominated by production-database runner occupancy (13,145.7 wall min across 55 runs, almost all of it a few long approval-gate holds) plus heavy CI.

## 3. Duplicate-run analysis — ci.yml

Concurrency config (`.github/workflows/ci.yml`): `concurrency.group = ci-{{workflow}}-{{ event == 'push' ? github.sha : github.ref }}`, `cancel-in-progress` only for `pull_request`. So push runs key on SHA (no cross-push cancellation) and PR runs key on ref with cancel-in-progress.

| Measure                                                                                                        | Value                                                         |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| ci runs in window (push + pull_request)                                                                        | 407                                                           |
| Distinct `head_sha` values                                                                                     | 404                                                           |
| Runs per head_sha distribution                                                                                 | **1 run: 401 shas · 2 runs: 3 shas** (no sha ran CI 3+ times) |
| Cancelled ci runs                                                                                              | **92** (79 pull_request, 13 push)                             |
| Cancelled runs that overlap a later ci run on the same branch+event (consistent with concurrency supersession) | **56 of 92**                                                  |
| ci reruns (`run_attempt > 1`)                                                                                  | 38; attempts: 1=369 · 2=33 · 3=4 · 4=1                        |

Interpretation: almost every PR head SHA executed CI exactly once (401/404). The 92 cancellations are not same-SHA duplicates — 79 are PR runs superseded within the same branch by a newer push (the ref-keyed `cancel-in-progress` group), of which 56 show a direct overlap with a later same-branch PR run. The 13 cancelled **push** runs (all on `main`, 2026-09-05..09-08, cancelled 11–47 min after start) are not explainable by the SHA-keyed push group — see UNVERIFIED (U2). Cross-checking the 3 shas with 2 runs: the second execution is a rerun after a failure/cancel, not a concurrency duplicate. **Duplicate-run waste is negligible in this window** — there is no head-SHA duplication pattern; cancellation volume is normal branch-supersession behaviour and is largely structurally prevented.

## 4. Job-minute estimation (sampling method + extrapolation)

**Census is complete for run counts and wall-clock; only job-minutes are sampled.**

1. **Sample frame.** Per workflow, eligible runs = `status=completed`, conclusion ≠ `skipped`, wall > 0. Top-8 workflows by run count (factory-status, production-smoke, codeql, ci, dependency-review, local-ci-shadow, agent-watchdog, production-database): sampled **10 runs each** = the 3 longest wall-time runs + 7 deterministic pseudo-random from the remainder (mulberry32 PRNG, seed 20260921). The 8 remaining workflows with runs (nightly, dependabot, production-deploy, release-notes, slo-report, nightly-proof, admin-mfa-bootstrap; hosted-staging had 0 eligible): **4 runs each** (2 longest + up to 2 random).
2. **Sampled runs:** 107 total. Exact run IDs per workflow are recorded in `data/jobs-sample-selection.json`, `data/jobs-sample-selection-extra.json`, and `data/stats-jobs.json` (`.sampled_per_run`), with raw job payloads in `data/jobs-raw/<run_id>.json`.
3. **Job durations.** All jobs for each sampled run fetched via `GET /actions/runs/{id}/jobs?per_page=100` (paginated). Per-job duration = `completed_at − started_at` (min). `raw` = exact sum; `billed` = each started-and-completed job rounded **up** to the nearest whole minute (GitHub billing rounds per job). Never-started (queued/skipped) jobs = 0 min.
4. **Ratio and extrapolation.** Per workflow: `ratio = Σ sampled job-min ÷ Σ sampled wall-min`. Window estimate = `ratio × workflow total wall-min`. Extrapolated numbers are explicitly labelled **ESTIMATED**; the two estimate columns in Section 1 are derived this way (raw ratio and billed-round ratio). `hosted-staging.yml` got no sample (its only run has 0 wall minutes; ratio assumed 1.0 — irrelevant to totals).

Measured ratios (raw / billed): factory-status 0.029/0.045 · production-smoke 0.154/0.559 · codeql 0.048/0.059 · **ci 4.017/4.593** · dependency-review 0.006/0.037 · local-ci-shadow 0.007/0.039 · agent-watchdog 0.293/3.061 · production-database 0.749/0.750 · **nightly 4.845/5.532** · dependabot 0.957/1.022 · production-deploy 0.926/1.051 · release-notes 0.041/0.477 · slo-report 0.196/0.382 · nightly-proof 0.753/2.667 · admin-mfa-bootstrap 0.565/0.875.

**Why ratios exceed 1** (ci, nightly): those workflows fan out to 48–169 parallel jobs per run, so aggregate job-minutes far exceed per-run wall-clock. Per-run variance is large (queue-and-timeout-heavy runs give ~0.1×, heavily parallel runs give up to ~21×), so treat the workflow estimates as approximately ±30% band around the central value rather than precise numbers (see Caveats).

**Notable finding:** `production-database.yml`'s "Database promotion" job ran continuously on a runner for up to **9,959 min (~6.9 days)** in one sampled run (conclusion `cancelled`), and "Authenticate the deployed baseline" for 226 min in another; similar multi-day holds appear in runs 35245440488 (4,234 min wall), 34170494641 (1,134 min wall) and 34029908979 (529 min wall). These approval-gate holds are the dominant cause of the workflow's 20,313 wall minutes and ≈15,212 est job-minutes — a capacity/robustness concern beyond billing.

## 5. Billing state

- Repo permissions: `GET /repos/lapeninns/nabaperks/actions/permissions` → `{"enabled":true,"allowed_actions":"all","sha_pinning_required":false}`.
- Runner labels: every workflow definition inspected — all 17 files on the local branch head, `ci.yml` on `origin/main`, the whole `origin/main` workflow tree, and `hosted-staging.yml` (fetched from the branch it ran on, since it is not present on `main`) — declares `runs-on: ubuntu-latest`. Execution-truth check: the job label sets across **all 107 sampled runs** (spread 08-22..09-21) contain **only `ubuntu-latest`**. **No windows/macOS/larger/self-hosted runner classes in use** → no paid-runner charges.
- **Billing verdict:** repository is public; standard GitHub-hosted Linux runners on public repos are **free**, therefore the window's ≈71,641 billed-round job-minutes incur **$0.00** from GitHub. The minute figures remain useful for capacity planning and for comparison against private-repo billing, but directional usage data could not be confirmed from the billing API (U1).

## 6. Method (full)

Data acquisition:

1. `GET /repos/lapeninns/nabaperks/actions/workflows` — 19 active workflows (16 under `.github/workflows/`, 1 `dynamic/dependabot/dependabot-updates`, 2 others as listed in Section 1).
2. Repo-wide `GET /actions/runs` with `per_page=100&created=2026-08-22..2026-09-22`, `--paginate --slurp` → **GitHub caps one query at 1,000 records; the first pass captured only the 1,000 newest runs** (`data/runs-30d-e1.json`, kept as evidence). The repo-level `total_count` (3,182) is authoritative.
3. To complete the census: per-workflow `GET /actions/workflows/{id}/runs?per_page=100&created=…&` paginated for all 19 workflows (`data/runs-wf-<id>.json`). The 19 per-workflow `total_count`s sum to exactly 3,182 and the merged set has 3,182 distinct run ids, all inside the window → **full coverage**. Merged census: `data/runs-all-merged.json`.
4. Computations: custom node scripts (sources retained in report) reading the merged census; results in `data/stats-base.json` (per-workflow run/conclusion/event/duration/rerun stats, weekly runs+wall, ci duplication) and `data/stats-jobs.json` (job-minute ratios, workflow/trigger/weekly estimates, ci cancellation overlap).
5. Definitions used: run duration = `updated_at − created_at`; queue time = `run_started_at − created_at` (median 0 s everywhere — runs start immediately; queuing manifests inside job intervals); median/p95 via sorted percentile index; success rate = successes ÷ runs.

## 7. Caveats and explicit UNVERIFIED items

Caveats:

- 93 `skipped` runs (all `production-smoke`, workflow_run-triggered) are counted in run totals but consumed ~0 minutes; they are excluded from the job-minute sample frame.
- Runs created before 2026-08-22T00:00:00Z are excluded by the API query; none outside the range leaked in (validated).
- A few sampled runs completed moments before fetch and showed 1–3 jobs still "running" (no `completed_at`) — their elapsed minutes are slightly under-counted (max impact ≪ 1% of estimates).
- Ratios carry large per-run variance (queue waits vs parallel fan-out); estimates should be read as a central value with an approximate ±30% band, not precise bills.
- Cancellation _cause_ is not exposed by the API; the 56-run overlap count is a heuristic consistent with concurrency supersession, not proof.

UNVERIFIED:

- **U1 — Billing usage totals:** `GET /orgs/lapeninns/settings/billing/actions` → HTTP 404 (not an org; `lapeninns` is a user account); `GET /users/lapeninns/settings/billing/actions` → HTTP 404 and the gh token lacks the required `user` OAuth scope (`gh auth refresh -h github.com -s user` would be needed, not performed — auth mutation out of scope); `GET /users/lapeninns/settings/billing/shared` → HTTP 404. Billing-quota/usage numbers therefore **could not be verified via API**; the $0 verdict rests on the public-repo free-tier rule plus the verified `ubuntu-latest`-only runner labels, not on usage data.
- **U2 — Cause of the 13 cancelled ci push runs** (all on `main`): not explained by the SHA-keyed push concurrency group; plausibly manual/merge-train cancellation, but not verifiable from metadata.
- **U3 — Cause of the 36 of 92 cancelled ci runs with no overlapping later same-branch run** (manual cancel, PR close/branch deletion cancels, or pre-start cancels — not distinguishable from API fields).
- **U4 — `hosted-staging.yml` content:** absent from `main` (local checkout and `origin/main`); verified `ubuntu-latest` only from the feature branch it ran on. Its single window run had 0 wall minutes, so this has no numerical impact.
- **U5 — Historical runner labels:** only current local head, `origin/main`, and the job labels of the 107 sampled runs were verified; workflow versions in between could not be inspected. No evidence of paid runners anywhere.

## 8. Data files (all under `research/delivery-audit/data/`)

`runs-30d-e1.json` (1,000-run capped repo-wide fetch, evidence) · `runs-wf-<workflow_id>.json` ×19 (per-workflow full pages) · `runs-all-merged.json` (complete 3,182-run census) · `stats-base.json` (Section 1/2/3 base stats) · `stats-jobs.json` (ratios, estimates, weekly, ci overlap) · `jobs-sample-selection.json` + `jobs-sample-selection-extra.json` (sampled run IDs) · `jobs-raw/<run_id>.json` ×107 (raw job payloads) · `workflows-all.json` (workflow list) · `sample-ids.txt`, `sample-ids-extra.txt`.
