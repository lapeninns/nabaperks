# Nabaperks local CI execution plane — operator runbook

Owner: Lapen Inns product operations
Repository: `lapeninns/nabaperks`
Execution host: one Apple-silicon Mac running Docker Desktop (runtime
`docker-desktop`, section 8); the Lima VM `nabaperks-ci` is kept stopped as the
rollback runtime
Escalation inbox: `info@lapeninns.com`

This runbook covers every part of the local CI execution plane that **cannot be
performed from inside the repository**: preparing the runtime (Docker Desktop,
or the Lima VM on rollback), creating and installing the GitHub App, installing
the host service, qualifying the local plane against the hosted plane,
recovering from an offline Mac, verifying log evidence, and auditing the
security boundary.

## Running the nine roots locally first

`ops/local-ci/roots/run-roots.sh <branch> [root ...]` runs the hosted roots
(`fast`, `coverage`, `quality`, `build`, `a11y`, `visual`, `e2e`,
`lighthouse`, `zap`, `db`) on a clean worktree of the branch before a PR is
opened or updated, so hosted minutes are spent only on what local proof
cannot give. Browser roots run inside the CI-pinned Playwright image on the
headless shell channel visual CI uses (regular Chromium for e2e and a11y);
Lighthouse and ZAP build the branch on the host; `db` starts an isolated
Supabase stack on the `557xx` port range with the Homebrew CLI. The
workflow's synthetic env is extracted from `ci.yml` by
`workflow-env.mjs`, never real secrets. This is advisory proof: hosted CI
on the PR remains the merge authority. Known local differences: the host is
arm64 while hosted runners are amd64, so a handful of image-heavy visual
baselines (poster sheets) can differ by about 0.01 of pixels; the `coverage`
root's worktree-guard and `jq` tests need a non-root host run.

## Status: what is and is not active today

The current source implements **CI redesign Phase 2**, described in
[CI redesign](ci-redesign.md), plus the installed
[change-aware selection policy](change-aware-ci.md). This describes source
behaviour, not a claim that the installed Mac agent or provider configuration
has been updated.

- `Release gate` retains its name and is plan-driven. Its `needs` list is the
  nine hosted roots (`fast`, `quality`, `build`, `e2e`, `a11y`, `visual`,
  `lighthouse`, `zap-baseline`, `db`) plus the `selection`, `documentation`,
  `targeted-browser`, `targeted-visual` and `selection-comparison` jobs. Eligible
  documentation and literal public-page PRs select their checks; unselected
  roots are reported as not required. Full-profile PRs and exact-main CI still
  require all nine hosted roots. No test coverage is routed locally.
- The advisory observer is in `.github/workflows/local-ci-shadow.yml`, separate
  from `CI`. It preserves the same same-repository/event allowlist, reads once
  with `LOCAL_CI_OBSERVE_ONCE=true`, and has a two-minute job timeout. It does not
  wait for the Mac. Missing or pending proof is observational, not test success.
- The App continues publishing eventual local results. The agent, App permission
  boundary and shadow qualification remain unchanged; no local result becomes
  authoritative. Neither the observer nor the local App check is required by
  this phase. API or malformed-proof errors remain visible in the observer.
- Database promotion still waits for successful whole exact-main CI and CodeQL,
  then protected ephemeral proof and production approval. Separating the observer
  removes its waiting time from that dependency without bypassing validation.
- `LOCAL_CI_MODE` controls hosted observation, not service startup. The installed
  agent polls independently; leave a paused watcher paused until its separate
  operational resumption is authorised.
- The agent dispatches into the runtime `config/local-ci-contract.json` selects.
  Source selects `docker-desktop` since 2026-09-28 (section 8); the Lima VM is
  the dormant rollback runtime. Merging that change does not reinstall the host
  agent: until an operator runs `install.sh` from the merged revision, the
  installed release keeps the runtime it was installed with. On the Docker
  Desktop runtime an agent whose runtime fails its checks claims no job and
  publishes nothing new; the work waits in the queue.

`config/local-ci-contract.json` still carries the historical `bridge-shadow`
agent policy. Its older cutover-step labels and polling ceilings are not rollout
instructions. [The prior cutover specification](local-ci-cutover.md) is
superseded. Do not acquire local merge authority by flipping a variable or
contract field; follow a separately reviewed redesign phase.

### Live readback, 2026-09-09

Measured or read back directly on this date. Everything else in this runbook
describes source behaviour and procedure, not the installed state.

| Fact                        | Observed value                                                                                                                     |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `origin/main`               | `d5f5c36417efd114117ca75eb5e7866b9a7ac06d`                                                                                         |
| Installed agent revision    | `aed95ca9b` — five commits behind `origin/main`                                                                                    |
| launchd job                 | `com.nabaperks.local-ci` running                                                                                                   |
| Self-hosted Actions runners | **zero** — the architecture is GitHub App check publication, not a runner                                                          |
| `LOCAL_CI_MODE`             | `shadow`                                                                                                                           |
| `LOCAL_CI_WATCHDOG_ENABLED` | `true`                                                                                                                             |
| Contract                    | `cutoverStep` 1, `stage` `bridge-shadow`, `bridge.enforcement` `advisory`, `bridge.requiredCheck` false, `shadowMode.enabled` true |

Three things this runbook describes are implemented in source but **not live**:

- `routeTrustedProof` (`ops/local-ci/core/routing.mjs`) has no callers. No code
  path can return `route: 'local'`.
- The trusted supervisor is not installed: `/opt/nabaperks-trusted-ci` does not
  exist on the host.
- The `Trusted local proof preparation` workflow has never run.

**Coverage the local plane does not have.** The `pr` and `main` profiles declare
fourteen lanes — `fast`, `quality`, `print-kit`, eight `e2e-*` (each project's
odd and even shards), two `a11y-*` and `db`. Mapped onto the nine hosted roots
that gate a merge, they cover `fast`, `quality`, `e2e`, `a11y` and `db`;
`print-kit` has no hosted root of its own — hosted print-kit verification runs
inside the `quality` job. On the Docker Desktop runtime `db` is hosted-only
(section 8.4), so that runtime covers four. There is **no local lane for
`build`, `visual`, `lighthouse` or `zap-baseline`**. The local plane is therefore
not a substitute for the hosted gate, and no amount of local green changes that.

**Measured performance and reliability.** One `main`-profile run on
`d5f5c3641` completed in 947 seconds across 10 lanes and 4,089 tests, conclusion
`success`. Reliability over the recorded history is materially worse than that
single run suggests: `main` 11 success / 14 failure / 9 cancelled / 1 timed out;
`pr` 19 success / 21 failure / 11 cancelled. No `nightly` run has ever
succeeded — `db-stress` fails deterministically with
`Cannot find package 'postgres'`, and `zap-full` is pinned `x64-only` and so
never executes locally. Both belong to the local `nightly` profile
(`ops/local-ci/profiles/nightly.json`); the hosted
`.github/workflows/nightly.yml` has no database job. The hosted nightly runs the
cross-browser suite (four projects, 16 shards each), k6 load checks and the ZAP
full scan every night, adds mutation testing on Mondays and manual dispatches,
and reports failures through standing watchdog issues rather than per-run
alerts; see `docs/operations/nightly.md`.

**Hosted cost, for comparison.** A CI run is 72 jobs and roughly 165
machine-minutes, with a 6–7 minute wall clock. Over 25 consecutive runs in a
6.8-hour window: 1,782 jobs and 4,041 raw job-minutes, of which about 14% was
burned by runs that were subsequently cancelled.

## File map

Everything this runbook references is either committed in the repository or
created by hand on the Mac host.

| Path                                               | Where    | Purpose                                                                                                                |
| -------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------- |
| `config/local-ci-contract.json`                    | repo     | The declarative contract: runtime, VM shape, timeouts, check names, App permissions, retention                         |
| `ops/local-ci/agent/runtime-docker-desktop.mjs`    | repo     | The Docker Desktop runtime: isolation verdict, canary, helper, proxy, volume mounts                                    |
| `ops/local-ci/agent/runtime-lima.mjs`              | repo     | The dormant Lima runtime (rollback path)                                                                               |
| `ops/local-ci/host/lima-nabaperks-ci.yaml`         | repo     | Lima VM definition and its provisioning scripts                                                                        |
| `ops/local-ci/host/install.sh`                     | repo     | The only supported installer/upgrader for the host agent                                                               |
| `ops/local-ci/host/com.nabaperks.local-ci.plist`   | repo     | launchd LaunchAgent definition                                                                                         |
| `ops/local-ci/host/README.md`                      | repo     | VM image refresh procedure and the pinned Docker Engine ledger                                                         |
| `ops/local-ci/agent/main.mjs`                      | repo     | Long-running supervisor; the LaunchAgent's program                                                                     |
| `ops/local-ci/agent/main.mjs --dry-run`            | repo     | Host preflight mode of the agent: resolves credentials, loads the profile, runs the snapshot guard, dispatches nothing |
| `ops/local-ci/core/`                               | repo     | Pure decision modules — no clock, no network, no filesystem                                                            |
| `ops/local-ci/profiles/{pr,main,nightly}.json`     | repo     | Lane definitions, including each lane's `arch`                                                                         |
| `scripts/check-local-ci-proof.mjs`                 | repo     | Proof reader; single observation in `local-ci-shadow.yml`                                                              |
| `.github/workflows/nightly-proof.yml`              | repo     | Nightly proof verifier (`scripts/check-nightly-proof.mjs`)                                                             |
| `/opt/nabaperks-local-ci/current/`                 | Mac host | Symlink to the installed, reviewed agent revision                                                                      |
| `/opt/nabaperks-local-ci/logs/agent.{out,err}.log` | Mac host | Agent process logs, rotated by newsyslog                                                                               |
| `/opt/nabaperks-local-ci/docker-config/`           | Mac host | The agent's `DOCKER_CONFIG`: the desktop-linux context and an empty `config.json`                                      |
| volume `nabaperks-ci-state`                        | Desktop  | Mirror clone, per-run clones, lane checkouts and per-run pnpm stores                                                   |
| `~/.nabaperks-local-ci/app-private-key.pem`        | Mac host | GitHub App private key, mode `0600`                                                                                    |
| `~/.nabaperks-local-ci/runs/<sha>/<run>/`          | Mac host | Per-run lane evidence, one directory per run, retained 30 days                                                         |

Read `config/local-ci-contract.json` before running any procedure below. Agent bounds are committed there as data and checked by tests. Hosted observer
placement and its two-minute single-observation bound are owned by
`.github/workflows/local-ci-shadow.yml`; historical polling values do not override
that workflow. Verify current source before using older provisioning examples.

---

## 1. Provisioning the Lima VM

