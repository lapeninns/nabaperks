# 07 — CI reliability deep-dive

Evidence window: 2026-08-22T01:44:22Z .. 2026-09-21T17:37:43Z (API filter `created=2026-08-22..2026-09-22`).
Repository: `lapeninns/nabaperks` (read-only; `gh api` only). All times UTC. Local checkout reference:
`/Users/amankumarshrestha/LapenInns Project/platform/naba-perks` (branch `codex/console-l8-sweep`, 32 commits ahead of `origin/main`).

## Method and dataset

- `repos/lapeninns/nabaperks/actions/runs?per_page=100&created=2026-08-22..2026-09-22` — the single query
  returns `total_count: 3182` but GitHub caps one paginated query at 1000 items, so the window was
  fetched in 3-day slices plus daily re-slices of the 2026-09-09..09-12 burst. Final dataset:
  **3182 unique runs = exactly the API `total_count`** — the window is complete.
  Saved as `research/delivery-audit/data/runs-reliability-e2.json`.
- Job-level detail: `actions/runs/<id>/jobs` and `actions/runs/<id>/attempts/<n>/jobs` for (a) every failed
  `ci.yml` and `nightly.yml` run, (b) **every attempt** of all 49 rerun runs (`run_attempt > 1`), and
  (c) samples of failed runs in other workflows (production-smoke 8, production-deploy 4,
  production-database 4, agent-watchdog 2, slo-report 3, factory-status 3, dependabot 2, others 1 each).
  **226 job-page API calls — ~13% over the ~200-call cap**, accepted to cover all failed CI runs plus every
  rerun attempt; 227 job files under `research/delivery-audit/data/jobs/` (15,455 job records).
- Annotations: `check-runs/<id>/annotations` for 13 representative failed jobs
  (`research/delivery-audit/data/annotations-sample.json`).

Overall run conclusions in the window: **2213 success (69.5%), 541 failure (17.0%), 335 cancelled
(10.5%), 93 skipped (2.9%), 0 `startup_failure`** (all runs are `completed`; no run-level startup failures).

## 1. Run outcomes by workflow

| workflow                                                                         | runs | success | failure            | cancelled | notes                                               |
| -------------------------------------------------------------------------------- | ---- | ------- | ------------------ | --------- | --------------------------------------------------- |
| `ci.yml` (CI)                                                                    | 407  | 243     | **72**             | **92**    | 79 PR supersession + 13 push cancellations (see §8) |
| `nightly.yml` (Nightly QA hardening)                                             | 36   | **2**   | **20**             | 14        | 5.6% success rate — worst workflow                  |
| `production-smoke.yml`                                                           | 464  | 134     | **236**            | 1         | 178 of the failures are one resolver bug (§8)       |
| `factory-status.yml` (Delivery decision report)                                  | 471  | 289+    | 54                 | 181       | cancellations are its own concurrency supersession  |
| `production-database.yml`                                                        | 92   | 8       | 43                 | 41        | promotion pipeline, 09-03..09-08 crisis window      |
| `production-deploy.yml`                                                          | 88   | 41 fail |                    |           | 09-04..09-07 cluster                                |
| `slo-report.yml`                                                                 | 31   | 0       | **31**             | 0         | **100% failure — red every single day**             |
| `agent-watchdog.yml`                                                             | 125  | 104     | 21                 | 0         | failures = 09-17..09-21 production outage           |
| `codeql.yml` / `dependency-review.yml` / dependabot / admin-mfa / hosted-staging | —    | —       | 1 / 2 / 17 / 2 / 1 | 5 / 0     | minor                                               |

## 2. Failure taxonomy — what actually breaks

Four distinct classes dominate; only one is genuine test flakiness.

### 2.1 GitHub Actions billing/spending-limit shutdowns (never-started jobs)

Annotation on failed jobs with zero executed steps and no runner assigned:

> "The job was not started because recent account payments have failed or your spending limit needs to
> be increased. Please check the 'Billing & plans' section in your settings"

