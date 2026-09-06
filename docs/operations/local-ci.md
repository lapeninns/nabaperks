# Nabaperks local CI execution plane — operator runbook

Owner: Lapen Inns product operations
Repository: `lapeninns/nabaperks`
Execution host: one Apple-silicon Mac running a single Lima VM (`nabaperks-ci`)
Escalation inbox: `info@lapeninns.com`

This runbook covers every part of the local CI execution plane that **cannot be
performed from inside the repository**: provisioning the VM, creating and
installing the GitHub App, installing the host service, qualifying the local
plane against the hosted plane, recovering from an offline Mac, verifying log
evidence, and auditing the security boundary.

## Status: what is and is not active today

This document describes **cutover step 1 only** — `config/local-ci-contract.json`
carries `"cutoverStep": 1` and `"stage": "bridge-shadow"`. After step 1 merges:

- The `local-proof` job in `.github/workflows/ci.yml` is **advisory**
  (`bridge.enforcement: "advisory"`, `bridge.dependents: []`). No job lists it
  in `needs:`. `release-gate` still declares `needs: [fast, build]` and still
  asserts only `test "$FAST_RESULT" = "success"` and
  `test "$BUILD_RESULT" = "success"`.
- `config/github-governance-contract.json` still pins `requiredChecks` to
  exactly three names: `Release gate`, `Analyze (javascript-typescript)` and
  `Review dependency changes`. Neither the bridge job nor the
  `Nabaperks Local CI` check run is one of them.
- Every hosted job that gated a merge before step 1 still gates it. No job was
  deleted, renamed, or had its `needs:` reduced.
- **Nothing in this runbook can block a merge today.** A Mac that is switched
  off, a VM that will not boot, or a GitHub App that was never created makes
  the advisory bridge report a failure or a timeout and changes nothing else.
  That is deliberate: the local plane earns trust by shadowing the hosted
  plane, not by being trusted in advance.
- `shadowMode.enabled` is `true` and flips at cutover step 3, in the same
  commit that flips `bridge.enforcement` to blocking. Not before.
- The agent is **dormant** until an operator sets the repository variable
  `LOCAL_CI_MODE`. With that variable unset there is no local plane at all.

The remaining cutover steps — promoting the bridge, converting the staging
job, monitoring v2, governance and recovery — are documented separately in
`docs/operations/local-ci-cutover.md`. Do not perform any of them from this
document.

## File map

Everything this runbook references is either committed in the repository or
created by hand on the Mac host.

| Path                                               | Where    | Purpose                                                                                                                |
| -------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------- |
| `config/local-ci-contract.json`                    | repo     | The declarative contract: VM shape, timeouts, check names, App permissions, retention                                  |
| `ops/local-ci/host/lima-nabaperks-ci.yaml`         | repo     | Lima VM definition and its provisioning scripts                                                                        |
| `ops/local-ci/host/install.sh`                     | repo     | The only supported installer/upgrader for the host agent                                                               |
| `ops/local-ci/host/com.nabaperks.local-ci.plist`   | repo     | launchd LaunchAgent definition                                                                                         |
| `ops/local-ci/host/README.md`                      | repo     | VM image refresh procedure and the pinned Docker Engine ledger                                                         |
| `ops/local-ci/agent/main.mjs`                      | repo     | Long-running supervisor; the LaunchAgent's program                                                                     |
| `ops/local-ci/agent/main.mjs --dry-run`            | repo     | Host preflight mode of the agent: resolves credentials, loads the profile, runs the snapshot guard, dispatches nothing |
| `ops/local-ci/core/`                               | repo     | Pure decision modules — no clock, no network, no filesystem                                                            |
| `ops/local-ci/profiles/{pr,main,nightly}.json`     | repo     | Lane definitions, including each lane's `arch`                                                                         |
| `scripts/check-local-ci-proof.mjs`                 | repo     | The bridge poller run by the `local-proof` job                                                                         |
| `.github/workflows/nightly-proof.yml`              | repo     | Nightly proof verifier (`scripts/check-nightly-proof.mjs`)                                                             |
| `/opt/nabaperks-local-ci/current/`                 | Mac host | Symlink to the installed, reviewed agent revision                                                                      |
| `/opt/nabaperks-local-ci/logs/agent.{out,err}.log` | Mac host | Agent process logs, rotated by newsyslog                                                                               |
| `~/.nabaperks-local-ci/app-private-key.pem`        | Mac host | GitHub App private key, mode `0600`                                                                                    |
| `~/.nabaperks-local-ci/runs/<sha>/<run>/`          | Mac host | Per-run lane evidence, one directory per run, retained 30 days                                                         |

