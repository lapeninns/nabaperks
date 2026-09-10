# CI remediation, 2026-09-10

Reconciled against live state, not the attached reports. `origin/main` was
`e0c04c624` (#297); the reports' reference `94c667cbb` (#295) is merged and an
ancestor of it. There were no open pull requests. The required checks on `main`
are `Release gate`, `Analyze (javascript-typescript)` and
`Review dependency changes` — local CI holds none of them, and nothing here
changes that.

## Decision

**Hosted authority stays; the local plane stays paused; retirement stays owner-gated.**

This is not a new decision. `docs/operations/self-hosted-runner-pilot.md` (#297)
already reached it in its "Recommended disposition":
**"Pause, do not retire, and do not run both."** The evidence found here
supports it rather than revisiting it:

- The plane cannot qualify by its own reviewed design.
  `core/shadow-qualification.mjs:165` refuses any run whose lanes lack
  `executionVerified`, and no runtime emits that field —
  `core/root-coverage.mjs:54` says so outright: _"Only a supervisor may assert
  verification; no current runtime emits it."_ Qualification therefore throws
  on every real document. #295 made the evidence honest, and honesty showed
  the plane proves nothing without a supervisor that does not exist.
- What it published was worse than nothing. 12 of 13 attempts on 2026-09-10
  failed, each one publishing a fraction of the workload as advisory coverage
  (see below).
- The running controller is not the reviewed one.
  `/opt/nabaperks-local-ci/current -> releases/aed95ca9b` is ~1020 insertions
  behind `origin/main` across the execution surface and does not contain
  `core/root-coverage.mjs`, `core/checkout-proof.mjs` or
  `core/hosted-identity.mjs`. `scripts/ci/check-installed-revision.mjs` would
  detect that and nothing invokes it.
- The repository is public, so hosted minutes are free. No cost argument
  favours local execution here.

## The browser failure, and what actually caused it

The report attributed this to memory-cgroup exhaustion. That is correct, and it
is still current — but the numbers and the blast radius were not what the
profile note assumed.

`ops/local-ci/profiles/*.json` ran the local `test:e2e` denominator at 8 while
hosted runs 32, so each local dev server carried four times the hosted load.
The inventory has grown since 8 was chosen: `mobile-safari` is 292 tests,
Playwright fills low shards first, and shard 1/8 is **37 axe sweeps out of
`a11y-sweep.ts` against a single `next dev`** — not the "about 28 functional
tests" the note claimed.

The Lima VM's kernel ring buffer holds **twelve** container scopes in which the
memory cgroup killed `next-server` at **6.06–6.43 GiB** anon-RSS inside an
8 GiB lane, taking `WPEWebProcess` with it. RSS overshoots the 6144 MiB ceiling
because `--max-old-space-size` bounds old space, not RSS.

Measured on the host at a fixed heap, one fresh server per shard:

| Arm | Shard | Heap | Tests | Peak `next-server` RSS | Outcome   |
| --- | ----- | ---- | ----- | ---------------------- | --------- |
| A   | 1/8   | 6144 | 37    | 4.17 GiB               | 37 passed |
| B   | 1/32  | 6144 | 10    | 1.98 GiB               | 10 passed |
| C   | 1/32  | 4096 | 10    | 1.88 GiB               | 10 passed |
| D   | 1/8   | 4096 | 37    | 4.02 GiB               | 37 passed |

Arm A is the control and the important one: unbounded by a cgroup, all 37 of
shard 1/8's tests pass — **including the two that fail on every VM run**. The
tests are sound; the boundary was not. Arms C and D tested a second variable
and **refuted** the hypothesis behind them: a lower ceiling does not turn the
kill into a diagnosable V8 error, it just makes V8 collect harder. That claim
is withdrawn.

These are host measurements. They establish the cause (RSS growth of about
0.11 GiB per swept route); the kill itself is established only by the VM kernel
evidence. A `/32` run inside the 8 GiB container is still **NOT YET PROVEN**.

## Then the evidence chain hid it

Three separate defects turned one dead server into a clean-looking test failure:

1. `set -Eeuo pipefail` in the generated lane script aborts shards 2–8 once
   shard 1 exits non-zero (`ops/local-ci/agent/runner.mjs:438`).
2. `buildLaneResult` parsed the surviving shard's tally off the concatenated
   log, so the lane published `testsRun: 37, countsParsed: true` while seven of
   its eight declared shard reports sat in `missingLogParts`.
3. `browser-workload.mjs` mapped a signalled child to exit 1 — the same code
   Playwright returns for a red suite — and Playwright's `webServer` discards
   the server's stdout, so the server left no account of its own death.

## Disposition

| Component                                                                 | Disposition        | Note                                                                                                                            |
| ------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| launchd controller `com.nabaperks.local-ci`                               | **paused**         | Booted out and `launchctl disable`d so it survives login. Journals, logs, releases and VM untouched. Reversible in one command. |
| `config/ci-workloads.json` local e2e denominator                          | **simplified**     | 8 → 32, hosted parity. Raises the split, so the executed union is unchanged.                                                    |
| `runner.mjs` count parsing                                                | **simplified**     | Incomplete declared evidence reports null counts.                                                                               |
| `browser-workload.mjs` exit code                                          | **simplified**     | Signal is no longer flattened into 1.                                                                                           |
| `playwright.config.ts` `webServer`                                        | **simplified**     | `stdout: "pipe"`.                                                                                                               |
| `agent-watchdog.yml` / `watchdog-incidents.mjs`                           | **simplified**     | Production health decoupled from the local-CI flag.                                                                             |
| `codeql.yml` concurrency                                                  | **simplified**     | Exact-main evidence preserved.                                                                                                  |
| Trusted-proof plane, shadow comparator, bridge                            | **retain for now** | #297 requires a separate reviewed qualification before retirement. Not this change's call.                                      |
| `install.sh`/`uninstall.sh`, releases, Lima VM, contract floors, journals | **retain**         | Rollback path and audit trail.                                                                                                  |

## Operating the pause

```sh
# pause (already applied)
launchctl bootout  "gui/$(id -u)/com.nabaperks.local-ci"
launchctl disable  "gui/$(id -u)/com.nabaperks.local-ci"

# resume — separately authorised; verify the installed revision first
launchctl enable    "gui/$(id -u)/com.nabaperks.local-ci"
launchctl bootstrap "gui/$(id -u)" ~/Library/LaunchAgents/com.nabaperks.local-ci.plist
```

Pausing is a LaunchAgent action, never `limactl stop`: `ops/local-ci/host/README.md`
treats a stopped VM as an accident to repair, not a pause. A second, unrelated
project runs its own `local-ci` supervisor and its own `nabatable-runner` VM on
this Mac — never use a broad `pkill` matching `local-ci`.

**Do not** set `LOCAL_CI_WATCHDOG_ENABLED=false` to silence the paused agent on
releases before this change: it also gates the production health probe. After
this change the heartbeat reports "not monitored" on its own.
