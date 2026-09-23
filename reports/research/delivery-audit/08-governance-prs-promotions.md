# 08 — Governance, merged-PR CI profiles and production promotions

Collected: 2026-09-21 (UTC), read-only GitHub API (`gh api`, authenticated as lapeninns, admin scope).
Evidence window for workflow-run sweeps: `created=2026-08-22..2026-09-22`.
Raw API responses are archived verbatim under `research/delivery-audit/data/governance/` (index at the end). Workflow-file facts cite the `origin/main` versions (local branch `codex/console-l8-sweep` is 32 commits ahead of `origin/main`).

## 1. Branch rules on `main`

Endpoints used and results:

- `GET repos/lapeninns/nabaperks/rules/branches/main` — worked. Returned 5 rules, all from ruleset id **19613437**.
- `GET repos/lapeninns/nabaperks/rulesets` — worked. Exactly one ruleset: **19613437 "Main delivery policy"** (target `branch`, source Repository, enforcement **active**, created 2026-07-23, updated 2026-09-15).
- `GET repos/lapeninns/nabaperks/rulesets/19613437` — worked. Includes conditions and bypass actors.
- `GET repos/lapeninns/nabaperks/branches/main --jq '{protection_url, required_pull_request_reviews}'` — worked: `protection_url` present, `required_pull_request_reviews: null`. Legacy branch protection is not used; protection is entirely ruleset-based.
- Note: `GET actions/runs/{id}/attempts/1` (without `/jobs`) 404s; `.../attempts/1/jobs` is the correct form.

Ruleset 19613437 detail (`12-ruleset-19613437-detail.json`):

- **Conditions:** `ref_name` include `["~DEFAULT_BRANCH"]` (the default branch, `main`), no excludes.
- **Rules:**
  - `deletion` — branch deletion blocked.
  - `non_fast_forward` — force-push blocked.
  - `required_linear_history` — linear history required.
  - `pull_request`: `required_approving_review_count: 1`; `dismiss_stale_reviews_on_push: true`; `require_code_owner_review: true`; `require_last_push_approval: false`; `required_review_thread_resolution: true`; `require_extra_approval_for_unattributed_changes: true`; `allowed_merge_methods: ["merge","squash","rebase"]`; `required_reviewers: []` (no named forced reviewers).
  - `required_status_checks` (exact context names):
    1. **`Release gate`** (ci.yml `release-gate` job — the aggregate required-check job)
    2. **`Analyze (javascript-typescript)`** (codeql.yml)
    3. **`Review dependency changes`** (dependency-review.yml)
  - `strict_required_status_checks_policy: true` (head must be up to date with main when merging); `do_not_enforce_on_create: false`.
- **Required signatures:** no `required_signature` rule — not set.
- **Merge queue:** no `merge_queue` rule — not set. (`allow_auto_merge: true` at repo level, but the ruleset does not require a queue.)
- **Merge method:** all three methods permitted at both the ruleset (`allowed_merge_methods`) and repo level (`allow_squash_merge/allow_merge_commit/allow_rebase_merge` all true); no single method is enforced.
- **Bypass:** `bypass_actors: []` — no actor (user/team/role) may bypass; `current_user_can_bypass: "never"` for the admin token used.

## 2. CODEOWNERS

`origin/main:.github/CODEOWNERS` exists and is **byte-identical** to the local worktree copy (`diff` clean). Rules (all owned by `@lapeninns @amanshresthaa`):

```
*                       (default: everything)
/.github/
/DESIGN.md
/supabase/
/lib/supabase/
/lib/security/
/lib/stripe/
/app/api/
```

Required reviews **do** rely on CODEOWNERS: the `pull_request` rule sets `require_code_owner_review: true`, so any PR touching those paths needs a review from a code owner. PR #339's body records this operating live: "Independent code-owner review: required by the protected ruleset; the author self-review is dismissed and no reviewer is assigned."

## 3. Environments and protection rules