Read `config/local-ci-contract.json` before running any procedure below. Every
numeric bound quoted here is committed there as data; the contract tests assert
it, and the agent re-reads it at start rather than hardcoding it. Where this document and the contract disagree, the
contract is correct and this document is stale — fix the document.

---

## 1. Provisioning the Lima VM

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

| Permission        | Level          | Why it is needed                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Checks**        | Read and write | The agent creates the `Nabaperks Local CI` check run for a head SHA and completes it with the conclusion and the lane summary. This is the agent's only published output.                                                                                                                                                                                                                       |
| **Actions**       | Read and write | Read: find the bridge workflow run and its jobs for a SHA. Write: used **solely** to call `POST /repos/lapeninns/nabaperks/actions/runs/{run_id}/rerun-failed-jobs` when a bridge job timed out while the Mac was asleep (section 5). The contract pins `allowedActionsWriteOperations` to that single operation, and a contract test asserts it is the only non-GET Actions call under `ops/`. |
| **Contents**      | Read           | Fetch `refs/heads/<branch>` and read the commit graph to build the candidate set. Read-only: the agent never pushes, never tags, never opens a pull request.                                                                                                                                                                                                                                    |
| **Pull requests** | Read           | Enumerate open pull requests and read `head.repo.full_name`, `head.repo.id`, `head.ref`, `head.sha` and `base.ref` — the inputs to the fork allowlist predicate.                                                                                                                                                                                                                                |
| **Metadata**      | Read           | Mandatory; GitHub grants it automatically alongside any repository permission.                                                                                                                                                                                                                                                                                                                  |

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

`config/local-ci-contract.json` ships `githubApp.appId`,
`githubApp.installationId` and `githubApp.repositoryId` as `null` sentinels.
Open a pull request setting all three to the positive integers recorded in 2.3
and 2.4.

No proof lane may be promoted from advisory to blocking while any of the three
is `null`, so this pull request is a precondition for qualification. It is also
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
  Mac. That is a _delay_, not a failure: the bridge is advisory in step 1, and
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
   bridge job had already hit its ceiling, expect it to stay red: the automatic
   rerun is not wired yet (section 5.3), so recover it with "Re-run all jobs"
   as in section 5.4.

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
Until it passes, the bridge stays advisory. Nothing in this section changes a
required check.

### 4.1 Preconditions

1. Sections 1–3 complete; the installed-tree preflight (section 3.4) exits clean.
2. `githubApp.appId`, `githubApp.installationId` and
   `githubApp.repositoryId` are pinned to positive integers on `main`
   (section 2.6).
3. Turn the plane on:

   ```sh
   gh variable set LOCAL_CI_MODE --body shadow --repo lapeninns/nabaperks
   gh variable list --repo lapeninns/nabaperks
   ```

   This activates the hosted bridge. The installed agent polls independently
   of this variable; stop its LaunchAgent to pause local execution. `shadow` is
   the only value used during qualification; values that make the bridge load-bearing
   belong to later cutover steps and are documented in
   `docs/operations/local-ci-cutover.md`.

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
complete local PR proof on `79b8a048a3c64a7340db04635fe1143442888f9d`, after the
non-baseline accessibility tags were corrected. Its browser skips are the
existing DB-free fixture and project-specific skips. Hosted results must
independently satisfy those same ceilings. The two command-only lanes, quality
and print-kit, have explicit zero floors because they do not run a countable
node:test or Playwright suite. This does not exempt their exit status.

