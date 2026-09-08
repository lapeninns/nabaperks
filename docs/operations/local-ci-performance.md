# Local CI performance and default execution

The requested destination is local execution by default, with hosted fallback
and separately retained canonical x64/security checks. Source implementation,
measured local performance, installation and merge authority are separate states.
The installed advisory agent does not acquire authority from a concurrency edit.

## Parallel execution

The old runner executed every lane sequentially despite a four-lane contract.
The scheduler now admits independent lanes within all of these limits:

- At most six admitted lanes and one whole CI run.
- At most 10 CPUs and 32 GiB across all job containers combined.
- Every daemon adds 1 CPU and 6 GiB; at least 1 CPU and 2 GiB remain for the VM.
- Lanes sharing a service concurrency group cannot overlap.

Browser lanes each have 2 CPUs, 8 GiB and a 6 GiB Node heap. Four simultaneous
browser lanes consume the job-memory budget. Fast checks have 4 CPUs, 8 GiB and
four Node test subprocesses. Quality/print lanes have 2 CPUs and 4 GiB. Mutation
and load lanes have 8 CPUs and 24 GiB. Increasing the lane-count ceiling cannot
override the CPU, memory, service or VM-reserve constraints.

Each lane clones its own checkout and Git objects without hardlinks. Dependencies,
generated files, Next caches and background-service logs are private. Browser
projects retain their original eight shards and one Playwright worker. Each shard
retains a fresh server invocation; retries and flakes do not become acceptable
because work is parallel.

Results and log digests retain profile order even if lanes finish out of order.
A failed lane stops new execution; already started lanes settle before shared
cleanup. Container/network absence is verified before a lane releases its budget.
Unverifiable leftovers prevent another run and quarantine its workspace.

## Reproducible qualification

`pnpm ops:ci:benchmark <full-sha> <1-6> <new-output-directory> [pilot|full]`
runs without App credentials, publishes no checks, acquires the same controller
lease and refuses to overlap existing CI containers. The runtime checkout must
match the exact candidate and be clean. The candidate must be fetchable through
the repository's configured remote. The installed pinned job image is reused.

The pilot runs the first two original local shards of all four E2E browsers.
Run it serially and in parallel on the same commit. Compare retained identities,
outcomes, skip reasons, retries, flakes, sampled resources and elapsed time. A
pilot is not a complete-profile qualification. The `full` mode executes the
entire PR profile; provide the installed `LOCAL_CI_IMAGE_CACHE_PIN_FILE` for
verified database image preloading. Results, raw browser JSON, logs and resource
samples remain in the requested output directory. Source and fixture scratch
inside the VM are removed only after its job containers are absent.

Do not change VM allocations or stop an in-flight run to make a benchmark look
faster. Drain the owned watcher at a completed-job boundary, verify the lease and
resource state, then perform qualification. Installation uses a reviewed merged
revision and the administrator-authorised host installer.

## Local-default activation

Keep the requirements in [CI redesign](ci-redesign.md) and
[delivery coordination](software-factory.md): exact candidate binding,
independently protected publication, qualified disposable execution, complete
coverage and equivalent hosted fallback. The legacy advisory App check for a PR
head is insufficient proof of the actual merge candidate. The current trusted
supervisor adapter and its operational qualification must be completed before
the required gate can accept local proof. Do not activate it by merely changing
the shadow/enforcement flags or omitting hosted jobs.

After the new runner is approved and installed, qualify complete current PR/main
profiles and failure recovery, then verify the default-routing and fallback
changes through the existing review process. Retain x64 visual snapshots and
independent security checks on their canonical execution plane. Report actual
local-default activation only after live provider readback and a successful
end-to-end candidate run.
