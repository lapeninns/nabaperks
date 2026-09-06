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
be presented as a passing local test. No watcher restart, provider-setting
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
   test-identity, skip/flake and resource parity evidence.
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
