# Hosted browser CI performance

## Measured baseline

GitHub CI run [34235430647](https://github.com/lapeninns/nabaperks/actions/runs/34235430647)
on 8 September 2026 took 17 minutes 21 seconds across 168 jobs. Its 128 E2E
shards consumed 89.05 aggregate minutes installing browsers and 74.68 minutes
executing tests. Peak observed concurrency was 40 jobs, which is an observation,
not a verified account limit. E2E starts were spread over six minutes.

Mobile Safari shard 13/32 spent 762 seconds in browser preparation and 20 seconds
in tests. Browser cache restoration succeeded, but Ubuntu fetched 114 MB of
system dependencies in 12 minutes 21 seconds. Cached browser binaries do not
remove the system package installation step.

## Implementation and acceptance

**This work is merged.** It landed on 2026-09-08 as
`aed95ca9b33eacbe79c7a4b2808976649b2502c6` (#288) and is main's hosted matrix at
`d5f5c3641`. Earlier revisions of this section described qualification on an
unmerged PR; that is no longer the state. Rollback is a reviewed revert
restoring the prior browser matrix and runner setup, not a pending decision.

E2E now uses eight packs per browser, covering the same original 32 shards in
ascending groups of four. All four browser projects remain selected. Each shard
retains one worker, its original denominator and selection, a fresh Playwright
server, and wrapper cleanup. A pack first lists the selected tests and compares
the complete identity multiplicities against its executed JSON reports. Failed,
missing, flaky or retried runtime evidence cannot pass a pack. A failure stops
that pack and fails the E2E root; it cannot silently skip the remaining work and
pass. Reports and timing evidence are retained for every pack.

E2E and accessibility use Microsoft's Playwright 1.62.1 Noble image, pinned to
registry manifest digest
`sha256:dcc5531e97840b9b5e794f2814476b21571c5124a3fca2267d73041f56e7580e`.
The container runs as UID 1001 to match GitHub's pwuser-owned home directory;
Firefox refuses a root process using that directory. The runtime verifies the
installed Playwright version, browser location and all
three browser executables. Upgrade the image tag, digest and verifier version
alongside the Playwright dependency, then requalify. Image download time must be
included in comparisons; the image removes repeated apt installation, not all
setup cost. See the [official image guidance](https://playwright.dev/docs/docker).

Quality, E2E, accessibility and database jobs no longer wait for the fast lane;
they consume no output from it. Visual tests retain their original runner,
browser setup and fast-lane dependency to preserve the established environment.
Lighthouse and ZAP still consume the single production build. The release gate
continues to require all nine roots. This changes hosted scheduling only; local
execution remains advisory and production authority is unchanged.

## Measured after merge

The job count landed as intended: **72 jobs per CI run instead of 168**.
Measured on 2026-09-09, a run consumes roughly 165 machine-minutes with a
6–7 minute wall clock, against the 254.77 and 247.07 aggregate execution minutes
recorded for 168-job runs in the [consumption baseline](ci-cost-baseline.md).

Two caveats keep this short of a stable saving claim:

- Over 25 consecutive runs in a 6.8-hour window — 1,782 jobs and 4,041 raw
  job-minutes — about **14% of job-minutes were burned by runs that were
  subsequently cancelled**. That waste is scheduling behaviour, not browser
  setup, and this change does not address it.
- Cold-start behaviour across a longer window is still **unmeasured**. Aggregate
  execution minutes are not billed minutes.

Review of all 32 pack inventories and outcomes, and comparison of image/setup
time, retries and failures, remains the standing qualification for any further
change to this matrix. Main, security and deployment checks remain separately
required.

## Pull-request feedback time

Measured on 2026-09-12 over the twenty most recently merged pull requests
(#306–#329), the window from the first check starting to the last check
finishing averaged **10.42 minutes** (median 8.68, maximum 19.17). Fifteen of
the twenty finished between 6.6 and 9.8 minutes; five took 11–19. The
[agent-readiness "fast CI feedback" signal](../../scripts/ci/pr-feedback-time.mjs)
is judged on that mean against a ten-minute bar, so the outliers are what fail
it, not the typical run.

The typical run's floor is the e2e critical path, not any single lane:

| Segment                                   | Wall clock |
| ----------------------------------------- | ---------- |
| Select required checks                    | ~0.5 min   |
| E2E (mobile-safari, pack 1) — the slowest | ~7.4 min   |
| E2E gate + Release gate                   | ~0.6 min   |

Inside the slowest pack, ~55 s is job setup, ~12 s the inventory listing and
~80 s eight fresh dev-server starts; the remaining ~6 min is test time. The
packs are far from even — `mobile-safari` packs 1–4 carried 368 s, ~170 s,
322 s and 306 s of test time on run 34689434054 — so the consecutive grouping
that `packShards` deliberately keeps (see [ci-cost-baseline.md](ci-cost-baseline.md))
now costs roughly 45–60 s of wall clock against a measured-weight grouping.
That is a real but second-order lever; it is recorded here, not taken.

The two things that actually broke the bar:

- **Flaky shard re-runs.** #325 and #327 each failed
  `E2E (desktop-firefox, pack 2)` on the first attempt on the same test — the
  throttled venue-code path in `tests/e2e/customer-venue-code-flow.ts` —
  passed on Playwright's retry, and were still red because `failOnFlakyTests`
  is deliberately on. The failed jobs were re-run by hand ten to thirteen
  minutes later, and that whole wait is contributor-visible feedback time
  (18.5 and 15.8 minutes). The same file flaked on desktop Firefox in at least
  two other recent pull-request runs. The cause was the venue-code input's
  `scrollIntoView({ behavior: "smooth" })` on focus: Firefox scrolls on the
  compositor, so the submit button read as stable while still sliding, and the
  click after `fill` landed beside it. The form now scrolls instantly like the
  other customer forms, which also honours `prefers-reduced-motion` (the
  reduced-motion CSS never applied to an explicit JS `behavior`).
- **Runner queueing under concurrent runs.** #310 (17.9 min) and #324
  (11.3 min) had no failures; their packs waited 2–7 minutes for a runner
  because five pull requests and a main push were running 53-job CI runs at
  once. Job count per run is the lever there; nothing in this change alters it.

Re-measure with `node scripts/ci/pr-feedback-time.mjs 20` (read-only; exits 1
while the mean is at or over ten minutes). The unit tests in
`tests/unit/ci-pr-feedback-time.test.mjs` pin the definition: earliest
`startedAt` to latest `completedAt` (or `updatedAt` for an unfinished check)
across every check on the pull request, re-runs included.