This section applies to the Lima runtime, which is dormant since 2026-09-28 and
kept as the rollback path. The current runtime is Docker Desktop; see section 8.

The VM is the execution boundary. Everything that runs unreviewed pull-request
code runs inside it, in a container, on a kernel that is not the Mac's.

### 1.1 Prerequisites

1. Confirm the host is Apple silicon and has the capacity the contract's `vm`
   block demands (12 vCPU, 40 GiB memory, 150 GiB disk):

   ```sh
   uname -m                 # expect arm64
   sysctl -n hw.ncpu        # must be >= vm.cpus
   sysctl -n hw.memsize     # bytes; must comfortably exceed vm.memoryGb
   df -g /                  # free GiB must exceed vm.diskGb plus headroom
   ```

2. Install Lima. The definition declares `minimumLimaVersion: "1.0.0"` and
   `vmType: "vz"`, so the Virtualization.framework backend is required:

   ```sh
   brew install lima
   limactl --version
   ```

3. Confirm the VM definition is the committed one. The repository asserts this
   in a contract test, but check it on the host too — a hand-edited local copy
   is exactly the failure this step exists to catch:

   ```sh
   cd /path/to/nabaperks
   git status --porcelain -- ops/local-ci/host/lima-nabaperks-ci.yaml
   ```

   The output must be empty. Never provision from a modified definition.

### 1.2 Create and start the VM

```sh
cd /path/to/nabaperks
limactl create --name=nabaperks-ci --tty=false \
  ops/local-ci/host/lima-nabaperks-ci.yaml
limactl start --tty=false nabaperks-ci
limactl list --json nabaperks-ci
```

After the **first successful boot**, restart once before using Docker as the
guest user:

```sh
limactl stop --tty=false nabaperks-ci
limactl start --tty=false nabaperks-ci
limactl shell nabaperks-ci -- docker info
```

Lima opens its initial SSH session before provisioning adds the guest user to
the Docker group. That existing session retains its old group membership.
The restart creates a fresh session; the readiness probe uses passwordless
sudo to inspect the daemon and firewall while first boot is still completing.

First boot downloads the Ubuntu 24.04 ARM64 cloud image and runs three
provisioning scripts: the ufw firewall, pinned Docker Engine with its
`DOCKER-USER` inbound-deny guard, and the `/var/lib/nabaperks-ci` workspace
root. The definition carries a readiness probe, so `limactl start` does not
return until Docker is up and ufw reports active. If it stalls:

```sh
limactl shell nabaperks-ci -- \
  sudo journalctl -u docker -u nabaperks-docker-inbound-deny --no-pager | tail -50
```

### 1.3 Verify the isolation properties

These are the reason the VM exists. Verify all four, in this order, and record
the output. Any failure means the VM is deleted and recreated — never patched
in place.

**No mounts.** The Mac's home directory, and therefore the App private key, must
be unreachable from the guest. The definition declares `mounts: []`.

```sh
limactl list --json nabaperks-ci | \
  python3 -c 'import json,sys; print(json.load(sys.stdin).get("mounts"))'
# expect: [] or None

limactl shell nabaperks-ci -- findmnt -t virtiofs,9p
# expect: no output, non-zero exit

limactl shell nabaperks-ci -- ls /Users
# expect: failure — the directory does not exist
```

**No forwarded SSH agent and no operator keys.** The definition declares both
`ssh.forwardAgent: false` and `ssh.loadDotSSHPubKeys: false`, so only the
per-instance Lima key can reach the guest.

```sh
grep -n "forwardAgent\|loadDotSSHPubKeys" ops/local-ci/host/lima-nabaperks-ci.yaml
# expect: both false

limactl shell nabaperks-ci -- sh -c 'echo "[${SSH_AUTH_SOCK}]"'
# expect: []
```

**Inbound blocked.** Three independent mechanisms; check all three, because
each closes a hole the others do not.

```sh
# 1. No published guest ports. networks: [] and portForwards[].ignore: true
#    mean Lima publishes nothing onto the Mac beyond its own SSH transport,
#    which is bound to 127.0.0.1.
limactl list --json nabaperks-ci | \
  python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("sshLocalPort"), d.get("networks"))'
lsof -nP -iTCP -sTCP:LISTEN | grep -i lima
# every address must be 127.0.0.1:<port>, never *:<port>

# 2. Default-deny at the guest firewall, with one allow for Lima's own SSH.
limactl shell nabaperks-ci -- sudo ufw status verbose
# expect: "Status: active" and "Default: deny (incoming), allow (outgoing)"

# 3. Docker's FORWARD rules run before ufw's, so ufw alone does not protect a
#    published container port. The DOCKER-USER guard drops every new inbound
#    flow on the external interface.
limactl shell nabaperks-ci -- sudo iptables -S DOCKER-USER
# expect a rule of the form: -A DOCKER-USER -i <ext_if> -m conntrack \
#   --ctstate NEW -j DROP
limactl shell nabaperks-ci -- \
  systemctl is-enabled nabaperks-docker-inbound-deny.service
# expect: enabled
```

There is no inbound path to the agent by design: the GitHub App is created with
its webhook **inactive** (section 2), so the agent polls outward and nothing
needs to reach the Mac. If you find yourself opening a port or standing up a
tunnel, stop — that is a design change, not an operational step.

**These checks are made again before every dispatch, by the agent.** The
verification in this section is a point in time, and a VM can be stopped and
edited, recreated, or handed a mount at run time by anyone with a shell on the
Mac; an instance installed with `--skip-vm-check` was never checked at all.
So immediately before it materialises any commit inside the guest, the agent
re-derives the same properties from two live sources — `limactl list --json`
for what Lima believes it is running, and a probe inside the guest for what is
actually true there:

| Property                       | How it is re-derived                             |
| ------------------------------ | ------------------------------------------------ |
| the instance exists and is up  | `limactl list --json <name>`, `status`           |
| no host mounts                 | `findmnt -t virtiofs,9p,nfs,cifs,sshfs` is empty |
| the Mac's home is not visible  | `/Users` does not exist in the guest             |
| no forwarded SSH agent         | `SSH_AUTH_SOCK` is empty in the guest            |
| no Rosetta                     | `/mnt/lima-rosetta` does not exist               |
| no declared mounts or networks | the instance record's `mounts` / `networks`      |

Any mismatch refuses the dispatch with `VM_ISOLATION_VIOLATION` and names every
property that failed, so an instance is recreated once rather than four times.
A probe that cannot be run at all is `VM_UNVERIFIABLE` and refuses too: a
dispatch that proceeds because the check could not be made has no isolation
guarantee. Recreate the instance from the committed template; never patch it
in place.

**Docker inside the VM, native ARM64.** The Mac's Docker socket is never
shared; the guest runs its own pinned daemon, and Rosetta is disabled so no
x86-64 binary can silently run under emulation.

```sh
limactl shell nabaperks-ci -- docker info \
  --format '{{.ServerVersion}} {{.Architecture}} {{.OSType}}'
# expect: 27.5.1, aarch64, linux

limactl shell nabaperks-ci -- docker run --rm alpine:3 uname -m
# expect: aarch64

grep -n -A2 "^rosetta:" ops/local-ci/host/lima-nabaperks-ci.yaml
# expect: enabled: false and binfmt: false
```

Preload the pinned Docker-in-Docker image before enabling database lanes:

```sh
limactl shell nabaperks-ci -- docker pull docker:27.5.1-dind
limactl shell nabaperks-ci -- docker image inspect docker:27.5.1-dind \
  --format '{{.Id}} {{.Architecture}}'
```

If `LOCAL_CI_DIND_IMAGE` overrides the default, preload that exact pinned image
instead. Sidecars use `--pull=never`; a missing image prevents daemon startup
and must be fixed during provisioning.

### 1.4 Re-assert the VM against the contract

Two different mechanisms cover the VM, and it matters which is which:

- **Committed shape — enforced by tests.** `tests/contracts/devops-local-ci.test.mjs`
  asserts `ops/local-ci/host/lima-nabaperks-ci.yaml` against
  `config/local-ci-contract.json`'s `vm` block, so a pull request cannot land a
  VM definition with a mount entry, a forwarded agent, or a cpu/memory/disk
  value that differs from the contract.
- **Live VM — verified by the operator.** The agent does **not** compare the
  running Lima instance against the contract at start or before dispatch. That
  comparison is the manual `limactl` sequence in 1.1–1.3 above, and it is why
  step 2 of 1.5 rebuilds the instance from the committed file rather than
  editing it.

The agent's own preflight (`--dry-run`) covers the host side: it loads and
validates the contract, resolves the GitHub App credentials, **refuses any
credential file readable beyond `0600`**, loads the profile, and runs the
snapshot guard. It dispatches nothing. Run it now, before the agent is
installed:

```sh
cd /path/to/nabaperks
node ops/local-ci/agent/main.mjs --profile main --ref refs/heads/main \
  --sha "$(git rev-parse HEAD)" --dry-run
```

`--dry-run` validates and reports without starting or dispatching anything.
Each refusal carries a distinct `LocalCiError` code; quote that code in any
escalation.

### 1.5 Changing the VM later

The contract is the source of truth. To change the VM's shape:

1. Change the `vm` block in `config/local-ci-contract.json` **and**
   `ops/local-ci/host/lima-nabaperks-ci.yaml` in the same pull request, so the
   contract test stays green.
2. After the change merges to `main`, on the host:
   `limactl stop nabaperks-ci && limactl delete nabaperks-ci`, then repeat
   1.2–1.4.

Never run `limactl edit`. A hand-edited VM diverges from the committed file
with nothing to detect it — no test sees the live instance, and the agent does
not compare against it — so the drift surfaces only as an unexplained lane
failure. The Ubuntu image and Docker Engine version are
pinned literals with a refresh procedure in `ops/local-ci/host/README.md`;
bumping either is a pull request, not a host action.

---

## 2. Creating the "Nabaperks Local CI" GitHub App

The agent authenticates as a repository-scoped GitHub App, not as a personal
access token. A PAT carries the operator's whole account; an App installation
carries exactly the permissions below, on exactly one repository.

### 2.1 The exact permission set

Grant these repository permissions and **nothing else**. They are declared as
data in `config/local-ci-contract.json` under `githubApp.permissions`.

