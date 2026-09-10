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
