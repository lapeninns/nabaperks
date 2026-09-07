# Disposable Lima adapter preparation

`ops/local-ci/host/lima-disposable-adapter.mjs` implements the protected
supervisor's five-operation adapter protocol. It is not installed or connected
to the watcher or a merge workflow. The existing `nabaperks-ci` VM is never a
candidate resource. Each lane creates a new `np-proof-<identity>` VM in a
separate, dedicated Lima home and destroys it before the next lane.

The current deployment remains hosted and advisory. Fixture tests and template
validation prove source behaviour only. No disposable VM has been created by
this implementation work; resource, network and workload qualification remain
required before operational use.

## Protected installation prerequisites

The supervisor runs as root and holds its signing input. Lima runs as a separate
non-root service UID through `/usr/bin/sudo -n -u #UID -- /usr/bin/env -i ...`.
The adapter supplies only `HOME`, `LIMA_HOME`, `PATH` and `SSH` to that service.
Its subprocess stdio contains descriptors 0, 1 and 2 only; signing descriptors
and arbitrary host environment variables are not inherited. This requires the
independent launcher/memory protections in
[the supervisor boundary](trusted-supervisor.md).

Install the adapter and its dependency `ops/local-ci/agent/lease.mjs` in the
same root-owned, non-writable protected tree as the supervisor. All ancestor
paths must be root-owned without group/other write permission or symlink
aliases. Use canonical paths on macOS, including `/private/var` where applicable.
The supervisor configuration pins the adapter's direct module digest.

A reviewed `limactl` installation and its runtime dependencies must also be
protected from the service UID and candidate users. The current user-managed
Homebrew installation is not an eligible production adapter binary. The
adapter validates its configured binary, image and source bundle paths and
pins all three byte digests;
protecting Lima's transitive native dependencies is an installation obligation.

The dedicated service UID must own only its `serviceHome` and `limaHome`, each
with mode 0700. It must not own or write the signing configuration, admission
journal or source/runtime policy. Unreviewed Lima `_config/default.yaml` or `_config/override.yaml` files are
refused. The root-owned `stateRoot` uses mode 0700.
A separate root-owned `inputRoot` uses mode 0755 so the service can read the
root-written per-lane template. The immutable base image and source bundle must
be readable by the service without granting write access.

## Prepared offline image

The base VM disk is pinned by SHA-256 and independently prepared before this
adapter runs. It must boot without internet-dependent provisioning and contain:

- An independent control account compatible with Lima's `npcontrol`, UID 1000,
  and a candidate account `npcandidate`, UID/GID 2000, without sudo authority.
- `sudo`, `git`, `nft`, `findmnt`, `sha256sum`, `timeout`, the reviewed Node/pnpm
  toolchain, browsers, dependencies and every fixture image needed offline.
- A root-owned `/usr/local/share/nabaperks-ci/runtime-sha` containing the exact
  installed runtime revision. The candidate must not be able to write it.
- Fixture services compatible with an unprivileged candidate. Database lanes
  use the rootless Docker socket `/run/user/2000/docker.sock`; access to the
  rootful `/var/run/docker.sock` causes allocation refusal.

Each realized VM configuration carries a fresh random ownership nonce plus
attempt/source/runtime bindings. Cleanup verifies that provider-read identity
before deleting a named VM; mismatches remain pending without deletion.

The adapter disables mounts, additional networks, forwarded agents, public-key
imports, proxy environment propagation, automatic containerd and guest port
forwarding. Before candidate source enters the VM, trusted root setup installs
an nftables policy that drops new external traffic, allows loopback fixture
traffic, existing control connections and inbound SSH control. It checks the
policy before and after the candidate command. The candidate runs as UID 2000
with a clean environment and no sudo or rootful Docker authority. This guest
privilege separation and rootless-service compatibility need measured proof;
the adapter does not claim a host firewall or kernel exploitation defence.

The source artifact is an independently prepared Git bundle, not a shared
checkout, mutable mount or arbitrary tar extraction. A protected configuration
binds its digest to the admitted SHA. The adapter copies the bundle into the VM,
checks its digest, clones as UID 2000 and checks out the exact detached commit.
No host Git credentials are needed inside the VM.

## Adapter configuration

The exported adapter protocol reads only the fixed protected file
`/opt/nabaperks-trusted-ci/lima-adapter.json`. A deployment controller must write
this independently of candidate code. Example shape (illustrative values,
not a qualified installation):

