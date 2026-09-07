# Browser grouping experiment

This is a measured, opt-in pilot. It changes no active workflow, profile,
command wrapper, shard count or merge authority. Start with one local project
and suite only after the operational owner finishes upgrade qualification.
An existing aggregate count or `--list` inventory cannot qualify grouping.

The experiment executes the reviewed eight local shards sequentially, then one
unsharded invocation with the same project and selection. Functional filtering,
accessibility tagging and both ARM snapshot exclusions come from the shared
browser workload definition. One worker, one retry, forbidOnly,
failOnFlakyTests, heap, fixtures, browser installation and the original test
configuration are preserved. An unexpected failure/flake remains a failure.

Each invocation imports the original Playwright configuration through a derived
configuration. Only report/output locations and matched observation are added:
JSON reporter output, an explicit original test directory/server working
directory, and a Node preload that records actual Next server-worker startup.
It neither replaces server lifecycle management nor suppresses teardown. The
preload is applied identically to both arms. It is reviewed against Next 16.2.12;
a different version requires review. Missing startup observation fails closed.
The configuration retains the original timeout and Next Turbopack command.

Exact identities and multiplicity, statuses, retry/flake state and reported skip
reasons are compared with `browser-parity.mjs`. Missing reasons, runtime results,
global-error lists, process completion or resource measurements cannot be filled
with zeros. A test process exiting successfully without complete JSON is not
proof. The resolved base configuration, source configuration and relevant fixture
environment are hashed and must match between arms. These are hashes only;
fixture values are not printed in evidence.

## Configuration

Provide a JSON file with schema `nabaperks.browser-grouping-experiment.v1`,
repository (absolute clean checkout), exact revision, new absolute output
location, suite (`test:e2e` or `test:a11y`), project, heapMb, timeoutMs (at most one
hour per invocation), and budget `{maxRssMb, durationMs}`. The duration budget is
for the packed arm. Use the current local 12,288 MiB heap and existing 10 CPU,
32 GiB container policy when measuring equivalence; set maxRssMb to 32768.

The running environment must provide `CI=1`, `PLAYWRIGHT_WORKERS=1`,
`PLAYWRIGHT_REGULAR_CHROMIUM=1`, `PLAYWRIGHT_NODE_HEAP_MB=12288`, the reviewed
DB-free fixture environment and a reserved loopback PLAYWRIGHT_BASE_URL. Existing
server reuse and checkout `.env`/`.env.local` files are refused. Supply fixture
environment directly. The checkout must match its clean full revision before
and after execution. Install the frozen dependencies and pinned browser first.

## Existing fresh-container execution

The operational owner can use the existing job-container machinery rather than
granting writable cgroup access. Set resourceMode to `fresh-container` and receiptRoot to an absolute host-only
directory outside both repository and output. Never mount receiptRoot into any
candidate container. Run
preparation in the target Linux image, with the checkout/dependency/browser paths
that all nine containers will use:

```sh
node scripts/ci/browser-grouping-experiment.mjs --prepare-containers /absolute/options.json
```

Preparation starts no browser or service. It writes nine payloads and derived
configs, plus `prepared.json`. Run each payload in a **fresh** container, ordered
before-1 through before-8, then after-1:

```sh
node scripts/ci/browser-grouping-experiment.mjs --container-invocation /absolute/evidence/before-1/payload.json
```

The operational owner must mount the evidence path at the same absolute path
and provide owned per-phase `.next-grouping-<id>-before` / `-after` cache mounts.
The before cache persists across all eight invocations, reproducing the existing
local lane's caller-owned Next directory. The after cache starts empty and is
separate. Do not mount unrelated job workspaces or caches. All nine containers
must have the same immutable image, source revision, fixture environment,
10 CPU limit and 32 GiB memory limit. No containers run concurrently.

The inner invocation reads actual read-only cgroup-v2 `memory.peak`, memory
limits/events and CPU limits after the subprocess. It records the browser
subprocess exit, but does not invent the outer container's result. After actual
exit, the trusted operational owner inspects and removes the container, then
writes `<invocationId>.json` under receiptRoot, which stays outside all candidate
mounts. Required fields are:

- schema `nabaperks.browser-grouping-container-receipt.v1`, revision and
  invocationId matching the payload;
- full containerId and immutable imageDigest;
- freshContainer=true, actual exitCode, oomKilled and removed state;
- resourcePolicy `{cpus:10,memoryBytes:34359738368}`;
- createdAt and finishedAt from the actual container lifecycle;
- bundleDigest from `invocationBundleDigest(payload)`, binding the raw payload,
  derived config, preload, test report, policy, lifecycle and measurement files;
- measurementDigest: SHA-256 of `JSON.stringify()` applied to the parsed
  measurement JSON, binding the inspected container to the measured output.

Receipts are operational evidence inputs, not self-authenticating JSON. Generate
and retain them through the trusted host/operator after actual container exit,
under receiptRoot outside candidate-writable mounts. Do not allow a later
container to modify a previous receipt. The
collector rejects reused containers, differing images, resource drift, overlapping
or out-of-order timings, failed/unclean exits, absent measurements and changed
measurement or complete-bundle digests. Run collection only after all nine actual receipts exist:

```sh
node scripts/ci/browser-grouping-experiment.mjs --collect-containers /absolute/evidence/prepared.json
```

The raw host-bound payload also includes a canonical experiment-definition
digest. Changing the selection, heap, runtime policy or budget in prepared.json
after receipt collection fails validation.

The collector writes comparison.json and fails if parity or budgets fail. A
passing result still says activation=false. Preserve raw reports, lifecycle
records, process logs, measurements and host receipts for independent review.
The operational owner removes only these experiment-owned cache mounts.

## Delegated-cgroup execution alternative

On a Linux execution environment with a specifically delegated writable memory
cgroup hierarchy, supply cgroupRoot below `/sys/fs/cgroup/` and run the options
file directly. The runner creates a fresh child cgroup for each invocation,
applies the same memory/CPU caps, observes process exit and requires the group to
contain no remaining descendants. It reads kernel memory peak/OOM counters and
cleans up only its own cgroup and Next directories. Unsupported, read-only or
undelegated cgroups fail before browser execution; do not substitute an estimate.
No host cgroup permissions or service changes are performed automatically.

## Measurement and qualification limits

The comparator's compatibility field `maxRssMb` holds the measured cgroup memory
peak in MiB. This is **not process RSS**: it includes charged page cache and all
processes in the measured cgroup. Fresh-container measurements also include
container setup before the browser invocation. This is a conservative whole-job
memory budget, not a claim of cold-cache RSS equality. durationMs measures the
browser subprocess and its server startup/teardown; it excludes container
creation and dependency-install overhead. Host lifecycle timestamps retain the
outer timing separately. Do not compare results
from different resource methods or image/setup policies.

Next startup records count actual worker processes; a second worker start within
one invocation is a restart and fails qualification. Missing instrumentation also
fails. This is not a sampled process estimate. Future Next lifecycle changes
require renewed instrumentation review.

Browser identity records Playwright's installed version and executable digest,
with identical immutable image receipts required in fresh-container mode. It is
not a fabricated `browser.version()` response. Source-only tests check the
instrumentation and refusal paths; they do not establish any browser outcome,
resource usage, skip/flake parity or packing performance. After a successful
one-project pilot, review the raw evidence before extending to the other five
local browser lanes. Active grouping needs a separately reviewed implementation
and authority decision; this experiment never activates it.