**419 failed-job records across 17 runs, all 2026-09-09 .. 2026-09-21.** The three nightly runs
35319523791 (09-18), 35429208079 (09-19), 35497809583 (09-20) each failed **all 132 matrix jobs**
(cross-browser 4×32 + mutation + k6 + ZAP-full) with zero steps — 396 of the 419. The rest are
scattered zero-step failures in `ci.yml` (35472283167, 35505771259 a1/a2, 35590421536), `codeql.yml`
(3 runs), `dependency-review.yml` (2), `factory-status.yml` (2), `local-ci-shadow.yml` (1),
`agent-watchdog.yml` (2). Confirmed by annotation on 2 runs; the other 15 share the identical
zero-step/no-runner signature. These show up as red runs but are account/payment failures, not test
or code failures — and they silently void CI evidence for the affected commits.

### 2.2 Artifact-service 403s

`Fast lane` run 34252798166 (09-08) died at `upload-artifact` with
"Failed to FinalizeArtifact: Received non-retryable error: Failed request: (403) Forbidden";
8 E2E and 16 Accessibility `upload-artifact` step failures across the window carry the same
"no files found / upload failed" signature. Infrastructure class, not test failures.

### 2.3 Browser-image verification mass failures

`Verify prepared browser environment` (`scripts/ci/check-browser-image.mjs`, ci.yml:452 and ci.yml:522)
failed **en masse on exactly two runs**, killing the entire browser tier before any test ran:

- run 34809164971 (2026-09-14, head 8b15ad7cda): all 16 `E2E (project, pack n)` + all 8 `Accessibility` jobs
- run 35563994282 (2026-09-21, head 9f15ac922e): all 16 E2E + all 8 Accessibility jobs

32 zero-test browser-job failures. Both predate/exist around Playwright/container pin churn; the
annotation only says "Process completed with exit code 1" (root cause UNVERIFIED — likely image
digest/version mismatch; logs not fetched).

### 2.4 Real test/assertion failures

- `Visual regression` matrix: 56 job-failures (all attempts); the dominant step is
  `Run the unchanged visual selection` (34 failures) — genuine pixel diffs, clustered in the
  09-11..09-21 console-rebuild era (`Release gate` runs red until baselines were regenerated).
- `nightly.yml` cross-browser: genuine suite failures nearly every night 08-22..09-03
  (see §7), including the documented webpack-dev-server heap OOM pattern the workflow comments
  already describe (`.github/workflows/nightly.yml:30-38`).
- `Fast lane`: 8 × `pnpm security:audit --ignore-registry-errors` step failures (08-22..09-02 era)
  and 5 × `Run shared fast validation commands`.

### 2.5 Production-adjacent workflow failures (not CI flakiness, but dominate the red board)

- **production-smoke resolver storm**: 178 failures 08-22..08-26 (45+46+32+34+21 per day). Sampled
  10 runs: in every one the `Liveness and readiness` probes **succeeded** and only the
  `Resolve recovered production alert` job failed at the `Resolve the external incident` step
  (`notify-production-alert.mjs resolve`, exit 1 — annotation confirms, root cause UNVERIFIED).
  Production was healthy; the incident-resolution job was broken.
- **Real production outage 09-17..09-20**: sampled smoke runs 35290011896, 35308585780,
  35328533201 (09-18) show `Liveness and readiness` probes **failing** and the incident job firing;
  `agent-watchdog` corroborates (18 failures on 09-17..09-19). This is a genuine availability event.
- **slo-report: 31/31 runs failed.** The `30-day availability and error budget` job fails every day
  at both `Page the SLO breach` (webhook step, exit 1 — the pager itself is broken) and
  `Enforce the SLO gate` (the rolling availability objective is breached — a direct consequence of
  the §2.5 storm + outage). A permanently red SLO gate means the gate has no discriminating power.

## 3. CI (`ci.yml`) failure anatomy

Job matrix learned from `.github/workflows/ci.yml` + `scripts/ci/run-browser-pack.mjs`:
`E2E (project, pack n)` with projects `chromium | mobile-safari | desktop-firefox | desktop-safari`
and packs 1-4 (ci.yml:437-460; packs = consecutive blocks of 8 of the 32 shards,
`run-browser-pack.mjs:11-13`), `Accessibility (project, shard n/4)` and
`Visual regression (project, shard n/4)` for `chromium | mobile-safari` (ci.yml:502-513, 562-570),
`Lighthouse (route)` ×4, `ZAP baseline`, `DB behavioral moat`, plus gate jobs. The window also
contains older matrix shapes (`shard n/32` e2e jobs, packs 5-8, a11y/visual `n/2`) — the matrix was
consolidated mid-window (the pack runner landed ~09-10, `94c667cb`).

