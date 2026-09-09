# Handoff — local CI execution plane

> **Corrected 2026-09-09 against `origin/main`
> `d5f5c36417efd114117ca75eb5e7866b9a7ac06d`.** This file was written on
> 2026-09-05, before PR #238 merged, and its state sections had since inverted:
> they claimed no VM, no GitHub App and no polling agent existed, that PR #238
> was open, and that `Release gate` blocked on `[fast, build]`. All four were
> false. Those sections are rewritten below. The engineering traps in
> "Traps that cost real time" were re-checked against the tree and still hold.

Read [CI redesign](ci-redesign.md) for the current phases and scope, then
[the operator runbook](local-ci.md) for the installed plane.
[The cutover specification](local-ci-cutover.md) is superseded historical
design — read it for rationale, never as a rollout procedure.

## Where things stand

PR #238 merged as `292db876c8b83d344a66ddaca6d7142bf3741b98`, and the work has
moved on several times since: #268 merged 2026-09-07 as `d30ae19ee`, and #288
merged 2026-09-08 as `aed95ca9b`. PR #266 is **closed**, not open.

Read back on 2026-09-09:

| Fact                        | Observed value                                                                                                                     |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `origin/main`               | `d5f5c36417efd114117ca75eb5e7866b9a7ac06d`                                                                                         |
| Installed agent revision    | `aed95ca9b`, five commits behind `origin/main`                                                                                     |
| launchd job                 | `com.nabaperks.local-ci` running                                                                                                   |
| Self-hosted Actions runners | zero — the architecture is GitHub App check publication, not a runner                                                              |
| `LOCAL_CI_MODE`             | `shadow`                                                                                                                           |
| `LOCAL_CI_WATCHDOG_ENABLED` | `true`                                                                                                                             |
| Contract                    | `cutoverStep` 1, `stage` `bridge-shadow`, `bridge.enforcement` `advisory`, `bridge.requiredCheck` false, `shadowMode.enabled` true |

The plane is advisory. Nothing local gates a merge, and no configuration flip is
a legitimate way to change that — see "Scope discipline".

## The single most important invariant

`Release gate` in `.github/workflows/ci.yml` blocks on **all nine hosted roots**:
`fast`, `quality`, `build`, `e2e`, `a11y`, `visual`, `lighthouse`,
`zap-baseline`, `db`. The historical `[fast, build]` gate this file used to
describe was retired; do not restore fast/build-only merge semantics to obtain a
green result.

`tests/contracts/devops-local-ci.test.mjs` enforces the gate's membership
mechanically, and no job may list the bridge in `needs:`. That interlock is not
decorative. If you change `ci.yml`, prove it still fires by running both
mutations and watching each turn the suite red:

```bash
# 1. wire the advisory bridge into the merge gate
#    add "      - local-proof" under release-gate's needs
# 2. delete the `db` job
node --test tests/contracts/devops-local-ci.test.mjs   # must fail for both
```

A green suite after a `ci.yml` edit is only meaningful if the interlock still
fires.

## What is real and what is unproven

**Real and running.** The Lima VM, the `Nabaperks Local CI` GitHub App
(ID `4839346`) and the polling agent all exist. The agent runs under launchd as
`com.nabaperks.local-ci` and publishes App check results. The Dockerfile builds
and the job image is installed. This is the exact opposite of what this file
originally said, which was written before any of it was provisioned.

**Measured.** One `main`-profile run on `d5f5c3641` completed in 947 seconds
across 10 lanes and 4,089 tests, conclusion `success`.

**Unreliable.** Aggregate local run outcomes are much worse than that single
run: `main` 11 success / 14 failure / 9 cancelled / 1 timed out; `pr` 19 / 21 / 11. No `nightly` run has ever succeeded — `db-stress` fails deterministically
with `Cannot find package 'postgres'`, and `zap-full` is pinned `x64-only` so it
never executes locally.

**Not local at all.** The `pr` and `main` profiles declare ten lanes: `fast`,
`quality`, `print-kit`, four `e2e-*`, two `a11y-*`, `db`. Against the nine hosted
roots that gate a merge, they cover `fast`, `quality`, `e2e`, `a11y` and `db`
only; `print-kit` maps to no hosted root of its own, since hosted print-kit
verification runs inside the `quality` job. There is **no local lane for `build`,
`visual`, `lighthouse` or `zap-baseline`**. Local green is structurally
incapable of standing in for the hosted gate.