Save the **full** local check response with `gh api repos/lapeninns/nabaperks/check-runs/<id>`.
The command below validates the pinned App ID, check name, completed status and
SHA, reads the embedded published lane summary, and measures elapsed time from
`started_at` to `completed_at`. Listing check runs is insufficient because that
endpoint can truncate the embedded summary.

Prepare hosted evidence from the matching CI run's complete job logs and job
conclusions. Collect every expected shard exactly once: 32 per functional
browser project and eight per accessibility project. Strip GitHub timestamps
and ANSI colour codes before using `parseLaneCounts` from
`ops/local-ci/agent/runner.mjs`; retain source run/job IDs and raw logs beside
the evidence. Do not infer zero counts from missing logs. Split the hosted
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
Cutover step 3 replaces this manual comparison with an automated comparator
reading the same records; until then, the ledger issue is the ledger.

The nightly proof verifier (`.github/workflows/nightly-proof.yml`, running
`scripts/check-nightly-proof.mjs`) independently fails when the newest
`Nabaperks Local CI (nightly)` proof for the default branch is older than
`nightlyProof.maxAgeHours` (36) — one 24-hour cadence plus a 12-hour recovery
window, so a single missed night warns and two consecutive misses fail. It is
advisory in step 1. Treat a failing verifier as a signal that the qualification
evidence has gone stale.

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
3. Record the decision — lane id, date, reason, and the two SHAs — in the ARM64
   decision subsection of `docs/operations/devops-maturity.md`.
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
visual snapshots. The hosted `visual` and `visual-gate` jobs in `ci.yml` are
untouched by cutover step 1.

---

## 5. Mac offline, VM outage, and the fallback

### 5.1 What actually happens today

In step 1 the bridge is advisory. An offline Mac makes the `local-proof` job
report a timeout and changes nothing else: no job depends on it and it is not a
required check. **Rehearse this section anyway.** It becomes load-bearing at
cutover step 3, and the first time you need it should not be the first time you
have run it.

Distinguish the two outages, because the symptom differs:

- **Mac offline or asleep at the boundary.** No check run is created at all.
  The bridge polls until its ceiling.
- **Mac up, VM broken.** The dispatch fails when `limactl shell` cannot reach
  the instance; again, no check run is created, and the failure lands in
  `agent.err.log`. Fix the VM per section 1, or fall back.

A third case is not an outage at all and must not be treated as one: the bridge
enforces a head-SHA rule. On `pull_request` it polls the pull request's head
SHA, which must differ from `GITHUB_SHA`; on `push` it polls `GITHUB_SHA`,
which must equal it. A mismatch fails the job in **seconds** with a
self-describing message rather than timing out. If a bridge job fails almost
immediately, read the message — it is a wiring error, not a dead Mac.

### 5.2 The 120-minute bridge ceiling

The bridge job's ceiling is **120 minutes** (`bridge.timeoutMinutes`), polling
every 30 seconds (`bridge.pollIntervalSeconds`). The job container's own
ceiling is **110 minutes** (`container.timeoutMinutes`) — deliberately ten
minutes inside the bridge ceiling, so the agent kills and _reports_ an
over-running job before the hosted bridge gives up waiting for it. The
difference is what turns a hang into a readable failure instead of a silent
timeout.

120 minutes is far below GitHub's own six-hour job limit, on purpose: a hung
local plane must not hold a workflow run — and, from step 3, a merge — open for
hours.

### 5.3 The automatic bridge rerun after wake — NOT YET WIRED

> **Status: designed and permitted, but no code issues it today.** The rerun is
> a recovery convenience, not a safety property: a timed-out bridge is red, and
> from step 3 a red bridge blocks the merge. Nothing unsafe happens without it —
> the operator does one extra thing, described in 5.4.

The intended behaviour, once wired: when the Mac wakes and the agent finishes a
SHA whose bridge job has already ended in a timeout, it repairs that run, but
only when all of these hold:

- the workflow run is still for the current head SHA;
- the bridge job actually ended in a timeout or a failure;
- the agent has not already issued a rerun for that run.

