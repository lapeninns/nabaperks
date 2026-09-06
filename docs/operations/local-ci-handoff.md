# Handoff — local CI execution plane

You are picking up an in-flight change to `lapeninns/nabaperks`. Read this file
first, then `docs/operations/local-ci-cutover.md`. Everything below was verified
against the tree, not assumed.

## Where things stand

Branch `feat/local-ci-execution-plane`, pushed, **PR #238 is OPEN and not
merged**. `origin/main` is still `08ec0f434`, which is also what production runs.
Nothing in this branch has reached staging or production.

- 7 commits, 55 files, ~26,000 insertions, **0 deletions**.
- CI: **173 checks pass, 1 skipping, 0 failing.** The skip is `Local CI proof`,
  which is correct — it is gated on a repository variable that is not set.
- CodeQL: **0 open alerts.** Eleven were raised and all eleven closed.
- Review: 30 threads. 29 resolved. **1 deliberately left open** — see "Known gap".
- Merge is blocked only by `REVIEW_REQUIRED`. There is no technical blocker.

This delivered **cutover step 1 of 7** from the original plan: "merge agent,
bridge, contracts and documentation without changing required checks." Steps 2–7
are specified but not done.

## The single most important invariant

`Release gate` in `.github/workflows/ci.yml` still blocks on exactly
`[fast, build]`, and `git diff main .github/workflows/ci.yml` is **80 insertions,
0 deletions**. Merging this PR does not change what gates a merge.

`tests/contracts/devops-local-ci.test.mjs` enforces that mechanically. It asserts
every job id present today is still present, that `release-gate`'s needs list is
exactly `[fast, build]`, and that no job lists the bridge in `needs`. It is not
decorative — both of these mutations were run and each turns it red:

```bash
# 1. wire the advisory bridge into the merge gate
#    add "      - local-proof" under release-gate's needs
# 2. delete the `db` job
node --test tests/contracts/devops-local-ci.test.mjs   # must fail for both
```

If you change `ci.yml`, re-run those two mutations. A green suite after a
`ci.yml` edit is only meaningful if the interlock still fires.

## What is real and what is unproven

**Proven.** The pure decision modules under `ops/local-ci/core/` — fork refusal,
queue priority, stale-SHA cancellation, dedup, App identity, bridge timeout,
retention, job-env secret isolation. 1,284 unit tests, offline, injected clocks
and fetch.

**Unproven.** Everything that needs real infrastructure. The Dockerfile **has
never been built**, so the entrypoint, the `pnpm fetch` store layer and the venv
assertions are unrun. No Lima VM exists. No GitHub App exists. The agent has
never polled anything.

Treat the runtime as unvalidated until shadow qualification runs on a real VM.
That gap is structural: the tests inject fakes for Docker, launchd, the VM and
GitHub, so they say nothing about whether the agent works once provisioned. An
automated reviewer found 19 defects of exactly that kind, all real, all now
fixed — assume more remain.

## Known gap — the one open thread

PR comment `3939775482`. The automatic bridge rerun after the Mac wakes is **not
wired**. `ops/local-ci/agent/github.mjs` implements `rerunWorkflowJob`,
`ops/local-ci/core/bridge.mjs` returns the `rerun` decision, and
`scripts/check-local-ci-proof.mjs` correctly refuses to issue it (the
`local-proof` job holds `checks: read` by design, and a running job cannot re-run
the run it belongs to). But no agent code calls it.

To finish it you need a workflow-run lookup on the GitHub client — a GET, already
covered by the App's Actions **read** — plus a call site in the agent's publish
path and once-per-run bookkeeping. Runbook §5.3 is marked **NOT YET WIRED** and
points at the operator fallback; update it in the same commit that wires this.

This is a recovery convenience, not a safety property. A timed-out bridge is red,
and from step 3 a red bridge blocks the merge. The cost of its absence is one
operator click.

## Two plan requirements that need a design decision before step 3

Both are documented in `docs/operations/local-ci-cutover.md`. Do not start step 3
without resolving them.

1. **Shadow qualification is unimplementable as originally specified.** The plan
   requires "three consecutive same-repository PR SHAs produce equivalent hosted
   and local results." But local and hosted routing are mutually exclusive by
   construction — and that exclusivity is exactly what keeps fork code off the
   VM. You need an explicit dual-run comparison mode plus a machine-readable
   per-lane result summary on both sides, or "equivalent results" cannot be
   checked at all.

2. **"Keep an ARM64-incompatible lane GitHub-hosted permanently" has no route.**
   If hosted lanes only run for fork PRs, a lane pinned back to hosted never
   executes on the merge path for internal PRs — silently dropping coverage
   rather than preserving it. Needs a per-lane routing table where a
   hosted-routed lane also runs on the merge path.

## Traps that cost real time — do not rediscover these