`GET repos/lapeninns/nabaperks/environments` — worked, 5 environments. Per-environment detail (`13-env-*.json`):

| Environment    | Required reviewers     | prevent_self_review | Wait timer  | Deployment branch policy                             | can_admins_bypass |
| -------------- | ---------------------- | ------------------- | ----------- | ---------------------------------------------------- | ----------------- |
| **Production** | `amanshresthaa` (User) | **true**            | none (null) | protected branches only (`main`); no custom policies | true              |
| **Monitoring** | none                   | n/a                 | none        | protected branches only                              | true              |
| Staging        | `amanshresthaa` (User) | true                | none        | protected branches only                              | true              |
| Recovery Drill | `amanshresthaa` (User) | true                | none        | protected branches only                              | true              |
| Preview        | none                   | n/a                 | n/a         | none (null)                                          | true              |

Workflow usage cross-check (`git grep 'environment:' origin/main -- .github/workflows/`):

- **Production**: `production-database.yml:229` (job `Authenticate the deployed baseline`), `production-database.yml:342` (job `Database promotion`), `production-deploy.yml:78` (job `Production deployment`, called from the promotion's `application` job), `admin-mfa-activation.yml:33`, `admin-mfa-bootstrap.yml:27`.
- **Monitoring**: `production-smoke.yml:32` (probes), `:92` (incident), `:143` (resolve-incident); `slo-report.yml:22`. Unattended (no reviewers) by design.
- **Recovery Drill**: `recovery-drill.yml:48`.
- **Staging** and **Preview**: no `origin/main` workflow declares them. Staging has 1 historical deployment (2026-07-23); Preview has a vercel[bot] deployment history (50 in the fetched page, 2026-07-30 to 2026-08-06) from the Vercel GitHub integration.

## 4. Repo visibility and Actions settings

- `GET repos/lapeninns/nabaperks` — **public** (`visibility: public`, `private: false`), default branch `main`.
- `GET .../actions/permissions` — Actions **enabled**, `allowed_actions: "all"`, `sha_pinning_required: false`.
- `GET .../actions/permissions/workflow` — **`default_workflow_permissions: "write"`**, `can_approve_pull_request_reviews: true`.
- Repo merge settings: `allow_auto_merge: true`, `delete_branch_on_merge: false`, `allow_update_branch: false`.

## 5. Last 20 merged PRs — check profile, qualification, CI executions

Classification method (from `origin/main` ci.yml + `scripts/ci/plan-checks.mjs`): the `selection` job ("Select required checks") computes an impact plan; `profile` is `full` (all nine roots), `public-pages` or `documentation`; on `push` it is always `full`. The nine root lanes are `fast`, `quality`, `build`, `e2e` (16 matrix jobs), `a11y` (8), `visual` (8), `lighthouse` (4), `zap-baseline`, `db`, each rolled up by a `-gate` job plus the aggregate **`Release gate`**. The qualification-comparison job is **`selection-comparison`** ("**Verify targeted and full outcomes**"); it runs only when the plan sets `comparison=true` (PR touches a comparison dependency such as `scripts/ci/plan-checks.mjs`, ci.yml, lockfile, playwright config, a11y/visual specs), together with `documentation`, `targeted-browser`, `targeted-visual`.

Observed (per PR head-sha run, `pr-<n>-ci-jobs.json`): **every one of the last 20 merged PRs ran the full nine-root profile** — 16 E2E, 8 accessibility, 8 visual, 4 Lighthouse matrix jobs, ZAP, DB, fast/quality/build all `success`, every rollup gate and `Release gate` `success`. Only **PR #329** additionally ran `documentation`, `targeted-browser`, `targeted-visual` and **`selection-comparison` ("Verify targeted and full outcomes") = success**; it changed `scripts/ci/plan-checks.mjs` (+ two CI unit tests), which forces `comparison=true` and a full profile ("CI selection changes require full and targeted comparison").

Table (sorted by merged date, UTC). "CI runs on head" = ci.yml runs for the PR head sha; ci.yml's `push` trigger only fires on `main`, so PR heads have exactly one `pull_request`-event run.

| PR  | Merged (UTC)     | Profile                  | Qualification comparison | CI runs on head              | Reruns (run_attempt)                                                                                                                      |
| --- | ---------------- | ------------------------ | ------------------------ | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 354 | 2026-09-21 16:46 | full                     | not required (skipped)   | 1 (run 35623718919, success) | 0                                                                                                                                         |
| 347 | 2026-09-21 14:54 | full                     | skipped                  | 1 (35590421536, success)     | 1 — attempt 1 failed: "Select required checks", "Release gate"                                                                            |
| 345 | 2026-09-21 04:07 | full                     | skipped                  | 1 (35559291931)              | 0                                                                                                                                         |
| 344 | 2026-09-20 22:46 | full                     | skipped                  | 1 (35542109144)              | 0                                                                                                                                         |
| 343 | 2026-09-20 20:49 | full                     | skipped                  | 1 (35536278976)              | 0                                                                                                                                         |
| 340 | 2026-09-20 19:30 | full                     | skipped                  | 1 (35526079563)              | 0                                                                                                                                         |
| 342 | 2026-09-20 17:28 | full                     | skipped                  | 1 (35516717487)              | 0                                                                                                                                         |
| 341 | 2026-09-20 14:30 | full                     | skipped                  | 1 (35506945003)              | 0                                                                                                                                         |
| 339 | 2026-09-17 16:06 | full                     | skipped                  | 1 (35223182214)              | 0                                                                                                                                         |
| 332 | 2026-09-13 12:22 | full                     | skipped                  | 1 (34753022236)              | 0                                                                                                                                         |
| 330 | 2026-09-12 17:31 | full                     | skipped                  | 1 (34708011903)              | 0                                                                                                                                         |
| 326 | 2026-09-12 17:04 | full                     | skipped                  | 1 (34705730776, success)     | 1 — attempt 1 failed: "E2E (desktop-firefox, pack 2)", "Lighthouse (home)", "Lighthouse CI", "E2E (DB-free harness tier)", "Release gate" |
| 329 | 2026-09-12 16:34 | full (comparison-forced) | **ran, success**         | 1 (34704673184)              | 0                                                                                                                                         |
| 328 | 2026-09-12 15:53 | full                     | skipped                  | 1 (34702814963)              | 0                                                                                                                                         |
| 327 | 2026-09-12 15:28 | full                     | skipped                  | 1 (34700951749, success)     | 1 — attempt 1 failed: "E2E (desktop-firefox, pack 2)", "E2E (DB-free harness tier)", "Release gate"                                       |
| 325 | 2026-09-12 12:57 | full                     | skipped                  | 1 (34694144206, success)     | 1 — attempt 1 failed: "E2E (desktop-firefox, pack 2)", "E2E (DB-free harness tier)", "Release gate"                                       |
| 324 | 2026-09-12 12:35 | full                     | skipped                  | 1 (34692658429)              | 0                                                                                                                                         |
| 323 | 2026-09-12 11:13 | full                     | skipped                  | 1 (34689434054)              | 0                                                                                                                                         |
| 322 | 2026-09-12 09:50 | full                     | skipped                  | 1 (34685850410)              | 0                                                                                                                                         |
| 321 | 2026-09-12 07:48 | full                     | skipped                  | 1 (34680947401)              | 0                                                                                                                                         |

Other runs on each PR head (5 runs per head; 6 for PR 340): `codeql.yml` (pull_request, success — required check "Analyze (javascript-typescript)"), `dependency-review.yml` (pull_request, success — required check "Review dependency changes"), `factory-status.yml` (pull_request_target, success or cancelled — advisory), `local-ci-shadow.yml` (pull_request, success — advisory). PR 340 had two `factory-status.yml` runs (1 cancelled, 1 success).

The three desktop-firefox pack-2 reruns (#325, #327, #326) are independently corroborated by PR #330's body: "Two of the five outliers (#325 at 18.5 min, #327 at 15.8 min) were hand re-runs after `E2E (desktop-firefox, pack 2)` failed the throttled venue-code test".

Author-recorded checks (PR template asks for a `## Verification` block; bodies archived in `24-merged-pr-bodies.txt`):

- Most PRs record substantial local verification and explicitly leave hosted proof to CI: e.g. #354 (typecheck/lint/tokens, 743 contracts, unit, build+bundle 560 KB, axe 79; "needs hosted baselines" for visual, Lighthouse /app not covered); #342 (`quality:fast` 723/1,932, full `test:db` 601/601, synthetic compatibility qualification; unchecked: hosted nine roots + protected promotion); #344/#343 (local fixture proof; unchecked: hosted CI/CodeQL + fresh release run).
- #339 records hosted results: "all 53 CI jobs, Linux visual regression, DB, accessibility, browser, Lighthouse, ZAP, fast, quality, build, and CodeQL passed for `5aa21cc0...`", with code-owner review still required.
- #329 records the qualification comparison outcome explicitly: earlier head run 34703757440 passed all nine roots "after one bounded retry" but the comparison "correctly failed because the download action selected the prior failed attempt's" artifact; the merged head's run **34704673184** "passed all nine workload roots, the targeted/full comparison and Release gate", with 128 E2E, 8 accessibility, 8 visual reports and all six targeted combinations matching.
- #321 records full local `quality:check` (719 contracts / 1,873 units), browser suite 96 passed, DB suite 594/594, production build — and that hosted CI, CodeQL, dependency review, code-owner approval and the protected release process "remain required before production promotion".

## 6. Production promotions

**Which workflow is "the promotion":** `production-database.yml` (**"Production database promotion"**). The runbook (`docs/operations/production-runbook.md`, origin/main) states it is "the only routine production" promotion path; it is the outer release owner (`concurrency: production-release`), and it calls `production-deploy.yml` ("Production deployment") as a **reusable workflow** (`workflow_call`) from its `application` job. The current `production-deploy.yml` on `origin/main` has `on: workflow_call` only — application deployments since then run **inside** the promotion run (its jobs appear as `Promote and prove the same application candidate / Production deployment`), which is why `production-deploy.yml`'s own run history ends 2026-09-07 (see the era note below).

Chain per promotion run: `preflight` (requires successful ci.yml + codeql.yml on the exact main revision; dispatch requires `PROMOTE_PRODUCTION_DATABASE` and head==main tip) → `baseline` (`environment: Production`) → `staging` ("Cost-neutral ephemeral release proof") → `qualification` → `promote` ("Database promotion", `environment: Production`) → `application` (calls production-deploy.yml, `environment: Production`). Each `environment: Production` job is gated by the required reviewer.

Last 10 runs of the promotion workflow (`14`/`15`/`19`/`25` files). "Gate wait" = `waiting`→`queued` deployment-status gap per Production deployment (upper bound on the approval wait; statuses' `creator` is the run actor `lapeninns`, so the approver identity itself is not exposed — see UNVERIFIED):

| Run id      | #   | Date/actor (UTC)                              | Conclusion (duration)  | Production approvals / gate waits                                                                                             | Smoke verified same head_sha?                                                                                                                                          |
| ----------- | --- | --------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 35628770690 | 152 | 09-21 16:56, lapeninns, workflow_run          | **success** (30m25s)   | 3 gates: baseline 75s; promote **11m27s**; application 1m33s                                                                  | Partial: automatic smoke 35632084507 **cancelled** by manual dispatch 35632094279 (workflow_dispatch, success, same sha 17c3094bec); dispatch input pinning UNVERIFIED |
| 35616302616 | 151 | 09-21 15:03, lapeninns, workflow_run          | cancelled (1h53m16s)   | baseline never approved — `waiting` 15:03:29 → `error` 16:56:33 (1h53m04s); superseded by run 152                             | n/a (cancelled) — smoke 35628815091 skipped (source not success)                                                                                                       |
| 35567608614 | 150 | 09-21 06:14, lapeninns, **workflow_dispatch** | **success** (27m25s)   | 3 gates: baseline 20s; promote **9m06s**; application 1m45s                                                                   | **Yes** — automatic smoke 35569598154 (workflow_run, success, head 4ee03147f0)                                                                                         |
| 35560368695 | 149 | 09-21 04:16, lapeninns, workflow_run          | cancelled (1h58m17s)   | baseline approved (25s); promote `waiting` 04:26:46 → `error` 06:15:08 (1h48m22s, never approved); superseded by dispatch 150 | n/a — smoke 35567650021 skipped                                                                                                                                        |
| 35550383641 | 148 | 09-21 01:16, lapeninns, workflow_run          | **failure** (1h01m05s) | baseline approved after **54m56s**; "Cost-neutral ephemeral release proof" then **failed**                                    | No promotion — smoke 35553707524 skipped                                                                                                                               |
| 35543120344 | 147 | 09-20 22:55, lapeninns, workflow_run          | **failure** (7s)       | none — **preflight failed**                                                                                                   | smoke 35543126720 skipped                                                                                                                                              |
| 35537688433 | 146 | 09-20 21:07, lapeninns, workflow_run          | **failure** (59m21s)   | baseline approved after **52m44s**; staging proof **failed**                                                                  | smoke 35540631941 skipped                                                                                                                                              |
| 35537219814 | 145 | 09-20 20:58, lapeninns, workflow_run          | **failure** (6s)       | none — **preflight failed**                                                                                                   | smoke 35537225746 skipped                                                                                                                                              |
| 35533011161 | 144 | 09-20 19:39, lapeninns, workflow_run          | **failure** (47m33s)   | baseline approved after **42m07s**; staging proof **failed**                                                                  | smoke 35535575731 skipped                                                                                                                                              |
| 35526989736 | 143 | 09-20 17:47, lapeninns, **workflow_dispatch** | **success** (19m13s)   | 3 gates: baseline 49s; promote 1m14s; application 2m14s                                                                       | **Yes** — automatic smoke 35528006819 (workflow_run, success, head 6cc1aaafab)                                                                                         |

Supporting evidence:

- **Job outcomes per run** (`25-promo-*-jobs.json`): successes 152/150/143 show `preflight`, `Authenticate the deployed baseline`, `Cost-neutral ephemeral release proof`, `Qualify runtime without production credentials`, `Database promotion`, and `Promote and prove the same application candidate / Production deployment preflight` + `/ Production deployment` all `success`. Failures 148/146/144 fail at the staging proof; 147/145 fail at preflight. Cancelled 151 dies at baseline; 149 dies at `Database promotion`.
- **Deployment/status detail** (`21-depstatus-*.json`): every successful gate sequence is `waiting → queued → in_progress → success`. Production deployments per sha: 17c3094bec ×3 (run 152), 4ee03147f0 ×5 (runs 149 baseline+promote-error, 150 ×3), 6cc1aaafab ×4 (run 142 baseline error, 143 ×3), plus one baseline deployment each for the failed runs 148/146/144. `error` statuses mark superseded pending deployments: run 142's baseline (error 17:47:26, replaced by dispatch 143 at 17:47:37), run 149's promote (replaced by dispatch 150), run 151's baseline (replaced by run 152). Production smoke for run 152 also produced a cancelled Monitoring deployment `error` (6574170023, from smoke run 35632084507 cancelled under the `production-smoke` concurrency group by dispatch 35632094279, which then succeeded twice on Monitoring deployments 6574178168/6574186550).
- **Pending deployments:** `actions/runs/<id>/pending_deployments` returned `[]` for all 10 promotion runs — nothing stuck pending at collection time.
- **Approval identity:** all deployment statuses list `creator: lapeninns` (the workflow actor); GitHub does not expose the environment-approval reviewer in the deployment API. By configuration the **only** eligible approver is `amanshresthaa` (sole Production required reviewer, `prevent_self_review: true`, run actor `lapeninns` excluded). Individual gate approvals are therefore configuration-inferred, not API-verified.
- The long unapproved waits and re-dispatches match the runbook: "Evidence expires after one hour across the whole chain. If approval waiting, main advancement, provider drift or a partial rerun invalidates it, start a fresh complete outer run after reviewing the actual completed stages."
- Production smoke in the window: 464 total runs (schedule `7/15 * * * *` plus `workflow_run` after each promotion completion and manual dispatches). Smoke job guard `github.event_name != 'workflow_run' || (conclusion == 'success' && head_branch == 'main')` yields `skipped` runs after failed/cancelled promotions — those are expected, not gaps. The one genuine gap: run 152's automatic smoke was cancelled and replaced by a manual dispatch.
- A Monitoring-environment deployment for sha 4ee03147f0 failed at 2026-09-21T14:02:18 with **no** production-smoke run in that window; it is most plausibly the scheduled SLO report (`slo-report.yml`, the only other Monitoring consumer) — attribution not further investigated (outside the assigned areas).

**production-deploy.yml standalone history (era note).** At sha `bf6f38cf` (2026-09-06) production-deploy.yml was `on: workflow_run` (triggered by "Production database promotion") — application deployment was then a separate run; on current `origin/main` it is `workflow_call` only and runs nested inside the promotion. Its last 10 standalone runs (`14-deploy-wf-runs.json`), all 2026-09-06/07, all `workflow_run` on `main`, attempt 1:

| Run id      | #   | Created     | Actor         | Conclusion (duration) | Smoke                                                     |
| ----------- | --- | ----------- | ------------- | --------------------- | --------------------------------------------------------- |
| 34139581026 | 96  | 09-07 15:41 | lapeninns     | failure (7s)          | 34139594183 skipped                                       |
| 34136773099 | 95  | 09-07 15:08 | amanshresthaa | failure (9s)          | 34136791038 skipped                                       |
| 34134613189 | 94  | 09-07 14:44 | lapeninns     | failure (12s)         | 34134632706 skipped                                       |
| 34132881148 | 93  | 09-07 14:25 | lapeninns     | failure (20s)         | 34132915997 skipped                                       |
| 34128504423 | 92  | 09-07 13:38 | amanshresthaa | failure (7s)          | 34128518169 skipped                                       |
| 34126474625 | 91  | 09-07 13:16 | lapeninns     | failure (18s)         | 34126504044 skipped                                       |
| 34123740895 | 90  | 09-07 12:46 | lapeninns     | **success** (7m09s)   | **34124394660 success** (workflow_run, same sha 5b827aa2) |
| 34122134415 | 89  | 09-07 12:29 | lapeninns     | failure (44s)         | 34122207111 skipped                                       |
| 34119072288 | 88  | 09-07 11:55 | lapeninns     | failure (6s)          | 34119085590 skipped; dispatch 34120055076 failure         |
| 34059767043 | 87  | 09-06 21:01 | lapeninns     | **success** (6m42s)   | **34060128897 success** (workflow_run, same sha bf6f38cf) |

Deployments for those shas (`22-deployments-sha-*.json`): `ed8fdd33` 0, `87abc72a` 0, `d09921a0` 0 (preflight-era failures created no deployments); `f1cc8ce1` 1 (failure); `3eb54445` 2 (both failure); `5b827aa2` 4 (two reached `success` 12:46/12:54 on 09-07); `bf6f38cf` 18 (all `success`, spanning 09-06 18:35 → 09-07 10:09). Four of those deployments were marked `inactive` at 2026-09-10T21:27:36-37Z, when a later production deployment superseded them. Per-run deployment attribution for this era is not resolvable from run-to-deployment mapping alone (several workflows deployed the same main shas) — see UNVERIFIED.

## 7. Tip of `main`

- SHA: **`17c3094bec70eb563260326b4198ce1e1651923a`**
- Committer date: **2026-09-21T16:46:47Z**
- Subject: `feat(console): counter-first venue console rebuild, lanes L2–L8 (#354)` — i.e. `main`'s tip is PR #354's merge commit (PR #354's branch head was `1919a3df`, its merge commit is `17c3094b`). Promotion run 152 promoted exactly this revision, and the post-promotion smoke dispatch 35632094279 also ran at this head_sha.

## UNVERIFIED

1. **Environment-gate approver identity.** Deployment statuses record `creator: lapeninns` (run actor) on every status; GitHub exposes no per-gate approval record via the deployments/runs APIs used. Approvals are inferred from configuration (sole Production required reviewer `amanshresthaa`, `prevent_self_review=true`), not from an API-verified approval event.
2. **Manual smoke dispatch 35632094279's `expected_revision` input.** The REST API does not expose workflow_dispatch inputs; the run succeeded at head_sha `17c3094bec`, but whether the operator pinned `expected_revision` is unverified.
3. **production-database.yml runs beyond the last 10.** 105 runs exist in the evidence window; only the last 10 were profiled (per task). Sept 6-11-era runs were not individually examined.
4. **Sept 6-7 production-deploy standalone era: per-run deployment attribution.** Multiple workflows deployed the same main shas in that era; the 18 `bf6f38cf` deployments and 4 `5b827aa2` deployments cannot be mapped 1:1 to the standalone deploy runs from the fetched data alone.
5. **CI `selection` job internal plan values** (profile string, plan JSON) were inferred from the executed job set, not read from job logs/outputs (the jobs API does not expose job outputs).
6. **The 2026-09-21T14:02 Monitoring deployment failure** (sha `4ee03147f0`) is not attributable to any production-smoke run in the saved window page; it most plausibly belongs to `slo-report.yml`, which was not fetched (outside the seven assigned areas).
7. **Preview environment ownership.** The 50 vercel[bot] deployments were not examined per-workflow (no origin/main workflow declares `environment: Preview`; created by the Vercel GitHub integration, July 30–Aug 6).

## Raw evidence index (`research/delivery-audit/data/governance/`)

- Governance: `01-rules-branches-main.json`, `02-branch-main-protection.json`, `03-rulesets.json`, `12-ruleset-19613437-detail.json`, `04-environments.json`, `13-env-*.json` (×5), `07-actions-permissions.json`, `08-actions-workflow-permissions.json`, `09-repo-props.json`, `10-CODEOWNERS-origin-main.txt`, `11-main-tip.json`, `05-workflows.json`.
- PRs: `06-merged-prs-20.json`, `24-merged-pr-bodies.txt`, `27-pr329-files.json`, `pr-<n>-head-runs.json`, `pr-<n>-ci-jobs.json` (×20 each), `26-attempt1-*-jobs.json` (×4).
- Promotions: `14-deploy-wf-runs.json`, `15-database-wf-runs.json`, `16-smoke-wf-runs.json` (100 newest of 464), `19-promotion-last10.json`, `20-pending-*.json` (×10, all `[]`), `25-promo-*-jobs.json` (×10), `18-deployments-*.json` (×5 environments), `22-deployments-sha-*.json` (×7), `21-depstatus-*.json` (×74), `23-smoke-sha-*.json` (×13).
- Workflow-file reference copies (origin/main): `wf-ci.yml.origin-main.yml`, `wf-production-database.yml.origin-main.yml`, `wf-production-deploy.yml.origin-main.yml`, `wf-production-smoke.yml.origin-main.yml`, `plan-checks.origin-main.mjs`, `17-production-runbook.origin-main.md`.