Failed jobs inside the **final attempt of the 72 failed CI runs** (gate jobs fail when their `needs`
fail; they are listed for completeness):

| failed job (final attempts of the 72 failed runs)                         | failures      | runs                    |
| ------------------------------------------------------------------------- | ------------- | ----------------------- |
| Release gate                                                              | 49            | 49                      |
| E2E (DB-free harness tier) [gate]                                         | 31            | 31                      |
| Visual regression [gate]                                                  | 27            | 27                      |
| Verify targeted and full outcomes (selection-comparison)                  | 17            | 17                      |
| Lighthouse CI [gate]                                                      | 16            | 16                      |
| Typecheck and build [gate]                                                | 14            | 14                      |
| Accessibility sweep [gate]                                                | 13            | 13                      |
| Fast lane (lint, typecheck, unit)                                         | 13            | 13                      |
| Lighthouse (home)                                                         | 11            | 11                      |
| DB behavioral moat gate                                                   | 11            | 11                      |
| Visual regression (mobile-safari, shard 4/4)                              | 9             | 9                       |
| Select required checks                                                    | 9             | 9                       |
| Visual regression (chromium, shard 4/4)                                   | 8             | 8                       |
| E2E (desktop-firefox, pack 2)                                             | 7             | 7                       |
| Visual regression (mobile-safari, shard 1/4)                              | 7             | 7                       |
| Visual regression (chromium/mobile-safari, shard 1-3/4)                   | 6/6/6/5/4     | 27 runs                 |
| E2E (chromium                                                             | mobile-safari | desktop-safari, pack 2) | 5 each | 15  |
| Lighthouse (loyalty-for-pubs)                                             | 4             | 4                       |
| Accessibility matrix jobs (8 shards)                                      | 3 each        | 24                      |
| ZAP baseline / Production build / Quality lane / Documentation validation | 3/1/1/1       | —                       |

Median duration of **failed** jobs (minutes — how fast CI dies): E2E 1.0 (max 16.9), Visual 1.5
(max 10.2), Lighthouse 3.9 (max 9.8), Accessibility 1.1, Fast lane 0.6, Release gate 0.5.
Failed CI **runs** (attempt-level wall clock): median 10.5 min, max 120.3 min (n=72).

## 4. Flakes vs real failures

49 runs were rerun (`run_attempt > 1`; 38 of them CI). Job-level flake = failed on attempt _k_,
passed on attempt _k+1_ of the same run (same head SHA). **36 of 38 rerun CI runs ended green** —
the rerun pass rate is high, and most reruns were started against unchanged code.

### Flaky-job table (failures → rerun-passes, same run)