**Implemented in source, not live.** `routeTrustedProof`
(`ops/local-ci/core/routing.mjs`) has no callers, so no code path can return
`route: 'local'`. The trusted supervisor is not installed —
`/opt/nabaperks-trusted-ci` does not exist. The `Trusted local proof
preparation` workflow has never run.

**Monitoring is much weaker than it reads.** `agent-watchdog.yml` declares
`cron: "3/5 * * * *"` but GitHub throttles it to a measured mean gap of about
3.1 hours (12 scheduled runs over 37.3 hours, longest gap about 4.6 hours). A
17h42m agent outage on 2026-09-07 raised no incident. See
[the watchdog runbook](local-ci-watchdog.md).

**Still unproven.** The 19 defects an automated reviewer found in the original
branch were all fixed; assume more remain. Live shadow qualification against the
hosted plane has not established three consecutive equivalent SHAs.

## Known gap — the bridge rerun is still not wired

Still true as of `d5f5c3641`. The automatic bridge rerun after the Mac wakes is
**not wired**. `ops/local-ci/agent/github.mjs` implements `rerunWorkflowJob`
(line 1048), `ops/local-ci/core/bridge.mjs` returns the `rerun` decision, and
`scripts/check-local-ci-proof.mjs` correctly refuses to issue it (the
`local-proof` job holds `checks: read` by design, and a running job cannot re-run
the run it belongs to). But no agent code calls it — `rerunWorkflowJob` appears
only in its own definition and in `tests/unit/local-ci-github-client.test.mjs`.

To finish it you need a workflow-run lookup on the GitHub client — a GET, already
covered by the App's Actions **read** — plus a call site in the agent's publish
path and once-per-run bookkeeping. Runbook §5.3 is marked **NOT YET WIRED** and
points at the operator fallback; update it in the same commit that wires this.

This is a recovery convenience, not a safety property. The bridge is advisory
with `bridge.dependents: []`, so a timed-out bridge blocks nothing today. The
cost of its absence is one operator click.

## Two requirements that are still unresolved

Both were raised against the superseded cutover specification. The first now has
a mechanism but no result; the second still has no route at all.

