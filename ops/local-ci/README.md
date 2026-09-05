# `ops/local-ci` — the local CI execution plane

This directory is a second CI plane. It runs the same lanes `.github/workflows/ci.yml`
runs, on a Mac in the operator's home, and publishes the result to GitHub as a
check run through a dedicated GitHub App.

**At cutover step 1 it blocks nothing.** `config/local-ci-contract.json` carries
`bridge.enforcement: "advisory"` and `bridge.dependents: []`, no job in `ci.yml`
lists the bridge in its `needs:`, and `release-gate` still requires exactly
`[fast, build]`. Read `docs/operations/local-ci-cutover.md` before changing any
of that; steps 3–7 are what promote this plane, and each is a reviewed change of
its own.

---

## Layout

```
ops/local-ci/
├── core/        pure decision modules — no clock, no network, no filesystem, no env
├── agent/       the runtime that executes those decisions
├── profiles/    pr.json, main.json, nightly.json — what each run does
├── image/       the disposable job container image
└── host/        Lima VM definition, launchd plist, install/uninstall scripts
```

`config/local-ci-contract.json` is the single source of truth. Both planes, the
agent, the bridge and the tests read it; nothing in this directory hard-codes a
timeout, a lane list, a repository name or a retention window.

---

## The agent, file by file

| File                  | What it owns                                                                                                                   | Impure?                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| `agent/github.mjs`    | GitHub App auth (RS256 JWT → installation token), check runs, ref and pull-request listing, the single permitted Actions write | network only                                                        |
| `agent/container.mjs` | the `docker run` argv for a disposable job container and its sidecar daemon, plus the lifecycle around them                    | argv builders are pure; `runContainer` spawns                       |
| `agent/runner.mjs`    | executing a profile's lanes, parsing test tallies, building lane-result records                                                | everything but `createRunner` is pure                               |
| `agent/loop.mjs`      | the poll tick: list → classify → enqueue → supersede → run one job → heartbeat                                                 | `tick()` is driven by injected dependencies                         |
| `agent/heartbeat.mjs` | the monitoring heartbeat                                                                                                       | network only                                                        |
| `agent/main.mjs`      | argv parsing, credential resolution, composition, exit status                                                                  | **the only file that reads `process.env`, the filesystem or exits** |

Every module takes its dependencies as arguments — `fetch`, `now`, `spawn`, the
file reader — so the whole package is unit-testable offline with no VM, no
Docker and no network.

### Running it

```sh
# One shot, against a commit that already exists on the remote.
LOCAL_CI_JOB_IMAGE=nabaperks-ci-job:<built-from sha> \
  node ops/local-ci/agent/main.mjs \
    --profile pr --ref refs/pull/12/head --sha <40 hex>

# Resolve everything, print the plan, run nothing.
node ops/local-ci/agent/main.mjs --profile main --sha <40 hex> --dry-run

# The launchd mode.
node ops/local-ci/agent/main.mjs --watch
```

Exit status is `0` only when the run completed and concluded `success`.

Host configuration is read from the environment first and from the state root
second, because launchd cannot hold a secret:

| Name                              | Default                                                 |
| --------------------------------- | ------------------------------------------------------- |
| `LOCAL_CI_GITHUB_APP_ID`          | `githubApp.appId` from the contract                     |
| `LOCAL_CI_GITHUB_INSTALLATION_ID` | `githubApp.installationId`                              |
| `LOCAL_CI_GITHUB_APP_PRIVATE_KEY` | the `.pem` at `githubApp.privateKeyPath`                |
| `LOCAL_CI_HEARTBEAT_URL`          | `heartbeat.url` in the state root                       |
| `LOCAL_CI_JOB_IMAGE`              | _(required — no default; an unpinned image is refused)_ |
| `LOCAL_CI_DIND_IMAGE`             | `docker:27.5.1-dind`                                    |
| `NABAPERKS_LOCAL_CI_HOME`         | `~/.nabaperks-local-ci`                                 |
| `NABAPERKS_LOCAL_CI_VM`           | `vm.name` from the contract                             |

Any credential file readable beyond its owner is a refusal, not a warning: the
agent checks the mode and exits rather than continuing with a caveat.

---

## The trust boundary

The Mac holds a GitHub App private key that can publish check runs and re-run
workflow jobs. A job container runs code that arrived in a pull request. The
whole design exists to keep those two facts from meeting, and each barrier below
is a mechanism you can observe rather than a policy you have to trust.

**1. Only this repository's own code runs here.** `core/allowlist.mjs` compares
`head.repo.full_name` with a strict `===` against `lapeninns/nabaperks`, and
`loop.mjs` additionally checks the head repository's numeric id against
`githubApp.repositoryId` once it is pinned — a repository can be renamed, and an
id cannot. A fork pull request is classified `hosted-fork`, recorded in the
loop's refusal ledger, and **never enqueued**: it produces no local result at
all, and the GitHub-hosted plane covers it in full.

**2. Host secrets never enter a container.** `core/job-env.mjs` builds a lane's
environment from an _allowlist_ of host variables — not a denylist, which leaks
whatever it has not heard of — then layers the profile's declared values over
it, deletes every name in `hostSecrets`, and finally proves the result carries
neither a host-secret name, nor a host-secret value under a different name, nor
a PEM block. The Lima VM has `mounts: []` and `forwardAgent: false`, so
`~/.nabaperks-local-ci` does not merely have permissions inside the guest — it
does not exist there.

