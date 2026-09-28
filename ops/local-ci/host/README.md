# Local CI host provisioning

This directory holds everything that lives **outside** a container: the macOS
launchd service, the installer that wires it together, and the definition of
the dormant Lima VM. The agent code it installs lives in `ops/local-ci/`; the
disposable job image it runs lives in `ops/local-ci/image/Dockerfile`.

The agent dispatches into the runtime `config/local-ci-contract.json` selects
with `runtime.kind`. Since 2026-09-28 that is **`docker-desktop`**: the
operator's Docker Desktop engine, addressed only as
`docker --context desktop-linux` (see
[the Docker Desktop runtime](#the-docker-desktop-runtime) below and section 7
and 8 of `docs/operations/local-ci.md`). The **`lima`** runtime - the dedicated
`nabaperks-ci` VM described in the rest of this file - is kept stopped as the
rollback path, not retired (#297). Do not run both at full size: together they
need more memory than the Mac has.

Nothing here runs in GitHub Actions. These are operator artifacts for one
specific Apple silicon Mac.

## Files

| File                           | What it is                                                                             |
| ------------------------------ | -------------------------------------------------------------------------------------- |
| `lima-nabaperks-ci.yaml`       | Lima template for the isolated Ubuntu 24.04 ARM64 build VM.                            |
| `com.nabaperks.local-ci.plist` | macOS LaunchAgent that starts the CI agent at login and keeps it alive.                |
| `install.sh`                   | Idempotent installer. Verifies the checkout, places credentials, installs the service. |
| `uninstall.sh`                 | Idempotent uninstaller. Removes only OS registrations unless told otherwise.           |
| `../image/Dockerfile`          | The disposable per-job container image.                                                |
| `../image/build-pins.env`      | Reviewed k6 and Supabase CLI build arguments `install.sh` passes to the image build.   |

## Host layout after installation

```
/opt/nabaperks-local-ci/            root:wheel 0755   reviewed code only
├── releases/<sha>/                 root:wheel 0755   `git archive` of a merged commit
│   └── ops/local-ci/agent/main.mjs
├── current -> releases/<sha>       root:wheel        atomically repointed symlink
├── job-image                       root:wheel 0644   the pinned job image tag
├── docker-config/                  root:wheel 0755   docker-desktop only: the agent's DOCKER_CONFIG
│   ├── config.json                                   `{}` - no credsStore, no auths
│   └── contexts/                                     the desktop-linux context
└── logs/                           <operator>:staff 0750
    ├── agent.out.log
    └── agent.err.log

~/Library/LaunchAgents/
└── com.nabaperks.local-ci.plist    <operator> 0644   byte-identical to the committed file

~/.nabaperks-local-ci/              <operator> 0700   NEVER in git, NEVER in the VM
├── github-app-private-key.pem      <operator> 0600
└── uptimerobot-heartbeat-url       <operator> 0600 (optional legacy provider)

~/.lima/nabaperks-ci/               the Lima VM (rollback runtime): 12 vCPU, 40 GiB RAM, 150 GiB disk

Docker Desktop (desktop-linux)      the docker-desktop runtime
├── volume nabaperks-ci-state       the mirror clone, per-run clones and pnpm stores
└── image nabaperks-ci-job:<sha>    built by install.sh from the installed revision
```

`/etc/newsyslog.d/com.nabaperks.local-ci.conf` rotates both logs once they
reach 10 MB, keeping 7 bzip2-compressed generations.

The installer accepts ordinary clones and linked Git worktrees. It normalises
reviewed release permissions on every run: directories and executable files
are `0755`, other files are `0644`, and the macOS `current` symlink is `0755`.
Credentials remain `0600` inside their separate `0700` directory. This repairs
older installations where the credential-stage `umask 077` left public code
unreadable by the operator. Operator access is checked before launchd starts;
registration alone is still not proof of a live heartbeat or a successful job.
The agent resolves its invocation path through `current` before deciding whether
to run its CLI; invoking the installed path with `--help` must print usage.

## Trust boundary

This section describes the Lima runtime. The Docker Desktop runtime keeps the
same four host-side properties with different mechanisms, listed under
[the Docker Desktop runtime](#the-docker-desktop-runtime).

The GitHub App private key can mint installation tokens for the repository, and
an optional monitoring heartbeat URL can silence the agent-liveness alarm. Both are
**host-only secrets**. Four independent barriers keep them away from job code,
and none of them is a policy statement — each is a mechanism you can observe.

1. **The VM cannot see the Mac's filesystem.** `lima-nabaperks-ci.yaml`
   declares `mounts: []`. There is no host directory to traverse, so
   `~/.nabaperks-local-ci` is not merely protected inside the guest — it does
   not exist there. `install.sh` refuses to run if that line ever changes, and
   re-checks the live instance's own `~/.lima/nabaperks-ci/lima.yaml`.
2. **The VM has no host agent credentials.** `ssh.forwardAgent: false` and
   `ssh.loadDotSSHPubKeys: false`. No `SSH_AUTH_SOCK` is forwarded and none of
   the operator's personal public keys are installed in the guest.

   Barriers 1 and 2 are **re-derived immediately before every dispatch**, not
   trusted from the day the VM was installed. An instance can be stopped and
   edited, recreated, or handed a mount at run time, and one installed with
   `--skip-vm-check` was never checked at all — so the agent asks the live
   instance (`limactl list --json`) and the live guest (`findmnt`, `/Users`,
   `SSH_AUTH_SOCK`, `/mnt/lima-rosetta`) each time, and refuses to materialise
   any commit inside a VM whose answers have changed. A probe it cannot run at
   all refuses too: a dispatch that proceeds because the check could not be
   made has no isolation guarantee at all.

3. **The job container cannot become root on the VM.** The image installs the
   Docker _CLI_ only and pins `DOCKER_HOST` to a sibling `docker:dind`
   container over TCP. The daemon socket is never bind-mounted; doing so would
   be equivalent to handing the job root on the VM.
4. **Credentials cannot be placed somewhere weaker.** `install.sh` refuses to
   run if the credential directory is outside `$HOME`, inside the repository
   working tree, inside the world-readable install root, under `/tmp`,
   `/var/tmp`, `/Volumes`, `/Users/Shared`, `/Library` or `/System`, on any
   mounted volume other than the boot volume, or beneath a world-writable
   ancestor directory. Every path is canonicalised first — symlinks in the
   final component included — so a credential directory that is itself a
   symlink into the repository or onto a mounted volume is refused on what it
   points at, not on what it looks like. It then forces `0700` on the directory
   and `0600` on both files and verifies the result with `stat`.

Two more properties follow from the same file:

- **Inbound traffic is blocked.** Lima uses user-mode NAT with `networks: []`,
  and `portForwards` ignores the entire `1-65535` range so Lima never publishes
  a guest port on the Mac. Inside the guest, provisioning step 1 runs
  `ufw default deny incoming` and allows exactly one thing: TCP/22 from the
  host-side NAT gateway address, discovered at boot from the default route.
  Provisioning step 2 adds a `DOCKER-USER` conntrack `DROP` on the external
  interface, installed as a systemd unit, because Docker's own iptables rules
  run ahead of ufw's and would otherwise expose any published container port.
- **The guest is native ARM64 only.** `rosetta.enabled: false`. This matters
  for snapshots: Playwright encodes only `process.platform` in the `{platform}`
  token, so a Linux ARM64 run and a Linux x64 run produce the _same_ snapshot
  filename with different pixels. Local runs therefore must never write or
  compare visual snapshots.

## The sleep contract

The requirement is that the Mac stays awake **while a CI job is running** and
sleeps normally at every other moment.

**launchd cannot express that.** A plist can start a process; it cannot hold a
power assertion for part of that process's life. Anything the plist did — for
example wrapping `ProgramArguments` in `caffeinate` — would keep the machine
awake for the agent's entire lifetime, which is always.

So the plist deliberately does **not** wrap the agent, and the assertion lives
in the agent instead. The contract between the two halves is:

| Half      | Obligation                                                                                                                                    |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| The plist | Starts `local-ci-agent.mjs` with **no** power assertion. An idle agent holds none, and the Mac sleeps normally.                               |
| The agent | On claiming a job, forks the job runner, then spawns `/usr/bin/caffeinate -i -m -w <job-runner-pid>` as a sibling. On job end, nothing to do. |

`-i` prevents idle system sleep, `-m` prevents disk sleep, and `-w <pid>` makes
`caffeinate` exit when that pid exits. Binding the assertion to the _job
runner's_ pid rather than the agent's is what makes it job-scoped, and it means
the assertion is released when the job finishes, when the job is cancelled, and
even when the agent itself crashes. No code path leaks a permanent assertion.

The macOS persistent power-management settings CLI is forbidden anywhere under
`ops/`: it mutates global system state that survives the agent, whereas
`caffeinate` takes a scoped, self-releasing assertion. A contract test asserts
both halves: the presence of `caffeinate -i -m -w` in the agent source, and the
absence of any call to that CLI.

Observe a live assertion with `pgrep -fl caffeinate`. It prints the flags and
the job-runner pid the assertion is bound to, so you can confirm it is
job-scoped rather than agent-scoped.

## Interface contract with the agent

These names are fixed by the files in this directory. Changing one means
changing both sides in the same commit.

| Name                                                                          | Fixed by                              |
| ----------------------------------------------------------------------------- | ------------------------------------- |
| Launchd label `com.nabaperks.local-ci`                                        | plist `Label`, and the plist filename |
| Agent entrypoint `ops/local-ci/agent/main.mjs`                                | plist `ProgramArguments[0]`           |
| Install root `/opt/nabaperks-local-ci/current`                                | plist, `install.sh`                   |
| Credential dir `~/.nabaperks-local-ci` (override: `$NABAPERKS_LOCAL_CI_HOME`) | `install.sh`                          |
| Key file `github-app-private-key.pem`                                         | `install.sh`                          |
| Heartbeat file `uptimerobot-heartbeat-url`                                    | `install.sh`                          |
| Lima instance name `nabaperks-ci`                                             | `install.sh`, `uninstall.sh`          |
| Log paths `/opt/nabaperks-local-ci/logs/agent.{out,err}.log`                  | plist, `install.sh`                   |
| Job image pin `/opt/nabaperks-local-ci/job-image`                             | plist, `install.sh`, `main.mjs`       |
| Agent `DOCKER_CONFIG` `/opt/nabaperks-local-ci/docker-config`                 | plist, `install.sh`, contract         |
| Docker CLI `/usr/local/bin/docker`, context `desktop-linux`                   | contract, adapter, `install.sh`       |

`install.sh` fails loudly if the agent entrypoint is missing from the commit it
is installing, so a rename cannot ship half-applied. It refuses just as loudly
if the plist's `LOCAL_CI_JOB_IMAGE_FILE` does not name the path it writes the
pinned tag to: the agent will not start without a pinned image, and a
LaunchAgent that cannot start is a `KeepAlive` crash loop, not a poller.

The plist sets `NABAPERKS_LOCAL_CI_INSTALL_ROOT` but deliberately does **not**
set `NABAPERKS_LOCAL_CI_HOME`: hard-coding an operator's home directory would
break the invariant that the committed and installed plists are byte-identical.
The agent resolves the credential directory from `$HOME`, which launchd
provides to a gui-domain LaunchAgent.

## Operator runbook

Everything below is a host action. None of it can be performed from inside the
repository, which is why it is written down rather than automated.

### 0. One-time macOS preparation

The agent is a LaunchAgent, not a LaunchDaemon, because `limactl` with
`vmType: vz` needs a logged-in Aqua session to hold the
Virtualization.framework VM. That has a consequence worth stating plainly
rather than hiding: **the Mac must auto-login to the operator account after a
reboot**, or the agent will not start until someone logs in.

- System Settings > Users & Groups > Automatic login: the operator account.
- FileVault, if enabled, blocks automatic login until the disk is unlocked at
  the login screen. A machine that reboots unattended with FileVault on will
  sit at the unlock prompt with no agent running. Decide which of the two you
  want; do not assume you have both.
- Leave "Prevent automatic sleeping when the display is off" **off**. The
  agent's job-scoped `caffeinate` is the only sleep control in this design.

### 1. Install the host tooling

```sh
brew install lima docker   # `docker` here is the CLI only, for troubleshooting
limactl --version
```

### 2. Create the VM

```sh
cd /path/to/nabaperks
limactl create --name=nabaperks-ci ops/local-ci/host/lima-nabaperks-ci.yaml
limactl start nabaperks-ci
```

After the first successful boot, stop and start the instance once so the SSH
session picks up the guest user's newly granted Docker group membership:

```sh
limactl stop --tty=false nabaperks-ci
limactl start --tty=false nabaperks-ci
limactl shell nabaperks-ci -- docker info
```

Then confirm the isolation properties actually took effect in the running
instance, not just in the template:

```sh
limactl shell nabaperks-ci -- sudo ufw status verbose
limactl shell nabaperks-ci -- sudo iptables -S DOCKER-USER
limactl shell nabaperks-ci -- docker info --format '{{.ServerVersion}}'
limactl shell nabaperks-ci -- ls /Users 2>&1   # must fail: there are no mounts
grep -n 'mounts:' ~/.lima/nabaperks-ci/lima.yaml
```

### 3. Record the pins and build the job image

The image build needs three values that the repository cannot supply: the k6
version (nightly.yml floats it) and the two download digests. Compute them,
record them in the ledger below in the same commit, then build.

```sh
limactl shell nabaperks-ci

K6_VERSION=<the version you are qualifying>
curl -fsSLO "https://github.com/grafana/k6/releases/download/v${K6_VERSION}/k6-v${K6_VERSION}-linux-arm64.tar.gz"
sha256sum "k6-v${K6_VERSION}-linux-arm64.tar.gz"

curl -fsSLO "https://github.com/supabase/cli/releases/download/v2.106.0/supabase_2.106.0_linux_arm64.deb"
sha256sum supabase_2.106.0_linux_arm64.deb
```

Clone a verified `main` inside the VM and build from the repository root, which
is the Docker build context (the image reads `.nvmrc` from it):

```sh
git clone https://github.com/lapeninns/nabaperks.git /var/lib/nabaperks-ci/repo
cd /var/lib/nabaperks-ci/repo
docker build -f ops/local-ci/image/Dockerfile -t "nabaperks-ci-job:$(git rev-parse HEAD)" \
  --build-arg "K6_VERSION=${K6_VERSION}" \
  --build-arg "K6_SHA256=<digest from above>" \
  --build-arg "SUPABASE_CLI_SHA256=<digest from above>" \
  .
```

The build fails on purpose if either digest is absent. An unverified download
must not silently succeed.

Note the tag: `nabaperks-ci-job:<the commit it was built from>`. That is the
value `install.sh` pins in step 6, and the agent refuses a floating tag such as
`latest` — a tag that can be repointed lets a rebuild change what executes
without changing anything reviewable.

### 4. Create the GitHub App and its private key

Not automatable from here: the App is created in GitHub's UI, and the private
key is downloadable exactly once.

1. Create the App against the `lapeninns` account, install it on
   `lapeninns/nabaperks` only, and grant Checks: read and write, Contents:
   read, Actions: read and write, Metadata: read.
2. Generate a private key. The `.pem` downloads to `~/Downloads`.
3. Record the numeric `appId` and the installation's `repositoryId` in
   `config/local-ci-contract.json` in a normal reviewed pull request. They are
   identifiers, not secrets.

### 5. Configure the GitHub watchdog

The operator selected GitHub Actions monitoring on 2026-09-05. No UptimeRobot
or Healthchecks account, ping URL, API key or paid subscription is needed.
The merged contract selects `agentLiveness.provider: github-check`; the agent
uses its existing App credential to publish a separate heartbeat check every
five minutes. The installer reads this setting from the selected merged
revision, including on rollback, and requires an external URL only for older
revisions using the HTTPS provider. The legacy URL filename remains supported.

Follow [the watchdog runbook](../../../docs/operations/local-ci-watchdog.md)
after installation. Leave `LOCAL_CI_WATCHDOG_ENABLED` unset until a real agent
heartbeat is visible and notification delivery can be rehearsed. The scheduled
monitor opens one assigned incident on evidence older than 20 minutes (five-minute cadence plus
15-minute grace). This is a detection threshold, not an alert-delivery deadline:
GitHub can delay or drop scheduled jobs, and GitHub outages affect both sides.
Repeated failures leave the incident unchanged; recovery closes it. Read the
workflow summary and incident state, since a successful delivery job does not
mean the monitored targets are healthy.

### 6. Install the agent

`install.sh` refuses anything that is not a reviewed, merged commit, so check
out `main` first.

```sh
cd /path/to/nabaperks
git checkout main && git pull --ff-only
ops/local-ci/host/install.sh \
  --github-app-key ~/Downloads/<app>.private-key.pem \
  --job-image "nabaperks-ci-job:<the sha you built the image from>"
```

`--job-image` is needed once. The tag is written to
`/opt/nabaperks-local-ci/job-image` (root-owned, `0644`) and kept across
re-runs, and the installer derives it by itself when the VM is running and
holds exactly one `nabaperks-ci-job` image. It also proves the image exists
inside the VM before registering the service, because the alternative is
finding out at first dispatch, when every lane fails at once.

`--revision <sha>` installs a specific merged commit instead of `HEAD`, which
is how a rollback works without moving the working tree.

After verifying the installed key, remove its original:

```sh
rm ~/Downloads/<app>.private-key.pem
```

Expected refusals, all of which are correct behaviour:

| Message                                          | Cause                                                                        |
| ------------------------------------------------ | ---------------------------------------------------------------------------- |
| `refusing to run as root`                        | Run as the operator. Privileged steps escalate individually.                 |
| `the working tree is dirty`                      | Uncommitted or untracked files. The bytes were never reviewed.               |
| `HEAD (...) is not an ancestor of origin/main`   | You are on a feature branch. Pull-request code never becomes the agent.      |
| `origin is '...', expected '...'`                | Wrong remote.                                                                |
| `refusing to keep credentials ...`               | The credential directory is in a location a job or another user could reach. |
| `instance nabaperks-ci declares host mounts`     | The VM was created from something other than the committed template.         |
| `no job image is pinned ...`                     | Pass `--job-image`, or start the VM so the tag can be derived.               |
| `image '...' does not exist inside ...`          | Build the job image first (section 3).                                       |
| `the plist does not set LOCAL_CI_JOB_IMAGE_FILE` | The plist and the installer drifted apart; fix both in one commit.           |
| `Docker Desktop uses its default file sharing`   | Restrict Docker Desktop's file sharing first (see below).                    |
| `the desktop-linux engine does not meet ...`     | Raise Docker Desktop's CPU or memory to the contract's `runtime` budget.     |

### 7. Verify

```sh
launchctl print "gui/$(id -u)/com.nabaperks.local-ci" | head -20
tail -f /opt/nabaperks-local-ci/logs/agent.err.log
pgrep -fl caffeinate                        # empty when idle, present during a job
ls -le ~/.nabaperks-local-ci                # both files 0600, directory 0700
readlink /opt/nabaperks-local-ci/current    # the installed release sha
cat /opt/nabaperks-local-ci/job-image       # the pinned job image tag
```

There is **one** launchd job. The nightly proof
(`Nabaperks Local CI (nightly)`) is published by this same agent, which asks
every 15 minutes whether the last nightly run is older than the 24-hour cadence
and produces one when it is. A `StartCalendarInterval` job would silently skip
a window the Mac was powered off for, which is the failure the freshness
monitor exists to catch; asking a cheap local question on a short interval
turns every missed window into a late run instead. See the header comment in
`com.nabaperks.local-ci.plist`.

```sh
# ask the question without running anything
node /opt/nabaperks-local-ci/current/ops/local-ci/agent/main.mjs --nightly --dry-run
```

## The Docker Desktop runtime

Selected by `runtime.kind: "docker-desktop"`. The agent's own code for it is
`ops/local-ci/agent/runtime-docker-desktop.mjs`.

### What keeps the host secrets away from job code here

Docker Desktop's VM is shared with other worktrees' containers and sees the
directories in Docker Desktop's file-sharing list. The owner accepted that
weaker isolation on 2026-09-28; `docs/operations/local-ci.md` section 7.6
records the residual risk, including two paths found afterwards - the
forwarded SSH agent in the VM and the VM's unrestricted network - that still
need the owner's acceptance before the agent is loaded. The barriers that replace Lima's are, again,
mechanisms rather than policy, and the agent re-checks them before every
dispatch, refusing on any failure:

1. **The credential directory is not shared with the VM.** Docker Desktop's
   `FilesharingDirectories` must be an explicit list, and no entry may cover
   `~/.nabaperks-local-ci` or the whole home directory, compared both as
   written and where each path physically lives (symlinks and the
   `/System/Volumes/Data` firmlink resolved). The default list includes
   `/Users`, so a fresh Docker Desktop fails this until the operator restricts
   it.
2. **No container is given a Mac path, a daemon or privilege.** Workspaces
   live in the `nabaperks-ci-state` named volume; a job mounts only its own
   lane directory through `volume-subpath` and its run's pnpm store read-only.
   Bind mounts, `--privileged`, added capabilities and host devices are refused
   when the argv is built, and every job container is inspected after it is
   created and before it starts. No Docker-in-Docker sidecar runs: `db` and
   `db-stress` are hosted-only here.
3. **A job cannot reach the Mac or the network.** Job networks are
   `--internal` networks from `10.213.0.0/16`: no gateway, no
   `host.docker.internal`, no internet. A negative canary proves it before
   every dispatch against a one-shot listener on the Mac's `127.0.0.1`. Only
   the trusted helper, which clones and installs with scripts and pnpmfile
   hooks off, has egress, through an allowlist proxy to `github.com`,
   `codeload.github.com` and `registry.npmjs.org` on 443.
4. **The CLI cannot be redirected or handed a credential.** Every command is
   `/usr/local/bin/docker --context desktop-linux`, with `DOCKER_CONFIG` at
   `/opt/nabaperks-local-ci/docker-config`, whose `config.json` has no
   credential store and no logins.

### One-time Docker Desktop settings (operator, GUI)

- Resources: CPUs 18, Memory at least the contract's `runtime.memoryGb` (50
  GiB; Docker Desktop reports about 50.9 GiB of a 52 GiB setting), Swap 1 GiB,
  disk at least 256 GiB.
- File sharing: remove the `/Users` default and share only what other local
  stacks need; never `~/.nabaperks-local-ci` and never the whole home
  directory. The agent's own workspaces need no file share at all.
- General: start Docker Desktop when you sign in. Software updates: turn off
  automatic download and install, so the engine does not restart mid-run.
  Resource Saver off. Rosetta stays off.
- Stop the Lima VM before raising Docker Desktop's memory:
  `limactl stop -f nabaperks-ci`. Keep the instance; it is the rollback path.

### Install

The same `install.sh`, from a clean checkout of merged `main`:

```sh
ops/local-ci/host/install.sh --github-app-key ~/Downloads/<app>.private-key.pem
```

For the docker-desktop runtime it additionally checks the `desktop-linux`
engine against the contract's `runtime` block and the file-sharing rule above,
builds `nabaperks-ci-job:<sha>` on `desktop-linux` from the verified revision
with the reviewed arguments in `ops/local-ci/image/build-pins.env` (when that
image is not already there), pins it, and writes the agent's `DOCKER_CONFIG`
directory. Then verify:

```sh
DOCKER_CONFIG=/opt/nabaperks-local-ci/docker-config   node /opt/nabaperks-local-ci/current/ops/local-ci/agent/main.mjs   --profile main --sha "$(git rev-parse origin/main)" --dry-run
tail -f /opt/nabaperks-local-ci/logs/agent.err.log
```

The dry run prints the isolation verdict - engine, file sharing, state volume
and canary - and dispatches nothing.

### Rollback to Lima

1. `launchctl bootout "gui/$(id -u)/com.nabaperks.local-ci"`.
2. Lower Docker Desktop's memory, then `limactl start nabaperks-ci`.
3. Either reinstall a release from before the switch
   (`install.sh --revision <sha> --job-image <lima image tag>`), or merge a
   pull request that sets `runtime.kind` to `lima` with the Lima `container`
   budget (10 CPUs, 32 GiB, `dockerInDocker: true`) and
   `agent.maxConcurrentLanes` 6, and reinstall it. A Lima runtime that does not
   fit `vm` is refused when the contract loads.

## Pin ledger

Every pin in the image and the VM template, with the command that refreshes it.
When a pin goes stale the build fails with
`Version '<x>' for '<pkg>' was not found` — that is a stale pin, not a broken
Dockerfile.

| Pin                      | Value                                                              | Source of truth / refresh command                                                          |
| ------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Node major               | `24`                                                               | `.nvmrc`; the image verifies its own Node major against it                                 |
| `NODE_PKG_VERSION`       | `24.11.0-1nodesource1`                                             | `apt-cache madison nodejs` with the NodeSource repo enabled                                |
| pnpm                     | `10.28.0`                                                          | `package.json` `packageManager`                                                            |
| Playwright               | `1.62.1`                                                           | `@playwright/test` as resolved in `pnpm-lock.yaml`                                         |
| Supabase CLI             | `2.106.0`                                                          | `supabase/setup-cli` `version` input in `ci.yml`                                           |
| Supabase CLI digest      | `a004217bc9e146e6aede8f7f26138fbd94cfdffa5ed4c6b9983bc8b804e5c928` | `sha256sum supabase_2.106.0_linux_arm64.deb`                                               |
| Docker Engine / CLI      | `5:27.5.1-1~ubuntu.24.04~noble`                                    | `apt-cache madison docker-ce` with the Docker repo enabled                                 |
| k6 version               | `2.2.0`                                                            | `../image/build-pins.env`; `nightly.yml` uses `grafana/setup-k6-action@v1` with no version |
| k6 digest                | `4ecd64cadcc792402d16293836115480419c4447c032858f564852d98f1bf54c` | `sha256sum k6-v<version>-linux-arm64.tar.gz`                                               |
| `opencv-python-headless` | `4.10.0.84`                                                        | matches the package `ci.yml` installs for `posters:verify-pdfs`                            |
| `pymupdf`                | `1.24.10`                                                          | as above                                                                                   |
| apt package versions     | `ARG APT_*` in the Dockerfile                                      | `apt-cache madison <pkg>` inside an `ubuntu:24.04` container                               |
| Ubuntu cloud image       | rolling `releases/24.04/release/`                                  | pin to a dated build plus its `SHA256SUMS` digest when you qualify one                     |

### Supabase image registry parity

The `db` lanes in all three profiles and nightly `db-stress` declare
`SUPABASE_INTERNAL_IMAGE_REGISTRY=ghcr.io`. This matches the environment
exported by the [pinned hosted setup action](https://github.com/supabase/setup-cli/blob/46f7f98c7f948ad727d22c1e67fab04c223a0520/src/main.ts).
Installing the CLI binary alone does not reproduce that action's environment.
Without the value, local database setup uses the default registry; qualification
recorded rate-limit responses and interrupted downloads that exhausted its
25-minute lane timeout before assertions could run.

The registry setting changes neither service versions nor test coverage. Each
lane retains a fresh, disposable Docker daemon and the same timeout. Registry
credentials and host overrides are not forwarded. A change to these profiles
takes effect only after the reviewed revision merges and the operator installs
it from main; a PR cannot update the running agent's profiles.

### Ubuntu package refresh — 2026-09-28

The 2026-09-28 Docker Desktop spike could not build the image from `main`:
`E: Version '8.5.0-2ubuntu10.13' for 'curl' was not found`. The archive
candidate was `8.5.0-2ubuntu10.15`, and a build with that value (and every
other pin unchanged) succeeded on `desktop-linux` the same day, so
`APT_CURL` is now `8.5.0-2ubuntu10.15`.

### Ubuntu package refresh — 2026-09-05

The first real image build failed because the archived versions of curl, Git,
xz-utils, Poppler and python3-venv were absent. Querying `apt-cache policy`
inside the ARM64 `ubuntu:24.04` image returned the versions below. The refreshed
pins also keep GnuPG, jq and CA certificates on the current archive candidates.

| Argument              | Verified archive candidate     |
| --------------------- | ------------------------------ |
| `APT_CA_CERTIFICATES` | `20260601~24.04.1`             |
| `APT_CURL`            | `8.5.0-2ubuntu10.13`           |
| `APT_GIT`             | `1:2.43.0-1ubuntu7.3`          |
| `APT_GNUPG`           | `2.4.4-2ubuntu17.6`            |
| `APT_JQ`              | `1.7.1-3ubuntu0.24.04.2`       |
| `APT_UNZIP`           | `6.0-28ubuntu4.1`              |
| `APT_XZ_UTILS`        | `5.6.1+really5.4.5-1ubuntu0.3` |
| `APT_POPPLER_UTILS`   | `24.02.0-1ubuntu9.9`           |
| `APT_IMAGEMAGICK`     | `8:6.9.12.98+dfsg1-5.2build2`  |
| `APT_PYTHON3_VENV`    | `3.12.3-0ubuntu2.1`            |

The Ubuntu image used for this inspection resolved to
`sha256:33ceb71981b602c1a7443a53469e4dba065f7503eab3078a2d7a57a2ab987517`.
Package availability is verified; full image and job qualification are separate.

### Preserve the pnpm pin across users and cache cleanup

The initial image build activated pnpm 10.28.0 under root, then removed
`/root/.cache` after `pnpm fetch`. The final unprivileged user selected pnpm
11.25.0 outside a project, so a successful build did not prove the declared
package-manager pin survived.

`COREPACK_HOME=/opt/corepack` now keeps the prepared manager in a persistent,
container-local cache shared by the build and runtime users.
`COREPACK_DEFAULT_TO_LATEST=0` prevents implicit latest-version selection; see
[Corepack's documented environment variables](https://github.com/nodejs/corepack#environment-variables).
The build asserts the version again after switching to `runner`. Qualification
also runs `pnpm --version` without network access both in an empty workspace and
in the merged project's directory, checking for 10.28.0 in each case.

### Why the Python dependencies need a virtualenv

`ci.yml` installs the print-kit tooling on the hosted runner with
`python3 -m pip install --quiet opencv-python-headless pymupdf`. That exact
command **fails** on Ubuntu 24.04, which marks the system interpreter
externally managed under PEP 668:

```
error: externally-managed-environment
```

The image therefore creates `/opt/print-kit-venv`, installs the two wheels into
it, and puts the venv first on `PATH` so `python3` resolves to it with no
change at any call site. `--break-system-packages` is not used: it lets a wheel
overwrite apt-managed `site-packages` and turns the image into something apt
can no longer reason about.

## Day-to-day operations

```sh
# restart the agent
launchctl kickstart -k "gui/$(id -u)/com.nabaperks.local-ci"

# upgrade to a newer merged commit (re-run the installer; it is idempotent)
git -C /path/to/nabaperks checkout main && git -C /path/to/nabaperks pull --ff-only
/path/to/nabaperks/ops/local-ci/host/install.sh

# roll back to a previous release
/path/to/nabaperks/ops/local-ci/host/install.sh --revision <older-sha>

# repoint the job image after rebuilding it
/path/to/nabaperks/ops/local-ci/host/install.sh --job-image nabaperks-ci-job:<sha>

# remove the service, keep the VM, the releases and the credentials
ops/local-ci/host/uninstall.sh

# remove everything, including the VM and the credentials
ops/local-ci/host/uninstall.sh --purge --remove-vm --purge-credentials
```

The installer keeps the five most recent releases, so a rollback is a symlink
swap rather than a rebuild.

## What is not proven from inside the repository

These are qualification gates for the operator, not assertions the test suite
can make. Each has to be checked once on the real machine.

1. **Supabase 2.106.0 stack images publish `linux/arm64` manifests**, in
   particular Logflare and Vector for the `[analytics]` block that
   `supabase/config.toml` enables, and Studio. If any of them is amd64-only,
   `supabase start` fails inside the VM and the database tier stays on the
   hosted plane. Do not disable analytics in `supabase/config.toml` to work
   around it: `production-database.yml` reads the same file.
2. **`supabase start` propagates container options through the nested daemon.**
   The dind topology is one more layer than the hosted runner has.
3. **Playwright WebKit runs on ARM64 Ubuntu 24.04** for the browser tiers the
   local profiles claim to cover.
4. **The apt and pip pins above still resolve** on the day you build. They were
   transcribed from the noble archive at authoring time and the archive moves.
5. **The Ubuntu cloud image digest**, once you pin one, matches the
   `SHA256SUMS` file published beside it.
6. **Automatic login actually survives a reboot** on this machine, with
   whatever FileVault setting you chose in step 0.

Record the outcome of each in the cutover runbook when you qualify it.

## Disposable checkout and idle liveness

The VM retains a public repository cache. Each job receives a standalone clone
with its own `.git` directory, full history and no object hardlinks or alternates
back to that cache. This keeps Git inspection valid when the checkout is mounted
at `/workspace` and prevents job code from modifying cached objects through shared
files. Preparation also upgrades a shallow cache and fetches the requested commit.
Snapshot inspection errors fail the lane instead of being treated as a clean diff.
The polling and nightly timers keep Node alive while idle; neither holds a Mac
power assertion while waiting.

The browser lanes set a 4096 MiB V8 old space through
`PLAYWRIGHT_NODE_HEAP_MB` inside each lane's 8 GiB cgroup. Hosted shards retain
their 8 GiB default. The override accepts only bounded integer values
(1–16 GiB); it cannot add shell arguments.
