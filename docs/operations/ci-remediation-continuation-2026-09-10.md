# CI remediation continuation, 10 September 2026

Base: PR #300, `codex/ci-simplify-20260910`,
`61c7b690c481c5c70c06efb46e00bc9b778fb5ec`. This continuation preserves
that increment and the decision **Pause, do not retire, and do not run both**.
Hosted checks remain authoritative; local results remain advisory.

## Execution evidence and drift

Bare lane IDs now carry unknown execution. They still map to their declared
roots, but cannot establish coverage, including beside a verified sibling.
Object entries still require both supervisor assertions. No runtime is upgraded
to supervisor verification by this change.

The shared `dispatchRun` path now invokes the installed-revision checker before
VM inspection, resource recovery, checkout or evidence creation. Execution or
image-input drift, an unreadable install, a stale/unavailable provider reference,
and an agent executing outside the installed current release all refuse dispatch.
This covers watcher, one-shot and nightly callers. Dry-run remains a plan only.

An installed release has no Git metadata. The preflight therefore creates a
disposable host Git reference and fetches the pinned canonical repository's main
branch, without reading a candidate checkout. The existing checker independently
checks the current provider SHA. A race fails closed. The temporary reference is
removed on exit; accepted runs retain `installed-revision.json` beside their lane
results. This is source attribution only: neither a source tag nor this check
attests job-image contents, provides execution verification or grants authority.

On 10 September the actual installed source was
`aed95ca9b33eacbe79c7a4b2808976649b2502c6`, ten commits behind provider main
`e0c04c6242d88fd9c38c3e8cbdfb0c3f73552623`. The new inspection path returned
`execution-surface-drift`, exit code 3. The privileged installation was not
updated. An isolated canary must remain outside its launchd service and journals;
it cannot publish qualification or borrow the installed controller's attribution.

## Resource budget

The proposed local browser old-space ceiling is 4096 MiB. Every browser lane
retains its hard 8192 MiB cgroup limit and unchanged CPU allocation. Profile
validation binds that ceiling to the contract and checks planning allowances of
1536 MiB for browsers and 2560 MiB for native memory, young space, tooling and
filesystem charges. These are allowances within one enforced cgroup limit,
not separately enforced process limits or a promise that V8 fails before OOM.

Admission retains 32 GiB for workers, 6 GiB for the DB daemon and 2 GiB for the
VM, within the existing 40 GiB guest. Four browser lanes fit; three browser
lanes plus the DB lane and its daemon also fit; four browser lanes plus DB are
refused. A larger daemon cannot silently borrow the VM reserve. No VM resize,
sidecar resize, coverage-floor reduction or skip-ceiling increase is proposed.
The /32 E2E denominator is retained. Hosted heap and visual baselines are unchanged.

## Declared VM experiments and outcomes

The immutable run set and raw outputs are kept outside operational journals at
`~/.codex/tmp/nabaperks-ci-remediation-20260910/`. Attempt A was declared for
PR #300's main profile and stopped before workspace/container creation because
the canary harness omitted its own controller lease. It executed no tests and is
a failed preflight, not passing evidence. The corrected harness declared B before
running it. C was separately declared for the resource-budget comparison. No
failed VM lane was discarded or retried to obtain these results.

| Attempt | Workload revision                          | Scope and result                                                                                                                                        |
| ------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A       | `61c7b690c481c5c70c06efb46e00bc9b778fb5ec` | Full-main plan; preflight failed because the harness omitted its isolated lease. No workspace or container created.                                     |
| B       | `61c7b690c481c5c70c06efb46e00bc9b778fb5ec` | All 10 main lanes succeeded; 1180 seconds; 15:55:27–16:15:07 UTC.                                                                                       |
| C       | `7b369521e786d541119d8ff1aa8be0acf6b695e4` | All 10 main lanes succeeded; 1159 seconds; 16:17:17–16:36:35 UTC. Same browser selection, new budget and repair regressions.                            |
| D       | `c47bccf77ae97af9cd1d566f20b96fa38d5810d5` | Separately declared four-lane a11y run for draft PR #301. Its result belongs in the composition decision record; it is not a complete main-profile run. |

Both B and C used the pinned `61c7b690c` dispatcher solely as a canary harness,
with isolated state, lease and VM workspace. C loaded its profile and contract
from `7b369521e`. This deliberately does **not** test installation of the new
dispatch gate: that gate was separately tested to refuse the real drifted install.
No GitHub publication client or signing credential was supplied. All returned
lanes keep `executionStarted: null` and `executionVerified: null`.