| Permission        | Level          | Why it is needed                                                                                                                                                                                                                                                                                                                                                                                            |
| ----------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Checks**        | Read and write | The agent creates the `Nabaperks Local CI` check run for a head SHA and completes it with the conclusion and the lane summary. This is the agent's only published output.                                                                                                                                                                                                                                   |
| **Actions**       | Read and write | Read: workflow metadata. Write: the existing helper is restricted **solely** to `POST /repos/lapeninns/nabaperks/actions/runs/{run_id}/rerun-failed-jobs` for the historical bridge-repair design; no CI phase has wired this repair (section 5). The contract pins `allowedActionsWriteOperations` to that single operation, and a contract test asserts it is the only non-GET Actions call under `ops/`. |
| **Contents**      | Read           | Fetch `refs/heads/<branch>` and read the commit graph to build the candidate set. Read-only: the agent never pushes, never tags, never opens a pull request.                                                                                                                                                                                                                                                |
| **Pull requests** | Read           | Enumerate open pull requests and read `head.repo.full_name`, `head.repo.id`, `head.ref`, `head.sha` and `base.ref` — the inputs to the fork allowlist predicate.                                                                                                                                                                                                                                            |
| **Metadata**      | Read           | Mandatory; GitHub grants it automatically alongside any repository permission.                                                                                                                                                                                                                                                                                                                              |

### 2.2 The permissions that must NOT be granted

Refusing these is a security control, not tidiness. The Mac host holds the App
private key **and** runs unreviewed pull-request code in a VM on the same
machine. Every permission below would turn a host compromise into a repository
or production compromise.

- **Contents: write** — would let the holder push to `main`, or to a branch a
  ruleset treats as trusted. The agent has no reason to write code and must not
  be able to.
- **Secrets** (repository or environment, read or write) — would expose the
  production Supabase, Vercel, Stripe, Resend and Twilio credentials to a host
  whose whole job is to execute untrusted code. The local plane runs entirely
  on non-secret fixtures; see section 7.
- **Environments** — would let the holder read or alter the `Production`,
  `Staging` and `Monitoring` environment configuration, including protection
  rules and reviewer requirements.
- **Administration** — would let the holder edit branch protection and the
  ruleset. The entire safety argument of this design rests on `requiredChecks`
  being exactly three names that the agent cannot change.
- **Workflows: write**, **Deployments**, **Members**, **Packages**, **Webhooks:
  write**, and every organization-level permission — none of them have a use
  here.

If a procedure ever seems to need one of these, it is the procedure that is
wrong.

### 2.3 Create the App

1. GitHub → account **Settings** → **Developer settings** → **GitHub Apps** →
   **New GitHub App**.
2. **GitHub App name:** `Nabaperks Local CI`. This must match
   `githubApp.name` in the contract. If GitHub appends a suffix because the
   name is taken, record the actual name and slug and correct the contract in
   the same pull request that pins the App ID.
3. **Homepage URL:** `https://github.com/lapeninns/nabaperks`.
4. **Webhook:** uncheck **Active**. Leave the webhook URL and secret empty.
   The agent polls outward every `agent.pollIntervalSeconds` (60); there is no
   inbound path to the Mac, and creating one would contradict section 1.3. The
   contract reserves a `LOCAL_CI_WEBHOOK_SECRET` name in `hostSecrets` for a
   possible future push-delivery path — step 1 does not use it, so leave it
   unset.
5. **Identifying and authorizing users:** leave the callback URL empty; do not
   enable "Request user authorization (OAuth) during installation" or "Enable
   Device Flow". The App acts as an installation, never on behalf of a user.
6. **Repository permissions:** set exactly the five rows in 2.1. Leave every
   other row at **No access**.
7. **Subscribe to events:** none. With the webhook inactive there is nothing to
   deliver.
8. **Where can this GitHub App be installed?** → **Only on this account**.
9. Create the App. Record the **App ID** from its settings page.

### 2.4 Install it on `lapeninns/nabaperks` only

1. On the App's page choose **Install App** → the `lapeninns` account →
   **Only select repositories** → select `nabaperks` and nothing else.
2. Install. The browser lands on
   `https://github.com/settings/installations/<installation_id>`. Record the
   **installation ID** from that URL.
3. On that page, confirm the repository selection is a single repository and
   that the permission list matches 2.1 exactly, with no pending additional
   permission awaiting approval.
4. Record the repository's numeric id, which the allowlist predicate compares
   against:

   ```sh
   gh api /repos/lapeninns/nabaperks --jq .id
   ```

If the App is ever installed on a second repository, uninstall it there. The
allowlist compares `head.repo.full_name` with a strict `===` against the
literal `lapeninns/nabaperks` — no case folding, no `startsWith` — and
`head.repo.id` against the pinned repository id, so a second installation
cannot smuggle work in. It also has no legitimate purpose, and its presence
means something was misconfigured.

### 2.5 Generate and place the private key

1. On the App's settings page: **Private keys** → **Generate a private key**.
   The browser downloads a `.pem`.
2. Put it where the contract's `githubApp.privateKeyPath` says, at the mode
   `githubApp.privateKeyMode` requires, and remove the download:

   ```sh
   mkdir -p ~/.nabaperks-local-ci
   chmod 700 ~/.nabaperks-local-ci
   mv ~/Downloads/nabaperks-local-ci.*.private-key.pem \
      ~/.nabaperks-local-ci/app-private-key.pem
   chmod 600 ~/.nabaperks-local-ci/app-private-key.pem
   stat -f '%Lp %N' ~/.nabaperks-local-ci/app-private-key.pem
   # expect: 600 /Users/<you>/.nabaperks-local-ci/app-private-key.pem
   ```

3. Place the heartbeat URL in the same directory at the same mode, if the
   monitoring heartbeat has been created:

   ```sh
   printf '%s\n' '<heartbeat url>' > ~/.nabaperks-local-ci/heartbeat.url
   chmod 600 ~/.nabaperks-local-ci/heartbeat.url
   ```

4. Neither file ever enters the repository, a container, or a backup that
   leaves the host. The agent refuses to start if either file is readable
   beyond `0600` (enforced in `ops/local-ci/agent/main.mjs`).

**If the key is ever exposed:** revoke it on the App's settings page (**Private
keys** → delete), generate a replacement, and repeat step 2. The App and its
installation survive; only the key rotates, and outstanding installation
tokens expire on their own within the hour.

### 2.6 Pin the identifiers in the contract

This step is complete. `config/local-ci-contract.json` pins
`githubApp.appId` (`4839346`), `githubApp.installationId` (`159244911`) and
`githubApp.repositoryId` (`1268458916`); its notes record the pinning on
2026-09-05. If the App or its installation is ever replaced, open a reviewed
pull request setting all three to the new positive integers recorded in 2.3
and 2.4.

No proof lane may be promoted from advisory to blocking while any of the three
is `null`, so the pinning is a precondition for qualification. It is also
why a leaked App ID alone changes nothing: the check-run selector matches on
`app.id`, so a correctly named check run published by any other App is rejected
as impersonation.

---

## 3. Installing the host service

### 3.1 Install

`ops/local-ci/host/install.sh` is the **only** supported way to place or
upgrade the agent. It extracts a reviewed revision under
`/opt/nabaperks-local-ci/`, repoints the `current` symlink atomically, creates
`/opt/nabaperks-local-ci/logs` (mode `0750`) and its newsyslog rotation entry,
and installs the LaunchAgent at
`~/Library/LaunchAgents/com.nabaperks.local-ci.plist` byte-identically to the
committed plist.

```sh
cd /path/to/nabaperks
git checkout main && git pull --ff-only
REVISION="$(git rev-parse origin/main)"
ops/local-ci/host/install.sh \
  --revision "$REVISION" \
  --job-image "nabaperks-ci-job:<the sha the image was built from>"
```

`--revision` names the bytes to install; `git archive` takes them from that
commit, so the working tree is never moved and a rollback is the same command
with an older sha. `--job-image` pins the container image the agent runs. It is
needed **once**: the tag is written to `/opt/nabaperks-local-ci/job-image`,
kept across re-runs, and derived from the VM automatically when the instance is
running and holds exactly one `nabaperks-ci-job` image.

That pin is not optional, and this is why it is validated here rather than
discovered at first run: the agent refuses to start without a pinned image, and
a LaunchAgent that cannot start is a `KeepAlive` crash loop, not a poller. The
installer refuses to register the job unless the plist's
`LOCAL_CI_JOB_IMAGE_FILE` names the same path it wrote, and — when the VM is
reachable — unless `docker image inspect` finds the tag inside it.

The installer refuses a revision that is not an ancestor of `origin/main`, a
dirty working tree, an unexpected `origin`, and a credential directory it
cannot prove is safe. It does **not** consult the `Release gate` check for that
revision; that is a judgement the operator makes before naming a sha. **Never
install from a pull-request branch**, and never edit anything under
`/opt/nabaperks-local-ci/` by hand. The integrity of that tree rests on
filesystem permissions alone (`root:wheel`, `go-w`, written only by
`install.sh` under `sudo`): the agent does **not** hash the installed tree, so a
hand edit made as root would run undetected.

### 3.2 Verify the service is loaded

```sh
launchctl list | grep -i nabaperks
launchctl print "gui/$(id -u)/com.nabaperks.local-ci" | head -30
```

Confirm:

- `state = running` and a live `pid`.
- The program is the absolute path
  `/opt/nabaperks-local-ci/current/ops/local-ci/agent/main.mjs`. A
  LaunchAgent pointing at a working copy would execute whatever a branch
  checkout happened to contain.
- `LimitLoadToSessionType` is `Aqua` — the vz-backed Lima VM needs a GUI
  session, which is why this is a LaunchAgent and not a LaunchDaemon.

Then confirm the agent reached GitHub and the VM:

```sh
node /opt/nabaperks-local-ci/current/ops/local-ci/agent/main.mjs \
  --profile main --ref refs/heads/main \
  --sha "$(basename "$(readlink /opt/nabaperks-local-ci/current)")" --dry-run
tail -20 /opt/nabaperks-local-ci/logs/agent.err.log
```

The preflight resolves the host credentials and the pinned job image,
re-asserts the profile and snapshot guard, and reports whether the live Lima
instance still presents the isolation properties a dispatch requires. It is
safe to run at any time; it starts no job, and it warns rather than failing on
the VM so it is still useful before the instance exists.

Confirm the pin the service will use:

```sh
cat /opt/nabaperks-local-ci/job-image     # root:wheel, 0644
limactl shell nabaperks-ci -- docker image inspect "$(cat /opt/nabaperks-local-ci/job-image)" \
  --format '{{.Id}}'
```

### 3.3 Surviving reboot

The agent runs in the logged-in user's session. That has a consequence worth
stating plainly rather than engineering around:

- **After a reboot the agent does not run until a GUI session exists.**
- Enabling automatic login (System Settings → Users & Groups → Automatic login)
  makes that session appear without an operator. **With FileVault enabled,
  automatic login is unavailable** — the disk must be unlocked at the boot
  screen first.