- **`JSON.stringify` is not an escaper.** It leaves U+2028/U+2029 raw, and both
  terminate a line in JavaScript source. `quoteForMessage` in
  `ops/local-ci/core/contract.mjs` exists for this. CodeQL flags the
  `JSON.stringify` call site, not the obvious-looking `String(value)` nearby —
  read the alert's own source node via
  `gh api repos/lapeninns/nabaperks/code-scanning/alerts/<n>` before fixing.
- **`openSync` succeeds on a directory.** `readCredentialFile` must distinguish
  `ENOENT` (return null, "not configured") from every other failure (throw). An
  earlier version returned null on any failure, which meant a present-but-
  unreadable App key read as absent and the loader authenticated as a different
  key — strictly worse than the TOCTOU it was fixing.
- **Playwright encodes only `process.platform`** in the `{platform}` snapshot
  token. ARM64 Linux resolves the same `-linux` filenames as the hosted x86-64
  baselines, so every local Playwright invocation carries `--grep-invert @visual`
  **and** `--ignore-snapshots`. Visual regression must stay GitHub-hosted.
- **Non-baseline accessibility journeys now have matching selection.** The
  direct customer-join and merchant ID-verification journeys retain `@a11y`
  but no longer claim `@visual`; neither compares pixel baselines. The stale
  `knownLocalGaps` records have been removed. Existing fixture-dependent skips
  remain, and the local snapshot guard still excludes actual visual tests.
- **Unsharded Playwright against one webpack dev server is fatal** (heap OOM,
  recorded in `nightly.yml` as run 30196429475). Local lanes shard 1/8; hosted
  uses 1/32 because hosted sharding also buys runner parallelism a single VM
  does not have.
- **GitHub's "Re-run failed jobs" does not re-run _skipped_ jobs.** The Mac-
  outage fallback requires "Re-run all jobs".
- **`pull_request` `github.sha` is an ephemeral merge commit.** The bridge polls
  `github.event.pull_request.head.sha`; the local agent checks out the real head
  and can never publish a proof against the merge commit.
- **`QA_CERTIFICATION_EVIDENCE/` is untracked local scratch** and fails
  `pnpm lint`. It is not in git and CI never sees it. Use the scoped invocation
  in "Verification" below as the real signal.
- **`esbuild@0.27.0` is declared but may be missing** from `node_modules`, which
  fails two unrelated unit tests. `pnpm install --frozen-lockfile` clears it.
- **Push protection blocks credential-shaped literals**, including synthetic test
  fixtures. `tests/unit/local-ci-job-env.test.mjs` composes them at runtime from
  fragments. Do not add such a literal, and do not use the unblock-secret URL.

## Verification — run all of this before any push

```bash
git diff main --stat .github/workflows/ci.yml    # must be 80 insertions, 0 deletions
git diff main .github/workflows/ci.yml | grep -c '^-[^-]'   # must be 0
pnpm test:contracts        # >= 684 pass, 0 fail
pnpm test:unit             # >= 1284 pass, 0 fail
pnpm typecheck
pnpm exec eslint --max-warnings=0 app components hooks lib scripts tests ops instrumentation.ts proxy.ts
pnpm debt:check && pnpm agents:check && pnpm deadcode:check && pnpm duplicates:check && pnpm docs:check
```

Then re-run the two interlock mutations described above.

## What to do next, in order

1. **Get PR #238 reviewed and merged.** It is green and safe: it deletes nothing,
   changes no required check, and the bridge is skipped until a repository
   variable is set. Nothing operational changes on merge.
2. **Cutover step 2 — provisioning.** Follow `docs/operations/local-ci.md`:
   Lima VM, the repository-scoped `Nabaperks Local CI` GitHub App with exactly
   Checks read/write, Actions read/write, Contents read, Pull requests read, and
   `ops/local-ci/host/install.sh`. Build the job image for the first time here —
   expect it to fail and need iteration.
3. **Shadow qualification.** Resolve design decision 1 above first. Set the
   `LOCAL_CI_MODE` repository variable to start the advisory bridge.
4. **Steps 3–7** are specified per-file, with the breaking assertions enumerated,
   in `docs/operations/local-ci-cutover.md`. Step 3 flips
   `bridge.enforcement` to `blocking` and `shadowMode.enabled` to `false` in
   `config/local-ci-contract.json` — that is a contract edit, not a workflow
   edit, by design.

## Scope discipline

The original plan's cutover order exists for a reason. Do not delete `ci.yml`
lanes before the bridge is enforcing: today `Release gate` blocks on `fast` and
`build`, and removing those lanes while the bridge is advisory would leave lint,
typecheck, audit, contracts, coverage, Playwright, accessibility and the DB moat
ungated for the entire provisioning window. The ~15-job target is an end state
reached at step 3, not step 1.