| job                                                        | F→P       | run ids                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lighthouse CI (gate)                                       | 19→19     | 33825240266, 33831641706, 33841703002, 33865233639, 33870871871, 33958780510, 33961169259, 33965153720, 33988443406, 34223163467, 34251247535, 34252798166, 34450650602, 34467272323, 34632920425, 34705730776, 35510047215, 35512617303, 35542699435                                                                                                                                                                           |
| Release gate (composite)                                   | 18→18     | (follows its needs; same runs)                                                                                                                                                                                                                                                                                                                                                                                                  |
| E2E (DB-free harness tier) gate                            | 15→15     | 33716614799, 33788750770, 33831641706, 33848702998, 33973390907, 33990381234, 34136895870, 34243704597, …                                                                                                                                                                                                                                                                                                                       |
| Lighthouse (home)                                          | 10→10     | 33870871871, 33958780510, 33961169259, 34223163467, 34251247535, 34252798166, 34450650602, 34705730776, 35512617303, 35542699435                                                                                                                                                                                                                                                                                                |
| Lighthouse (loyalty-for-pubs)                              | 6→6       | 33965153720, 33988443406, 34252798166, 34467272323, 34632920425, 35510047215                                                                                                                                                                                                                                                                                                                                                    |
| Lighthouse (pricing / signup)                              | 1→1 each  | 34252798166                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Cost-neutral ephemeral release proof (production-database) | 4→4       | 34287352531, 34291429483, 34338744483, 34613822353                                                                                                                                                                                                                                                                                                                                                                              |
| E2E (desktop-firefox, pack 2)                              | 4→4       | 34694144206, 34700951749, 34703757440, 34705730776                                                                                                                                                                                                                                                                                                                                                                              |
| CodeQL Analyze (javascript-typescript)                     | 3→3       | 34325794101, 35505771228, 35590421480                                                                                                                                                                                                                                                                                                                                                                                           |
| Visual regression gate                                     | 3→3       | 33831641706, 33848702998, 34145535922                                                                                                                                                                                                                                                                                                                                                                                           |
| Typecheck and build gate                                   | 3→3       | 33831641706, 33848702998, 34252798166                                                                                                                                                                                                                                                                                                                                                                                           |
| DB behavioral moat gate / DB behavioral moat               | 3→3 / 1→1 | 33831641706, 33848702998, 35536775409 / 35536775409                                                                                                                                                                                                                                                                                                                                                                             |
| Accessibility sweep gate                                   | 2→2       | 33831641706, 33848702998                                                                                                                                                                                                                                                                                                                                                                                                        |
| Select required checks (billing-induced)                   | 2→2       | 35505771259, 35590421536                                                                                                                                                                                                                                                                                                                                                                                                        |
| Review dependency changes                                  | 2→2       | 35505771219, 35590421560                                                                                                                                                                                                                                                                                                                                                                                                        |
| Single e2e matrix flakes (1→1 each)                        | 14 total  | desktop-safari pack 7 (34243704597, 34252798166), chromium shard 32/32 (33716614799), mobile-safari pack 7 + desktop-safari pack 5 (34251247535), chromium packs 3/6/7 + desktop-safari pack 8 + Lighthouse pricing/signup + ZAP baseline + Fast lane (34252798166), chromium shard 7/32 (33990381234), desktop-safari shard 16/32 (33973390907), mobile-safari shard 20/32 (33788750770), desktop-firefox pack 3 (35619178220) |

**Top flaky jobs by name:** Lighthouse (home) + Lighthouse CI, the E2E gate (as a consequence of
single e2e matrix flakes), `E2E (desktop-firefox, pack 2)`, `Cost-neutral ephemeral release proof`,
CodeQL. Lighthouse is the single flakiest root: its routes failed then passed on rerun in **15
distinct runs** without any code change. `failOnFlakyTests: true` + `retries: 1` in CI
(`playwright.config.ts:76-77`) means Playwright-internal retries already absorb one in-run retry;
these are failures that survived both the retry and needed a **manual workflow rerun**.

### Consistently failing (real failures — every attempt red)

- run 35505771259 (PR head f87d90c2, 09-20): a1 2f → a2 2f (billing) → a3 2f → a4 9f — never green.
- runs 35616938984 (3f4b1182) and 35619178220 (29a65e45, 09-21): the console-sweep PR; a3 fails
  `Verify targeted and full outcomes` + `Release gate` even after e2e/visual matrix jobs pass — the
  targeted/full evidence comparison is the persistent blocker, not a flake.
- run 34703757440 (09-12): a1 4f → a2 2f; runs 33981819400, 33996277283 (09-05): a1 2f → a2 2f.
- production-database run 34287352531 (09-08): a1 1f → a2 1f (promotion-stage failure).

## 5. Timeouts

Workflow `timeout-minutes` inventory (ci.yml): selection 5 (:72), documentation 5 (:130),
targeted-browser 15 (:154), targeted-visual 15 (:181), selection-comparison 15 (:221), fast 10 (:307),
quality 10 (:351), build 10 (:404), e2e 30 (:455), a11y 20 (:513), visual 20 (:567), lighthouse 10
(:628), zap-baseline 10 (:676), db 12 (:707), gates 1, release-gate 5 (:762).
nightly.yml: cross-browser 45 (:39), mutation 90 (:123), load 20 (:147), zap-full 30 (:187).
production-smoke probes 7 (production-smoke.yml:31). slo-report 10. agent-watchdog 5/2/5.

**Timeouts are almost non-existent as a failure cause.** Exactly one job ran into its limit:
`Lighthouse (home)` at 9.8 min vs the 10-min ceiling (run 33849136878, 09-04). No e2e job approached
30 min (max observed 16.9 min), no a11y/visual job approached 20 (max 11.9/10.2). The e2e pack
consolidation's modelled ~376 s slowest pack (run-browser-pack.mjs:24-30) leaves the ~5x margin the
comment claims. Failures are **fast** (E2E median 1.0 min — setup/infra or early assertion), not
budget-bound.