**3. The container that runs repository code is never privileged.**
`container.mjs`'s `buildContainerArgv` refuses to emit `--privileged`, any host
namespace, or any published port, and refuses any argument naming the host
Docker daemon socket. Lanes that need a Docker daemon (`supabase start`) get a
sibling `dind` container on a job-private network, reachable over TCP at the
alias the job image's `DOCKER_HOST` already points at. The privilege lives in
the sidecar, which executes nothing from the repository. `docs/operations/local-ci.md`
§9 verifies this from the outside with `docker inspect`.

**4. No credential is ever logged.** `github.mjs` redacts JWTs, installation
tokens, PEM blocks and `Authorization` headers from every message it raises;
`heartbeat.mjs` logs only a URL's origin, because the path segment _is_ the
credential; `core/summary.mjs` redacts the published check output and then
re-checks it, because the redaction is an argument and the proof is a proof.

**5. No pixel baseline can be written from here.** Playwright encodes only
`process.platform` in the `{platform}` snapshot token, so the hosted x86-64
`-linux` baselines resolve identically on ARM64 — a local run that compared them
would be comparing the wrong PNGs. Every Playwright invocation in every profile
carries `--grep-invert @visual --ignore-snapshots`, the contract's forbidden
substrings are refused at profile load, and each lane script ends with the
contract's mutation check and fails the lane if it reports anything. Visual
regression stays hosted for the whole cutover.

---

## The sleep contract

The Mac must stay awake **while a job runs** and be free to sleep at every other
moment. launchd cannot express that — a plist can only start a process, and any
assertion it held would be held forever — so the assertion lives in the agent:

- `com.nabaperks.local-ci.plist` starts the agent **without** `caffeinate`. An
  idle agent holds no power assertion.
- `loop.mjs` acquires `/usr/bin/caffeinate -i -m -w <pid>` immediately before a
  job starts and releases it in a `finally`. Because `-w` binds the assertion to
  a pid, it is also released if the agent itself dies: there is no path that
  leaks a permanent assertion.
- The macOS persistent power-management settings CLI is forbidden anywhere under
  `ops/`. It mutates global state that outlives the agent; `caffeinate` takes a
  scoped, self-releasing one.

Observe a live assertion with `pgrep -fl caffeinate` — empty when idle, present
during a job.

---

## Evidence: `nabaperks.lane-result.v1`

One document per lane per run under `evidence.artifactRoot`
(`~/.nabaperks-local-ci/runs/<headSha>/`), retained for
`agent.logRetentionDays`, so a shadow-mode comparison can be reconstructed after
the fact.

| Field                                                                 | Meaning                                                       |
| --------------------------------------------------------------------- | ------------------------------------------------------------- |
| `schema`                                                              | `nabaperks.lane-result.v1`                                    |
| `plane`                                                               | `local`                                                       |
| `profile`, `ref`, `headSha`, `laneId`, `title`                        | which run, which lane                                         |
| `status`                                                              | `success` · `failure` · `timed_out` · `cancelled` · `skipped` |
| `exitCode`, `timedOut`, `startedAt`, `completedAt`, `durationSeconds` | how it ended                                                  |
| `testsRun`, `testsPassed`, `testsFailed`, `testsSkipped`, `flaky`     | `number \| null`                                              |
| `countsExpected`                                                      | did this lane's commands include a test runner?               |
| `countsParsed`                                                        | did the runner recognise a tally in the output?               |
| `countSources`                                                        | `node:test`, `playwright`, or `no-test-command`               |
| `failures`                                                            | failure titles recovered from the output, capped              |
| `commands`                                                            | the lane's commands, verbatim                                 |
| `logParts`                                                            | the log files, in the order `digestLogBundle` hashed them     |
| `logDigest`                                                           | SHA-256 over those parts                                      |

**A null count is not a zero.** A lane that runs no tests (`quality`,
`print-kit`) reports zeros, because zero is the truth there. A lane that _should_
have printed a tally and did not reports `null` and raises an entry in the
published check's failure list — incomplete evidence is a defect of this plane,
and the shadow comparison must not read it as a green run with nothing to prove.
`toSummaryLane` renders a null as `0` in the check's lane table only because the
GitHub-facing schema requires an integer; the failure entry is what stops that
zero from being the only thing a reader sees.

Verify a published check against the logs on disk with the procedure in
`docs/operations/local-ci.md` §6.4.

---

## Known integration points

These are true today and are resolved by later cutover steps or by the host
runbook, not by code in this directory:

- The launchd plist executes `ops/local-ci/agent/main.mjs --watch` directly —
  there is no wrapper script. The plist's `ProgramArguments[0]` and
  `install.sh`'s `AGENT_RELATIVE_PATH` must name that same file; `install.sh`
  refuses to install if it is missing.
- `install.sh` writes the credential files as `github-app-private-key.pem` and
  `uptimerobot-heartbeat-url`; the contract and `docs/operations/local-ci.md`
  name them `app-private-key.pem` and `heartbeat.url`. `main.mjs` accepts either
  pair so an install from either document works.
- Lanes run one at a time. `agent.maxConcurrentLanes` and every
  `concurrencyGroup` are therefore satisfied trivially — no two lanes are ever in
  flight, so nothing contends for `127.0.0.1:3000` or the local Supabase ports.
  Running independent lanes in parallel is a later change, and the concurrency
  groups are what will make it safe.
- `container.workspacePath` is `/workspace`, which the job container's
  `--workdir` and bind mount both use; the image's own `WORKDIR` is
  `/home/runner/work` and is overridden per run.

---

## Related documents

- `docs/operations/local-ci.md` — the full runbook, including everything that
  cannot be done from inside this repository.
- `docs/operations/local-ci-cutover.md` — cutover steps 1–7.
- `ops/local-ci/host/README.md` — VM, launchd and image provisioning.
- `ops/local-ci/profiles/README.md` — how a profile maps onto `ci.yml`.