- Both postures are acceptable. Keeping FileVault on and accepting a manual
  unlock after each reboot means the plane is dormant until someone unlocks the
  Mac. That is a _delay_, not a failure: local proof remains advisory, and
  section 5 covers it afterwards. Record which posture this host uses so an
  on-call operator knows whether to expect self-recovery.

Test it once, deliberately:

```sh
sudo shutdown -r now
# after the Mac is back and a session exists:
launchctl print "gui/$(id -u)/com.nabaperks.local-ci" | head -5
limactl list nabaperks-ci
node /opt/nabaperks-local-ci/current/ops/local-ci/agent/main.mjs \
  --profile main --ref refs/heads/main \
  --sha "$(basename "$(readlink /opt/nabaperks-local-ci/current)")" --dry-run
```

`RunAtLoad` starts the agent with the session and `KeepAlive` restarts it on
any exit, with `ThrottleInterval` 30 seconds so a crash loop cannot saturate
the machine. The expected state after any reboot with a session is `running`.

Lima does not restart the VM after a reboot. The agent covers that itself: when
the pre-dispatch listing reports the instance as `Stopped` it runs
`limactl start --tty=false nabaperks-ci`, lists again, and only then takes the
isolation verdict from the running instance. Any other non-running state
(`Broken`, `Starting`, unknown) is still a refusal. Pausing the plane remains a
LaunchAgent action, never `limactl stop`: a stopped VM is treated as an
accident to repair, not as a pause.

### 3.4 Surviving sleep

Sleep is blocked **only while a job is running**, and the assertion is tied to
the job runner's process id:

- The plist starts the agent **without** `caffeinate`. An idle agent holds no
  power assertion and the Mac sleeps normally.
- When the agent claims a job it spawns `/usr/bin/caffeinate -i -m -w
<job-runner-pid>`. Because `-w` waits on that pid, the assertion is released
  when the job ends, when it is cancelled, and even if the agent itself
  crashes. There is no path that leaks a permanent assertion.
- **Nothing calls `pmset`.** `pmset` mutates global, persistent system power
  settings; `caffeinate` takes a scoped, self-releasing one. A contract test
  asserts the absence of `pmset` anywhere under `ops/` and the presence of the
  `caffeinate -i -m -w` invocation.

Verify:

```sh
# While no job is running: no assertion attributable to the agent.
pmset -g assertions | grep -i PreventUserIdleSystemSleep

# While a job is running: exactly one, held by caffeinate. It disappears
# within seconds of the job ending.
```

Test the sleep path once:

1. Trigger a cycle so a job is in flight.
2. `pmset sleepnow` from another terminal.
3. Wake the Mac.
4. Confirm the agent resumes and republishes the check for that SHA. If the
   observer already reported pending, that snapshot stays observational; inspect
   the App’s eventual completion instead. No hosted rerun is needed solely to
   replace a pending snapshot (section 5).

### 3.5 Upgrading and rolling back

Repeat 3.1 with the new `origin/main` revision. The installer keeps the last
five release directories, so a rollback is a second
`install.sh --revision <previous sha>` — the release is already extracted and
the `current` symlink is repointed atomically.

`git pull` inside `/opt/nabaperks-local-ci/` is **not** an upgrade path.
Nothing hashes that tree, so such an edit would run silently and undetected;
its integrity is filesystem permissions alone (section 3.1). Every change to
the installed agent goes through `install.sh`, from a reviewed commit.

---

## 4. Shadow qualification

Qualification is the evidence that the local plane may eventually be trusted.
Local proof stays advisory even after qualification passes. Nothing here changes a
required check.

### 4.1 Preconditions

1. Sections 1–3 complete; the installed-tree preflight (section 3.4) exits clean.
2. `githubApp.appId`, `githubApp.installationId` and
   `githubApp.repositoryId` are pinned to positive integers on `main`
   (section 2.6).
3. Enable advisory hosted observation, only during an authorised qualification:

   ```sh
   gh variable set LOCAL_CI_MODE --body shadow --repo lapeninns/nabaperks
   gh variable list --repo lapeninns/nabaperks
   ```

   This enables the separate single-observation workflow. The installed agent
   polls independently of this variable. `shadow` is the qualification value;
   no variable value substitutes for reviewed implementation of local authority.
   Do not resume a paused LaunchAgent as part of this source-only phase.

4. Open the ledger issue if it does not exist, titled exactly as
   `shadowMode.ledgerIssueTitle` records:
   `[Local CI] Shadow qualification ledger`.

### 4.2 What must be proved

All four, together:

1. **Three consecutive same-repository pull-request head SHAs** produce
   equivalent hosted and local results, by the definition in 4.4.
   `shadowMode.requiredConsecutiveEquivalent` is `3`.
2. **No unexpected test skips**, machine-checked as
   `testsSkipped <= maximumSkipped` and `testsRun >= minimumTests` **on both
   planes**, for every compared lane.
3. The local `pr` and `main` profiles complete **within 75 minutes**.
4. Mutation completes **within 75 minutes at concurrency 8**.

Fork pull requests cannot qualify anything. The allowlist refuses any candidate
whose `head.repo.full_name` is not exactly `lapeninns/nabaperks`, so a fork SHA
produces no local result at all. Pick internal branches.

"Consecutive" means three qualifying SHAs in a row with no `divergent` or
`incomplete` outcome between them. An `incomplete` outcome — a missing lane
record, a record whose `headSha` does not match, or a cancelled run on either
plane — **resets the counter to zero**. It is not a pass, and it is not a lane
failure for the purposes of 4.6 either.

### 4.3 Collecting the two result sets

**Local — the authoritative copy is on the Mac.** The agent writes one
`nabaperks.lane-result.v1` document per lane per run under the contract's
`evidence.artifactRoot`:

One commit can be run more than once - a fast-forwarded pull-request commit is
tested again the moment it lands on `main`, and the nightly proves whatever
`main`'s head is - so evidence is keyed by **run**, not by commit:
`runs/<headSha>/<profile>-<UTC instant>-<entropy>/`. Pick the run you mean.

```sh
SHA=<40 hex head sha>
ls -1 ~/.nabaperks-local-ci/runs/"$SHA"/      # one entry per run of this commit
PROFILE=pr                                    # pr | main | nightly
python3 - "$SHA" "$PROFILE" <<'PY' > "/tmp/local-$SHA.json"
import json, pathlib, sys
commit = pathlib.Path.home() / ".nabaperks-local-ci" / "runs" / sys.argv[1]
runs = sorted(
    d for d in commit.iterdir() if d.is_dir() and d.name.startswith(sys.argv[2] + "-")
)
assert runs, f"no {sys.argv[2]} run recorded for {sys.argv[1]}"
root = runs[-1]  # the newest: the directory name sorts by UTC instant
lanes = []
for path in sorted(root.glob("*.json")):
    doc = json.loads(path.read_text())
    if doc.get("schema") == "nabaperks.lane-result.v1":
        lanes.append(doc)
json.dump(sorted(lanes, key=lambda lane: lane["laneId"]), sys.stdout, indent=2)
PY
```

Each record carries `laneId`, `plane`, `headSha`, `status`, `durationSeconds`,
`testsRun`, `testsPassed`, `testsFailed`, `testsSkipped` and `flaky`.

The same lane records are also published in the `Nabaperks Local CI` check run
so the hosted side can read them without host access. Fetch the check run **by
id**, not from the list endpoint, which truncates `output.text`:

```sh
ID="$(gh api "repos/lapeninns/nabaperks/commits/$SHA/check-runs" \
  --jq '.check_runs[] | select(.name=="Nabaperks Local CI") | .id')"
gh api "repos/lapeninns/nabaperks/check-runs/$ID" --jq '.output.text'
```

**Hosted.** Take the same fields for the same SHA from the corresponding CI
run:

```sh
gh run list --repo lapeninns/nabaperks --commit "$SHA" \
  --json databaseId,name,event,conclusion
gh run view <run-id> --repo lapeninns/nabaperks --json jobs \
  > "/tmp/hosted-$SHA.json"
```

**Sanity-check both files before comparing anything.** If either is empty or
unparseable, if either `schema` is wrong, if either `headSha` differs from
`$SHA`, or if either plane's result is `cancelled`, the outcome is
**incomplete** — stop, fix the cause, and re-run the SHA.

### 4.4 What "equivalent" means, concretely

Compare only the lanes both planes were expected to run. For each such lane,
all three rules must hold:

1. **Status parity.** `local.status === hosted.status`, where status is drawn
   from `{success, failure, timed_out}`. A lane that failed on both planes for
   the same reason is _equivalent_; equivalence is agreement, not green.
2. **Count parity.** `testsRun`, `testsPassed`, `testsFailed` and
   `testsSkipped` are equal **exactly**. Not "close", not "within tolerance". A
   one-test difference means the two planes are not running the same suite,
   which is the only thing qualification is trying to establish.
3. **Skip and floor sanity, on both planes.** `testsSkipped <= maximumSkipped`
   and `testsRun >= minimumTests` for that lane. The floor catches the silent
   zero: a `--project` typo or an over-narrow `--grep` selects nothing, exits
   0, and would otherwise read as a perfect pass on both planes.

Two fields are **recorded and never compared**:

- `durationSeconds`, and any local/hosted ratio derived from it. ARM64 and
  x86-64 timings are not comparable; comparing them produces noise, not signal.
  Duration is still checked against the absolute budgets in 4.2.
- `flaky`. It does not need comparing: the local profiles set `CI=1`, which
  makes Playwright's `failOnFlakyTests` true, so flakiness becomes a lane
  failure on both planes and is already caught by status parity.

Lanes that run on only one plane are **not compared**; list them with the
reason, such as a lane pinned to hosted execution under 4.6. But a lane that
was _expected_ on both planes and is missing from one result set is not "not
compared" — it is an **incomplete** outcome.

A SHA is **equivalent** only when every compared lane satisfies all three rules
and no expected lane is missing. Otherwise it is **divergent** (a rule failed)
or **incomplete** (evidence is missing or unusable).

### 4.4.1 Read-only comparison command

`shadowMode.qualification` in `config/local-ci-contract.json` pins the test
floors, skip ceilings and 4,500-second PR/main budget. The baseline is the
recorded local main run on `d5f5c36417efd114117ca75eb5e7866b9a7ac06d`, at
`~/.nabaperks-local-ci/runs/d5f5c36417efd114117ca75eb5e7866b9a7ac06d/main-20260908T234905Z-dec709/lane-result.json`.
It supersedes the `79b8a048a3c64a7340db04635fe1143442888f9d` PR baseline
linked from issue #255. The contract retains that earlier provenance under
`supersededBaseline`; the current floors and skip ceilings come from the main
run. Its browser skips are the existing DB-free fixture and project-specific skips. Hosted results must
independently satisfy those same ceilings. The two command-only lanes, quality
and print-kit, have explicit zero floors because they do not run a countable
node:test or Playwright suite. This does not exempt their exit status.

