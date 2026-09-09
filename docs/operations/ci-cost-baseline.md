# CI consumption baseline

This records what a hosted CI run actually costs, where the cost goes, and what
the packing change is modelled to recover. Every figure below is measured from
provider job and step timestamps unless it is explicitly labelled as modelled.

## Current cost model (measured)

Source: GitHub CI run
[34290952137](https://github.com/lapeninns/nabaperks/actions/runs/34290952137),
a `push` on `main` at `d5f5c3641`, completed 2026-09-08T23:36:45Z. Re-derive with
`gh api repos/lapeninns/nabaperks/actions/runs/<id>/jobs` and sum step durations.

**A run costs 154.1 machine-minutes across 72 jobs, with a 369-second wall clock.**

| Lane       | Jobs | Machine-min | Slowest job                                     |
| ---------- | ---- | ----------- | ----------------------------------------------- |
| e2e        | 32   | 92.3        | 239s (`E2E (desktop-firefox, pack 1)`)          |
| a11y       | 16   | 25.8        | 112s (`Accessibility (mobile-safari, 5/8)`)     |
| lighthouse | 5    | 12.8        | 240s (`Lighthouse (home)`)                      |
| visual     | 9    | 11.6        | 116s (`Visual regression (mobile-safari, 4/4)`) |
| other      | 10   | 11.7        | 173s (`DB behavioral moat`)                     |

Lane totals above are job wall durations. The setup analysis below sums _step_
durations instead, which excludes runner acquisition and is the figure the
packing model works from. The two differ by about 1.5 minutes for e2e.

### Setup is paid once per job, and it dominates the small lane

Splitting each browser job's steps into the workload step
(`run-browser-pack.mjs` / `browser-workload.mjs`) and everything else
— `Set up job`, `Initialize containers`, `checkout`, `./.github/actions/setup`,
`Verify prepared browser environment`, artifact upload, post-steps, teardown:

| Lane | Jobs | Step-sum | Test work | Setup    | Setup share | Setup per job |
| ---- | ---- | -------- | --------- | -------- | ----------- | ------------- |
| e2e  | 32   | 90.8 min | 62.0 min  | 28.8 min | 32%         | 54s           |
| a11y | 16   | 25.1 min | 11.3 min  | 13.7 min | 55%         | 51s           |

The e2e root is 33 jobs counting its `E2E (DB-free harness tier)` gate, and the
a11y root 17 counting `Accessibility sweep`; both gates cost 3–4 seconds and are
excluded from the tables. Setup is roughly a fixed ~52-second toll per job, so
its total is a direct function of **job count**, not of how much testing happens.
Accessibility is the clearest case: it spends more time preparing to test than
testing. That is the whole argument for packing — fewer, longer jobs pay the toll
fewer times while executing exactly the same tests.

### Cancelled runs

Concurrency cancellation wastes minutes on top of the per-run cost. Across the
25 most recent `ci.yml` runs sampled 2026-09-09 (1,779 jobs, 3,990 job-minutes),
**9.7% of job-minutes — 389 minutes across 195 jobs — were spent in runs that were
subsequently cancelled**. An earlier 25-run, 6.8-hour window recorded in
[hosted browser CI performance](ci-browser-performance.md) put this at 14%. Both
are small samples of a bursty workload; treat the range, not either endpoint, as
the estimate.

The `main`-push case is worse than the aggregate and is a correctness problem as
well as a cost one. Of the last 40 `push`-on-`main` runs, **13 were cancelled**.
Because `ci.yml` sets `cancel-in-progress: true` on a group keyed by
`github.ref`, merging a second commit to `main` cancels the in-flight run of the
previous one. Three commits in main's history — `cae8eba95`, `d30ae19ee` and
`87abc72a0` — have exactly one CI run each, and it was cancelled: those commits
have **no successful CI run at all**. The wasted minutes are recoverable; the
missing evidence is the reason to stop cancelling main.

## Modelled effect of the packing change (not yet proven)

Same tests, fewer jobs. e2e keeps its `/32` denominator and merely groups eight
original shards per job instead of four, giving four packs across four projects.
a11y re-splits the same union from `1/8..8/8` into `1/4..4/4` across both existing
projects, giving eight jobs. No project, spec, shard, grep or retry setting changes.

| Lane  | Jobs    | Machine-min  | Saving |
| ----- | ------- | ------------ | ------ |
| e2e   | 32 → 16 | 90.8 → 75.9  | 14.9   |
| a11y  | 16 → 8  | 25.1 → 18.1  | 7.0    |
| Total | 48 → 24 | 115.9 → 94.0 | 21.9   |

Against the 154.1-minute run this is **about 22 machine-minutes, a 14% reduction**
(154.1 → 132.3), plus whatever share of the cancellation waste above the `main`
concurrency fix recovers. An earlier model quoted ~25 minutes and 16%; that
assumed a11y would collapse to four jobs, whereas it landed at eight, so the a11y
saving is 7.0 minutes rather than 10.3. The e2e figure is not an even-distribution estimate: it sums the real
measured test time of each existing pack and adds one ~52s setup per merged job,
so the machine-minute saving holds regardless of how packs are paired.

### Honest caveat on wall clock

The saving is robust; **the wall-clock claim is not**. Merging packs concentrates
test time, and the existing shards are unevenly weighted — pack 1 is consistently
the heaviest. Modelled from real per-pack timings:

- pairing packs adjacently (1+2, 3+4, 5+6, 7+8): slowest e2e job **372s**
- pairing them to balance load (1+8, 2+7, 3+6, 4+5): slowest e2e job **364s**

Both sit at or just above the current 369-second whole-run wall clock, so the
critical path would shift from `Lighthouse (home)` (240s) to a packed e2e job and
wall clock may regress slightly. An earlier estimate of ~285s for the slowest
packed job assumed test time were spread evenly across shards; the measured
distribution does not support that, and the estimate should not be relied upon.
The a11y side is sound: shard times are tightly clustered (35–52s each), and
summing real adjacent pairs gives a slowest job of **144s**, comfortably below both
its current 112s-plus-margin bound and the run wall.

`packShards` emits consecutive blocks, so the landed shape _is_ the adjacent
pairing: new pack 1 is old packs 1 and 2, the two heaviest. Balanced pairing
would recover about 8s of wall clock at identical machine-minutes, but it costs
`run-browser-pack.mjs` its one-line "consecutive equal blocks tile 1..32 exactly
once" proof, which is the property that makes the no-tests-dropped argument
readable. Adjacent pairing is therefore the deliberate choice, and the ~15s of
wall clock is the stated price of the ~22 machine-minutes.

Everything in this section is modelled from **one run's** job timings. It must be
confirmed against real runs after merge before it is quoted as an achieved
saving.

## What this saving is, and is not

This is a **hosted-side** saving. It reduces GitHub Actions machine-minutes and is
independent of the local CI plane: no local runner, proof or qualification state
is involved, and local execution remains advisory either way. A change in local CI
would not produce this saving, and this saving does not advance local cutover.

It is also **not currently a monetary saving**. `lapeninns/nabaperks` is a public
repository (`"visibility":"PUBLIC"`, read back 2026-09-09), and GitHub Actions on
standard runners is free for public repositories. Twenty-five machine-minutes a
run of nothing is still nothing. The saving becomes real money only if the
repository goes private, where the Free plan quota is 3,000 minutes per month —
at 154 minutes per run that is roughly **19 runs a month**, which the current merge
rate would exhaust in about two days. At 129 minutes it is roughly 23. The reason
to make the change now is headroom, queue behaviour and the cancelled-run
evidence gap, not an invoice.

Aggregate execution minutes are also not billed minutes: billing rounds each job
up to the minute and applies per-runner multipliers, so a private-repo bill would
exceed these sums.

## Historical before-figure (pre-#288)

The 168-job runs below predate `aed95ca9b` (#288, merged 2026-09-08), which
replaced the 32-shard browser matrix with eight packs per browser. Keep them as
the before-figure; do not read them as current consumption.

Read-only provider snapshot: 2026-09-08T13:01:31.644Z. Re-run
`node scripts/ci/collect-usage.mjs 5` for current evidence. The collector reads
all sampled attempts and all artifact pages, deduplicating reused job IDs.

| Run                                                                            | Event        | Attempt | Measured jobs | Aggregate execution minutes |
| ------------------------------------------------------------------------------ | ------------ | ------- | ------------- | --------------------------- |
| [34223163467](https://github.com/lapeninns/nabaperks/actions/runs/34223163467) | push         | 1       | 168           | 254.77                      |
| [34223163467](https://github.com/lapeninns/nabaperks/actions/runs/34223163467) | push         | 2       | 168           | 254.35                      |
| [34222153267](https://github.com/lapeninns/nabaperks/actions/runs/34222153267) | pull_request | 1       | 168           | 247.07                      |

Unexpired artifacts: 1,836,
3,666,606,550 bytes. Historical artifacts:
6,781. Active caches: 56,
4,422,624,490 bytes.

These storage numbers are a point-in-time snapshot, not GB-hours or a monthly
invoice.

The corrected Vercel governance collector observed 35 Git deployments during
2026-09-07T12:51:41Z through 2026-09-08T12:51:41Z. The checked source did not
contain `git.deploymentEnabled=false`, despite provider metadata reporting
`createDeployments=disabled`. The two distinct source and observation controls
now fail. No Vercel setting was changed by this diagnostic.

### First packing pilot

On macOS ARM64 with Node 24.18.0, Chromium shards 1/32, 2/32, 3/32 and 4/32
ran sequentially under one dependency installation. Each retained its original
selection and a separate server lifecycle. All 32 tests passed with no retries
or flakes. The runtime identities matched the listed identities exactly.
Process-group absence was verified after each invocation, with no unexpected
survivors. Shard wall times were approximately 25.5, 14.8, 21.1 and 16.7 seconds.

This is runner/selection proof on macOS. Hosted Linux x64 runtime comparisons,
whole-process resource measurements, server restart measurements and the rest
of the shard inventory remained necessary before changing the required matrix.
That change has since been made and merged as `aed95ca9b` (#288); all nine
`Release gate` roots remain active and unchanged by it.