1. **Shadow qualification as originally specified is unimplementable, and the
   replacement has produced no streak.** The plan required "three consecutive
   same-repository PR SHAs produce equivalent hosted and local results." Local
   and hosted routing are mutually exclusive by construction — and that
   exclusivity is exactly what keeps fork code off the VM. The explicit
   comparison mode it needs does now exist: `ops/local-ci/compare-shadow.mjs`
   compares one saved local check against saved hosted evidence for the same
   SHA through `ops/local-ci/core/shadow-qualification.mjs`, and
   `extractLaneSummary` (`ops/local-ci/core/summary.mjs`) publishes the per-lane
   counts it parses as fenced JSON. Both landed 2026-09-06 in `902a529ec`
   (#259). What is missing is the outcome: no run of three consecutive
   equivalent PR heads has been recorded against
   `shadowMode.requiredConsecutiveEquivalent` (3), and with `pr` reliability at
   19 success / 21 failure / 11 cancelled that streak is not currently
   reachable.
2. **"Keep an ARM64-incompatible lane GitHub-hosted permanently" has no general
   route.** If hosted lanes only ran for fork PRs, a lane pinned back to hosted
   would never execute on the merge path for internal PRs. Today exactly one
   lane is pinned — `zap-full` in the nightly profile — and it does still run
   hosted, in `.github/workflows/nightly.yml`. The pins are recorded in
   [ARM64 hosted-pinning decisions](devops-maturity.md#arm64-hosted-pinning-decisions).
   A per-lane routing table that guarantees a hosted-routed lane also runs on
   the merge path is still absent.

## Traps that cost real time — do not rediscover these

Each of these was re-verified against the tree on 2026-09-09.

- **`JSON.stringify` is not an escaper.** It leaves U+2028/U+2029 raw, and both
  terminate a line in JavaScript source. `quoteForMessage` in
  `ops/local-ci/core/contract.mjs` (line 143) exists for this. CodeQL flags the
  `JSON.stringify` call site, not the obvious-looking `String(value)` nearby —
  read the alert's own source node via
  `gh api repos/lapeninns/nabaperks/code-scanning/alerts/<n>` before fixing.
- **`openSync` succeeds on a directory.** `readCredentialFile`
  (`ops/local-ci/agent/main.mjs`, line 245) must distinguish `ENOENT` (return
  null, "not configured") from every other failure (throw). An earlier version
  returned null on any failure, which meant a present-but-unreadable App key read
  as absent and the loader authenticated as a different key — strictly worse than
  the TOCTOU it was fixing.
- **Playwright encodes only `process.platform`** in the `{platform}` snapshot
  token. ARM64 Linux resolves the same `-linux` filenames as the hosted x86-64
  baselines, so every local Playwright invocation carries `--grep-invert @visual`
  **and** `--ignore-snapshots`. The contract's `snapshotGuard` enforces this in
  four layers. Visual regression must stay GitHub-hosted.
- **Non-baseline accessibility journeys have matching selection.** The direct
  customer-join and merchant ID-verification journeys retain `@a11y` but no
  longer claim `@visual`; neither compares pixel baselines. No profile lane
  declares a `knownLocalGaps` record. Existing fixture-dependent skips remain,
  and the local snapshot guard still excludes actual visual tests.
- **Unsharded Playwright against one webpack dev server is fatal** (heap OOM,
  recorded in `nightly.yml` as run 30196429475). Local lanes shard 1/8. Hosted
  E2E keeps the 32-shard denominators but packs four consecutive shards into one
  job (eight packs per browser, since `aed95ca9b`); hosted accessibility shards
  1/8 and hosted visual 1/4. Hosted sharding buys runner parallelism a single VM
  does not have.
- **GitHub's "Re-run failed jobs" does not re-run _skipped_ jobs.** The Mac-
  outage fallback requires "Re-run all jobs".
- **`pull_request` `github.sha` is an ephemeral merge commit.** The bridge polls
  `github.event.pull_request.head.sha`; the local agent checks out the real head
  and can never publish a proof against the merge commit.
- **`QA_CERTIFICATION_EVIDENCE/` is untracked local scratch** and fails
  `pnpm lint`. It is not in git and CI never sees it. Use a scoped ESLint
  invocation as the real signal.
- **`esbuild@0.27.0` is declared but may be missing** from `node_modules`, which
  fails two unrelated unit tests. `pnpm install --frozen-lockfile` clears it.
- **Push protection blocks credential-shaped literals**, including synthetic test
  fixtures. `tests/unit/local-ci-job-env.test.mjs` composes them at runtime from
  fragments. Do not add such a literal, and do not use the unblock-secret URL.

## Verification

The original fixed counts here (684 contracts, 1,284 unit tests, an 80-insertion
`ci.yml` diff) were true for PR #238 and are stale now — the suite has grown and
`ci.yml` has changed repeatedly. Do not treat any number below as a target;
read the actual output.

```bash
pnpm test:contracts
pnpm test:unit
pnpm typecheck
pnpm exec eslint --max-warnings=0 app components hooks lib scripts tests ops instrumentation.ts proxy.ts
pnpm debt:check && pnpm agents:check && pnpm deadcode:check && pnpm duplicates:check && pnpm docs:check
```

If you touched `ci.yml`, re-run the two interlock mutations described above.

## What to do next, in order

1. **Fix the nightly profile.** No `nightly` run has ever succeeded.
   `db-stress` fails on a missing `postgres` package; `zap-full` never executes
   locally. Until both are addressed, the nightly proof verifier is observing
   nothing, and its "stale" verdict carries no information.
2. **Address local run reliability** before any qualification claim. Eleven
   successes in 35 recorded `main`-profile runs will not produce three
   consecutive equivalent SHAs.
3. **Fix watchdog detection latency, or stop describing it as monitoring.** The
   throttled schedule gives hours of latency; a 17h42m outage passed unflagged.
4. **Resolve the two unimplemented requirements above** before proposing any
   change to routing or authority.

## Scope discipline

Do not delete `ci.yml` lanes while the bridge is advisory. `Release gate`
requires all nine hosted roots, and the local plane has no lane at all for four
of them (`build`, `visual`, `lighthouse`, `zap-baseline`). Removing hosted lanes
now would leave real coverage ungated, not relocated.

Do not acquire local merge authority by changing `LOCAL_CI_MODE`,
`shadowMode.enabled`, `bridge.enforcement`, `bridge.requiredCheck`,
`nightlyProof.enforcement` or a cutover-stage label. Authority requires a
separately reviewed implementation with qualified isolation, trusted
verification independent of candidate code, and an equivalent hosted fallback —
none of which exists today.