```json
{
  "version": 1,
  "serviceUid": 700,
  "serviceHome": "/private/var/lib/np-ci-service",
  "limaHome": "/private/var/lib/np-ci-lima",
  "stateRoot": "/opt/nabaperks-trusted-ci/state",
  "inputRoot": "/opt/nabaperks-trusted-ci/inputs",
  "limactl": "/opt/nabaperks-trusted-ci/bin/limactl",
  "limactlDigest": "sha256:<64 lowercase hexadecimal characters>",
  "imagePath": "/opt/nabaperks-trusted-ci/inputs/base.qcow2",
  "imageDigest": "sha256:<64 lowercase hexadecimal characters>",
  "bundlePath": "/opt/nabaperks-trusted-ci/inputs/source.bundle",
  "bundleDigest": "sha256:<64 lowercase hexadecimal characters>",
  "arch": "aarch64",
  "vmType": "qemu",
  "maxResources": { "cpus": 10, "memoryMiB": 32768, "diskMiB": 153600 },
  "expected": {
    "repository": "lapeninns/nabaperks",
    "sha": "<40 lowercase hexadecimal characters>",
    "runtimeSha": "<40 lowercase hexadecimal characters>",
    "profile": "pr",
    "attemptId": "<independently allocated unique attempt>",
    "challenge": "<64 lowercase hexadecimal characters>"
  }
}
```

The supervisor's image digest identifies this immutable base VM disk. Its
allocation request must match the independently configured runtime revision.
Architecture selection is explicit: the adapter never labels ARM execution as
x86 visual parity. The full nine-root workload still needs compatible offline
fixtures and measured parity for the selected architecture.

## Recovery and evidence

Admission rejects an unconfigured candidate, reused attempt or reused challenge.
The exclusive root controller lease prevents competing controllers. Resource
intent and whether creation was issued are fsynced before the provider call;
a lost creation response is therefore discoverable even before `allocate`
returns an ID. Startup admission first reconciles incomplete owned resource
intents. It never performs a broad prune or deletes an unjournalled VM. A name
collision detected before creation does not grant deletion authority. If an
external actor wins the race between absence readback and creation, cleanup
requires the independently recorded ownership nonce in realized provider
configuration and refuses to delete the foreign VM. The Lima CLI has no atomic
compare-and-delete API; the dedicated service account must remain under one
operational owner, and root operators must not replace resources during cleanup.

`destroy` targets only a journalled resource created by this adapter and requires
an independent successful `limactl list --json --all-fields` absent readback.
An unavailable provider or failed deletion leaves the intent pending and
prevents a successful supervisor envelope. The journal reloads after acquiring
the lease, so a newly admitted controller does not overwrite an older snapshot.

Lifecycle commands have host process-group deadlines and TERM/KILL escalation.
Candidate execution also uses a guest `timeout`; the disposable VM is destroyed
when the command fails or times out. Raw candidate stdout/stderr remain byte buffers through supervisor hashing.
Audit files retain both channels as explicit base64-encoded bytes with exit
status; timeout/overflow records are labelled incomplete, with truncation
recorded separately. UTF-8 decoding is restricted to trusted lifecycle text/JSON
readbacks. Output beyond the
bounded capture limit fails the attempt instead of claiming complete evidence.
The supervisor separately hashes its command/resource/cleanup manifest.

A crash during exclusive-lease publication or an unverifiable lease owner
requires operator inspection. The adapter does not kill an unrelated owner to
recover. Root-owned per-lane templates and evidence remain as audit artifacts;
VM deletion does not remove those host records.

## Verification completed and still required

Completed source evidence includes new-VM identity, admission/replay refusal,
wrong runtime refusal with cleanup, lost allocation response followed by
restart reconciliation, resource budget refusal, foreign deletion refusal,
failed absent readback, controlled environment, process timeout and descriptor
non-inheritance. The generated template passed the installed Lima
`validate` command without creating a VM.

Before an operational claim, independently review the adapter, provision the
protected OS account/install and offline image, then measure actual resource
limits, absence of host mounts/credentials, network denial and loopback fixture
access, rootless Docker compatibility, exact runtime/source identity, all nine
lanes, timeout/cancellation and crash recovery including absent readbacks.
Retain evidence and durations. Current shared-VM browser tests do not satisfy
these disposable execution obligations.
