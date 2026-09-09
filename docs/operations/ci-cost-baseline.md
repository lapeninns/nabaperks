# CI consumption baseline

> **This is the pre-#288 baseline.** The 168-job runs sampled below predate
> `aed95ca9b` (#288, merged 2026-09-08), which replaced the 32-shard browser
> matrix with eight packs per browser. Main now runs 72 jobs at roughly 165
> machine-minutes per run, measured 2026-09-09 — see
> [hosted browser CI performance](ci-browser-performance.md). Keep this table as
> the before-figure; do not read it as current consumption.

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

Aggregate execution is the sum of job timestamp durations, including reruns.
It is different from wall-clock duration and billed minutes. These storage
numbers are a point-in-time snapshot, not GB-hours or a monthly invoice. No
cash-saving claim follows from this sample.

The corrected Vercel governance collector observed 35 Git deployments during
2026-09-07T12:51:41Z through 2026-09-08T12:51:41Z. The checked source did not
contain `git.deploymentEnabled=false`, despite provider metadata reporting
`createDeployments=disabled`. The two distinct source and observation controls
now fail. No Vercel setting was changed by this diagnostic.

## First packing pilot

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
