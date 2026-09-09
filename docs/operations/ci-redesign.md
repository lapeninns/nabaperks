# CI redesign

Owner: Lapen Inns product operations. This document records source behaviour and
reviewed rollout boundaries. A merged workflow, installed local agent, provider
ruleset and verified production release are separate states.

## Phase 1: complete hosted gate and separate observation

`Release gate` retains its check name and requires successful results from all
nine hosted roots: `fast`, `quality`, `build`, `e2e`, `a11y`, `visual`,
`lighthouse`, `zap-baseline` and `db`. A missing, failed, cancelled or skipped
required root cannot satisfy the gate. Existing browser/DB aggregators continue
to require their constituent jobs. No workload or coverage is removed.

For ZAP, Phase 1 requires the job outcome to succeed. The pinned action’s
`fail_action` default remains `false` and the existing empty rules configuration
is preserved, so individual scan findings do not become newly blocking. A
review of scan severity and failure policy is a separate phase.

The advisory local observer moves from `CI` into
`.github/workflows/local-ci-shadow.yml`. It preserves the same same-repository
and event allowlist, uses `LOCAL_CI_OBSERVE_ONCE=true`, reads once without
sleeping, and has a two-minute job timeout. Missing or pending proof is reported
as an observation, not as successful local tests. Malformed proof, identity
mismatch and API errors remain visible. The local App independently publishes
its eventual completion result; an earlier observation is not final evidence.

The observer does not dispatch local execution and has no write or merge
authority. On PR events its default checkout is the PR merge tree, so it may
execute candidate repository observer code with a read-only GitHub token, like
an ordinary read-only PR check; it does not run `pnpm install`. A trusted verifier
independent of candidate code belongs to a later phase. The host agent is never
updated from PR code. The local agent, App permission contract and
shadow qualification remain unchanged. No local check acquires merge authority.
`LOCAL_CI_MODE` controls observation and does not start or stop the installed
host service. A paused watcher remains a separate operational decision.

Database promotion still requires successful whole exact-main `CI` and CodeQL,
followed by the existing protected ephemeral proof and production approval.
Separating the observer removes its wait from CI completion; it does not replace
whole-workflow success with a weaker fast/build result. This phase does not
repair the separate DB/app release locks, change migrations, or deploy anything.

## Phase 2: fewer hosted jobs for the same tests

This phase reduces hosted job count and stops `main` pushes cancelling each
other. It removes no test. The measured cost model it is built on, and every
figure quoted here, live in the [consumption baseline](ci-cost-baseline.md).

