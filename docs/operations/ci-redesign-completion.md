# CI redesign completion evidence

Owner: Lapen Inns product operations. Working evidence record started on
7 September 2026, Europe/London. Source implementation, independent review,
merge, installation, provider configuration and operational qualification are
different states. This record does not authorise bypassing any of them.

## Verified starting point

At 23:57 BST on 6 September 2026, remote main was
`bf6f38cff3563130295e5819548101a3bd1998f7`. The shared main checkout was clean
at `08ec0f43451dcd7d7f97464c59f7b519e3572013`, twenty commits behind. It has
not been reset, switched, stashed or cleaned by this work.

[PR #266](https://github.com/lapeninns/nabaperks/pull/266), head
`1e1fcb045b4d731fceb37ece888362ff99544e3f`, remained open with independent
code-owner review required. Its 174 checks were successful. An independent
source review found no blocking Phase 1 defect and ran 53 passing focused
tests. Live main rules still required Release gate, CodeQL and dependency
review, with fresh independent code-owner approval and no bypass actor.

The installed agent symlink identifies
`bf6f38cff3563130295e5819548101a3bd1998f7`; job image is
`nabaperks-ci-job:68fc908fd3bf850bc18bc4efaee8a33f373c3bce`. The previous
operational owner handed over coordination and confirmed the watcher was
stopped at a completed-job boundary. At 00:11 BST on 7 September the
Nabaperks Lima VM was running. The separate Nabatable VM is owned by its own
task. No installation or watcher resume is implied by source changes.

Historical last main qualification: App check `101532880700` for exact main
timed out after 61m21s while downloading DB images, before DB assertions. Nine
preceding lanes passed, but that is not a successful full-main qualification.
The historical comparator result was divergent. This run was not repeated
merely to refresh the timestamp.

[PR #264](https://github.com/lapeninns/nabaperks/pull/264), head
`a5befc0ad756ecac53d93c00d71a116af1f22151`, is the previous owner's unmerged
draft image-cache repair. Its relevant source is incorporated here with
resource-budget and cancellation checks. The archive was subsequently completed and independently qualified with the
filtered DB lane. Installation and full-profile qualification remain separate
obligations.

## Completion matrix

The reviewed core is commit `86b58fce81618b002311f3c96f07e60c171f3dcb` in
[draft PR #268](https://github.com/lapeninns/nabaperks/pull/268), with separate
follow-up preparation tracked in the isolated
`codex/ci-redesign-completion-20260907` worktree. It is unmerged and requires
independent GitHub approval. The original PR #266 and PR #264 worktrees remain
preserved.

| Requirement                          | Source implementation                                                                                 | Review and local evidence                                                                            | Merge / installation                                   | Hosted / operational proof and blocker                                                                                                                        |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Complete hosted gate                 | PR #266, nine roots and strict result validation                                                      | Independent review; 53 focused tests; current-head hosted checks passed                              | Open, independent GitHub approval required             | Resulting main CI, observer and downstream release still need post-merge proof                                                                                |
| Advisory observer                    | PR #266, separate read-only one-read two-minute job                                                   | Missing/pending cannot become passing local tests                                                    | Open                                                   | Exact-main observer timing after merge pending                                                                                                                |
| Shared workload commands             | `config/ci-workloads.json`, shared runners, hosted/local wiring                                       | Command failure, exact selection and multiset tests                                                  | Unmerged, uninstalled                                  | 152 hosted / 48 local browser invocations retained; all six selection inventories equivalent; 976 passes, 152 skips, no failures/flakes across 48 invocations |
| Browser execution parity             | Identity, outcomes, skips, flakes, process result and resource evidence comparator                    | Global teardown failure regression added after independent review                                    | Qualification helper only                              | Reviewed eight-shard versus unsharded pilot prepared; actual paired runtime measurements still required                                                       |
| Durable attempts                     | Journal, bounded infrastructure retry, publication outbox, nightly/one-shot/watch integration         | Crash/restart/publication/cancellation fixture tests                                                 | Unmerged, uninstalled                                  | Dedicated fixture controller crash/restart cleanup passed; full controller installation remains unqualified                                                   |
| Exclusive controller                 | Atomic PID/start-identity lease and conservative stale-owner recovery                                 | Live-owner, stale-owner and unverifiable-owner cases                                                 | Unmerged, uninstalled                                  | Shared-host installation and failure-injection qualification required                                                                                         |
| Resource bounds                      | Job 10 CPU/32 GiB, DinD 1 CPU/6 GiB, reserve 1 CPU/2 GiB                                              | Both command builders reject malformed budgets/overcommit                                            | Unmerged, uninstalled                                  | Live cgroups confirmed CPU/memory/zero swap; exact DB lane passed under limits at 00:32:55 BST                                                                |
| Verified image preload               | PR #264 source plus current budget/cancellation integration                                           | Archive/blob/layer/image identity and timeout tests                                                  | Unmerged, uninstalled                                  | Full archive and image identity verified; 528/528 DB tests passed including teardown in 241 seconds                                                           |
| Trusted local proof                  | Signed envelope, independently supplied policy/log hashes, replay-aware routing decision              | Forged/stale/mismatched/missing/duplicate/replayed proof tests                                       | Prepared; no local authority                           | Signing/policy provisioning, trusted supervisor integration and disposable execution unqualified                                                              |
| Trusted observer                     | Manual main-only workflow, no candidate checkout, always full hosted routing                          | CLI missing-policy fallback verified                                                                 | Unmerged                                               | Protected supervisor and disposable Lima adapter independently reviewed; root installation, service identity and actual isolation qualification absent        |
| Unified release ownership            | DB workflow calls reusable application stage while retaining `production-release` lock                | Independent review and caller identity/DAG/artifact fixture tests passed                             | Unmerged                                               | Real approval/secret/permission/concurrency behaviour requires protected hosted run                                                                           |
| Exact candidate promotion            | Full SHA/project/team/READY/target/immutable-ID validation immediately before promotion               | Negative candidate and artifact tests                                                                | Unmerged                                               | Actual staged provider readback on resulting main pending                                                                                                     |
| Release handoff to smoke             | Run/attempt-bound candidate artifact, successful promotion/public probes required                     | Wrong outer SHA, wrong attempt/path, corrupt/missing artifact tests                                  | Unmerged                                               | GitHub reusable-run artifact shape and actual downstream smoke require hosted proof                                                                           |
| Stage and compatibility records      | Five-stage producer and workflow enforcement, authenticated baseline and exact run/attempt transfer   | Independent review; stale/replay/wrong-attempt/changed-alias/dirty-source rejection                  | Unmerged; CI-only unchanged-app/schema admission wired | Hosted chain and authentic general application/schema compatibility producer remain required                                                                  |
| Populated schema upgrade             | Loopback-only marked fixture harness; exact baseline migration prefix; real synthetic schema fixtures | 9 tests passed; independent review closed invariant, transaction/ledger and artifact-binding defects | Unmerged                                               | Real platform DB, meaningful baseline/candidate/rollback app probes and successful execution required                                                         |
| Independent monitoring               | Separate scheduler/paging dependency and delivery/acknowledgement evidence contract                   | Missing/stale/dependent/mismatched evidence rejected                                                 | Preparation only                                       | Existing GitHub + production Supabase page path does not qualify; external operator/service decision needed                                                   |
| Backup lineage and measured recovery | Protected digest-bound source ledger/counts/restore operation; post-query end-to-end RTO              | Wrong lineage, tampering, count mismatch and verification-over-RTO cases                             | Unmerged                                               | Reviewed provider lineage/baseline, isolated restored project and measured drill absent                                                                       |

## Current operating authority

Until reviewed source is merged and the resulting main is verified, the live
architecture remains the existing hosted bridge-shadow system. PR #266's
broader gate is source-ready but is not yet live main behaviour. Neither
observer nor a configuration label grants local merge authority.

The proposed source retains all hosted roots and independent security checks.
Browser grouping and affected-test selection are not activated. The local
profile is not equivalent to all nine hosted roots: build, visual, Lighthouse
and baseline ZAP still need their appropriate hosted proof.

ZAP retains its existing policy: the job must succeed, but the pinned action's
default `fail_action: false` and empty rules file do not make every scan
finding blocking. This redesign does not silently change that policy.

## Release ownership and recovery

`production-database.yml` is the proposed single routine release owner. Its
whole-workflow concurrency group holds through exact-main CI/CodeQL admission,
ephemeral proof, protected DB application, the reusable application stage,
promotion and immediate public revision/readiness probes. The reusable workflow
has no second same-group lock. Administrative production mutators share the
outer group; the isolated recovery drill does not.

The application callee verifies the caller's actual GitHub workflow path,
repository, run/attempt, allowed event and candidate derivation before its
credential-bearing job. Both DB and application jobs retain the Production
environment. Permission scopes are granted only on the reusable call where
needed. No blanket secret inheritance is used.

There is no separate standalone application workflow run after conversion.
Scheduled smoke remains independent of release execution, and release-triggered
smoke reads the actual successful candidate artifact from the completed outer
run. The outer run's `head_sha` is not necessarily the candidate and is never
used as a substitute. Immediate public probes remain inside the release lock.

Manual recovery now uses the complete outer workflow, its main-tip SHA and
`PROMOTE_PRODUCTION_DATABASE` confirmation; it repeats ephemeral proof and the
forward-only DB path. The old application-only dispatch is removed. A failed
release after DB application is explicitly incomplete; an app-only rollback
must still satisfy the production runbook's compatibility rules. Forward DB
migrations are not reverted automatically.

GitHub concurrency is not a durable FIFO queue. Pending runs may be replaced,
even with cancellation of active work disabled. Main may also advance while
an existing release waits for approval, causing its existing immutable-tip
guard to reject it after DB application. Inspect the partial state and use a
reviewed compatible recovery. Do not interpret queueing or a green earlier
stage as eventual completion. Partial-rerun behaviour needs hosted proof.

## Recovery evidence boundary

The Recovery Drill environment must contain independently reviewed lineage and
source-baseline JSON, their separately pinned SHA-256 digests, and the explicit
recovery start. The workflow materialises those records from protected
environment variables. It must not hash arbitrary submitted files and then
call that self-derived digest a trust anchor.

Required variables are `RESTORE_DRILL_STARTED_AT`,
`RESTORE_DRILL_LINEAGE_JSON`, `RESTORE_DRILL_LINEAGE_SHA256`,
`RESTORE_DRILL_SOURCE_MANIFEST_JSON`, and
`RESTORE_DRILL_SOURCE_MANIFEST_SHA256`, in addition to the existing target and
RTO settings. The lineage must bind the source project, backup ID/recovery
point, completed provider restore operation and disposable target. The source
manifest must bind the actually applied ledger and aggregate row baseline at
that recovery point. Migration filename dates cannot establish either fact.

The verifier checks the digest-pinned reviewed evidence; it does not itself
authenticate a provider restore API response. A reviewer must establish its
provenance. Measured RTO includes database verification through its final clock
read. Source unit tests are not a restore drill.

## Provider prerequisites observed

The live GitHub governance readback on 7 September passed main review/check
controls but failed existing Monitoring paging-secret and Recovery Drill
target/credential prerequisites. New recovery evidence variables add explicit
source requirements, not evidence that they are configured.

After creating ignored local project metadata for the explicit canonical
target, Vercel governance passed all 22 controls. Supabase governance passed
nine controls and failed its PITR requirement: point-in-time recovery is
disabled. The 191 source migrations exactly matched production; seven
continuous physical backups were reported, latest approximately 16.3 hours
old at collection. Backup metadata is not a successful restore drill.

At 00:29:52 BST on 7 September 2026, authenticated Vercel alias readback for
`nabaperks.com`, followed by deployment lookup and a repeat alias read, bound
the active production deployment to
`dpl_sHSbuRKNMbJgywLRNWxeD7tYcQyG`, full SHA
`bf6f38cff3563130295e5819548101a3bd1998f7`, immutable host
`nabaperks-7v6xhqboc-lapen-inns-projects.vercel.app`. No production mutation
was performed. A fresh release must resolve that baseline again; this
historical value is not release admission.

No notification delivery, paid-service purchase, production restore, external
monitor provisioning or production migration was authorised implicitly by
this document. Required independent GitHub approvals remain external gates.

## Validation log

Focused implementation checks are fixture/source evidence. Full repository
quality, build, independent integrated review, service-backed checks and live
provider results are appended as they finish. Existing successful production
deployment run for the starting main:
[34059767043](https://github.com/lapeninns/nabaperks/actions/runs/34059767043).
Existing successful production smoke readback:
[34064097664](https://github.com/lapeninns/nabaperks/actions/runs/34064097664).
Neither proves the proposed redesign is deployed.

### Local gates and isolated operational proof

The isolated completion worktree passed `pnpm quality:check` (including
lint, strict typecheck, contracts, unit tests, dead code, duplication, debt,
generated API docs and agent documentation) and `pnpm build` before the final
stage-ledger wiring. The build used synthetic loopback/provider fixture values
only. The stable integrated revision must receive its final focused checks and
full gate before handoff.

At 00:32:55 BST on 7 September 2026 the independently operated Nabaperks VM
fixture passed the exact DB lane: **528 passed, zero failures/skips, 241
seconds**, including the Git snapshot guard and Supabase teardown under the
unchanged 25-minute lane timeout. Before repository commands, the complete
verified cache archive and loaded image configs were checked. Live cgroups
reported 10 CPU/32 GiB for the job, 1 CPU/6 GiB for the sidecar and zero swap.
Docker had no explicit PID limit; the inherited cgroup limit was 47947.

Separate live fixtures proved three-second timeout cleanup, cancellation after
READY, and killing only the dedicated fixture controller followed by successful
reconciliation of its identical resource names. No qualification containers or
networks remained. The job mounted only its VM fixture workspace, without
published ports or host Docker socket. The installed launchd watcher remained
absent. The separate Nabatable VM was not touched.

The first DB attempt passed all assertions but failed the overall lane because
the source archive lacked Git metadata required by the snapshot guard. A
VM-only Git repository committed the enumerated synthetic snapshot, then the
entire unchanged lane was repeated successfully. That fixture commit is
`021c3452d34e9acb5e204abee56f0f1bd892dfd1`; it represents source base
`1e1fcb045b4d731fceb37ece888362ff99544e3f` plus an inventory of captured
uncommitted changes, not a hosted or published candidate. Both attempts and
file hashes are retained in the local qualification report. No exact-commit
App result was published; full-main/nightly qualification remains absent.

Browser before/after `--list` JSON inventories matched across all six local
suites: E2E Chromium 238, mobile Safari 281, Firefox 235, desktop Safari 235;
accessibility Chromium 68 and mobile Safari 71. Actual execution of all 48
unchanged invocations is separate from selection inventory and is recorded
below. Visual remains a hosted lane: ARM Linux shares snapshot names
with the blessed x64 PNGs and is not an equivalent baseline environment. No
baseline was updated.

### Exact committed core and initial hosted readback

A separate clean detached worktree at
`86b58fce81618b002311f3c96f07e60c171f3dcb` received its own frozen dependency
install. `pnpm quality:check` passed **688 contract tests and 1,510 unit tests**
with zero failures, including the remaining repository gates. `pnpm build`
also passed for that exact clean commit with synthetic provider fixtures. The actual
`stage-ledger qualify` CLI also passed for that full source tree against the
authenticated deployed-baseline revision, using an explicitly synthetic local
run ID. It establishes source admission behaviour, not a production release.

The CodeQL analysis workflow [34068194044](https://github.com/lapeninns/nabaperks/actions/runs/34068194044)
and dependency review
[34068194013](https://github.com/lapeninns/nabaperks/actions/runs/34068194013)
succeeded for the core commit, but the separate CodeQL findings check failed with eight new alerts (four filesystem-race and four filesystem-to-HTTP dataflow reports). Analysis completion does not mean clean findings. The boundary fixes are under independent review; no alert was suppressed or dismissed. The separate observer
[34068194004](https://github.com/lapeninns/nabaperks/actions/runs/34068194004)
ran from 00:54:53 to 00:55:03 BST on 7 September 2026. Its actual single-read
step reported no matching App check, explicitly stated that this was not a
merge verdict, and completed in roughly half a second without polling. The
successful observer means observation completed; no local tests passed on its
account. Full hosted
[CI 34068194035](https://github.com/lapeninns/nabaperks/actions/runs/34068194035)
subsequently passed all 168 jobs. Release gate ran from 01:03:58 to 01:04:08 BST. The failed separate CodeQL findings check still prevents describing all PR checks as successful.

Authentic domain-probe artifacts were built for deployed baseline
`bf6f38cff3563130295e5819548101a3bd1998f7` and candidate
`86b58fce81618b002311f3c96f07e60c171f3dcb` from clean source exports, isolated
fresh stores and pinned frozen dependency installs. The bundled Linux ARM
Node 24.11.0 binary SHA-256 is
`bdcfa37d37f877ec1893226ccf24f68ed97867075a11a2e5a3a3533950b1a86e`.
The baseline and candidate contain the same application and migration bytes;
this artifact build does not itself prove a populated migration delta or an
executed application probe. Pristine platform execution remains a separate
recorded step.

### Completed local browser execution

At 01:15 BST on 7 September 2026, all six local browser lanes completed:

| Lane                        | Passed | Declared skips | Failed / flaky | Duration |
| --------------------------- | -----: | -------------: | -------------- | -------- |
| E2E Chromium                |    213 |             25 | 0 / 0          | 7m08s    |
| E2E mobile Safari           |    239 |             42 | 0 / 0          | 7m44s    |
| E2E Firefox                 |    194 |             41 | 0 / 0          | 10m39s   |
| E2E desktop Safari          |    194 |             41 | 0 / 0          | 6m07s    |
| Accessibility Chromium      |     67 |              1 | 0 / 0          | 3m16s    |
| Accessibility mobile Safari |     69 |              2 | 0 / 0          | 3m28s    |

The 48 unchanged invocations selected 1,128 tests: 976 passed and 152 skipped.
Total duration was 2,302 seconds. Pixel baseline guards passed. Maximum sampled
memory was 6.145 GiB under the 32 GiB job limit; sampling does not establish
true process RSS peak. Source comparison covered 1,275 files and found only
the profile description correction from authoritative to advisory; executable
browser and application source matched the frozen fixture. Next-generated
fixture tsconfig changes were retained separately. All owned containers and
networks were removed, and the installed watcher remained absent.

The local qualification directory retains 46 evidence files with 45 verified
hashes, including `BROWSER-QUALIFICATION-REPORT.md`, `browser-result.json`,
selection comparisons, resource samples, source differences and
`evidence-sha256.json`. This is current workload qualification; it is not a
paired grouping benchmark or proof of full-main/nightly coverage.

### Reviewed follow-up preparation

This preparation is deliberately **not** carried on the reviewed core branch.
It lives on `codex/ci-redesign-followup-prep`, which contains the core plus the
three prepared adapters, so the core pull request stays reviewable and its code
scanning surface stays limited to the redesign itself. None of it is activated,
and none of it is a merge prerequisite.

The disposable Lima adapter preserves raw log bytes through signing and base64
audit persistence, including bounded partial timeout output. Cleanup requires
provider-read ownership nonce, attempt, source and runtime bindings.
Independent reproductions confirmed split UTF-8/invalid bytes remain exact and
a colliding foreign VM is not deleted. Lima template validation passed; no
disposable VM was created. Root-protected runtime installation, dedicated
service identity, prepared offline image and actual isolation proof remain
external operational prerequisites.

The browser grouping experiment has independent source review and eight
passing fixture tests. Host-only receipts bind the entire result, policy,
lifecycle, configuration and measurement bundle, plus experiment definition
and budget. Its prepared eight-shard versus unsharded arms do not change
active wrappers, profiles or coverage. Every experimental result retains
`activation: false`. Its generated Playwright configuration is built by string
interpolation and code scanning reports it as unsanitised code construction;
that must be resolved on the follow-up branch before any activation.

The pristine Supabase platform provisioner has independent source review and
seven passing fixture tests. It requires empty private DinD, pinned images,
an authentic blank platform clone and a one-use target marker; cleanup is
restricted to the exact project. Actual platform startup, populated upgrade,
application probes and real SQL failure injection remain separate service
proof obligations.

### Code scanning state

Seven of the eight alerts recorded against the core commit are closed at their
source boundaries. Four filesystem-race reports are closed by inspecting and
reading a single opened descriptor; the observation path no longer derives its
request target from file data.

Four findings remain open and are assessed as false positives on guarded code.
They are not dismissed. Three `js/file-access-to-http` reports on
`deliverEvent` follow the configured receiver URL and the alert payload, both
of which are rebuilt from validated primitives: the receiver must be public
HTTPS with no credentials, port, query or fragment, must not share a monitored
or control-plane domain, and must match the reviewed paging hostname binding;
every delivered field is a literal constant, a format-checked UUID or a
canonical ISO timestamp. One `js/shell-command-injection-from-environment`
report covers a test that passes the interpreter and fixture paths as `sh`
positional parameters rather than interpolating them. A reviewer must decide
between a justified dismissal and restructuring these call sites; neither has
been done unilaterally.