## 6. Runner shutdowns / startup failures

- Run-level `startup_failure`: **0** in the entire window.
- "runner received shutdown signal" annotations: none found in the 13 sampled check-runs'
  annotations (the phrase search was not exhaustive — see UNVERIFIED).
- The dominant "job never really ran" class is the **billing/spending-limit shutdown** (§2.1):
  419 zero-step job failures, no runner ever assigned. Functionally equivalent to a runner shutdown
  from a reliability standpoint: CI evidence for those commits is void, and `Release gate` /
  required-check consumers see plain `failure` with no diagnostic step.

## 7. Browser stability verdict (chromium / firefox / webkit)

`ci.yml` e2e job failures by project **excluding the two mass image-verify runs** (which hit all 16
jobs uniformly and would mask the comparison):

| channel                    | e2e failures (ci.yml) | distinct runs |
| -------------------------- | --------------------- | ------------- |
| desktop-safari (WebKit)    | 22                    | 14            |
| desktop-firefox            | 19                    | 15            |
| mobile-safari (WebKit iOS) | 18                    | 9             |
| chromium                   | 18                    | 10            |

Nightly cross-browser (real failures, excluding the 3 billing runs): chromium 28, desktop-safari 27,
mobile-safari 26, desktop-firefox 26 — essentially uniform there. Visual regression: mobile-safari 30
vs chromium 26 job-failures; `E2E (desktop-firefox, pack 2)` is the single most chronically failing
matrix cell (9 step-level `run-browser-pack.mjs` failures; 4 of them flake-passed on rerun).

**Verdict:** on `ci.yml` the two WebKit channels combined (desktop-safari + mobile-safari = 40
failures) are the least stable pair, with **desktop-safari the least stable single channel**
(22 failures in 14 runs) — but the spread across all four channels is narrow (18-22), and on the
nightly suite all four are within 2 failures of each other. Firefox is not an outlier; the recurring
cell-level problem is `desktop-firefox pack 2` (shards 9-16). No channel is catastrophically worse;
treat desktop-safari as marginally least stable with run ids 35505771259, 34619034169, 34751364540,
34694144206 (pack-matrix era) and the nightly run set (§7 numbers above).

## 8. Systemic windows (chronological)

1. **08-22 .. 08-26 — smoke resolver storm**: 178 production-smoke failures, all sampled ones being
   `Resolve the external incident` step failures while probes stayed green. Ends abruptly 08-27.