The existing image was pinned by its observed immutable Docker image ID, recorded
in each plan. Its declared source `68fc908fd3bf850bc18bc4efaee8a33f373c3bce` is
older. Every lane installed the workload revision's frozen dependencies. This
does not attest image contents or qualify an image against the candidate.

| Lane                | B passed/skipped | C passed/skipped | JSON parts B/C | Duration B/C, seconds | Sampled peak B/C, GiB |
| ------------------- | ---------------- | ---------------- | -------------- | --------------------- | --------------------- |
| E2E Chromium        | 220/26           | 220/26           | 32/32          | 723/661               | 4.927/4.771           |
| E2E Mobile Safari   | 249/43           | 249/43           | 32/32          | 816/846               | 6.359/6.161           |
| E2E Desktop Firefox | 201/42           | 201/42           | 32/32          | 677/725               | 5.342/5.374           |
| E2E Desktop Safari  | 201/42           | 201/42           | 32/32          | 759/782               | 6.483/6.671           |
| A11y Chromium       | 71/1             | 71/1             | 8/8            | 266/292               | 4.727/4.947           |
| A11y Mobile Safari  | 73/2             | 73/2             | 8/8            | 326/342               | 6.092/6.181           |

Every browser lane in both runs had zero failures, zero flaky outcomes and zero
missing log parts. B fast reported 2491 passed checks; C reported 2500 after the
new regression tests. The database lane passed 594 checks in each run. Quality
and print-kit succeeded without parsed test counts; their zero counts are not
claims of test execution.

The baseline contained 12 historical OOM container scopes. After B, all 12 were
still present with no new scope. After C, the ring buffer retained 10 historical
scopes and no new one: its first retained timestamp was 2777.69 seconds after
boot, far earlier than either canary, and its latest OOM remained at 20516.49
seconds. The two absent scopes aged out of the ring buffer; they were not repaired
or removed. Sampled cgroup `oom`, `oom_kill` and `oom_group_kill` counters stayed
zero for C. Captured logs therefore cover the experiment period without a new
kernel OOM event.

These measurements support the /32 fix under the tested main workload. They do
not prove that OOM is impossible. Samples read lifetime `memory.peak` every ten
seconds while containers existed; the final unsampled interval can be missed,
and B sampling began after early lanes finished. Peaks include filesystem and
other cgroup charges, not just next-server RSS. B and C are serial runs with
cache and scheduling differences, not randomised controlled performance trials.
The 21-second total difference does not establish a speed improvement. Desktop
Safari and both dedicated a11y peaks increased, so the 4096 MiB old-space ceiling
must not be represented as uniformly reducing peak memory or forcing a V8 error.

## Source validation and review state

Implementation commits are `82f258b9e` (unknown bare-ID execution), `a428224aa`
(shared dispatch drift refusal), `199ebc5ac` (resource allowances) and `7b369521e`
(real inner Playwright signal preservation). They extend PR #300; they do not
replace the first increment.

`pnpm quality:check` passed on implementation revision `7b369521e`: 717 contract
checks and 1783 unit tests, plus lint, typecheck, dead-code, duplication, linked
debt and generated documentation checks. A production `pnpm build` passed using
non-production fixture environment values. Targeted signal tests exercised real
SIGKILL and SIGTERM children through the inner wrapper, actual pnpm command and
outer wrapper, preserving 137/143 while preserving ordinary exit 1 and success 0.
The new root-coverage, drift-gate and admission-budget regressions passed.

GitHub readback at 17:37 BST showed PR #300 at `7b369521e` with 53 successful
checks, including Release gate, CodeQL analysis and dependency review. The PR
remained open, `REVIEW_REQUIRED`, with two unresolved earlier review threads.
Their reported signal/denominator issues have source fixes, but this author has
not resolved the threads or substituted a second account for independent review.
A later documentation commit needs its own current-head provider readback;
the prior green SHA is not transferable evidence.

The separate composition proposal is draft PR #301, based on PR #300's branch.
Its source checks and fixture build passed. Because the CI pull-request trigger
targets `main`, a stacked-base draft does not have that full hosted run. After
independent review and merge of #300, retarget #301 to main and obtain the full
candidate's hosted results. No workflow trigger was weakened to manufacture them.

## Isolation findings: scope only

The objective explicitly asks for scoping these findings, with containment and
protected-gate changes reserved for a separate reviewed decision. Implementation
permission does not authorise self-approval, a production change or a bypass of
that boundary. No exploit, LAN probe or new privilege grant was performed.