The argument is that setup is a fixed toll paid per job. Run
[34290952137](https://github.com/lapeninns/nabaperks/actions/runs/34290952137)
(`push` on `main`, `d5f5c3641`) cost 154.1 machine-minutes over 72 jobs. Of that,
e2e spent 28.8 minutes of its 90.8 on setup rather than tests (32%), and
accessibility spent 13.7 of its 25.1 (55%) — roughly 52 seconds per job for
checkout, `./.github/actions/setup`, container pull and browser verification,
repeated 48 times. Accessibility prepares for longer than it tests. Fewer,
longer jobs pay that toll fewer times.

Three changes follow:

1. **e2e: 32 matrix jobs become 16.** Packs group eight original shards instead of
   four. The `/32` denominator is untouched, so Playwright's distribution is
   byte-identical and every original shard still runs exactly once — no gaps, no
   duplicates. Each shard keeps its own fresh Playwright server, one worker, and
   the existing listed-versus-executed inventory comparison.
2. **a11y: 16 matrix jobs become 8.** The `1/8..8/8` split becomes `1/4..4/4` — a
   different partition of the _same_ union — across both existing projects, so
   two projects times four shards is eight jobs. No project, spec, grep or retry
   setting changes.
3. **`main` pushes are no longer cancelled.** The concurrency group keyed on
   `github.ref` with `cancel-in-progress: true` means merging a second commit to
   `main` cancels the in-flight run of the previous one. Pull-request branches
   keep cancel-on-supersede, which is the behaviour you want there.

The visual tier is deliberately untouched: `test:visual` stays hosted x64 at four
shards, because it is the pixel-baseline authority and its rendering environment
must not move for a cost reason.

### What it is modelled to save, and what is not yet proven

Modelled: e2e 90.8 → 75.9 machine-minutes, a11y 25.1 → 18.1, together about **22
machine-minutes per run — a 14% reduction**, 154.1 → 132.3 — plus whatever share of
cancellation waste the `main` fix recovers. An earlier model quoted ~25 minutes and
16% by assuming a11y would collapse to four jobs; it landed at eight, so its
saving is 7.0 minutes rather than 10.3. Cancelled runs accounted for 9.7% of
job-minutes in a 25-run sample taken 2026-09-09, and 14% in an earlier window.

Two honest qualifications:

- **These are modelled from one run's job timings.** They are not an achieved
  saving and must be confirmed against real runs after merge before being quoted
  as one. The e2e figure is at least built from each pack's real measured test
  time rather than an even-distribution assumption, so the machine-minute result
  holds however packs are paired.
- **Wall clock is modelled as roughly unchanged, and this is the weaker claim.**
  Because existing shards are unevenly weighted, the slowest packed e2e job models
  at 364–372s depending on pairing, against a current 369s whole-run wall. The
  critical path moves from `Lighthouse (home)` (240s) to a packed e2e job, and a
  slight regression of roughly 15s is expected. The landed `packShards` emits
  consecutive blocks, so adjacent pairing is what ships; balanced pairing
  (1+8, 2+7, 3+6, 4+5) would recover about 8s for identical machine-minutes but
  would cost the script its one-line tiling proof, so it was not taken. An
  earlier ~285s estimate assumed even shard weights and should not be relied
  upon. The a11y tier has no such problem: summing real adjacent shard pairs
  gives a slowest job of 144s, and the 20-minute bound is generous either way.
  Both `ci.yml` comments now carry these measured figures rather than the
  abandoned four-job model's.

Nothing here is claimed as proven until a real post-merge run is measured. No
test was removed; that part is structural and checkable from the diff.

### Scope boundaries

This is a **hosted-side** change, independent of the local CI plane. It touches no
local runner, proof, qualification or cutover state, and local execution remains
advisory. Conversely, no local-CI progress produces this saving.

It is also not currently a monetary saving. `lapeninns/nabaperks` is public, and
Actions on standard runners is free for public repositories. The saving becomes
money only if the repository goes private: the Free plan allows 3,000 minutes a
month, which at 154 minutes per run is about **19 runs**, and at 129 about 23. The
present justification is headroom, queue behaviour, and the evidence gap below —
not an invoice.

That evidence gap is the more serious half of this phase. Of the last 40
`push`-on-`main` runs, 13 were cancelled, and `cae8eba95`, `d30ae19ee` and
`87abc72a0` — all in main's history — have exactly one CI run each, cancelled.
Those commits carry **no successful CI run**. Stopping main-push cancellation is a
correctness fix that happens to save minutes, not a cost optimisation.

The release gate is unchanged: the same nine hosted roots remain required, and
the aggregating `E2E (DB-free harness tier)` and `Accessibility sweep` gates still
require every constituent job. Job count is not coverage.

## Verification and rollout

Before merge, run targeted workflow/proof unit and contract checks, then the
repository checks appropriate to the change. Verify that all nine roots are
required, bad results fail closed, the observer has no dispatch/write/merge
authority, and missing/pending observation performs no polling or sleep. Preserve existing
App identity, permission and same-repository admission tests.

After merge, collect actual hosted evidence for an eligible PR and exact-main
push: complete hosted safety lanes, unchanged independent security checks,
separate bounded observer, and whole-CI completion without a local wait. Check
provider-required contexts separately; source membership does not prove live
ruleset enforcement. Check that missing local proof cannot block hosted CI or
be presented as a passing local test. For Phase 2, additionally re-measure job
count, machine-minutes, per-lane setup share and whole-run wall clock from a real
post-merge run and reconcile them against the modelled figures in the
[consumption baseline](ci-cost-baseline.md); a modelled saving is not an achieved
one, and a wall-clock regression is the expected way this change disappoints. No watcher restart, provider-setting
change or production dispatch follows automatically from these instructions.

At implementation time, these hosted/provider observations remain required;
local tests alone cannot establish them. Record the installed agent SHA and
provider/deployment state only after their own readbacks.

## Rollback

If the observer causes trouble, disable or revert that separate observational
workflow while preserving all nine hosted gate dependencies. Keep local proof
advisory. If gate wiring is wrong, correct the dependency/result mapping and
retain complete hosted safety coverage; do not restore fast/build-only merge
semantics to obtain a green result. Any coordinated workflow/provider-context
rollback requires an equivalent complete hosted gate and actual provider
readback. Diagnose genuine failing tests rather than rerouting them to bypass
failure. Production recovery remains governed by the production runbook.

## Later phases, each separately reviewed

1. Consolidate shared commands and pack equivalent browser invocations with
   test-identity, skip/flake and resource parity evidence. The browser-packing
   half of this is now Phase 2 above; shared command consolidation and the
   resource-parity evidence remain outstanding.
2. Qualify disposable local execution, durable attempts, resource budgets and
   trusted proof verification independent of candidate code.
3. Introduce authoritative local routing only with independent review,
   publisher binding and equivalent hosted fallback; qualify affected selection
   separately before reducing work.
4. Unify release ownership and stage manifests; prove populated schema upgrades,
   compatible rollback and exact production-candidate promotion.
5. Complete independent monitoring, paging, backup lineage and measured restore
   proof, then retire duplication supported by measurements.

The older [local cutover specification](local-ci-cutover.md) is historical and
superseded. Its variable/contract flips are not a current activation mechanism.
Do not change `shadowMode.enabled`, `bridge.enforcement` or a cutover-stage label
to make local evidence authoritative without implementing and verifying the
required trust and fallback controls.

The [completion evidence matrix](ci-redesign-completion.md) records the later
implementation, independent review, service-backed qualification and remaining
rollout gates. Shared command runners, durable attempts/resource enforcement,
signed-proof preparation, unified release ownership and recovery evidence are
tracked there separately from their merge and installed state. Full hosted
coverage remains authoritative until disposable execution and independent
trusted publication are qualified.

See [local operations](local-ci.md), [production operations](production-runbook.md)
and [incident response](incident-response.md) for their respective boundaries.