2. **09-03 .. 09-08 — promotion/deploy crisis**: production-database 43 + production-deploy 41
   failures cluster here (09-05: 16 deploy failures; 09-07: 9 db + 8 deploy). Also the 13 **cancelled
   push CI runs** (09-05..09-08): main commits lost their only CI run to concurrency supersession —
   the exact hazard ci.yml:19-27 documents. The sha-keyed push concurrency fix landed 2026-09-10
   (`94c667cb`, PR #295); no cancelled push run occurs after it.
3. **09-05 .. 09-08 — CI rerun-heavy flake cluster**: 11+ CI failures on 09-05; nearly all rerun-green
   (Lighthouse + single e2e cells, §4).
4. **09-11 .. 09-14 — console-rebuild CI churn**: 15 CI failures on 09-11; run 34619034169 fails 36
   jobs (all 8 a11y + 8 visual + 4 e2e); 09-14 run 34809164971 kills 24 browser jobs at image
   verification; run 34809264441 fails 8 others. Visual baselines needed regeneration after the
   shell reshape (see §9).
5. **09-17 .. 09-20 — real production outage**: smoke probes failing + agent-watchdog 18 failures
   (09-17..09-19) — a genuine availability event, not CI.
6. **09-18 .. 09-21 — billing shutdowns**: nightly 132-job total failures three nights in a row plus
   zero-step failures across ci.yml/codeql/dependency-review (§2.1).
7. **09-20 .. 09-21 — console-sweep PR consistently red**: 35505771259 (4 attempts), 35616938984,
   35619178220 — evidence-comparison verifier + visual/e2e, never green (real failures).
8. **All 31 days — slo-report red**: 31/31 failures (§2.5): the SLO gate is permanently breached and
   its pager step is itself broken.

## 9. Visual baselines

### Mechanism

- Baselines live in Playwright's `-snapshots` convention, **not** `__screenshots__`:
  `tests/e2e/visual.spec.ts-snapshots/` (112 files), `tests/e2e/merchant-billing-recovery.visual{,.desktop}.spec.ts-snapshots/`,
  `tests/e2e/merchant-launch-follow-through{,.desktop}.spec.ts-snapshots/`,
  `tests/e2e/poster-visual.desktop.spec.ts-snapshots/` (32), `tests/e2e/tent-visual.desktop.spec.ts-snapshots/`.
  Each test has per-project files (`-chromium`, `-mobile-safari`, `-desktop-firefox`, `-desktop-safari`)
  plus **`-linux` variants** (`harness-qr-chromium-linux.png`, …).
- `playwright.config.ts:61-64`: `snapshotPathTemplate` + `ciLinuxSnapshotPathTemplate` — on CI on
  Linux the snapshot path gains a `-linux` suffix. **Hosted CI therefore compares only the `-linux`
  files**; the plain files are consumed by local (macOS) runs and are never checked by hosted CI.
- Visual projects: `mobile-safari` (iPhone 14, `testIgnore` of `*.desktop.spec.ts`) and `chromium`
  (`testMatch` incl. `visual.spec.ts`) — `playwright.config.ts:91-117`. Visual CI stays on the
  headless shell (`PLAYWRIGHT_REGULAR_CHROMIUM` is set for e2e/fast but deliberately **not** for
  visual, ci.yml:470-474 vs ci.yml:573-576; `chromiumChannel` only resolves when that env is set,
  `playwright.config.ts:69`), so baseline pixels keep one rendering engine.
- Visual CI is single-worker (`PLAYWRIGHT_WORKERS: "1"`, ci.yml:573-576) and, in selection-comparison
  mode, runs `--update-snapshots=none` (ci.yml:583-588) — hosted CI **cannot** silently rewrite baselines.
- The intended regeneration path (AGENTS.md:141-144): _"Canonical visual proof uses the hosted Linux
  environment; inspect actual/diff images before changing baselines, and do not replace them with
  local macOS captures."_ i.e. regenerate from hosted Linux, review actual/diff images, commit.

### Regeneration history in the window

On `origin/main` (all PR merges except one):

- 08ec0f43 (09-04, PR #237): `marketing-landing` baselines (-linux + plain).
- 1818adb3 (09-08, PR #277): guide-spine baseline.
- **0a6f4abf (09-07): "Refresh dashboard visual baselines for the Team code card" — a direct push to
  main** (committer `lapeninns <info@lapeninns.com>`, no GitHub web-flow committer, push-event CI run 34120164681) changing 6 `-linux` dashboard baselines. No PR review; the after-the-fact main CI run
  passed.
- 64134291 (09-12, PR #326): offers baselines — modified **both** `-linux` and plain files including
  `-desktop-firefox/-desktop-safari` variants.
- 612a56c4 (09-13, #332), c93a6ae5 (09-20, #340), 17c3094b (09-21, #354 console rebuild): the 16
  harness baselines refreshed as the console shell changed (17c3094b also touches merchant baselines).

On the local branch (`codex/console-l8-sweep`, 32 commits ahead; **not merged**):

- 064d5a95 (09-21, local author/committer, +0100 timezone): "expand the console shell for full-page
  harness captures; refresh shell-affected baselines".
- **1919a3df (09-21, local HEAD): "test(visual): regenerate the shell-reshaped harness baselines
  without expansion"** — regenerates the same 16 `tests/e2e/visual.spec.ts-snapshots/*-linux.png`
  files (sizes collapse ~2-10x, e.g. `harness-offers-customer-chromium-linux.png` 770266 → 93383
  bytes: viewport-only captures again). The commit message states regeneration was done "in the
  CI-pinned Playwright image" — i.e. the pinned container from ci.yml:441
  (`mcr.microsoft.com/playwright:v1.62.1-noble@sha256:dcc5531e97840b9b5e794f2814476b21571c5124a3fca2267d73041f56e7580e`),
  run on the local machine — **a local regeneration, on macOS hardware, but inside Linux via the
  container — not macOS captures**. Net diff of `visual.spec.ts` vs origin/main is empty (the
  expansion was introduced and reverted within the branch); only the PNGs differ.

**Verification that the local regeneration matched hosted Linux:** CI run 35623718919 (PR for head
1919a3df, 2026-09-21T16:08) ran the full profile — 53 jobs including all 9 visual matrix jobs —
and **succeeded** with the regenerated baselines. The `-linux` path template also structurally
prevents a plain-macOS capture from overwriting the CI-consumed files (`platform === "linux"` gate,
playwright.config.ts:63-64): on macOS the template writes the plain file names.

### Risk assessment

1. **Local-container regeneration is a convention, not a control.** Nothing enforces the pinned
   image; a `-linux` baseline regenerated in any other Linux environment (different distro/fonts,
   unpinned Playwright) would be committed silently. It worked here only because the developer used
   the pinned image and hosted CI confirmed afterwards.
2. **Hosted CI is the sole drift detector, and it only runs after the baseline lands.** A bad
   regeneration surfaces as a red PR (or, for direct pushes like 0a6f4abf, a red main run) — after
   the fact. 0a6f4abf shows the risk realized: baselines changed on main without review; the only
   check was the subsequent main CI run.
3. **Baseline churn in one PR cycle** (064d5a95 expands, 1919a3df contracts) shows regenerations
   being used to make visual reds go away. Each regeneration makes _any_ current rendering pass; the
   review burden shifts entirely to whoever inspects actual/diff images, and AGENTS.md's
   "inspect actual/diff images before changing baselines" is a process step with no artifact
   evidence in the commit stream.
4. **The plain (non-`-linux`) baselines drift invisibly**: they are committed but never consumed by
   hosted CI (which compares only `-linux` files). Divergence between plain and `-linux` variants is
   unobservable in CI.
5. **The green run does not unblock the PR**: the console-sweep merge candidates (3f4b1182, 29a65e45)
   still fail CI on the evidence-comparison verifier (runs 35616938984, 35619178220) — the baseline
   regeneration fixed only the visual tier.

## 10. UNVERIFIED / caveats

- Root cause of `Verify prepared browser environment` exit-1 on runs 34809164971 / 35563994282
  (annotations only say "Process completed with exit code 1"; logs not fetched — suspected image
  digest/Playwright version mismatch).
- The billing/spending-limit annotation was read on 2 of the 17 zero-step runs; the other 15 are
  classified by their identical zero-step/no-runner signature.
- "runner received shutdown signal" text: only 13 check-runs' annotations were fetched; none
  contained it — not an exhaustive scan of all 541 failed runs.
- Whether all 178 storm-window smoke failures (08-22..08-26) were the resolve step: verified on
  10 sampled runs (08-22 ×8, 08-24 ×2); 08-23/25/26 not job-inspected.
- Root cause of `Resolve the external incident` / `Page the SLO breach` exit-1s (webhook config
  suspected; logs/secrets not inspected).
- Lighthouse flake root cause (annotations say only exit 1; suspected performance-budget variance —
  logs not fetched).
- 14 cancelled `nightly.yml` runs and 92 cancelled `ci.yml` PR runs were not job-inspected
  (concurrency supersession assumed per workflow definitions).
- Why run 34020206816 has attempt 2 with zero failed jobs in either attempt (attempt 1: 168 success
  - 1 cancelled job).
- Exact landing dates of the matrix consolidations (/32 → 8 packs → 4 packs; a11y/visual /2 → /4)
  were inferred from job names in the window, not from git history of ci.yml.

## Appendix — data files (all under `research/delivery-audit/`)

- `data/runs-reliability-e2.json` — 3182 runs (complete window).
- `data/jobs/<run_id>_a<attempt>.json` — 227 job files (15,455 job records), all attempts of rerun
  runs + failed CI/nightly runs + samples.
- `data/annotations-sample.json` — annotations for 13 representative failed jobs.
- `data/fetch-jobs.log` — fetch log.
- API budget: ~59 run-list calls, **226 job-page calls (vs the ~200 cap, +13% — noted)**, 13
  annotation calls. All read-only (`gh api` GET); no reruns, no mutations, no tests/services run.