| Finding                                                   | Evidence and impact                                                                                                                                                                                                                                                                                                                             | Concrete next action                                                                                                                                                                     |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Candidate DB code can control a privileged sibling daemon | `agent/container.mjs` starts Docker-in-Docker with `--privileged`, disables daemon TLS, and gives the DB job `DOCKER_HOST` on the same network namespace. An unprivileged job process therefore has administrative daemon capability; describing only the job container as unprivileged is insufficient isolation.                              | Review and implement a disposable guest boundary for DB work with no host mounts/credentials and externally enforced egress, then prove cold-cache, crash-cleanup and guest destruction. |
| Egress is not constrained by the executor                 | Job networks are ordinary Docker bridges; no executor-owned LAN-denial policy is applied before candidate launch. This source audit establishes no trusted egress restriction, not a demonstrated connection to a specific LAN asset.                                                                                                           | Approve an egress policy enforced outside candidate-controlled Docker configuration, with explicit dependency destinations and negative host/LAN probes in disposable fixtures.          |
| One-shot allowlist wiring is missing                      | `assertAllowedJobRequest` has no production caller. The watcher uses `classifyRequest`, but `runOnce` accepts a shaped SHA and ref, then reaches `dispatchRun` without a provider-backed head/base-repository classification. Fetching from the canonical repository alone is not proof that an arbitrary reachable PR commit originated there. | Add a shared provider-resolved ref/SHA/repository admission check before every dispatch; test fork heads, mismatched SHAs, lookalike repositories and unavailable provider evidence.     |
| Candidate code computes the required Release gate         | `ci.yml` checks out the candidate and executes its `scripts/ci/verify-required-evidence.mjs`. The live ruleset requires this named check; the check's own evaluator is still candidate-controlled.                                                                                                                                              | Separately review a trusted verifier workflow/reference and provider binding, then read back the protected check configuration without weakening the existing gate.                      |

Live ruleset `19613437` was read back on 10 September: active; no bypass actors;
one approving review; stale approvals dismissed on push; code-owner review and
thread resolution required; strict checks `Release gate`,
`Analyze (javascript-typescript)` and `Review dependency changes`. The required
check entries contain no integration IDs. These settings were not changed.

## What each test tier proves

| Tier                                    | Server/data surface                                                                    | Proof and limits                                                                                                                                                                                                                                                                                                              |
| --------------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit and source contracts               | Node processes and explicit test fixtures                                              | Domain behaviour and source/configuration invariants; no live provider or deployed application proof.                                                                                                                                                                                                                         |
| CI E2E                                  | `playwright.config.ts`: `next dev --turbopack`, one worker, DB-free harness by default | Browser interaction, hydration and selected accessibility assertions. Fixture-dependent database tests keep their skips. It is not a production-bundle journey.                                                                                                                                                               |
| Dedicated a11y                          | Same dev server; `@a11y`, currently Chromium/Mobile Safari                             | Axe and accessibility interactions on selected routes. It overlaps E2E until the separate composition change lands.                                                                                                                                                                                                           |
| Visual                                  | Same dev harness, canonical hosted Linux x64 baselines                                 | Pixel regressions for approved browser/baseline combinations. Local ARM64 excludes and ignores snapshots; no baseline migration is proposed.                                                                                                                                                                                  |
| Build/JSON-LD, Lighthouse, ZAP baseline | `next build` and `next start`; reused production bundle                                | Buildability, public structured data, sampled performance/accessibility/SEO and passive security checks. They do not cover every customer journey.                                                                                                                                                                            |
| Database moat                           | Disposable Supabase CLI stack                                                          | Database/RLS/RPC behaviour under fixtures; no production database was used in the canary.                                                                                                                                                                                                                                     |
| Protected release ephemeral staging     | Exact revision built and started; disposable Supabase; loopback HTTPS                  | Signed webhook and rollback-only loyalty smoke plus `merchant-id-verification.spec.ts` and `.desktop.spec.ts` in Mobile Safari/Chromium, including ID collection and accessibility. These are the two spec files explicitly run against a production server. Provider delivery and original customer success remain separate. |
| Nightly                                 | Dev-server cross-browser selection plus built-app load/full-ZAP and mutation/DB stress | Broader non-browser checks and a browser selection repeat. It is not entirely redundant, and its browser runtime policy differs from CI.                                                                                                                                                                                      |

The files named `production-qa.desktop.spec.ts` and
`production-review-closure.desktop.spec.ts` still use the ordinary configured
server; their names are not production-build evidence. `/dev` routes remain
blocked by the production layout. No harness route, visual baseline, production
credential or release approval was changed to expand test coverage.

## Finding disposition and next actions