It would then issue exactly one
`POST /repos/lapeninns/nabaperks/actions/runs/{run_id}/rerun-failed-jobs` —
the sole reason the App holds Actions write, and the only non-GET Actions call
in the agent.

**What exists now.** `ops/local-ci/agent/github.mjs` implements
`rerunWorkflowJob`, refusing any operation other than the one pinned in the
contract. `ops/local-ci/core/bridge.mjs` returns a `rerun` decision for exactly
the state above. `scripts/check-local-ci-proof.mjs` correctly _refuses_ to make
the call itself and says why: the `local-proof` job holds `checks: read` and no
Actions write, and a running job cannot re-run the workflow run it belongs to.

**What is missing.** The host agent never calls `rerunWorkflowJob`. Wiring it
needs a `listWorkflowRuns`-style lookup on the GitHub client to find the bridge
run for a SHA (a GET, already covered by Actions _read_), a call site in the
agent's publish path, and once-per-run bookkeeping. Until that lands, treat
every timed-out bridge as the operator fallback in 5.4.

### 5.4 The operator fallback — and the exact reason it needs "Re-run all jobs"

When the local plane will not come back in time, route the SHA's work to the
hosted plane:

```sh
SHA=<40 hex sha>
gh variable set LOCAL_CI_FALLBACK_SHA --body "$SHA" --repo lapeninns/nabaperks

# Find the existing run for that SHA, then re-run ALL of its jobs:
gh run list --repo lapeninns/nabaperks --commit "$SHA" \
  --json databaseId,event,name,conclusion
gh run rerun <run-id> --repo lapeninns/nabaperks     # NO --failed flag
```

**This is the operational fact the fallback turns on: GitHub's "Re-run failed
jobs" does NOT re-run skipped jobs.** The fallback works by re-evaluating the
route so lanes move from the local plane to the hosted plane. On the first
attempt those hosted lanes were `skipped`, not failed. "Re-run failed jobs"
therefore leaves them skipped, does not re-evaluate the route, and the run
cannot go green no matter how many times it is pressed. **Always use "Re-run
all jobs"** — the button in the run's UI, or `gh run rerun <run-id>` with no
`--failed`.

Two further constraints:

- **Re-run the existing push run; do not push an empty commit to make a new
  one.** `production-database.yml` matches on `--event push`, and re-running
  preserves the run's event. A new run for a new SHA is a different SHA and
  does not unblock the one you care about.
- **Clear the variable afterwards.** It is scoped to that one SHA, so a stale
  value is not dangerous, but leaving it set makes the next incident harder to
  read:

  ```sh
  gh variable delete LOCAL_CI_FALLBACK_SHA --repo lapeninns/nabaperks
  ```

### 5.5 Returning to normal

1. Fix the underlying cause — section 1 for the VM, section 3 for the service.
2. The installed-tree preflight in section 3.4 exits clean.
   exits clean.
3. Confirm the next internal pull-request SHA produces a `Nabaperks Local CI`
   check run.
4. If the outage spanned a qualification attempt, that attempt is
   `incomplete` and the counter in 4.2 resets.

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
       parts.push(await readFile(`${dir}/${name}`, "utf8"))
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

The VM cannot reach any of these: it has **no mounts** and **no forwarded SSH
agent** (section 1.3), so there is no path from the guest to `$HOME`. A
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

Two containers per job:

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

---

## Related documents

- `docs/operations/local-ci-cutover.md` — cutover steps 3 to 7, including
  promoting the bridge out of advisory mode. **Nothing in that document has
  been performed.**
- `ops/local-ci/README.md` — the agent's own inventory, schemas and module map.
- `ops/local-ci/host/README.md` — VM image refresh and the Docker Engine
  version ledger.
- `docs/operations/incident-response.md` — severity, escalation, and the
  integrity-finding path referenced in section 6.4.
- `docs/operations/production-runbook.md` — release entry criteria and the
  production promotion path this merge lane ultimately feeds.
- `docs/operations/devops-maturity.md` — where the ARM64 hosted-pinning
  decisions from section 4.6 are recorded.