Save the **full** local check response with `gh api repos/lapeninns/nabaperks/check-runs/<id>`.
The command below validates the pinned App ID, check name, completed status and
SHA, reads the embedded published lane summary, and measures elapsed time from
`started_at` to `completed_at`. Listing check runs is insufficient because that
endpoint can truncate the embedded summary.

The producer and saved-evidence comparator both read qualification limits from
`--sha`. The reviewed verifier pins the canonical repository separately from
that candidate contract. Hosted PR evidence requires a `pull_request` event;
main evidence requires a `push` on `main`. The saved provider metadata carries
that distinction and the comparator refuses missing or mismatched identity.
Coloured textual test tallies are parsed after terminal control codes are removed.

The producer also reads each comparison job's provider-separated checkout step
log, resolves the reported commit through GitHub's Git object API, and records
its tree alongside the local head's tree. The comparator requires complete
checkout proof for every contributing job and equal trees. A PR's synthetic
merge commit may have a different tree from its head; matching `run.head_sha`
alone is insufficient. Missing/expired logs, missing Git objects, or old evidence
without this proof make comparison incomplete. Provider logs whose steps are
labelled `UNKNOWN STEP` cannot establish checkout identity and are refused;
there is no fallback to a SHA printed elsewhere in the combined job log.
These are initial checkout
observations, not runtime attestation or local promotion authority.

Root coverage requires supervisor-owned validation-start evidence for every
mapped local lane. The current container protocol cannot provide it, so admitted
lanes publish `executionStarted: null` and appear under `unverifiedLanes` rather
than counting as verified root coverage. Lanes never admitted are separately
recorded as not run. Candidate stdout, including an `execution-started` marker
printed by a dependency script, is never promoted to execution proof. The
`workloadCommand` boundary and its log marker remain diagnostic only. Older
marker-derived `executionStarted: true` records without supervisor verification
also remain unverified. Qualification additionally requires verified execution
for every admitted local lane; matching counts and checkout trees cannot make
unverified results eligible for the PR streak. The current runtime therefore
cannot qualify that streak until supervisor-owned execution proof exists.
Saved comparisons must also carry `localExecutionVerified: true`; older reports
without this result cannot be replayed into the streak.
This does not change the hosted merge requirements.

Produce hosted evidence with `pnpm ops:ci:hosted-evidence --sha <sha>`
(`scripts/ci/hosted-evidence.mjs`), which reads the matching CI run's jobs and
logs through the GitHub REST API and emits the envelope described below. It
aggregates the sharded browser jobs back into one lane per project, refuses on
an unmappable job, a duplicated shard or a missing required root, and marks
counts it could not parse as unavailable rather than inferring zero. It is
read-only: it never publishes a check, reruns a job or writes to GitHub.

Hand-assembly is no longer the documented path. It remains possible, and if you
do it, collect every expected shard exactly once — 32 per functional browser
project and four per accessibility project — strip GitHub timestamps and ANSI
colour codes before using `parseLaneCounts` from
`ops/local-ci/agent/runner.mjs`, retain source run/job IDs and raw logs beside
the evidence, never infer zero counts from missing logs, and split the hosted
quality job into its hygiene and print-kit command results, each with its
actual status and explicit zero test counts.

The hosted JSON envelope has `schema: "nabaperks.lane-result.v1"`,
`plane: "hosted"`, the exact `headSha`, `profile: "pr"` or `"main"`, a run
`conclusion`, and a `lanes` array. Each lane contains `laneId`, `status`,
`testsRun`, `testsPassed`, `testsFailed`, `testsSkipped` and `flaky`. The
comparison covers the ten lanes named in the contract; keep hosted-only visual,
Lighthouse and governance evidence separately with its result and reason for
exclusion. The run conclusion here describes these compared lanes, not a
hosted-only job. Provider authenticity and complete log collection remain the
operator's responsibility; the offline comparator cannot authenticate a saved
file or reconstruct an omitted shard.

```sh
pnpm ops:ci:shadow-compare -- \
  --sha <40-hex-PR-head> --profile pr \
  --local-check /tmp/local-check.json \
  --hosted-evidence /tmp/hosted-evidence.json
```

The JSON output separates `verdict` (equivalent/divergent/incomplete) from the
absolute local `budget` result. Missing lanes, duplicate lanes, wrong identities,
missing counts and absent limits are incomplete. Both planes reporting the same
unexpected skips or zero tests still fails the ceilings/floors. The command
exits nonzero for a non-equivalent result or an exceeded budget. It never writes
a GitHub check, changes routing, or promotes a gate. Preserve each output in the
ledger in attempt order. `shadowEquivalenceStreak` tallies PR comparison outputs;
repeated heads do not increase the count, and an ineligible attempt resets it.

This command does not certify the full cutover. Three consecutive PR heads,
a complete main profile, mutation at concurrency eight within 75 minutes, and
the fork/fallback proofs remain separate requirements. A floor decrease or skip
ceiling increase needs a documented coverage change in the ledger; do not adjust
limits merely to accept a failed comparison.

The comparison command preserves `countsExpected` and `countsParsed` from the
published summary. A missing tally remains incomplete evidence; it is never
reinterpreted as a measured zero. Run conclusions must agree with their lane
statuses. A real executed lane divergence is retained when subsequent lanes
carry the runner's `blockedByLaneId`; those skipped lanes cannot qualify, and
an unexplained skip still makes the attempt incomplete. This retains evidence
for the architecture pin-back decision without treating skipped coverage as a
pass. Architecture attribution still requires operator diagnosis under 4.6.

Matching failed or timed-out totals do not establish the same cause. Until
independent same-cause evidence is available, the command returns `incomplete`
for an otherwise matching failed pair and does not add it to an automatic
streak. The operator must inspect the actual failures to apply rule 4.4.1;
aggregate counts alone are never sufficient evidence of a common failure.

### 4.5 Recording the outcome

For each of the three SHAs, record in the ledger issue:

- the head SHA and the pull-request number;
- the verdict — `equivalent`, `divergent` or `incomplete`;
- the per-lane table of both planes' four counts and status;
- the local wall-clock duration, measured from the agent's job start to the
  check run's `completed_at`, against the 75-minute budget;
- the mutation duration at concurrency 8, against the 75-minute budget;
- for a divergent lane, which of the three rules failed, and why.

Qualification is not complete while any lane is unproved on either plane.
The superseded cutover proposal described a later comparator. Qualification
records remain useful, but passing them does not activate local authority; the
current redesign requires separately reviewed isolation and trusted verification.

The nightly proof verifier (`.github/workflows/nightly-proof.yml`, running
`scripts/check-nightly-proof.mjs`) _reports_ a stale verdict when the newest
`Nabaperks Local CI (nightly)` proof for the default branch is older than
`nightlyProof.maxAgeHours` (36) — one 24-hour cadence plus a 12-hour recovery
window, so a single missed night warns and two consecutive misses report stale.

**It cannot go red today, and nothing depends on it.** Two independent reasons:
`nightlyProofExitCode` in `scripts/check-nightly-proof.mjs` returns 0 unless
`nightlyProof.enforcement === "blocking"`, and the contract sets that field to
`"advisory"`; and the job in `.github/workflows/nightly-proof.yml` also carries
`continue-on-error: true`. So the verdict is a summary line, not a failure —
read the summary, do not wait for a red check. Making it fail is one contract
string plus dropping `continue-on-error`, which is a reviewed change, not a
routine flip.

There is also nothing for it to observe. **No nightly local run has ever
succeeded.** The `db-stress` lane fails deterministically with
`Cannot find package 'postgres'`, and the `zap-full` lane has never executed at
all. Until those two are fixed, a "stale nightly proof" verdict is the expected
steady state and carries no information about qualification freshness.

**What produces that proof.** The watch agent does, by itself. Every 15 minutes
it asks a purely local question — is the newest `nightly` run directory under
`~/.nabaperks-local-ci/runs/` older than the 24-hour cadence? — and when the
answer is yes it resolves the default branch head from GitHub and runs the
`nightly` profile for it, serialised against the poll loop so only one job is
ever in flight.

There is deliberately **no separate launchd timer**:

- A `StartCalendarInterval` job replays a window missed while the Mac was
  asleep, but a window missed while it was powered off or logged out is simply
  gone, and the freshness monitor would report stale with nothing on the host
  explaining why. Asking a cheap question on a short interval turns every kind
  of missed window into a _late_ run instead of a skipped one.
- A second job would also dispatch alongside a pull request already running,
  and `agent.maxConcurrentJobs` is 1.

The cadence and the window are one design, and the agent refuses a contract in
which `nightlyProof.maxAgeHours` is not greater than the 24-hour cadence: with
no recovery margin, one missed night would fail the monitor outright.

To see the decision without running anything, or to force the question now:

```sh
node /opt/nabaperks-local-ci/current/ops/local-ci/agent/main.mjs --nightly --dry-run
node /opt/nabaperks-local-ci/current/ops/local-ci/agent/main.mjs --nightly
```

`--nightly` is the same decision the agent makes on its own: it exits 0 without
running anything when a proof is still inside the cadence.

### 4.6 The rule for an ARM64-incompatible lane

Some lanes will not survive ARM64 Linux. The likely candidates are Lighthouse
(its numeric budgets were calibrated on hosted x86-64), the ZAP full scan
(historically amd64-only images), the `desktop-safari` WebKit project, and the
Supabase local stack if any image in the pinned 2.106.0 set has no
`linux/arm64` manifest.

**The rule: if a lane fails qualification twice, it is pinned back to
GitHub-hosted permanently by setting that lane's `"arch"` to `"x64-only"`.**

Precisely:

1. A "failure" here means the lane was the cause of a `divergent` verdict on
   two separate SHAs, for an arch-attributable reason: a missing `linux/arm64`
   image, an engine or renderer divergence, or a duration that cannot meet the
   budget. An `incomplete` outcome is not a lane failure — fix the evidence and
   re-run the SHA.
2. On the second failure, open a pull request setting `"arch": "x64-only"` for
   that lane in `ops/local-ci/profiles/pr.json`, `main.json` and
   `nightly.json`. `x64-only` is one of the two values the contract's
   `archValues` permits; the default from `laneDefaults.arch` is `any`.