| Objective                                         | Status                                           | Changed files and next action                                                                                                                                                                                                                                                                       |
| ------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.1 Browser fix in the container                  | **FIXED AND VERIFIED** for the declared canaries | Existing /32 selection retained; `scripts/run-playwright.mjs`, `scripts/ci/process-exit.mjs` and `browser-workload.mjs` preserve inner signals. Both complete VM runs have all 32 Mobile Safari reports and no new OOM scopes. Obtain independent current-head review before merge.                 |
| 3.2 Consistent resource budget                    | **IMPLEMENTED, PENDING REVIEW OR INSTALLATION**  | `config/local-ci-contract.json`, `core/browser-budget.mjs`, `core/profiles.mjs` and all three generated profiles enforce the proposed allowances. C passed the real VM workload. Review the headroom trade-off, then install only the reviewed main revision under the separate operating decision. |
| 3.3 Drift detector wiring                         | **IMPLEMENTED, PENDING REVIEW OR INSTALLATION**  | `agent/installed-revision.mjs` and `agent/main.mjs` gate shared dispatch. The actual stale install is refused with exit 3. After review, test the installed matched and drifted paths before any separately authorised resume.                                                                      |
| 3.4 Bare-ID honesty                               | **FIXED AND VERIFIED** in source                 | `core/root-coverage.mjs` and regression tests retain unknown execution for bare IDs, including mixed verified/unverified siblings. Delivery still depends on review and installation.                                                                                                               |
| 3.5 A11y composition                              | **IMPLEMENTED, PENDING REVIEW OR INSTALLATION**  | Separate draft #301 updates the workload manifest, generator, hosted a11y matrix, local profiles, snapshot exclusion guard and composition tests. Review both halves together, retarget after #300 merges, then collect new real per-lane qualification baselines without lowering existing floors. |
| 3.6 Isolation and trusted gate                    | **BLOCKED BY EXPLICIT APPROVAL**                 | The four scoped findings above remain open. Approve a separate reviewed containment/admission/trusted-verifier design; do not resume the old controller as a workaround.                                                                                                                            |
| 3.7 Tier classification                           | **FIXED AND VERIFIED** as an investigation       | Source classification above and the separate composition record identify dev versus built-server evidence and nightly selection overlap. Broad production-bundle customer-journey coverage remains **NOT YET PROVEN**; design that tier separately while keeping `/dev` blocked.                    |
| Local authority, image attestation and deployment | **NOT YET PROVEN**                               | These canaries do not create qualification, image-content attestation, protected release evidence or customer/provider success. Follow the existing separately reviewed qualification and release procedures.                                                                                       |

Retained components: the local agent, trusted supervisor, routing, proof envelope
and policy, shadow observer, nightly proof, hosted fallback, /32 E2E structure,
repair journals, all installed releases and both VMs. Simplified components:
shared signal-to-exit conversion and explicit browser budget validation. Replaced
behaviour: bare lane strings no longer assert execution; shared dispatch no
longer accepts a drifted installation. Removed components: **none**. No subsystem
is marked **SUPERSEDED AND REMOVED**. Duplicate a11y executions are only proposed
for removal in the separate review; nightly remains intact.

## Rollback and operating handoff

To withdraw this continuation, revert its four implementation commits in reverse
order (`7b369521e`, `199ebc5ac`, `a428224aa`, `82f258b9e`) through review, preserving
the original PR #300 fixes. Re-run `pnpm quality:check` and the fixture production
build on the resulting revision. Do not roll back the honest count/signal handling
merely to turn a failed run green. The composition proposal must be reverted as
one unit so neither the E2E exclusion nor the four-project a11y expansion remains
alone. Documentation-only evidence commits can remain as historical records.

No privileged install, service restart, production deployment, production DB
mutation, protected-setting change or release approval occurred. Therefore no
service rollback is required. Keep `com.nabaperks.local-ci` disabled and absent
from launchd until its independent operating prerequisites are satisfied; keep
the `nabaperks-ci` VM running. The unrelated `nabatable-runner` VM was not stopped
or modified. Do not use broad process-name kills for canary cleanup.

Canary plans, errors, outcomes, per-shard JSON, summaries, memory samples and
kernel captures are in the external evidence directory above. The normal local
CI journals and releases are separate from this directory. The live initial
directory-only inventory was 129 run directories, not the handoff's 99; it also
contained 68 attempt entries and five releases. Preserve those records rather
than reconciling counts by deletion.

All changes were made in dedicated worktrees. The operator's main checkout and
pre-existing stashes were not edited, reset or popped. It acquired additional
unrelated edits during this session; final `git status` must report them as
concurrent work, not revert them to the earlier snapshot. The final delivery
message records exact branch heads, current provider checks and service state.
