# Trusted supervisor qualification boundary

The protected supervisor entrypoint is
`ops/local-ci/host/trusted-supervisor.mjs`. It is executable preparation for a
separately installed host controller, not a new merge gate. It always returns
`route: hosted`, all nine required hosted roots and `authorityEligible: false`.
No workflow or installed watcher calls it yet. No signing key or protected
adapter has been provisioned by this implementation.

The existing long-lived Lima VM is not a disposable resource. Do not point this
entrypoint at that VM and report disposable isolation. A signed envelope proves
what the protected controller observed; it does not prove that the controller,
adapter or VM is independently qualified.

## Protected installation and invocation

Install the supervisor and its two proof modules in a root-owned tree whose
files and ancestors are not writable by group or other users. Invoke the
installed entrypoint with a trusted Node executable and clean host environment;
never invoke candidate repository code with the signing key descriptor open.
The CLI verifies file ownership before dynamically importing the proof modules
and adapter. It rejects symlinks in protected paths, including ancestor aliases.
The independently reviewed adapter and all its transitive dependencies must be
part of the same protected installation. The adapter's direct module bytes are
also pinned by SHA-256 in protected configuration; this is not a transitive
package-integrity verifier.

An operator-controlled launcher supplies an Ed25519 private key over an already
opened pipe on FD 3 or higher. The CLI does not accept key bytes on its command
line, load them from an environment variable or write them to a file. It accepts
only a pipe descriptor, checks that the matching public key is pinned in the
protected configuration and clears its input buffer after use. Node's internal
key object remains subject to the process's memory lifecycle.

Example invocation, after the launcher has opened FD 3:

```bash
node /opt/nabaperks-trusted-ci/host/trusted-supervisor.mjs \
  --config /opt/nabaperks-trusted-ci/requests/attempt.json \
  --key-fd 3
```

The launcher must close the pipe after sending the key. It must also bound
launcher/adapter lifetime, prevent inherited signing descriptors in any child
process and protect signing-process memory. The CLI does not provision these
OS controls. A candidate must have no access to host memory, descriptors,
configuration, adapter code, attempt state or output publication credentials.

Configuration is a closed JSON object with these fields:

| Field                                      | Meaning                                                                            |
| ------------------------------------------ | ---------------------------------------------------------------------------------- |
| `version`                                  | `1`                                                                                |
| `repository`, `appId`, `sha`, `profile`    | Independent repository, App, exact commit and `pr` or `main` binding               |
| `runtimeSha`, `imageDigest`                | Installed runtime revision and immutable `sha256:` image digest                    |
| `attemptId`, `challenge`                   | Durable unique attempt and 64-character hexadecimal challenge                      |
| `requestedAt`, `maxAgeMs`, `maxDurationMs` | Explicit request time and positive millisecond budgets                             |
| `commands`                                 | Exact nine roots, each `{lane, argv, timeoutMs}`; no missing or duplicate lanes    |
| `resources`                                | `{kind: "disposable-vm", cpus, memoryMiB, diskMiB, networkPolicy: "fixture-only"}` |
| `adapterPath`, `adapterDigest`             | Absolute protected adapter and SHA-256 of its bytes                                |
| `publicKey`                                | Expected Ed25519 public key in SPKI PEM format                                     |

`argv` is an array passed to the adapter unchanged. It must name reviewed
commands, with no production credentials or customer fixtures. Configuration
is supplied by a trusted controller; candidate code never supplies its own
policy or a trusted adapter path. The CLI admits only full nine-root coverage.
Command digests bind the ordered command array and resource policy.

## Adapter protocol and evidence

The adapter exports five asynchronous operations:

1. `reserveAttempt(admission)` atomically rejects replay and supersession using
   durable host-owned state. Admission includes repository, SHA, profile,
   attempt ID and challenge. It returns exactly `true` for an eligible claim.
2. `allocate(request)` creates a fresh disposable VM for one lane. The request
   carries the protected expected `runtimeSha` and `imageDigest`. The adapter
   must independently inspect the runtime/image before executing candidate code.
   It returns exact fields `id`, `kind`, `imageDigest`, `runtimeSha`, `sha`, `resources`, `fresh`,
   `hostMounts` and `credentialsForwarded`. The last two must be `false`.
   The observed `runtimeSha` must exactly match protected configuration and is
   retained in the signed resource manifest. Resource identity must not repeat
   across lanes.
3. `execute({resourceId, argv, timeoutMs})` runs the reviewed command, capturing
   stdout/stderr and authoritative process exit status outside candidate code.
   It returns exactly `{exitCode, signal, stdout, stderr}`. It must enforce the
   passed timeout and reap the process tree; passing a timeout number alone
   does not establish OS enforcement.
4. `destroy({resourceId})` removes the resource, including on execution failure.
5. `inspectAbsent({resourceId})` independently reads the resource provider and
   returns exactly `true` only when destruction is verified.

The adapter must durably associate allocation intent with the attempt before
creation. It must reconcile resources after allocation failure, host crashes or
restarts, including the window before an allocation ID is returned. The
supervisor can clean up returned IDs but cannot discover a resource that the
adapter created and failed to return. Adapter lifecycle calls must be bounded;
the current interface does not impose a separate hard wall-clock kill around
an arbitrary adapter promise. These requirements need real adapter proof.

Only a complete successful run with verified cleanup emits an envelope. Failed,
cancelled, malformed, reused-resource or unverified-cleanup outcomes throw and
emit no success envelope. The CLI suppresses arbitrary adapter error details
because they may contain job data. It does not send messages or publish checks.

Each lane manifest records exact argv, resource identity/policy, lifecycle
completion times, destruction, exit code and raw stdout/stderr SHA-256 digests.
The envelope's lane `logDigest` hashes that entire JSON manifest. Consequently,
resource identity and cleanup are signed along with the command and raw-log
hashes. The returned `observedLogDigests` maps these manifest digests for the
existing proof verifier. Raw logs are not emitted or persisted by this module;
a protected adapter/evidence store must retain them separately for audit and
recomputation. Keep the manifest JSON serialization intact for recomputation.

## Implemented proof and remaining rollout

Fixture tests generate keys in memory and exercise all nine lifecycle sequences,
complete envelope verification, replay refusal, wrong keys, missing/duplicate
coverage, shared-VM rejection, failed/cancelled/malformed execution, cleanup
failure, resource reuse and protected-file admission. These tests do not create
VMs or establish resource isolation.

Operational completion still requires an independently reviewed protected
installation, clean launcher and key transport, durable admission/resource
reconciliation adapter, measured disposable VM isolation and timeout/cleanup
proof, retained log manifests, workload parity and independent App publication
readback. The current runtime has not acquired these properties. Existing
hosted CI and release governance remain authoritative throughout preparation.