3. Record the decision — lane id, date, reason, and the two SHAs — under
   [ARM64 hosted-pinning decisions](devops-maturity.md#arm64-hosted-pinning-decisions)
   in `docs/operations/devops-maturity.md`. That ledger also lists every lane's
   current `arch`. At `d5f5c3641` exactly one lane is pinned, `zap-full` in the
   nightly profile, and its pin predates the ledger, so no two-strike record
   backs it.
4. **The lane must still run on the merge path.** Pinning changes _which plane
   executes a lane_, never _whether it executes_. A lane pinned `x64-only` runs
   on the hosted plane on every route, including the internal pull-request
   route, and the local profile then refuses to claim it. A change that leaves
   a lane running on no plane is a defect, not a pin.
5. The pin does not expire on its own. Revisiting it is a deliberate pull
   request with fresh evidence, not a retry.

**Visual regression is not subject to this two-strike trial — it is pinned
hosted from the start**, and `snapshotGuard` in the contract enforces that with
four independent layers:

1. every Playwright invocation in every profile carries `--grep-invert @visual`;
2. every invocation carries `--ignore-snapshots`;
3. no profile command contains `-u`, `--update-snapshots`, or `test:visual`;
4. after every lane the agent runs
   `git status --porcelain -- 'tests/e2e/**/*-snapshots'` and fails the lane if
   it reports anything.

The reason is exact: Playwright encodes only `process.platform` in the
`{platform}` snapshot token, so `-linux` is identical on x86-64 and ARM64. An
ARM64 run that resolved those baselines would compare against the wrong images
— and, worse, Playwright's default `updateSnapshots` behaviour **writes** the
actual image before failing. Local runs therefore never write and never compare
visual snapshots. The hosted `visual` and `visual-gate` jobs in `ci.yml` remain
hosted-only and are required by `Release gate` on every full-profile PR and
exact-main run.

---

## 5. Mac offline, VM outage, and hosted validation

### 5.1 Current behaviour

The observer makes one metadata observation and exits. If the Mac is offline or
asleep, the local check may be missing or pending; this is reported without
waiting. If the VM fails, inspect `agent.err.log` and the eventual App result.
Neither condition makes local proof authoritative or changes hosted CI results.
Invalid SHA/event wiring, malformed evidence and API failures must remain
visible errors, rather than being described as successful local tests.

Hosted validation already runs in full. There is no local outage fallback
variable to set and no reason to rerun every hosted job merely because local
proof was absent. Diagnose an actual hosted failure on its own evidence.
Production promotion continues to require whole exact-main CI and CodeQL.

### 5.2 Observation and eventual results

`local-ci-shadow.yml` uses `LOCAL_CI_OBSERVE_ONCE=true` and a two-minute job
bound. It never sleeps while waiting for the agent. Historical contract polling
ceilings describe the older reader mode, not the current hosted observer. The
App's check is the source of the later local completion result; the earlier
snapshot is not retroactively changed into success.

The App's existing permission contract and rerun helper remain unchanged in
this phase. They do not authorise the observer to rerun workflows, dispatch
local work or publish an authoritative verdict. On PR events the observer uses
the default PR merge-tree checkout and may execute candidate repository code
with a read-only token; it performs no `pnpm install`. The host agent is never
updated from PR code. A verifier independent of candidate code is a later
redesign phase. No automatic bridge-repair feature is introduced.
The old `LOCAL_CI_FALLBACK_SHA` and full-rerun procedure belongs to the superseded
routing proposal and must not be used to activate local authority.

### 5.3 Recovery and qualification

Repair host/VM problems only within the separately authorised operational scope.
Before resuming a paused watcher, verify the installed revision and host state;
this source change does not install or resume it. Once running, inspect the
App's final lane evidence and preserve incomplete/failed qualification attempts.
Keep comparison and shadow-mode safeguards in place. Future authoritative local
routing requires disposable execution, trusted verification, durable attempt
handling and equivalent hosted fallback from the current redesign plan.

---

## 6. Logs, the log digest, and verifying evidence

### 6.1 Two different log surfaces

- **Agent process logs** — `/opt/nabaperks-local-ci/logs/agent.out.log` and
  `agent.err.log`, owned by the operator at mode `0750`, rotated by
  `/etc/newsyslog.d/com.nabaperks.local-ci.conf`. These are for debugging the
  supervisor: why it refused to start, which `LocalCiError` code it returned,
  whether a dispatch was skipped.
- **Per-run evidence** — `~/.nabaperks-local-ci/runs/<headSha>/<profile>-<UTC
instant>-<entropy>/`, holding the `nabaperks.lane-result.v1` documents and
  the captured lane logs. These are the evidence a check run attests to, and
  the input to section 4's comparison. One directory per **run**, not per
  commit: the `pr`, `main` and `nightly` runs of one SHA are separate records,
  and none of them overwrites another.

Neither is ever written into the repository, and neither survives in a
container after it exits.

### 6.2 Retention

`evidence.retentionDays` and `agent.logRetentionDays` are both **30**. The
pruning rule is deliberately conservative:

- a run directory is pruned only when it is **strictly older** than the window;
- the boundary day and today are **never** pruned;
- a run still in flight is never pruned, whatever its age — a long run started
  before the cutoff would otherwise have its own log deleted mid-write;
- a commit directory is removed only once its last run has been;
- the selection is stable across a daylight-saving boundary.

The sweep runs on every poll tick of the watch agent, so an installed service
prunes without anyone asking it to. It is the agent that does this: nothing
else reads `agent.logRetentionDays`.

The consequence, stated honestly: **an outcome older than 30 days cannot be
re-verified against local evidence.** GitHub retains the hosted plane's logs
for longer. If a comparison must outlive 30 days, copy the lane records and
their digest into the ledger issue at the time.

### 6.3 The SHA-256 log digest

Every completed job publishes a digest as the **last line** of the check run
summary:

```
Log digest: <64 lowercase hex characters>
```

Two properties matter:

- It is computed over a **length-prefixed** concatenation of the bundle's
  parts. Length-prefixing is what makes moving bytes between two parts change
  the digest — without it, `ab|c` and `a|bc` would hash identically and a
  reordered log would still verify.
- A single changed byte in any part changes it.

The summary itself is bounded and carries no job environment values: the
failure list is capped at 20 entries, and nothing from the job's environment
map is rendered into it.

### 6.4 Verifying a check's evidence against the local log

1. Read the digest the check attested:

   ```sh
   ID=<check run id>
   gh api "repos/lapeninns/nabaperks/check-runs/$ID" --jq '.output.text' \
     | tail -n 1
   ```

2. Read the digest the run recorded next to its own logs. The field names are
   fixed by `nabaperks.lane-result.v1`; `ops/local-ci/README.md` carries the
   schema.

   ```sh
   RUN_DIR=~/.nabaperks-local-ci/runs/<headSha>/<run>
   python3 -c 'import json,sys;d=json.load(open(sys.argv[1]));print(d["logDigest"])' \
     "$RUN_DIR/lane-result.json"
   ```

3. Recompute it from the bytes on disk, in the order the record names, using
   the agent's own pure digest module:

   ```sh
   RUN_DIR=~/.nabaperks-local-ci/runs/<headSha>/<run> \
   node --input-type=module -e '
     import { readFile } from "node:fs/promises"
     import { digestLogBundle } from "/opt/nabaperks-local-ci/current/ops/local-ci/core/digest.mjs"
     const dir = process.env.RUN_DIR
     const record = JSON.parse(await readFile(`${dir}/lane-result.json`, "utf8"))
     const parts = []
     for (const name of record.logParts) {
       // No encoding argument, so this reads Buffers. The digest binds the
       // log's bytes; reading as "utf8" would replace every invalid byte with
       // U+FFFD before the hash saw it, rebuild a different digest, and report
       // an intact run as an integrity finding.
       parts.push(await readFile(`${dir}/${name}`))
     }
     console.log(digestLogBundle(parts))
   '
   ```

4. All three values must be identical.

**If they differ, this is an integrity finding, not a flake.** Do not delete or
overwrite the run directory. Capture all three values, the check run id, the
head SHA and the lane id, and escalate per
`docs/operations/incident-response.md`. A mismatch means one of: the log on
disk is not the log the check attested; the installed agent is not the reviewed
revision (re-run the installed-tree preflight from section 3.4);
or something wrote into the run directory after the job ended.

---

## 7. The security boundary

### 7.1 What lives where

**Mac host only — never in the VM, never in a container.** The contract lists
these under `hostSecrets`, with `hostSecretsPolicy.neverEnterContainer: true`:

- `~/.nabaperks-local-ci/app-private-key.pem` (mode `0600`, directory `0700`).
- `~/.nabaperks-local-ci/heartbeat.url`.
- The App ID and installation ID.
- The short-lived installation token the agent mints from the key. It is held
  in memory on the host and is never written to disk.
- The installed agent tree at `/opt/nabaperks-local-ci/current/`, the agent
  process logs, and the per-run evidence.

The Lima VM cannot reach any of these: it has **no mounts** and **no forwarded
SSH agent** (section 1.3), so there is no path from the guest to `$HOME`. On the
Docker Desktop runtime the credential directory is kept out of Docker Desktop's
file sharing instead, and no container is given any Mac path (section 7.6). A
repository secret cannot reach this plane at all — which is exactly why lanes
that need one stay hosted.

**Inside the VM:** the pinned Docker Engine, the `/var/lib/nabaperks-ci`
scratch root, the git clone, and the containers. Nothing else.

**Inside a job container:** exactly the environment the profile declares, layered
in the contract's fixed precedence — `baselineEnv`, then `runtimeEnv`, then the
lane's own literal env. Every `runtimeEnv` source is a command or a generator
that produces its value at run time: the local Supabase stack's own per-stack
keys, a freshly generated VAPID pair, a freshly minted standard-webhook-shaped
auth-hook fixture, and freshly minted high-entropy fixtures for `CRON_SECRET`,
`PRODUCTION_MONITOR_SECRET` and the three `CUSTOMER_*` values. **No literal
value for any of them is committed** — not in the contract, not in a profile.
They are fixtures, not credentials, and they are regenerated per run.

### 7.2 The container topology

On the Docker Desktop runtime there is one container per job and no daemon: the
job container mounts its own lane directory of the `nabaperks-ci-state` volume
at `/workspace` through a `volume-subpath` mount and its run's pnpm store
read-only, joins its own `--internal` network, and is created, inspected and
only then started (section 8.2). The Lima topology below is the rollback path.

On the Lima runtime, two containers per job:

- A Docker-in-Docker daemon (`container.dockerInDocker: true`), whose state is
  a fresh volume removed with the job.
- The job container, which runs the pull-request code at
  `container.workspacePath` (`/workspace`) with `container.cpus` and
  `container.memoryGb` limits. Daemon-backed jobs share their own sidecar's
  network namespace and reach Docker and nested Supabase services on loopback.
  The agent checks daemon startup and waits for its API before starting the job.
  Other jobs use the private bridge directly. No job shares the VM network.

**`container.mountHostDockerSocket` is `false` and must stay false.** The job
container runs unreviewed code; binding `/var/run/docker.sock` into it is a
container escape — root on the VM. Job containers are also never started with
`-p`, which is what keeps the guest firewall rules in section 1.3 meaningful.

The job container **never talks to GitHub**. It has no token and no
credentials. The agent publishes the check run itself, on the host, after the
container has exited. A compromised job therefore cannot publish a passing
check for itself.

### 7.3 Fetch isolation

Fork pull-request heads are published in the **upstream** repository's object
store at `refs/pull/N/head`, so `git fetch origin <fork-sha>` would succeed.
Fetching by bare SHA is not isolation.

The agent instead fetches `refs/heads/<headRef>` and asserts that
`git rev-parse FETCH_HEAD` equals the expected head SHA. A fork branch that
does not exist upstream fails the fetch; a fork branch whose name collides with
an upstream branch resolves to the upstream commit, which is not the expected
SHA, and the equality assertion fails. The agent never references `refs/pull/`,
never fetches a bare SHA, and never adds a second remote. The allowlist refusal
runs before anything is queued, so the queue never receives an untrusted
candidate in the first place.

### 7.4 The host agent is never updated from PR code

This is the rule that makes everything above hold.

- The agent runs from `/opt/nabaperks-local-ci/current/`, referenced by
  absolute path in the LaunchAgent's `ProgramArguments`. `current` is a symlink
  that `install.sh` repoints atomically to a release directory extracted from a
  verified `main` commit.
- `install.sh` proves that revision is an ancestor of `origin/main` before it
  extracts anything. Confirming the revision also carries a successful
  `Release gate` check is the operator's judgement at install time; the
  installer does not query GitHub, and section 3.1 says so.
- The installed tree is protected by filesystem permissions only — `root:wheel`,
  `go-w`, written solely by `install.sh` under `sudo`. There is **no** runtime
  SHA-256 verification of that tree; adding it is tracked as follow-on work in
  `docs/operations/local-ci-cutover.md`. An agent that refuses to start does
  silence the heartbeat, which is itself an alert.
- `ops/local-ci/host/install.sh` is the only writer of that tree.
- **No code path reads a file from a job workspace and executes it as agent
  code.**

The statement for reviewers: a pull request that edits `ops/local-ci/**`
changes what the agent does **only after it merges to `main` and an operator
re-runs the installer**. A malicious pull request cannot alter the process that
judges it.

### 7.5 Verifying the separation

Run this after any change to the host, the VM or the agent, and during any
security review:

```sh
# 1. No mounts, no forwarded agent, no operator keys in the guest.
limactl shell nabaperks-ci -- findmnt -t virtiofs,9p             # no output
limactl shell nabaperks-ci -- sh -c 'echo "[${SSH_AUTH_SOCK}]"'  # []
limactl shell nabaperks-ci -- ls /Users                          # fails

# 2. Inbound stays closed.
limactl shell nabaperks-ci -- sudo ufw status verbose  # deny (incoming)
limactl shell nabaperks-ci -- sudo iptables -S DOCKER-USER | grep -c "ctstate NEW -j DROP"

# 3. Credential file modes on the Mac.
stat -f '%Lp %N' ~/.nabaperks-local-ci                          # 700
stat -f '%Lp %N' ~/.nabaperks-local-ci/app-private-key.pem      # 600

# 4. No host socket anywhere in the agent.
grep -RIn "docker\.sock" ops/local-ci/ || echo "no socket reference"

# 5. The pure core touches no ambient state.
grep -RIn "process\.env\|Date\.now(\|fetch(\|child_process" ops/local-ci/core/ \
  || echo "core is pure"

# 6. During a running job, inspect the job container.
name="$(limactl shell nabaperks-ci -- docker ps \
  --filter name=nabaperks-ci-job- --format '{{.Names}}' | head -1)"
limactl shell nabaperks-ci -- docker inspect \
  --format '{{.HostConfig.Privileged}} {{json .HostConfig.Binds}} {{json .NetworkSettings.Ports}}' \
  "$name"
# expect: false, no bind mentioning docker.sock, no published ports

# 7. The offline proofs, from the repository.
pnpm test:unit
pnpm test:contracts
```

Steps 4, 5 and 7 are the ones that survive a distracted operator: the same
properties are asserted by unit and contract tests that run in CI on every pull
request, so a change that mounts the socket, imports the network into the pure
core, widens the environment map, or removes the `pmset` prohibition reddens
the merge lane rather than waiting for a manual audit.

On the Docker Desktop runtime the separation is checked through the agent's own
verdict and the daemon's view of a running job:

```sh
# 1. The whole pre-dispatch verdict: engine, file sharing, state volume, canary.
DOCKER_CONFIG=/opt/nabaperks-local-ci/docker-config \
  node /opt/nabaperks-local-ci/current/ops/local-ci/agent/main.mjs \
  --profile main --sha "$(git rev-parse origin/main)" --dry-run

# 2. During a running job: no bind, no privilege, no port, an internal network.
name="$(docker --context desktop-linux ps --filter name=nabaperks-ci-job- \
  --format '{{.Names}}' | head -1)"
docker --context desktop-linux inspect --format \
  '{{.HostConfig.Privileged}} {{json .HostConfig.Binds}} {{json .HostConfig.PortBindings}} {{.HostConfig.NetworkMode}}' \
  "$name"
docker --context desktop-linux network inspect --format '{{.Internal}}' \
  "$(docker --context desktop-linux inspect --format '{{.HostConfig.NetworkMode}}' "$name")"
# expect: false null {} nabaperks-ci-net-..., then true

# 3. Only agent resources carry the agent's labels, and nothing is ever pruned.
docker --context desktop-linux ps -a --filter label=com.nabaperks.local-ci.role \
  --format '{{.Names}}'
```

### 7.6 Docker Desktop runtime: residual risk, owner-accepted on 2026-09-28

Moving the agent from the dedicated Lima VM to Docker Desktop weakens one
property. The repository owner accepted that weaker isolation on 2026-09-28,
with hosted CI unchanged as the only merge authority, `LOCAL_CI_MODE` at
`shadow`, `bridge.requiredCheck` false, and db and db-stress hosted-only on
this runtime. This section is the record of that acceptance and of the
conditions it rests on.

**What is weaker.** Lima gave this plane a VM of its own with `mounts: []`: an
escape from a job container landed in a VM that held nothing of the Mac's.
Docker Desktop's VM is shared with other worktrees' containers - their local
Supabase stacks and anything else the operator runs - and it sees every
directory in Docker Desktop's file-sharing list. A kernel exploit from an
unprivileged job container would reach that VM, the directories it shares
(which include repositories' `.env.local` files if a project tree is shared)
and the other containers on it. The VM also carries Docker Desktop's
host-service sockets and its own unrestricted network; see "Residual risk not
covered by the 2026-09-28 acceptance" below. Docker Desktop's Enhanced
Container Isolation would close this; it is not available or configured here.

**What still holds.** Each item is enforced by the agent before every dispatch
or by the argv builders, and fails closed:

1. The credential directory is outside Docker Desktop's file sharing. The list
   must be explicit (the default shares `/Users`) and may not cover
   `~/.nabaperks-local-ci` or the whole home directory. Paths are compared as
   written, without the `/System/Volumes/Data` firmlink, and where they
   physically live, so a share of `/Volumes/Macintosh HD/Users` or of the
   real target of a symlinked credential directory is refused too. Through
   file sharing, an escape into the VM does not reach the App private key. The
   installation token exists only in the agent's memory on the Mac.
2. No privileged container runs, and none executes candidate code: there is no
   Docker-in-Docker sidecar on this runtime, so `db` and `db-stress` are
   reported hosted-only and the hosted `db` root stays authoritative.
3. No container is given a Mac path. Workspaces live in the
   `nabaperks-ci-state` named volume; a job sees only its lane directory
   (`volume-subpath`) and its run's pnpm store read-only. Bind mounts are
   refused when the argv is built, and every job container is inspected after
   creation and before start: no binds, no privilege, no added capability, no
   ports, only agent-labelled volume mounts, and an internal pool network.
4. A job cannot reach the Mac, the LAN or the internet. Job networks are
   `--internal` networks from `10.213.0.0/16`, and a negative canary proves on
   every dispatch that a listener on the Mac's `127.0.0.1` is unreachable
   through `host.docker.internal` and `192.168.65.254`.
5. Candidate code runs only in job containers, each on its own per-lane
   `--internal` network with no route to the prep network, the proxy or any
   gateway. The trusted helper that has egress never runs candidate code: it
   clones and installs with lifecycle scripts, pnpmfile hooks and
   `configDependencies` refused, through an allowlist proxy to `github.com`,
   `codeload.github.com` and `registry.npmjs.org` on 443 at public addresses
   only; the job then installs offline. Lanes are admitted concurrently, so a
   helper may be installing through the proxy while other lanes' jobs are
   already running candidate code: the separation is the network, not the
   timing.
6. The daemon is shared, so the agent never prunes and touches only
   `nabaperks-ci-`-prefixed resources. The pre-dispatch sweep and the canary
   sweep remove only resources that also carry its `com.nabaperks.local-ci.`
   labels, by inspected ID. The per-run proxy, prep and egress networks and
   the per-lane job, sidecar and network resources are removed by their
   deterministic agent-prefixed name, without a label check. Two agent
   processes against the same engine and the same SHA are not supported (one
   host, `agent.maxConcurrentJobs` 1): each would remove the other's per-run
   resources by name.
7. Everything in sections 7.1 to 7.4 is unchanged: fork code never runs,
   `hostSecrets` never enter a container, and the agent is never updated from
   pull-request code.

**The residual risk that was accepted.** A kernel exploit from an unprivileged
job container reaches the Docker Desktop VM, the directories it shares and the
other worktrees' containers on it. It does not reach the App private key or the
installation token through file sharing.

**Residual risk not covered by the 2026-09-28 acceptance.** Review of this
record on 2026-09-28 found two further things a kernel escape reaches, which
the owner was not shown when accepting. They need the owner's acceptance of the
corrected scope; until it is recorded here, do not load the agent on this
runtime.

- **The operator's forwarded SSH agent, and so their GitHub identity.** Docker
  Desktop for Mac forwards the Mac's SSH agent into its VM at
  `/run/host-services/ssh-auth.sock` (observed present on this Mac on
  2026-09-28; the canary's `/run/host-services` probe exists because the path
  is in the VM). Root in the VM can use every key the macOS `ssh-agent` holds
  to authenticate to `github.com` as the operator (`lapeninns` or
  `amanshresthaa`, with push and admin on `lapeninns/nabaperks` and the other
  repositories) - a more powerful identity than the App key item 1 protects.
- **The VM's own network is unrestricted.** Items 4 and 5 constrain container
  networks, not the VM: root in the VM reaches the internet and the Mac's
  loopback services through `host.docker.internal` or `192.168.65.254` (the
  2026-09-28 spike showed a plain bridge reaches them). Anything in the shared
  directories, such as a project tree's `.env.local`, can be sent out.
- **Docker Desktop's other host-service sockets** in the same directory
  (among them its backend, proxy and secrets-engine sockets, observed on
  2026-09-28) were not assessed. What an escape can do through them is
  unknown, so the statement that an escape cannot reach the App key rests on
  file sharing alone and is unproven against those services.

**Conditions.** The acceptance holds only while all of these are true;
revisit it with the owner if any changes:

- Docker Desktop's file sharing stays restricted as in item 1. The agent
  refuses every dispatch otherwise, so a reset to the defaults stops the plane
  rather than weakening it.
- Proposed, pending the owner's acceptance of the corrected scope: while the
  agent is loaded, the macOS `ssh-agent` holds no key that can authenticate to
  GitHub (`ssh-add -l` reports no identities), or every such key needs
  hardware confirmation for each use. The agent does not enforce this; it is
  an operator condition.
- Local results stay advisory: no local check joins a required context, and
  `LOCAL_CI_MODE` and the enforcement fields are not flipped.
- The repository stays public, because the helper fetches anonymously.
- Enhanced Container Isolation, or a return to a dedicated VM, is reconsidered
  before the local plane is proposed as merge authority.

---

## 8. The Docker Desktop runtime

`config/local-ci-contract.json` `runtime.kind: "docker-desktop"` selects it;
`ops/local-ci/agent/runtime-docker-desktop.mjs` implements it. Everything above
the VM layer - the App poller and publisher, the allowlist, the queue, the
attempts journal and outbox, the profiles and the job image - is unchanged.

### 8.1 Operator settings

Apply these in the Docker Desktop GUI before installing:

- Resources: CPUs 18; memory at least the contract's `runtime.memoryGb`
  (50 GiB: a 52 GiB setting reports about 50.9 GiB); swap 1 GiB; disk at least
  256 GiB.
- File sharing: replace the `/Users` default with an explicit list that
  excludes `~/.nabaperks-local-ci` and does not cover the whole home directory.
  The agent needs no share of its own; share only what other local stacks
  need.
- Start Docker Desktop when you sign in; turn off automatic update download and
  install, and Resource Saver, so the engine does not stop mid-run. Rosetta
  stays off.
- Stop the Lima VM first (`limactl stop -f nabaperks-ci`) and keep it: it is the
  rollback path, and the two together need more memory than the Mac has.

### 8.2 What happens on a dispatch

1. The loop asks the runtime before claiming a queued job. The verdict checks
   the agent's `DOCKER_CONFIG` has no credential, `docker info` (Docker
   Desktop, linux/aarch64, at least `runtime.minServerVersion`, the budget's
   CPUs and memory, seccomp), the file-sharing list, the labels of the state
   volume, and runs the negative canary. If any part fails, nothing is claimed
   and nothing is published; the log names the reason once, and the job starts
   when the runtime is healthy again. The same verdict runs again inside the
   dispatch, immediately before a workspace is prepared.
2. The resource sweep removes leftovers carrying the agent's labels and name
   prefix, by ID.
3. The helper prepares the run: the mirror clone and fetch through the proxy,
   the run's clone, and the run's own pnpm store seeded from the image.
4. Each admitted lane gets its own clone, then the helper's
   `pnpm install --frozen-lockfile --ignore-scripts --ignore-pnpmfile
--config.package-import-method=copy` on the run's prep network. The job
   container is created with its lane directory and the read-only store, is
   inspected, and starts with `pnpm install --offline --frozen-lockfile` and
   `pnpm rebuild --pending` before the lane's own commands.
5. Lanes are admitted longest first within the runtime budget less the live
   memory of containers the agent does not own. The in-progress check is
   updated as each lane finishes; the conclusion is published at the end.
6. The workspace is released: proxy and prep networks removed, no labelled
   container left, the run's directories and env files deleted. The state
   volume and its mirror clone persist between runs.

### 8.3 Install and verify

Install with the same `ops/local-ci/host/install.sh` from a clean checkout of
merged `main`. On this runtime it checks the `desktop-linux` engine and the
file-sharing rule, builds `nabaperks-ci-job:<sha>` on `desktop-linux` from the
verified revision when that image is absent, pins it, and writes
`/opt/nabaperks-local-ci/docker-config`. Verify with the dry run in section 7.5
before loading the agent, then read the first run's verdict and lane table in
`/opt/nabaperks-local-ci/logs/agent.out.log`.

### 8.4 Known local gaps on this runtime

- `db` and `db-stress` are hosted-only: their Docker-in-Docker sidecar would be
  privileged on the shared VM. The published check lists them under "Lanes left
  to the GitHub-hosted plane", and the shadow comparison records `db` as
  pinned-hosted, never as passed.
- The fast lane's `pnpm security:audit --ignore-registry-errors` cannot reach
  the registry from an internal network, so it passes without auditing. The
  hosted `fast` root is the dependency audit. The step still spends about 70
  seconds retrying first: job env files set `npm_config_fetch_retries=0`, which
  a pnpm command the lane runs directly honours, but pnpm 10.28.0's script
  runner re-exports that variable empty to the nested `pnpm audit`, which
  then uses its default two retries (observed in the 2026-09-28 dry runs).
- Build cache from image builds stays in Docker Desktop's builder; removing it
  would need a builder prune, which affects other projects and is never run by
  the agent.

### 8.5 Rollback

1. `launchctl bootout "gui/$(id -u)/com.nabaperks.local-ci"`.
2. Lower Docker Desktop's memory, then `limactl start nabaperks-ci`.
3. Either reinstall a release from before the switch with
   `ops/local-ci/host/install.sh --revision <sha> --job-image <the Lima image tag>`,
   or merge a pull request that sets `runtime.kind` to `lima` with the Lima
   `container` budget (10 CPUs, 32 GiB, `dockerInDocker: true`) and
   `agent.maxConcurrentLanes` back to 6, and install it. The contract refuses
   to load a Lima runtime whose container, daemon and VM reserve do not fit
   `vm`, so a pull request that flips only the kind fails CI.
4. Never run both runtimes' agents: `agent.maxConcurrentJobs` is 1 per host.

---

## Related documents

- `docs/operations/ci-redesign.md` — current phases, scope and remaining proof.
- `docs/operations/local-ci-cutover.md` — superseded historical proposal; its
  activation commands are not current operating instructions.
- `ops/local-ci/README.md` — the agent's own inventory, schemas and module map.
- `ops/local-ci/host/README.md` — VM image refresh and the Docker Engine
  version ledger.
- `docs/operations/incident-response.md` — severity, escalation, and the
  integrity-finding path referenced in section 6.4.
- `docs/operations/production-runbook.md` — release entry criteria and the
  production promotion path this merge lane ultimately feeds.
- `docs/operations/devops-maturity.md` — its
  [ARM64 hosted-pinning decisions](devops-maturity.md#arm64-hosted-pinning-decisions)
  section is where the section 4.6 pins are recorded.

## Durable controller and bounded execution redesign

The later redesign source introduces a host-owned `attempts.json` and
`controller.lock` beneath the configured state root. These are separate from
candidate workspaces. Watch, one-shot and nightly execution acquire the same
controller lease before accessing the journal. PID plus process-start identity
prevents treating a reused PID as the former owner. An unreadable, malformed or
unverifiable lease fails closed; inspect the owner and retained evidence
before any manual repair. Never kill another controller merely to acquire it.

Attempts are persisted using atomic replacement and file/directory fsync before
work starts. Restart converts a running attempt to interrupted. The default
policy permits at most two attempts and a one-minute backoff for infrastructure
outcomes; a test failure is not automatically retried into success. Nightly
scopes include the daily identity. No-publish fixture runs still use durable
attempts but do not enqueue an App result. Journal corruption or persistence
failure stops admission.

Completion publication uses a durable outbox. Before creating an App check,
the publisher persists intent and a stable attempt identity. A lost creation
response is reconciled against exact App, check name, head SHA and attempt
`external_id`, then continued by immutable check ID. It does not blindly
repeat the POST. If no matching provider result can be established, the entry
remains pending; inspect provider evidence and reconcile with the operational
owner. Deleting the journal or inventing a replacement successful result is
not recovery. On shutdown, delayed publication callbacks cannot dispatch more
work or write the released controller's journal.

On the Docker Desktop runtime the resource contract caps simultaneous
unprivileged jobs at 16 CPUs/40 GiB inside the 18 CPU/50 GiB Desktop budget,
keeps 2 CPUs/4 GiB for Desktop's own VM, and subtracts the live memory of other
containers on the daemon (never less than 6 GiB) before each admission. On the
Lima rollback runtime it is 10 CPUs/32 GiB, each Docker sidecar needs
1 CPU/6 GiB, and admission preserves at least 1 CPU/2 GiB for the
12 CPU/40 GiB VM. The scheduler admits up to eight lanes, longest first, only
when all resource and concurrency-group budgets fit. Every lane has its own
checkout, Git metadata, dependencies and generated output.
Both containers disable additional swap. The runner rejects overcommitted or
malformed budgets before admission. The sidecar's privileges remain inside the
VM; this is not evidence of a disposable VM or qualification for authoritative
untrusted execution. Browser projects can overlap in separate containers; each project retains
its 32 sequential shards and one Playwright worker. Browser V8 old space is
capped at 4096 MiB within their 8 GiB containers. The fast lane explicitly caps Node test
processes at four; hosted Node tests retain their existing default.

The [verified image cache](local-ci-image-cache.md) avoids repeated registry
downloads while validating archive, manifest and loaded image identity before
repository commands. Timeout and cancellation also bound preload. Installation
and host activation still require coordinated operational ownership and the
reviewed immutable revision. Source changes never repoint the installed agent
or resume a paused watcher.

See the [completion evidence](ci-redesign-completion.md) for actual fixture
results, installed revision, full-main/nightly gaps and provider prerequisites.
A successful filtered database or browser lane is not a full profile or an
exact-commit App qualification.

### Installed source and image drift

Run `pnpm ops:ci:installed-revision -- --json` after fetching canonical main.
The checker compares the selected reference with a fresh read of GitHub main,
validates the resolved release directory and installed entrypoint files, then
compares the root-owned `job-image` pin's declared build revision with the
current image build inputs. Missing release files, stale references and
unattributable image pins fail closed; changed image inputs return
`image-source-drift`. The image comparison covers source compatibility only:
it does not attest the binary image contents or prove runtime qualification.
The check never installs a release, rebuilds an image or restarts a service.
