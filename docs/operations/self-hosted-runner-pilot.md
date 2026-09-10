# Self-hosted GitHub Actions runner — pilot scoping and decision

Owner: Lapen Inns product operations
Repository: `lapeninns/nabaperks`
Candidate host: the operator's Apple M5 Pro Mac (18 cores, 64 GiB), already
running Lima VMs `nabaperks-ci` and the unrelated `nabatable-runner`
Scoping basis: worktree `codex/local-first-ci-20260909` at `905362a5d`, based on
`origin/main` `d5f5c3641`. Measurements taken 2026-09-09.
Review update 2026-09-10 against `621231afed6f`: distinguish the historical
72-job measurements from the post-#296 48-job matrix, correct the cost model
for event-triggered usage, and specify credential-free fallback routing.

This document is a scoping decision, not an installation plan. No runner was
registered, no provider setting was changed and no workflow was edited while it
was written.

## Decision

**Do not run a self-hosted GitHub Actions runner pilot on this repository as it
stands today.** Three independent blockers apply, any one of which is
sufficient:

1. **The repository is public.** GitHub's own guidance is that "self-hosted
   runners should almost never be used for public repositories on GitHub,
   because any user can open pull requests against the repository and compromise
   the environment"
   ([secure-use reference](https://docs.github.com/en/actions/reference/security/secure-use),
   fetched 2026-09-09). The live fork-PR approval policy is
   `first_time_contributors`, the middle of three settings — one merged
   contribution and a stranger's later fork pull requests run with no approval
   at all.
2. **There is no money to save today.** Actions is free on public repositories
   and the billing API confirms it: run `34290952137` reports
   `billable.UBUNTU.total_ms = 0` across all 72 jobs. The entire cost case is
   contingent on a decision to go private that has not been made.
3. **Going private breaks two of the three required checks, at any price.**
   `Analyze (javascript-typescript)` and `Review dependency changes` need a
   GitHub Code Security licence on a private repository. That is a licensing
   wall, not a minutes problem, and no runner work touches it.

**The honest bottom line.** In the private world the recommended split saves
roughly **$362 per month**, and its shape is right — 74.7% of billed CI minutes
sit in `e2e` and `a11y` alone (142 of 190), and 80.0% in the whole self-hosted
set, exactly the tiers with no x86-64 baseline dependency and no
2-core-calibrated budget. But the saving is unavailable until the repository
goes private, the licensing question is answered, and the machine has spare
capacity it does not currently have.

**At the modelled volume, the split remains over quota.** Scenario (e) uses
400 CI run records plus the observed non-CI monthly mix: ~19,820 billed minutes
against a 3,000-minute allowance. The ~4,620 non-CI component is a mixture of
scheduled, PR, push and manual work, not a fixed floor. It cannot establish that
zero or every lower CI rate exceeds the allowance. The quota section separates
those triggers and gives the conditional break-even; the previous claim that
no break-even can exist is withdrawn. Public-repository exposure, licensing and
capacity remain separate reasons not to start this pilot.

Do the cheap moves first — landing PR #296, deleting `nightly.yml`, trimming the
smoke cadence — because they are cheap, not because they are larger. **They are
not larger.** Measured against the same model: the cheap moves take scenario (b)
to scenario (f), recovering about **25,300 billed minutes/month (~$152)**; a
pilot layered on top of (f) recovers a further **~48,800 billed minutes/month
(~$293)**. The runner is worth roughly twice the cheap moves. The argument for
doing the cheap moves first is that they add no execution plane and no security
surface — an argument about risk and effort, not about magnitude. An earlier
draft of this document claimed the opposite; the arithmetic above is the
correction, and it survives the re-measurement described in the cost model.

If a pilot proceeds anyway, it must be justified on latency and independence
from GitHub, **not** on money, and it must start on a throwaway VM with the
**four named non-secret nightly jobs only** — `cross-browser`,
`cross-browser-gate`, `mutation` and `load` — never with `nightly.yml` as a whole
and never with the pull-request path. Keep `zap-full` hosted until its native
ARM execution is qualified, even though an ARM64 image is now published. `nightly.yml`'s sixth job, `load-race`
(`:167-183`), passes `secrets.STAMP_RACE_AUTH_TOKEN` to candidate code and must
be pinned hosted by an explicit `runs-on: ubuntu-latest` plus a contract test.
An earlier draft recommended "start with `nightly.yml`" without that carve-out,
which would have put a repository secret on the pilot machine the first time
those variables were set. See prerequisite 12.

## Security verdict: the public-repository blocker

This is the top of the document because it is the blocker that does not
negotiate.

### What is live today

| Setting                                    | Live value                                         | Source                                                        |
| ------------------------------------------ | -------------------------------------------------- | ------------------------------------------------------------- |
| Visibility                                 | `public`, `allow_forking: true`, owner type `User` | `gh api repos/lapeninns/nabaperks`                            |
| Fork-PR approval                           | `first_time_contributors`                          | `gh api .../actions/permissions/fork-pr-contributor-approval` |
| Default workflow permissions               | `write`                                            | `gh api .../actions/permissions/workflow`                     |
| `can_approve_pull_request_reviews`         | `true`                                             | same                                                          |
| `allowed_actions` / `sha_pinning_required` | `all` / `false`                                    | `gh api .../actions/permissions`                              |
| Repository Actions secrets                 | **0**                                              | `gh api .../actions/secrets` → `total_count: 0`               |
| Registered self-hosted runners             | **0**                                              | `gh api .../actions/runners` → `total_count: 0`               |
| `runs-on` values in `.github/workflows`    | 47 × `ubuntu-latest`, zero `self-hosted`           | `grep -rh 'runs-on:' .github/workflows/`                      |

### The chain that matters

For `pull_request` events the workflow file comes from the pull-request head, so
a fork pull request can add `runs-on: <self-hosted label>` plus arbitrary steps.
The only gate today is the first-time-contributor approval, which GitHub
defines as lapsing permanently once a contributor has any commit or pull request
merged (GitHub: "a user that has had any commit or pull request merged into the
repository will not require approval"). An `if:` guard in the workflow is
defence in depth only — for `pull_request` the attacker writes the workflow file
and can delete the guard.

GitHub also states that a self-hosted runner "can be persistently compromised by
untrusted code in a workflow" and does not run in an ephemeral clean VM. That
sentence is what makes this different from a hosted-runner incident: the damage
outlives the job, the run and the de-registration. It is why rollback tier 2
below is **not** sufficient on its own.

Four facts sharpen this beyond the generic warning:

- **`pull_request_target` bypasses the approval gate entirely.**
  `factory-status.yml:8` triggers on `pull_request_target`, and GitHub is
  explicit: "Workflows triggered by `pull_request_target` events are run in the
  context of the base branch. Since the base branch is considered trusted,
  workflows triggered by these events will always run, regardless of approval
  settings." So the approval policy — including the recommended
  `all_external_contributors` — is **not** a complete gate on the entry point.
  Any anonymous fork pull request runs that workflow immediately. It is
  harmless today (`runs-on: ubuntu-latest`, `permissions: read`, `ref: main`,
  and a comment forbidding checkout of candidate code), but the moment any
  `pull_request_target` workflow carries a self-hosted label, unapproved
  stranger-triggered execution lands on the operator's hardware with no gate at
  all. This entry point was missing from an earlier draft of this section and it
  materially weakens mitigation 4 below.
- **The GitHub App private key is on disk in reach of a host-level runner.**
  `~/.nabaperks-local-ci/github-app-private-key.pem`, mode `0600`, owner
  `amankumarshrestha`, in a `0700` directory (verified by `ls -la`). The
  local-CI launchd job is a LaunchAgent in the operator's gui domain, so it runs
  as that same uid. `0600` is not a boundary against a same-uid process.
- **The required status checks are not pinned to a publishing app.** Ruleset
  `19613437` lists `{"context": "Release gate"}`,
  `{"context": "Analyze (javascript-typescript)"}` and
  `{"context": "Review dependency changes"}` with **no `integration_id` on any
  entry** (verified against the ruleset JSON). Nothing in the ruleset pins those
  contexts to GitHub Actions as the publisher.
- **The runner's own credentials live in the runner's working tree.** A
  persistent runner keeps `.runner` and `.credentials` (its RSA registration
  key) beside `_work`. Any job that escapes its step can read them and keep
  claiming queued jobs after the operator believes the pilot is over. Combined
  with the persistent-compromise sentence above, this is why de-registration
  alone is not rollback.

Composed, a job on a host-level runner could read the App key, mint an
installation token and publish check runs under those exact names. That is
forgery of the merge evidence and of the local-CI proof the whole local-first
programme depends on. **This composition is inferred, not demonstrated** — no
token was minted and no check run was forged. It is the single most
load-bearing inference in this document; see the open questions.

### What limits the blast radius

Genuinely mitigating, and worth preserving whatever is decided:

- Zero repository-level Actions secrets; all secrets live in `Production`,
  `Staging`, `Recovery Drill` and `Monitoring` behind required reviewers and
  branch policies. `ci.yml` declares no `environment:`, so CI job payloads carry
  no product secrets today.
- Fork pull requests receive a read-only `GITHUB_TOKEN` and no secrets, by
  GitHub's design. The runner-compromise path here is about the **host**, not
  about secret theft from the job.
- The Lima guest is already clean: `mounts: []`
  (`ops/local-ci/host/lima-nabaperks-ci.yaml:61`), `ssh.forwardAgent: false` and
  `ssh.loadDotSSHPubKeys: false` (`:64-65`), `networks: []` (`:79`). The App key
  is unreachable from the guest by construction.

### Seven provider changes worth making regardless

These are cheap, five are pure wins, and none of them depends on a runner
decision. All are operator actions; none was performed while scoping.

1. Add `integration_id` to all three `required_status_checks` entries in ruleset
   `19613437`, pinning them to GitHub Actions. Closes the check-forgery path
   today.
2. Set `can_approve_pull_request_reviews` to `false`. No workflow creates or
   approves pull requests.
3. Set `default_workflow_permissions` to `read`. Sixteen of seventeen workflows
   already declare their own `permissions:`; `codeql.yml` declares
   `security-events: write` per job.
4. Set the fork-PR approval policy to `all_external_contributors`. This is the
   strongest control over the `pull_request` entry point and it survives a
   stranger getting one pull request merged. It does **not** cover
   `pull_request_target`, which always runs — so it is necessary, not
   sufficient. Pair it with item 7.
5. Set `sha_pinning_required` to `true`. Free — every external action is already
   pinned to a 40-character SHA.
6. Move the App private key off a plain `0600` file owned by the interactive
   uid, at minimum to a dedicated unprivileged account no CI process shares.
7. Add a contract test asserting that **no** workflow triggered by
   `pull_request_target` or `issue_comment` carries a self-hosted label, and
   that `factory-status.yml` stays `runs-on: ubuntu-latest`. This is the only
   guard over the entry point that the approval policy cannot reach. Worth
   writing now — it costs nothing and it fails loudly the day someone adds a
   label in the wrong file.

## Cost model

Three corrections to the figures this scoping started from. The first two are
verified against GitHub's own pricing reference (fetched 2026-09-09); the third
came out of review and is measured from the Actions API.

- The Linux 2-core x64 rate is **$0.006/min**, not $0.008 (arm64 is $0.005/min).
- GitHub "rounds the minutes and partial minutes each job uses up to the nearest
  whole minute", **per job**. With 72 jobs per CI run that turns 154.1 raw
  machine-minutes into **190 billed minutes**, a 23% surcharge.
- **A workflow-run record is not a billable execution.** An earlier draft
  multiplied one complete 190-minute successful attempt by the count of
  workflow-run records. `ci.yml` sets `cancel-in-progress: true` (`:12`), so a
  superseded pull-request run terminates part-way through the matrix and bills
  less than a full attempt; conversely a rerun adds a second billed attempt
  under the same run ID — run `34223163467` carries attempts 1 and 2 and 336
  jobs. Both effects are now measured rather than assumed.

Both of the first two figures were reproduced independently for run
`34290952137`: 72 jobs, 154.1 raw minutes, 190 billed minutes.

### Billed minutes per run record, measured across attempts and conclusions

Rounded job durations were aggregated across **every** execution attempt
(`/actions/runs/<id>/jobs?filter=all`) for all 241 `ci.yml` runs in the 30 days
to 2026-09-09. The matrix shape changed repeatedly inside that window — daily
means run from 19 jobs on 2026-08-13 to 184 on 2026-09-05 — so the per-run
figure is taken from the 38 run records that carry the **historical 72-job** shape, between
2026-09-08T16:57Z and 2026-09-09T21:11Z:

| Conclusion  | Records | Share of lifetime runs | Mean billed min/record |
| ----------- | ------- | ---------------------- | ---------------------- |
| `success`   | 28      | 32.1% (367 / 1,143)    | 202                    |
| `failure`   | 5       | 39.1% (447 / 1,143)    | 178                    |
| `cancelled` | 5       | 28.8% (329 / 1,143)    | 153                    |

Blended at the lifetime conclusion mix, that gives **178.6 billed minutes per
run record**. Lifetime executed attempts are 1,221 against 1,143 records (1,077
single-attempt, 56 with two, 9 with three, 1 with five), an inflation of
**×1.068**, and none of the 38 sampled records was itself a rerun — so the two
adjustments compose: 178.6 × 1.068 = **190.7, call it 191 billed minutes per CI
run record.**

**The correction is methodological, not material.** It replaces "one good run
× the raw run count" with a figure that respects cancellation and reruns, and
it lands 0.4% above the 190 the earlier draft used, because the shortfall from
cancelled and failed runs (−6%) is almost exactly offset by rerun attempts
(+6.8%). Every scenario below therefore moves by well under 1% on this account.
The scenario totals _do_ move materially, but for a different reason — the
non-CI re-measurement in the table after next.

### Inputs

| Input                                                             | Value                                                                                                       | Confidence                                              |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| CI workflow-run records per month                                 | 404 (1,143 records over 86.2 days; complete history, first run 2026-06-15)                                  | verified                                                |
| Run-rate volatility                                               | last-30d 241/mo, lifetime 404/mo, last-7d 952/mo                                                            | verified                                                |
| Billed minutes per CI **run record**, the historical 72-job shape | **191** — blended over conclusions and executed attempts (see above)                                        | measured over 38 pre-#296 run records                   |
| Billed minutes per CI run, post-#296 48-job shape                 | ~160                                                                                                        | inferred from #296's own modelling plus per-job ceiling |
| Non-CI billed minutes per month                                   | **~16,150**, 74% of it `nightly.yml`                                                                        | measured per workflow over the last 30 days             |
| `nightly.yml` per run                                             | 285.6 raw / **355 billed** across 133 jobs (run `34323842337`); mean of the six most recent runs 331 billed | verified                                                |
| Rate / quota                                                      | $0.006 per minute over 3,000 free minutes                                                                   | verified rate; quota assumes Pro or Team                |

An earlier draft carried the non-CI figure as an inferred band of
12,000–15,000, then replaced it with ~12,470 by scaling each workflow's
**lifetime** run count to a month. That scaling was wrong in both directions:
it divided `production-smoke.yml`'s 1,185 runs by the repository's whole
86-day history when the workflow's first run was 2026-07-14, and it extrapolated
brand-new workflows from almost no history at all. The table below counts actual
runs in the **last 30 days** (2026-08-10 to 2026-09-09) and multiplies by the
mean billed minutes of that workflow's five or six most recent runs:

| Workflow                  | Runs, last 30d | Billed min/run | Billed min/mo |
| ------------------------- | -------------- | -------------- | ------------- |
| `nightly.yml`             | 36             | 331            | **11,930**    |
| `production-smoke.yml`    | 726            | 2              | 1,450         |
| `production-database.yml` | 60             | 25             | 1,500         |
| `codeql.yml`              | 247            | 2.3            | 570           |
| `dependency-review.yml`   | 190            | 1              | 190           |
| `factory-status.yml`      | 159            | 1              | 160           |
| `agent-watchdog.yml`      | 44             | 3              | 130           |
| `local-ci-shadow.yml`     | 70             | 1              | 70            |
| `release-notes.yml`       | 52             | 1              | 50            |
| `production-deploy.yml`   | 48             | 1              | 50            |
| `slo-report.yml`          | 31             | 1              | 30            |
| everything else           | 11             | ~1             | ~15           |
| **total**                 |                |                | **~16,150**   |

**The non-CI total is ~30% higher than the earlier draft said**, and the two
largest revisions both land on workflows that cannot move:
`production-smoke.yml` at ~1,450 rather than 419, and `production-database.yml`
at ~1,500 rather than 795. That matters for scenario (e) below and it is the
main reason every private figure in this document moved.

So `nightly.yml` alone, at its daily `24 2 * * *` cron plus manual dispatches,
is **~11,900 billed minutes per month — nearly four times the entire quota from
a single workflow.** A daily cron caps the scheduled portion at ~30.4
runs/month (~10,100 billed minutes at the measured 331/run); the extra six runs
in the window were `workflow_dispatch`. Either way it remains the single
largest line, and deleting it remains the single largest cost reduction that
costs nothing and adds no plane.

### Monthly cost, 400 CI run records/month, $0.006/min, 3,000 free minutes

This is a scenario with 400 CI records and the separately measured non-CI
monthly counts held at their observed values. It is not a forecast that assumes
those counts stay fixed as PR, push or release frequency changes.

| #   | Scenario                                                                      | Billed min/mo | Over quota | **Cost/month** |
| --- | ----------------------------------------------------------------------------- | ------------- | ---------- | -------------- |
| a   | **Public, today**                                                             | 0             | 0          | **$0**         |
| b   | Private, everything hosted, the historical 72-job shape                       | ~92,450       | 89,450     | ~$537          |
| c   | Private, everything hosted, post-#296                                         | ~80,150       | 77,150     | **~$463**      |
| d   | Private, recommended split, `nightly` still hosted                            | ~31,350       | 28,350     | ~$170          |
| e   | Private, recommended split + **four non-secret `nightly` jobs** self-hosted   | ~19,820       | 16,820     | **~$101**      |
| f   | Private, **no runner**, `nightly` deleted and smoke executions reduced by 75% | ~67,130       | 64,130     | ~$385          |

Scenarios (c) through (f) all assume PR #296 has landed. Without it, (f) is
impossible: CI alone at the historical 191-billed-minute shape is ~76,300
minutes/month, above (f)'s whole total.

**Scenario (e) changed after review, and not in the pilot's favour.** An earlier
draft counted `production-database.yml` as self-hosted in (e) while the "Never
move" list in the job-split section classifies it as untouchable — its
promotion jobs select the `Production` environment and consume production
secrets. That scenario was not deployable under this document's own security
boundary. `production-database.yml` is now hosted in every scenario. The
reviewer costed the correction at the 795 billed minutes the old table listed;
re-measured, the workflow is **~1,500 billed minutes/month**, so the residual
hosted usage was understated by roughly twice what the review assumed.

Scenario (e) moves only `cross-browser`, `cross-browser-gate`, `mutation` and
`load`. It retains both `load-race` (secret-bearing, currently conditioned out)
and `zap-full` (native ARM execution not qualified) on hosted runners.
The latter adds **~402 billed minutes/month** to the earlier scenario (e):
the six most recent nightly run records before 2026-09-10 contain one successful
hosted `ZAP full scan` job each, billed at **12, 10, 13, 10, 12 and 10 minutes**.
That is 67/6 = 11.17 minutes/run, or 402 minutes at the observed 36 nightly
records/month. The sampled run IDs are `34323842337`, `34198628566`,
`34095221625`, `34018441294`, `34018112799` and `34017648420`; job durations were
rounded up separately and all attempts were read with `jobs?filter=all`.
The non-CI total stays ~16,150; keeping ZAP hosted moves ~402 of the nightly
component into the retained portion, from ~4,220 to **~4,620**. Thus scenario
(e) becomes ~19,820 billed minutes, ~16,820 over quota and **~$101/month**.

A manifest-only check on 2026-09-10 found both Linux AMD64 and ARM64 in
`ghcr.io/zaproxy/zaproxy:stable`; the ARM64 child digest was
`sha256:05cbf4cab5d2fdaef55b0cd0b586f22d0ce4f75e0995f3cea2db23afbbdfd2f8`.
The local profile's comment that no ARM64 image exists is stale, but its
`zap-full.arch = x64-only` restriction remains in force. Image availability
alone is not proof that this repository's action, host networking and scan
execute natively and preserve the hosted outcome. Before moving it, pin the
chosen image, demonstrate native execution and review the profile/routing
change separately. No image was pulled or scan run for this document update.

**Does the recommended split fit the free quota at these volumes? No.** Scenario (e), the lowest-cost private 400-record scenario in this document, is
**~19,820 billed minutes against a 3,000-minute allowance: about 6.6x over,
16,820 chargeable minutes, ~$101/month.** No scenario except (a) fits. The
runner turns a $463 bill into a $101 bill; it does not turn it into a $0 bill,
and nothing in the ARM migration can. That residual splits two ways, and
neither half is an architecture problem: ~15,200 minutes of hosted CI, of which
32 of every 38 per-run minutes are `visual` and `lighthouse` — pinned hosted
for pixel baselines and uncalibrated Lighthouse budgets — and ~4,620 minutes of
non-CI workflows the security boundary forbids moving at all.

**What the operator actually pays: $0 per month today.** The pilot's value in
the private world is scenario (c) minus scenario (e) — roughly **$362 per
month, $4,340 per year**. Scenario (f) decomposes: deleting `nightly.yml`
without any runner work is worth about **$72/month** on its own (11,930 billed
minutes), and reducing actual smoke executions by 75% a further **~$7** (1,090 minutes);
the runner is what delivers the rest — and, per the Decision section, roughly
twice what the cheap moves do.

#### Quota break-even depends on scheduled and event-triggered usage

The retained ~4,620 minutes are an observed monthly workload, not an
irreducible floor. The current workflow triggers divide it as follows:

| Retained hosted workflow                     | Observed billed min/mo | Trigger and scaling behaviour                                                                                    |
| -------------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `production-smoke.yml`                       | 1,450                  | Scheduled checks, release-completion events and manual runs; only the scheduled part is independent of releases. |
| `production-database.yml`                    | 1,500                  | Completed main CI runs and manual dispatches; successful preflight controls which downstream jobs execute.       |
| `codeql.yml`                                 | 570                    | PRs, main pushes and a weekly schedule; only the scheduled part is independent of changes.                       |
| `dependency-review.yml`                      | 190                    | PR events.                                                                                                       |
| `factory-status.yml`                         | 160                    | Scheduled, workflow-completion, PR-target and manual events.                                                     |
| `production-deploy.yml`                      | 50                     | Reusable release workflow calls; the historical separate-run count must not be treated as a standing schedule.   |
| `slo-report.yml`                             | 30                     | Scheduled and manual runs.                                                                                       |
| `release-notes.yml`                          | 50                     | Main pushes and manual dispatches.                                                                               |
| `agent-watchdog.yml` / `local-ci-shadow.yml` | 200                    | Watchdog scheduled/manual work plus shadow PR/main-push work.                                                    |
| Other retained workflows                     | ~20                    | Inspect their scheduled/manual triggers separately.                                                              |
| `nightly.yml` / `zap-full`                   | ~402                   | Scheduled/manual nightly runs; retained until native ARM execution is qualified.                                 |
| **Observed total**                           | **~4,620**             | **Mixed event types; not a fixed floor.**                                                                        |

For `R` CI run records/month, let `S` be billed scheduled usage and `E` the
billed non-CI usage driven by PRs, pushes, releases and manual operations. The
correct model is `M = 38R + S + E`, so a 3,000-minute quota requires
`38R + E ≤ 3,000 − S`. The aggregate counts above do not partition `S` and `E`
or establish a constant number of PRs, merges and manual runs per CI record.
An event-level census and an explicit activity/cadence assumption are needed
for a numeric break-even for this repository.

If that assumption is `E = eR + U`, with `e` event-driven billed minutes per CI
record and `U` independently chosen manual usage, the threshold is
`R ≤ (3,000 − S − U) / (38 + e)`, provided `S + U ≤ 3,000`. A negative numerator
would rule it out **under those assumptions**, not at every possible activity
level. Within this 38-minute-per-record model, with zero other usage, the
upper bound is **78 whole CI records
per month** (`78 × 38 = 2,964`; `79 × 38 = 3,002`). Thus the old estimate of 80
was wrong, but so was replacing it with a universal claim that no non-negative
rate can fit. On a 2,000-minute allowance, the corresponding upper bound is 52.
Actual scheduled and event-driven work can only lower these bounds.

Scheduled delivery must also be modelled explicitly. The configured
`production-smoke.yml` cadence is every 15 minutes: if all 96 daily schedules
run for a 30-day month at the sampled two billed minutes each, smoke alone is
5,760 minutes. The observed total of 726 smoke records is much lower and mixes
scheduled and release/manual events. It must not be treated as guaranteed
future schedule delivery or reduced fourfold merely by changing the cron.

At the specific 400-record scenario, the split still reduces a modelled $463
bill to about $101. The cost model supports that scenario comparison; it does
not prove that every lower workload remains over quota. No schedule, workflow,
repository visibility or runner setting is changed by this analysis.

Two caveats attached to that saving:

- If the repository moves to a GitHub organisation on Team to keep CodeQL and
  dependency review alive, Code Security is an additional ongoing cost —
  approximately $30/month for a single active committer. That is roughly 30% of
  scenario (e)'s entire bill and it appears in none of the figures above.
  _Whether Code Security is purchasable at all on a personal-account plan is
  unverified._
- The $362 saving is the difference between two bills that are both far over
  quota. None of it is a saving against $0, which is what the repository pays
  today.

### Weakness in these figures

Every number is modelled from job wall-clock plus the documented per-job
ceiling, because the billing API reports zero while the repository is public.
Two modelling assumptions carry the model: that skipped jobs are not billed
(inferred from negative and zero durations in the API, not from a billing
statement), and that start-to-complete wall clock equals billable time. Both are
directionally safe but could move totals by 5–15%. One day of private operation
converts the whole model from inferred to measured.

The per-run figures were recomputed from scratch during review, straight from
`/actions/runs/34290952137/jobs`: 72 jobs, **154.1 raw, 190 billed**, with no
negative or missing durations to discard — so the skipped-job assumption turns
out not to be load-bearing for that run at all. Across the wider 30-day sample
189 job records of 31,567 carried a zero or negative duration and were
discarded, so the assumption remains a rounding effect rather than a lever.

An earlier draft claimed the rebuilt totals landed "within about 1.5%" of its
table. That is no longer true and the claim is withdrawn. Re-measuring the
non-CI workflows over a 30-day window rather than scaling lifetime counts moved
the non-CI total from ~12,470 to ~16,150 (+30%), and correcting scenario (e)'s
security boundary added `production-database.yml` back to the hosted side. The
scenario costs above are 3–19% higher than the earlier draft's: (b) $520 →
$537, (c) $445 → $463, (f) $376 → $385. Retaining the ZAP full scan moves
(e) from the previously corrected ~$99 to **~$101** and the private-scenario
saving from ~$364 to **~$362**. The quota conclusion needed a separate
correction: an observed mixed-event monthly total cannot be used as a fixed
floor when varying the CI run rate.

Two inputs still rest on nothing measured: the post-#296 per-run figure of ~160
billed minutes, and the choice of 400 CI run records/month, which sits inside a
measured 241–952 band depending on the window.

## Recommended job split

The duration tables below describe historical run `34290952137`, reproduced
independently: 72 jobs, 154.1 raw and 190 billed minutes. They are not current
matrix counts. At reviewed head `621231afed6f`, #296 has reduced E2E to 16 jobs
and accessibility to 8. The same proposed split now contains **30 self-hosted
jobs and 18 hosted jobs**. Of those 30, **27 invoke `./.github/actions/setup`**:
16 E2E + 8 accessibility + `fast` + `quality` + `db`. The other three are gate
jobs. Current cache-traffic estimates use 27 restores, not the old 51; the
historical duration measurements below remain labelled by their source run.

### Self-hosted arm64 — 126.1 raw / 152 billed minutes per run (80.0% of billed)

| Job       | `ci.yml` | Jobs      | Raw min   | Billed min |
| --------- | -------- | --------- | --------- | ---------- |
| `e2e`     | `:177`   | 32 + gate | 92.4      | 109        |
| `a11y`    | `:228`   | 16 + gate | 25.8      | 33         |
| `db`      | `:392`   | 1 + gate  | 3.1       | 4          |
| `quality` | `:90`    | 1         | 2.6       | 3          |
| `fast`    | `:48`    | 1         | 2.2       | 3          |
| **total** |          | **54**    | **126.1** | **152**    |

The `fast` row previously read "1 + gate", which made the rows enumerate 55
jobs against a stated total of 54. There is no dedicated fast gate in `ci.yml`:
`build-gate` (`:160`, check name "Typecheck and build") has
`needs: [fast, quality, build]` and is already one of the two jobs in the hosted
table's `build` row. The row is one job; the plane totals of 54 / 18 and
152 / 38 billed minutes were correct and are unchanged. Recounted directly from
`/actions/runs/34290952137/jobs`, the 54 self-hosted jobs are 32 `e2e` + 1 gate,
16 `a11y` + 1 gate, 1 `db` + 1 gate, 1 `quality`, 1 `fast`; the 18 hosted jobs
are 4 `lighthouse` + 1 gate, 8 `visual` + 1 gate, 1 `build` + 1 gate,
1 `zap-baseline`, 1 `release-gate`.

**How far the arm64 story is actually verified.** Two separate claims, and only
one of them is proven:

- _Proven._ The digest pinned at `ci.yml:181` and `:232`,
  `mcr.microsoft.com/playwright:v1.62.1-noble@sha256:dcc5531e…`, **is itself the
  OCI index digest**, not an amd64 child — confirmed by fetching
  `mcr.microsoft.com/v2/playwright/manifests/sha256:dcc5531e…`, which returns
  `application/vnd.oci.image.index.v1+json` listing exactly two real children,
  `linux/amd64` (`c091b21d…`) and `linux/arm64` (`941cc91e…`), and whose
  `Docker-Content-Digest` is that same `dcc5531e…`. So the digest pin needs no
  change, supply-chain hygiene is preserved exactly, and Docker selects the
  arm64 child automatically. This was the one assumption capable of
  invalidating the whole plan, and it holds.
- _Not proven._ That the arm64 child **runs this suite**. It has never been
  pulled or executed here; the check above is manifest metadata only. The arm64
  green record the local plane has is on a **different image** — its own
  `FROM ubuntu:24.04` build (`ops/local-ci/image/Dockerfile:47`) with browsers
  in `/opt/ms-playwright` (`:95`). That is good evidence that Playwright's
  Chromium, Firefox and WebKit builds work on Ubuntu 24.04 arm64, and the
  project's config helps: `playwright.config.ts` uses only
  `chromium`/`firefox`/`webkit` and never a branded `chrome` or `msedge`
  channel, which is precisely the browser family Playwright does not ship for
  Linux arm64. It is not evidence about MCR's arm64 child. Pull and run it once
  before routing anything — see day-one fix 3.

### GitHub-hosted x64 — 28.0 raw / 38 billed minutes per run (20.0% of billed)

| Job            | Jobs   | Raw min  | Billed min | Why it cannot move                                                                                                                                                                                                                                                                 |
| -------------- | ------ | -------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lighthouse`   | 5      | 12.8     | 15         | `.lighthouserc.json` sets no `throttling` or `throttlingMethod`, so budgets float with host CPU. An M5 Pro passes everything and the check becomes vacuous.                                                                                                                        |
| `visual`       | 9      | 11.6     | 17         | Baselines are x86-64 `-linux` PNGs. `playwright.config.ts:63-66` keys the template on `process.platform === "linux"` only, and Playwright substitutes `{platform}` with `process.platform` — no architecture anywhere. ARM would resolve, and with `-u` rewrite, the wrong images. |
| `build`        | 2      | 1.9      | 3          | Produces the `next-build` artifact that hosted `lighthouse` and `zap-baseline` consume. Cross-architecture `.next` portability is unverified.                                                                                                                                      |
| `zap-baseline` | 1      | 1.6      | 2          | An arm64 ZAP image does exist, but the docker-in-docker plus host-networking path is unproven here. Defer.                                                                                                                                                                         |
| `Release gate` | 1      | 0.1      | 1          | Verdict job; must not depend on the plane it judges.                                                                                                                                                                                                                               |
| **total**      | **18** | **28.0** | **38**     |                                                                                                                                                                                                                                                                                    |

126.1 + 28.0 = 154.1 raw and 152 + 38 = 190 billed, reconciling exactly to the
run totals. (An earlier draft's two tables summed to 187 billed while claiming
exact reconciliation: `a11y`, `db` and `build` were each rounded down by one
billed minute.)

Also staying hosted, outside `ci.yml`: **`codeql` (~2.0 min/run)** — at the
pinned `cdf488f5` (v4.37.9) the action maps `process.platform === "linux"` to
the `linux64` x86-64 bundle with no architecture branch. arm64 support landed
only in v4.38.0, which the GitHub API shows was published **2026-09-09 at
14:04Z — today, hours before this was written**, not 2026-09-08 as an earlier
draft said. Its own changelog entry is hedged: the action "downloads the native
`linux-arm64` CodeQL bundle **when available**." Do not put a required check on
a release that is hours old and whose arm64 path is conditional. And
**`dependency-review`**, which is architecture-neutral and cheap.

**Never move:** every workflow that reads a `Production`, `Staging`,
`Recovery Drill` or `Monitoring` environment secret —
`production-deploy.yml`, `production-database.yml`, `admin-mfa-*.yml`,
`recovery-drill.yml`, `slo-report.yml`, `production-smoke.yml`. This is already
the repository's stated position; a cost exercise must not erode it. **Add
`factory-status.yml` to that list** for a different reason: it is the one
workflow triggered by `pull_request_target`, so it always runs for any fork
pull request regardless of the approval policy.

### Five fixes that must land before a single runner is registered

Each is a certain day-one failure and none is pleasant to diagnose after the
fact.

1. **Cache key has no architecture component.**
   `.github/actions/playwright/action.yml:34` keys on
   `playwright-${{ runner.os }}-<browser>-<version>` over `~/.cache/ms-playwright`.
   `runner.os` is `Linux` on both planes, so an arm64 runner and the hosted x64
   runners would share and poison one cache entry. Add `${{ runner.arch }}`.
   **Note where the damage lands — an earlier draft named the wrong jobs.**
   Read from the workflow, the composite has exactly three consumers in
   `ci.yml`: `fast` (`:78`, "Install Chromium for the browser-backed unit
   tests", `project: chromium`), `quality` (`:110`, "Install Chromium for
   production print-kit rendering", `project: chromium`) and `visual` (`:290`,
   "Install project browser", `project: ${{ matrix.project }}` over
   `[chromium, mobile-safari]`). The `build` job does **not** invoke it at all.
   `e2e` and `a11y` do not either — they run inside the pinned Playwright
   container with browsers pre-baked and only verify the environment (`:206`,
   `:247`).

   The recommended split puts **both** arm64 producers, `fast` and `quality`,
   on the runner, and both resolve to `browser=chromium`
   (`action.yml:19-24`). Hosted `visual` restores two keys,
   `playwright-Linux-chromium-<version>` and `playwright-Linux-webkit-<version>`
   (`mobile-safari` maps to webkit). The crossed key is therefore precisely
   `playwright-Linux-chromium-<version>`: two arm64 jobs write it, four hosted
   chromium `visual` shards read it, and the failure lands on the one job this
   document hard-pins hosted for baseline safety.

   **The nightly pilot widens this, not narrows it.** `nightly.yml` uses the
   same composite in `cross-browser` (`:91`, all four projects → chromium,
   webkit _and_ firefox) and `mutation` (`:133`, chromium). Piloting the
   secret-free nightly tier on arm64 therefore poisons the webkit key as well
   as the chromium one — both of which hosted `visual` consumes — so fix 1 is a
   prerequisite of the _cheapest_ pilot, not only of the full split.

   Contrast with `.github/actions/setup`, which uses `actions/setup-node`'s
   built-in `cache: pnpm` and already produces arch-scoped keys
   (`node-cache-Linux-x64-pnpm-…`, confirmed live). Only the Playwright cache is
   arch-blind.

2. **Adding `runner.arch` will overflow the 10 GiB Actions cache.** The repo is
   already at **7.39 GiB across 73 entries** (`gh api .../actions/cache/usage`,
   live). Duplicating browser caches per architecture pushes past the limit and
   GitHub evicts least-recently-used entries — which, during a pilot where most
   traffic is arm64, means the **x64** entries are the ones evicted, silently
   slowing the hosted plane the pilot is supposed to leave alone. Prune the
   cache, or scope the arm64 key to a distinct prefix with a deliberate budget,
   before landing fix 1.
3. **`--user 1001` is a hosted-runner assumption.** `ci.yml:182` and `:233` hard-code
   it. On the Lima guest the account uid differs, so the container would not own
   the bind-mounted workspace and every write fails.
4. **Browser-path guard mismatch.** `scripts/ci/check-browser-image.mjs:11`
   throws unless the browsers path is `/ms-playwright`; the repository's own job
   image sets `/opt/ms-playwright` (`ops/local-ci/image/Dockerfile:95`). Decide
   which image self-hosted `e2e` runs in before routing anything — and if the
   answer is MCR's arm64 child, pull and run it once first, because nothing here
   has.
5. **Decide what happens to `actions/cache` traffic.** See the uplink row in the
   operational-burden table: the cache backend stays GitHub's, so a self-hosted
   runner downloads it over the operator's home connection on every job.

### Honest limit of the split

Using the historical residual of 38 hosted billed minutes per CI run, the
400-record scenario leaves 15,200 CI minutes plus the observed ~4,620 non-CI
minutes: roughly **19,820 billed minutes against a 3,000-minute quota**.
That is over quota at the modelled volume. It does not establish an
irreducible non-CI floor or rule out every lower activity level; use the
conditional calculation in the quota section for that question.
`visual` and `lighthouse` account for most residual CI usage, while protected
production workflows remain hosted. #296 trims E2E and accessibility, the
jobs proposed to leave the hosted meter, so it does not reduce that residual
hosted job set. Future timing or cadence changes need their own measurements.

## What happens to the bespoke local-CI plane

**It cannot coexist with a runner on this machine, and it should not be retired
before a pilot proves itself.**

### The machine is already fully committed

- `sysctl`: Apple M5 Pro, `hw.ncpu` 18, 64 GiB.
- `~/.lima/nabaperks-ci/lima.yaml` and `~/.lima/nabatable-runner/lima.yaml`:
  12 vCPU / 40 GiB and 6 vCPU / 12 GiB — **18 vCPU against 18 logical CPUs, and
  52 of 64 GiB, already allocated** before any runner exists. Disk on the host:
  36 GiB and 8.4 GiB respectively.
- The guest's own admission arithmetic is saturated too:
  `container.cpus` 10 + `container.daemon.cpus` 1 + `vm.reserveCpus` 1 = 12 =
  `vm.cpus` (memory 32 + 6 + 2 = 40 = `vm.memoryGb`), read from
  `config/local-ci-contract.json` and enforced by
  `ops/local-ci/core/lane-scheduler.mjs`.

**Precisely what is saturated, and what is not.** Those figures are
_allocation_, read from `~/.lima/*/lima.yaml`, not _utilisation_. vCPUs are not
exclusive: Lima/`vz` can allocate more vCPUs than the host has cores, and two
VMs at 12 + 6 do not pin 18 physical cores unless both are actually busy. So the
strict claim "a runner cannot be added" is too strong — a third VM can be
created today and it will boot.

The real constraint is contention under concurrency, and there the evidence
still points the same way: a max-config attempt made earlier in this session was
measured about **20% slower** with dev-server timeouts — _that measurement is
from this session and is not recorded in the tree_. Combined with the guest's
own admission arithmetic, which already claims every vCPU it was given, the
defensible statement is that **a runner's capacity has to be budgeted as a
subtraction** from `nabaperks-ci`, `nabatable-runner` or macOS, even though
nothing in the tooling will stop you from over-allocating instead. Over-
allocating is exactly the failure mode that produces the contaminated evidence
described next, because it degrades both planes without either noticing.

### Nothing would detect an overlap

- The controller lease (`ops/local-ci/agent/lease.mjs`) is keyed on the agent's
  own PID plus `ps lstart`. A runner process neither takes nor observes it.
- `assertVmIsolation` checks mounts, networks, agent forwarding, Rosetta and
  host home — **not foreign workloads**. A runner needs only outbound HTTPS 443
  and trips none of these.
- The resource reconciler filters inventory to `nabaperks-ci-(job|dind|net)-`
  names, so it will neither destroy nor notice a runner's containers, and its
  "absence verified, dispatch permitted" precondition passes while a runner job
  is executing.

Silent overlap therefore produces CPU starvation **and contaminated evidence**:
a starved local run still publishes an App check that feeds
`compare-shadow`'s duration budget and equivalence streak. The programme's only
acceptance instrument would be measuring contention rather than the plane.

### The architectural point

The bespoke agent is a **pull** model: it polls `/pulls` and
`ops/local-ci/core/allowlist.mjs` refuses fork pull requests at the machine, with
an exact `===` head-repository comparison and a repository-ID pin. A GitHub
Actions runner is a **push** model — GitHub queues work at a label and the
runner has no veto, so the fork boundary must live in the workflow file, which
for `pull_request` events is written by the attacker. **Migration would move the
fork boundary from code the operator controls into code the attacker
controls.** While the repository is public that is a security regression, cost
aside.

### What the runner does better

Not a small list, and it is why this is a real question rather than a
foregone one:

- It executes the **real workflow**, so it covers all nine required roots. The
  local plane covers five (`fast`, `quality`, `e2e`, `a11y`, `db`); there is
  **no local lane for `build`, `visual`, `lighthouse` or `zap-baseline`**
  (`docs/operations/local-ci.md`).
- Merge authority arrives through a supported channel — no proof envelope, no
  signing supervisor, no App identity pinning, no bridge poller.
- Artifacts, logs, re-runs, secrets and per-job `runs-on` fallback come for
  free.

By contrast, `routeTrustedProof` has no non-test caller,
`/opt/nabaperks-trusted-ci` does not exist, and the whole trust apparatus is
roughly 13,000 lines of agent code plus 12,300 lines of tests carrying a plane
that currently gates nothing.

### Recommended disposition

**Pause, do not retire, and do not run both.** Concretely:

- Keep the bespoke agent installed and paused during any pilot window. Its stop
  path is graceful ("stopping after the current tick" appears in the live log),
  and restarting it costs one `launchctl` command.
- Retire the bespoke plane only after a separate, reviewed qualification
  proves the proposed runner **against an all-GitHub-hosted execution of the
  same full candidate SHA**, with matching workload definitions and complete
  outcomes. Retain distinct provider run/attempt identities and per-job runner
  metadata, including runner IDs, names, groups, labels and native architecture
  evidence. Verify the all-hosted route from the reviewed workflow and provider
  worker metadata; an Actions App check name does not establish the hardware.
  A mixed or self-hosted Actions run is not the hosted baseline. Only then
  consider retiring `ops/local-ci/agent`, `ops/local-ci/host`, `routing.mjs`, the
  proof envelope and policy, the trusted supervisor, shadow observer and
  nightly proof.
- Keep the shared workload definition and runner command:
  `config/ci-workloads.json` and `scripts/ci/run-workload.mjs`.
  The evidence producer and comparator are useful starting points, **not a
  ready-made qualification for this pilot**. `scripts/ci/hosted-evidence.mjs`
  assigns `plane: "hosted"` to an Actions run without checking its runner
  placement. Feeding a self-hosted Actions run to it would mislabel the plane.
  Before using `ops/local-ci/compare-shadow.mjs` or the shadow qualification
  modules, add reviewed validation of the separate all-hosted baseline and
  pilot evidence identities. Current local evidence also lacks trusted
  execution verification and cannot establish an eligible streak. Do not
  relabel records or infer qualification from a green Actions check. Keep any
  watchdog repointing separate, with its required API credential reviewed.

The workload definition is already shared: `ci.yml` invokes
`node scripts/ci/run-workload.mjs <lane>` and the local profiles invoke the same
script. That is the most portable asset in the programme and it survives every
outcome.

## Prerequisites checklist

In order. Each item must be true before the next is attempted. Items 1–3 are
worth doing whether or not a pilot ever happens.

- [ ] **1. Answer the motive.** Cost, capacity, or independence from GitHub? For
      cost the migration is insufficient on its own; for capacity or sovereignty
      it is defensible. Nothing in the evidence settles this.
- [ ] **2. Set the fork-PR approval policy to `all_external_contributors`.**
      Independent of everything else; today a returning contributor's fork pull
      request would execute on the operator's hardware unattended.
- [ ] **3. Land the six other provider hardening changes** from the security
      section: `integration_id` on all three required checks,
      `can_approve_pull_request_reviews` false, `default_workflow_permissions`
      read, `sha_pinning_required` true, App key off the interactive uid, and
      the contract test forbidding a self-hosted label on any
      `pull_request_target` workflow.
- [ ] **4. Resolve the licensing wall.** On a private personal-account
      repository, CodeQL and dependency review stop working. Either stay public
      (the cost model then evaluates to $0), move to an organisation on Team and
      buy Code Security, or drop both required checks. Decide before any runner
      work.
- [ ] **5. Make the repository private,** if that is the decision. Until then
      the entire cost case is hypothetical and the fork-PR hazard is live.
- [ ] **6. Land the five day-one fixes**: `runner.arch` in the Playwright cache
      key, cache-budget headroom before that key doubles (7.39 of 10 GiB is
      already used), no hard-coded `--user 1001`, the `/ms-playwright` versus
      `/opt/ms-playwright` guard mismatch, and a decision on `actions/cache`
      traffic over the home uplink. Pull and run MCR's arm64 Playwright child
      once while you are here — it is the last unverified feasibility
      assumption.
- [ ] **7. Build and prove the rollback mechanism with no runner registered.**
      Use the repository variable directly in each eligible job's `runs-on`, as
      shown in tier 1. Add no routing preflight job, `needs` edge, API call or
      credential. Preserve all existing test/build prerequisites and check
      names. With no pilot runner registered, prove flag off/absent/invalid
      cases execute the complete hosted roots, failed real prerequisites still
      block, cancellation remains effective, and changing the flag before a
      rerun actually produces hosted execution for the same SHA. This is a
      prerequisite, not an implemented capability. Rehearse the whole
      stop/cancel/rerun sequence; a cancelled required check is not recovery.
      It controls only reviewed workflows that contain the expression, so a
      foreign or stale workflow without it needs tier-2 containment instead.
- [ ] **8. Reclaim capacity.** Either pause the bespoke agent, or explicitly
      reduce `container.cpus`/`vm.cpus` in the contract so `lanesFit` reflects
      the reduced share. Never add a runner's budget on top of a saturated
      machine. Leave `nabatable-runner` untouched.
- [ ] **9. Create a dedicated third Lima VM** for the runner with `mounts: []`,
      no `limactl`, no credentials, sized from budget reclaimed in step 8. Never
      install the runner on macOS, and never inside `nabaperks-ci` where it
      could poison the trusted job image and where neither the lease nor the
      isolation self-check can see it. Use `limactl stop` on one VM as the
      mutual-exclusion primitive: physical and visible, not dependent on either
      plane noticing the other.
- [ ] **10. Hard-pin `visual` and `lighthouse` to `runs-on: ubuntu-latest`**
      with inline comments, plus a contract test asserting those two jobs never
      carry a self-hosted label. The four-layer ARM snapshot guard lives in the
      agent's contract and profiles, **not** in the workflows, so it does not
      travel to a runner.
- [ ] **11. Also hard-pin every `pull_request_target` workflow hosted.**
      `factory-status.yml` today; the contract test from item 3 keeps it true.
      This is separate from item 10 because the reason is different: item 10 is
      about coverage, this is about an entry point no approval policy gates.
- [ ] **12. Pilot one cheap tier only, and name it precisely.** Prefer the four non-secret nightly jobs `cross-browser`, `cross-browser-gate`, `mutation` and `load`, which block no merge. `db` is another bounded candidate (3.1 historical raw minutes, no browser or visual baselines), but it is a required root. Do not start with all 16 E2E jobs. Keep **both** excluded nightly jobs explicitly on `ubuntu-latest`: `load-race` passes `secrets.STAMP_RACE_AUTH_TOKEN` to candidate code when its URL variables are set; `zap-full` has no qualified native ARM run and remains `x64-only` in the local profile. A published ARM64 ZAP image does not lift that restriction. Add routing contract checks for both exclusions before registration. `load-race` is currently conditioned out, while ZAP contributes the ~402 hosted monthly minutes included in the corrected scenario (e). Moving either requires a separate reviewed change with the relevant secret boundary or native execution proof.

- [ ] **13. Rehearse tier-3 rollback before you need it.** Destroy and recreate
      the pilot VM from its YAML once, on a quiet day, and time it. A rollback
      nobody has performed is not a rollback.

## Rollback

### Tier 1 — trusted workflow fallback: stop routing, then recover CI

**Apply this procedure only to a reviewed workflow that implements the direct
routing expression below.** Verify the workflow bytes and full
head SHA before replaying a stale run. A foreign, fork-supplied or older
workflow may omit these controls; do not rerun it as a recovery action. For
untrusted or unknown workflow definitions, cancel the work and de-register the
runner using tier 2. De-registration contains the exposure but does not rewrite
its `runs-on` labels or make that workflow run hosted; recovery needs a reviewed
hosted workflow on a branch whose definition is under owner control.

GitHub's [context-availability table](https://docs.github.com/en/actions/reference/workflows-and-actions/contexts#context-availability)
allows `vars` directly in `jobs.<job_id>.runs-on`; `env` is not available there.
Use a fixed reviewed label for the enabled case and a hosted default, for example:

```yaml
# Illustrative pilot label; no runner with this label is registered by this PR.
runs-on: ${{ vars.SELF_HOSTED_PILOT == 'on' && 'nabaperks-arm64-pilot' || 'ubuntu-latest' }}
```

A value matching `on` selects the fixed pilot label; an unset variable or other
value selects `ubuntu-latest`. The flag never becomes an arbitrary runner label.
There is **no routing preflight job or output dependency**. That removes the
failure/timeout path in which a preflight causes required descendants to be
skipped under GitHub's [`needs` semantics](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idneeds).
Keep each job's existing `needs`, `if` and `continue-on-error` settings unchanged;
do not weaken real test/build prerequisites or accept skipped required roots.
An optional diagnostic job must not become a routing prerequisite.

Before registration, retain hosted proof for flag off/absent/invalid cases,
workflow cancellation, failed real test/build prerequisites and an actual
stop/cancel/rerun after changing the flag. Confirm that the rerun selects hosted
workers for the same full SHA and completes every required root. Do not assume
that merely writing a repository variable recovers a queued or cancelled run.
These are implementation acceptance criteria, not tests performed by this
documentation-only PR.

This design deliberately makes **no live runner-status API call**. GitHub's
[repository runner-list endpoint](https://docs.github.com/en/rest/actions/self-hosted-runners#list-self-hosted-runners-for-a-repository)
requires repository Administration read permission, which the ordinary
`GITHUB_TOKEN` cannot grant. GitHub documents a separate App token or PAT for
[permissions unavailable to `GITHUB_TOKEN`](https://docs.github.com/en/actions/tutorials/authenticate-with-github_token#granting-additional-permissions).
No such credential is provisioned by this pilot design. The consequence is
explicit: when the flag is `on`, an offline runner may leave work queued. The
operator must use the stop/cancel/rerun procedure below; this expression provides
manual fallback, not automatic liveness-based routing.

```sh
# 1. Stop future routing in the reviewed workflow that implements this flag.
gh variable set SELF_HOSTED_PILOT --body off

# 2. Cancel the in-flight run. This ONLY cancels; it starts nothing.
gh run cancel <run-id>

# 3. Wait for the cancellation to reach a terminal state.
until [ "$(gh run view <run-id> --json status -q .status)" = "completed" ]; do
  sleep 5
done

# 4. Start the hosted replacement. Without this the required check stays
#    "cancelled" and the pull request stays blocked.
gh run rerun <run-id>
gh run view <run-id> --json status,conclusion   # confirm it is queued again
```

**Step 4 is not optional and an earlier draft omitted it.** The earlier
sequence set the variable and called `gh run cancel`, then claimed a
30-second recovery. `gh run cancel` is documented as "Cancel a workflow run"
and nothing else; `gh run rerun <run-id>` is the command that "Rerun an entire
run". For a queued pull-request run, cancelling therefore leaves `Release gate`
in the `cancelled` conclusion — a terminal, non-passing state — until another
push or an explicit rerun occurs. The pull request is blocked in the meantime,
and the ruleset has `bypass_actors: []`, so nobody can merge past it.

Two consequences for the advertised recovery time. First, the rerun replays the
whole workflow on hosted runners, so "recovery" means the variable flip plus a
full CI cycle (~10 minutes wall clock at the historical 72-job shape), not 30 seconds — the
30 seconds is only how long it takes to stop the bleeding. Second, `gh run
rerun` re-uses the original run's workflow file and head SHA, so it picks up
the routing variable when the rerun jobs are scheduled; a rerun before the variable is set
would route straight back to the runner, which is why the order above matters.
On a branch you control, a new push can instead create fresh checks for its
new SHA after the flag is off. An exact-SHA rerun is available only when the
original workflow has the reviewed routing expression. Neither
procedure converts a foreign workflow that hard-codes a self-hosted label into
a hosted workflow; use the tier-2 containment and trusted replacement described
at the start of this section.

Runner availability remains unknown when the flag is enabled. Prove the
offline-runner recovery case as well as the flag-off case before a pilot; this
is manual fallback, not automatic health-based routing.

**Tier 1 is an availability control, not a security control.** For
`pull_request` from a fork the workflow file comes from the attacker's head
commit, so it contains whatever `runs-on` the attacker wrote — the kill-switch
variable and the whole indirection may be absent from
that run. Turning the variable off stops _your_ jobs reaching the runner; it
does nothing to stop _theirs_. Only removing the label from GitHub's routing —
tier 2 — has any effect on a hostile pull request. Do not let the 30-second
switch create a false sense that the fork exposure is under a toggle.

### Tier 2 — de-register the runner

Stopping the service is **not** rollback. GitHub keeps an offline runner
registered for 14 days and keeps routing jobs to it. ("A self-hosted runner is
automatically removed from GitHub if it has not connected to GitHub Actions for
more than 14 days"; an ephemeral one after 1 day.) De-register properly:

```
./config.sh remove --token <removal-token>            # inside the guest
gh api -X DELETE repos/lapeninns/nabaperks/actions/runners/<id>   # if unreachable
```

### Tier 3 — destroy the guest, because de-registration is not remediation

GitHub is explicit that a self-hosted runner "can be persistently compromised by
untrusted code in a workflow." De-registering ends job routing; it does not undo
anything a job did to the machine — a cron entry, a modified Docker image, a
poisoned pnpm store, a copy of `.credentials`, an SSH key. If there is any
reason to believe untrusted code ran (any fork pull request at all, on a public
repository), the only honest rollback is to delete the Lima instance and
recreate it from the declarative config, then rotate anything the guest could
have touched.

```
limactl stop  <pilot-vm> && limactl delete <pilot-vm>   # then recreate from YAML
```

This is the concrete reason the pilot VM must be a **third, disposable**
instance and never `nabaperks-ci`: tier 3 has to be cheap enough to actually
perform. If rolling back means destroying the trusted job image and the bespoke
plane along with it, nobody will do it.

### Why tier 1 must exist before the runner does

A stalled job on an offline runner leaves the required check **pending, not
red**, for up to 24 hours (GitHub's limits reference: "A job can be in the queue
for 24 hours before it is automatically cancelled").
`release-gate` (`ci.yml:430-443`) has `needs:` on all
nine roots with `if: always()`, and `always()` fires only once dependencies
reach a terminal state — a perpetually queued dependency never does. The ruleset
has `bypass_actors: []` (verified) and
`strict_required_status_checks_policy: true`, so nobody can merge around it and
the revert pull request must itself pass the gate the outage is blocking. There
is no notification and no native hosted fallback. **Rehearse this recovery
deliberately in week one rather than discovering it in an outage.**

## Ongoing operational burden

Falls entirely on one person who already operates a bespoke agent with a poor
measured success rate.

### Where the local-plane reliability figures come from

This matters enough to show the derivation, because the ~50% failure rate is
used as a central blocker and an earlier draft cited it to
`docs/operations/local-ci.md:77-81`, which is a provisioning section and
contains no run totals. The real source is the agent's own retained evidence
store, `~/.nabaperks-local-ci/runs`, one directory per commit SHA, one
subdirectory per run named `<profile>-<UTC timestamp>-<short SHA>`, each holding
the run's `lane-result.json` whose `conclusion` field is the run's verdict.

Counted on 2026-09-09: **113 run directories**, of which 108 carry a
`lane-result.json` and 5 do not (the agent was interrupted before writing one).
The store's oldest retained run is `20260905T144537Z` and its newest
`20260909T210739Z` — a **4.3-day retention window**, not a project history.

| Profile   | Records | Success | Failure | Cancelled | Timed out | No record |
| --------- | ------- | ------- | ------- | --------- | --------- | --------- |
| `main`    | 38      | 12      | 16      | 9         | 1         | 1         |
| `pr`      | 64      | 22      | 30      | 12        | 0         | 4         |
| `nightly` | 6       | 0       | 3       | 1         | 2         | 0         |
| **total** | **108** | **34**  | **49**  | **22**    | **3**     | **5**     |

Excluding cancellations, which are mostly supersession rather than plane
failure, **34 of 86 completed runs succeeded — a 60% failure rate.** Including
them, 34 of 108.

Two honest qualifications, and the claim is reclassified accordingly. The
counts themselves are **verified** — they are a direct census of retained files
and reproducible with a `find` and a `jq`. What is **inferred** is that a
4.3-day window taken during heavy development of the agent represents the
plane's steady-state reliability; the store retains nothing older, so no longer
baseline exists to check it against. The separate claim that "no `nightly` run
has ever succeeded" is **not supported by this evidence** and has been narrowed
to the six nightly runs the store retains, none of which succeeded. If this
figure is going to carry a decision, the ledger needs to outlive its four-day
window — which is a change to the runbook, not to this document.

| Burden                   | Detail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runner updates           | Twelve releases in ~12.5 months (~34-day cadence) against a documented 30-day update requirement. Leave auto-update **on**; `--disableupdate` creates a permanent recurring chore.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| OS and image maintenance | GitHub: "you are responsible for updating the operating system and all other software". The Lima base image references a rolling Ubuntu 24.04 arm64 cloud image with no digest — pin it before relying on reproducibility.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Disk                     | `~/.lima/nabaperks-ci` is already 36 GiB; the guest holds two 4.36 GiB job images. Each runner instance adds a `_work` tree (~1.0 GiB `node_modules`, up to 2.7 GiB `.next`). Put `docker system prune` and `_work` cleanup in `ACTIONS_RUNNER_HOOK_JOB_COMPLETED` so hygiene is automatic.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Sleep                    | `pmset -g custom` shows `sleep 1` on both AC and battery, currently held off only by a manually started Amphetamine session and Electron apps. The bespoke agent holds a **job-scoped** `caffeinate` because it decides on the host when to claim work. A runner is assigned work **inside the guest**, which cannot take a macOS power assertion. Either the Mac never sleeps, or the runner is intermittently offline.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Reboot                   | **Not a LaunchAgent question — a Lima question.** Prerequisite 9 puts the runner inside a dedicated third Linux Lima VM and forbids installing it on macOS, so the runner service is a systemd unit in the guest (`./svc.sh install`) and starts when the guest starts. The unsolved host-side problem is what starts the **VM** after a Mac reboot, and neither existing instance solves it: `~/Library/LaunchAgents` contains no `lima.*` autostart file, and `limactl list` shows both `nabaperks-ci` and `nabatable-runner` running only because something started them. Two mechanisms exist and both are user-login-scoped. `limactl autostart <instance>` (Lima 2.2.0; the deprecated alias is `start-at-login`) registers, in its own words, an autostart file that starts the instance "when the user logs in". The alternative is a bespoke supervisor agent — `~/Library/LaunchAgents/com.nabatable.runner-vm.plist` does exactly this for the other project, `RunAtLoad` + `KeepAlive` around a `limactl start` wrapper. So the auto-login and FileVault constraints do not disappear; they move one layer up, from the runner service to the VM that hosts it, and they now gate a merge-blocking check rather than an advisory plane. Pick a mechanism, register it, and **test it with a real reboot** before week one. |
| Mid-run drops            | A sleep, lid close, Wi-Fi change or VPN toggle breaks the long poll and GitHub fails the job with "lost communication with the server" — a **red required check on a green change**, which trains reflexive re-runs and corrodes the gate.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Parallelism              | One runner instance takes one job at a time. Approaching the current proposed self-hosted fan-out of 30 jobs means N registrations, N `_work` trees, N services, N update paths — on a machine with zero spare cores.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Home uplink              | **The largest unmodelled operational cost, and it does not go away.** `actions/cache` is backed by GitHub's storage, not the host, and it downloads on every cache hit whether or not the path is already warm locally. The `setup-node`/pnpm entry alone is **~0.27 GiB** (measured from `gh api .../actions/caches`), restored by the **27 of 30** proposed self-hosted jobs that run `./.github/actions/setup` in the post-#296 matrix (the three gate jobs do neither): **0.27 × 27 = 7.29 GiB inbound per CI run, ~2.85 TiB/month at 400 runs**, over a residential connection, plus browser caches and any image pull. Hosted runners get this from inside GitHub's network at LAN speed, which is why "Initialize containers" is only 29 s there. Either accept the transfer, or explicitly bypass `actions/cache` on the self-hosted plane and rely on a pre-warmed guest — a design decision, not a detail.                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Steady state             | Realistically 45–90 minutes per month per runner instance, plus sole on-call for a frozen merge gate.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

**Ephemeral mode: a narrower claim than an earlier draft made.** Fixed per-job
overhead on the hosted plane is 2,931 s of 9,248 s — **31.7%** — chiefly
"Initialize containers" (48 jobs, 29.2 s mean) and the composite setup action
(65 jobs, 17.7 s mean); both reproduced from the run's step timings. A
persistent runner can win part of that back through a warm Docker layer cache.

But the earlier draft then said `--ephemeral` "discards it and refetches over
the operator's home uplink", and that contradicts its own next sentence.
`--ephemeral` de-registers the runner after one job; it does **not** reset the
machine and does **not** clean the disk. On a persistent guest the Docker layer
cache and any pre-warmed store survive an ephemeral registration untouched. What
`--ephemeral` actually buys is that a compromised job does not inherit or hand
on a live runner registration — worth having — and what it actually costs is a
re-registration round trip per job, not an image refetch. The genuine
uplink cost is the `actions/cache` row above, and that one is paid in **both**
postures.

So the honest version: ephemeral mode is a modest overhead cost and a real
security gain, not a performance catastrophe. The catastrophe would be
recreating the VM per job, which is what GitHub's guidance actually implies for
untrusted code and which nothing in this plan proposes.

## Evidence classification

### Verified

Reproduced directly on 2026-09-09 by command, API response or fetched GitHub
documentation.

- Repository is public, forkable, personal-account-owned; fork-PR approval is
  `first_time_contributors`; zero registered runners; zero repository Actions
  secrets; `default_workflow_permissions` write with
  `can_approve_pull_request_reviews` true; `allowed_actions` all with
  `sha_pinning_required` false.
- Ruleset `19613437` required checks carry no `integration_id`, and
  `bypass_actors` is empty with `strict_required_status_checks_policy: true`.
- Run `34290952137`: 72 jobs, 154.1 raw machine-minutes, **190 billed minutes**,
  `billable.UBUNTU.total_ms = 0`. Per-tier raw and billed reconcile exactly.
- 1,143 CI workflow-run records since 2026-06-15 (complete history) =
  404/month, with a 241–952/month band by window. Conclusions: 367 success,
  447 failure, 329 cancelled. Executed attempts: 1,221 (1,077 × 1, 56 × 2,
  9 × 3, 1 × 5), an inflation of ×1.068 over the record count.
- Billed minutes per CI run record at the historical 72-job shape, aggregated over rounded
  job durations across all attempts (`?filter=all`) for the 38 records between
  2026-09-08T16:57Z and 2026-09-09T21:11Z: success 202 (n=28), failure 178
  (n=5), cancelled 153 (n=5); blended at the lifetime conclusion mix and the
  attempt inflation, **191**.
- Nightly run `34323842337`: **133** jobs (131 success, 1 cancelled, 1 skipped;
  the run's own conclusion is `cancelled`, but only one job was), 285.6 raw,
  355 billed minutes. `nightly.yml` cron is `24 2 * * *`; 79 runs to date.
- Non-CI monthly total **~16,150** billed minutes, from counting each
  workflow's actual runs in the 30 days to 2026-09-09 and multiplying by the
  mean billed minutes of its five or six most recent runs. The retained hosted
  workload under the recommended split is **~4,620** of that at the observed
  event mix. It includes change-triggered work and is not a fixed floor.
- `nightly.yml`'s `load-race` job is gated on `vars.STAMP_RACE_URL` and
  `vars.REDEEM_RACE_URL`; `gh api repos/lapeninns/nabaperks/actions/variables`
  returns only `LOCAL_CI_MODE` and `LOCAL_CI_WATCHDOG_ENABLED`, so the job is
  conditioned out of every run today and bills nothing. It passes
  `secrets.STAMP_RACE_AUTH_TOKEN` when it does run (`nightly.yml:180`).
- The `.github/actions/playwright` composite is invoked by exactly three
  `ci.yml` jobs — `fast` (`:78`), `quality` (`:110`) and `visual` (`:290`) —
  and by `nightly.yml`'s `cross-browser` (`:91`) and `mutation` (`:133`).
  `build` does not invoke it.
- Lima 2.2.0 provides `limactl autostart` (deprecated alias `start-at-login`),
  which starts an instance at **user login**; no `lima.*` autostart file exists
  in `~/Library/LaunchAgents` today, and the other project starts its VM from a
  bespoke `RunAtLoad`/`KeepAlive` LaunchAgent
  (`com.nabatable.runner-vm.plist`).
- Rate $0.006/min Linux x64, $0.005 arm64 — GitHub billing reference. Plan
  allowances: Free 2,000, Pro 3,000, Team 3,000, Enterprise Cloud 50,000.
- GitHub's public-repository warning and persistent-compromise statement —
  secure-use reference.
- `pull_request_target` workflows "will always run, regardless of approval
  settings"; the first-time gate lapses on "any commit or pull request merged" —
  repository Actions-settings reference. `factory-status.yml:8` uses
  `pull_request_target`.
- `runs-on` accepts `github, needs, strategy, matrix, vars, inputs` and **not**
  `env` — contexts reference. Offline runners are removed after 14 days
  (ephemeral: 1 day); a queued job is cancelled after 24 hours — remove-runners
  and limits references.
- The pinned Playwright digest `sha256:dcc5531e…` **is** the OCI image index
  (`Docker-Content-Digest` matches; children `linux/amd64` `c091b21d…` and
  `linux/arm64` `941cc91e…`), fetched from `mcr.microsoft.com/v2/`.
- `codeql-action` pin `cdf488f5` = tag `v4.37.9` (published 2026-08-26);
  arm64 support first appears in `v4.38.0`, published 2026-09-09T14:04Z.
- Actions cache usage: 7.39 GiB across 73 entries against the 10 GiB repository
  limit; largest single entry `node-cache-Linux-x64-pnpm-…` at 0.27 GiB. Run
  `34290952137` produced 39 artifacts totalling only 0.02 GiB, so artifacts are
  not the uplink concern — caches are.
- Step timings for run `34290952137`: "Initialize containers" 48 jobs / 29.2 s
  mean, `./.github/actions/setup` 65 jobs / 17.7 s mean.
- `pmset -g custom`: `sleep 1` on both AC and Battery.
- CodeQL requires a Code Security licence on private repositories; the
  dependency-review action is "available for all public repositories, as well as
  private repositories that have GitHub Code Security or GitHub Advanced
  Security enabled".
- 47 × `runs-on: ubuntu-latest`, zero `self-hosted`, two container jobs on the
  multi-arch Playwright digest.
- Host: 18 cores / 64 GiB; two Lima VMs allocating 18 vCPU and 52 GiB;
  `mounts: []`, `forwardAgent: false`, `networks: []` on `nabaperks-ci`;
  contract budget 10 + 1 + 1 = 12 vCPU.
- App private key at `~/.nabaperks-local-ci/github-app-private-key.pem`,
  `0600`, in a `0700` directory. (Note: the contract names it
  `app-private-key.pem`; the file on disk is `github-app-private-key.pem`.)
- Local plane reliability, **re-derived from the retained evidence store**
  `~/.nabaperks-local-ci/runs` (see the paragraph below the Weaknesses
  section). An earlier draft cited `docs/operations/local-ci.md:77-81` for
  these counts; those lines describe the Lima VM boundary and its provisioning
  prerequisites and contain no run totals, and a repository-wide search finds
  the counts in no file but this one. The census and its caveats are set out
  under "Where the local-plane reliability figures come from". One `main` run on
  `d5f5c3641` completed in 947 s across 10 lanes and 4,089 tests.
- `release-gate` needs all nine roots with `if: always()` (`ci.yml:430-443`);
  `local-ci-shadow.yml` already carries the same-repository allowlist.

### Inferred

Reasoned from verified facts, not demonstrated. Each would change the decision
if wrong.

- **The check-forgery chain.** Key readable by same uid + unpinned required
  contexts + a readable app id composes into forged merge evidence. No token was
  minted and no check run was forged.
- **A fork pull request can reach a self-hosted runner.** The mechanism (head
  controls the workflow file for `pull_request`) follows from GitHub's
  documentation but was not reproduced.
- Post-#296 billed minutes per run (~160) — modelled from #296's own job-count
  reduction plus the per-job round-up ceiling, not metered. It is the one input
  in the cost table that no measurement in this document supports.
- **That 400 CI run records/month is the right planning rate.** The lifetime
  measurement is 404, but the last-30-day rate is 241 and the last-7-day rate
  952; the matrix shape also changed several times inside the sample window
  (daily means from 19 jobs to 184). Every private dollar figure scales with
  this choice, and a rate at the low end of the band would cut the modelled
  saving by roughly 40%.
- **That the local plane's four-day evidence window is representative.** The
  60% failure rate is a verified census of retained files; that it describes a
  steady state rather than a period of heavy agent development is not.
- That skipped jobs are unbilled and that job wall clock equals billable time.
- That ephemeral mode costs a re-registration round trip per job — direction
  reasoned, not benchmarked on a self-hosted runner. (The stronger claim that it
  forces an image refetch has been withdrawn; see the operational-burden
  section.)
- That `.next` is or is not architecture-portable — untested either way, which
  is why `build` stays hosted.
- **That MCR's `linux/arm64` Playwright child actually runs this suite.** The
  index and the child's existence are verified; the child has never been pulled
  or executed here. The supporting evidence is the local plane's green record on
  a _different_ arm64 Ubuntu 24.04 image, plus the absence of any branded
  `chrome`/`msedge` channel in `playwright.config.ts`. Cheap to settle: one
  `docker run` in the guest.
- **The ~7.3 GiB/run cache-transfer estimate** is `0.27 GiB × 27 setup jobs`
  in the post-#296 matrix at `621231afed6f`. At 400 runs it is ~2.85 TiB/month,
  before browser caches or image pulls. The entry size was measured on
  2026-09-09 and the 27 consumers were counted from current workflow source;
  transfer on an actual self-hosted runner was not measured. The earlier
  51-restore estimate described the pre-#296 matrix and is superseded.

### Open questions the operator must answer

1. **Is the repository actually going private, and why?** If it stays public the
   whole cost model is $0 and the pilot has no financial justification at all.
2. **Will Code Security be bought, and can it be bought on this account?** It is
   the only path that keeps two of the three required checks alive on a private
   repository, and at ~$30/month it is ~30% of the recommended split's bill
   (scenario (e), ~$101).
   Whether a personal account can purchase it is unverified.
3. **Does GitHub accept a check run from an arbitrary App as satisfying a
   required context that omits `integration_id`?** This is the load-bearing
   inference of the security section. It deserves a controlled test on a scratch
   repository, and fixing it (adding `integration_id`) is cheap enough to do
   without waiting for the answer.
4. **Which plan is the account on?** `gh api user` returns `plan: null`. Free is
   2,000 minutes rather than 3,000. That changes both bills and the conditional
   quota threshold; the threshold is not a uniform one-third reduction once
   scheduled and manual usage are included.
5. **Will the operator accept that the Mac stops sleeping?** That is the only
   clean answer to the power-assertion problem, and it is a lifestyle and power
   decision, not a technical one. If not, the pilot must be designed around an
   intermittently offline runner from day one.
6. **Does `nightly.yml` still earn its ~11,900 billed minutes per month?** It
   re-runs a matrix that already ran that day, and it is 74% of all non-CI
   minutes. If it is redundant, deleting it is the single largest cost reduction
   available that costs nothing and adds no plane. Note the shape of the answer
   changed with the re-measurement: deleting it is worth ~$72/month against a
   private bill, but the 400-record scenario remains well over quota. The
   ~4,620 retained non-CI minutes reflect the observed activity mix and must
   not be treated as a fixed floor at other CI rates.
7. **Why does `production-smoke.yml` run so often, and is its cadence now worth
   cutting?** An earlier draft said 1,183 runs over 86 days = 13.8/day and
   dismissed the workflow as ~$1.90/month. Both halves were wrong. The
   workflow's first run was 2026-07-14, not the repository's creation date, so
   the correct denominator is 57 days; measured directly, it ran **726 times in
   the 30 days to 2026-09-09 — 24/day — at 2 billed minutes each, ~1,450 billed
   minutes/month.** A fourfold reduction in actual executions would save
   ~1,090 minutes, about **$6.50/month**, but changing the cron alone does not
   establish that saving: separate scheduled, release-triggered and manual
   runs first. It is a protected workflow that stays hosted; only its scheduled
   portion is independent of release activity.
   `nightly.yml` remains where the money is, by a factor of about eight rather
   than twenty-four.
8. **Is the local plane's ~40% success rate an ARM problem, a scheduler problem
   or an agent-maturity problem?** No architecture-specific cause was found, so
   it cannot be attributed. If it is a workload defect it will follow the
   workload onto a runner and the migration will not fix reliability. A second
   question rides on it: **the evidence store retains only about four days.**
   Every reliability number in this document comes from
   2026-09-05 to 2026-09-09, which is a window of heavy active development on
   the agent itself. Whether that rate is representative of a steady state is
   unknown, and answering it needs a retained ledger, not a deeper search.
9. **What is `nabatable-runner` doing, and is its 6 vCPU / 12 GiB genuinely
   reserved at all times?** It is the only potential slack on the machine.
10. **Would regenerating the 65 `visual` baselines on ARM be acceptable,** losing
    x86-64 pixel coverage? That one decision moves 17 billed minutes per run and
    is the larger half of the residual hosted spend.
11. **What is the actual upstream and downstream bandwidth of the operator's
    connection, and is a metered or fair-use cap in play?** The plan implies
    roughly 7.3 GiB of inbound pnpm-cache traffic per CI run (~2.85 TiB/month
    at 400 runs in the post-#296 matrix), plus browsers and image pulls. If that is unacceptable, the design must bypass
    `actions/cache` on the self-hosted plane and pre-warm the guest instead —
    which is a different plan, with different failure modes, and it is better to
    know that before week one than during it.
12. **Has anyone run the arm64 Playwright child?** The manifest says it exists;
    nothing here says it works. One `docker run` settles the last feasibility
    assumption in this document.

## Weaknesses of this recommendation

Stated plainly, because the evidence does not support a smooth-migration story.

- **The machine has no budgeted headroom.** 18 vCPU are allocated against 18
  logical CPUs. That is allocation, not utilisation — a third VM will boot — but
  every capacity figure in a pilot plan is still a subtraction from work that
  already happens, and a max-config attempt this session was measured about 20%
  slower.
- **The largest operational cost is not in any table but one row.** Keeping
  `actions/cache` on the proposed self-hosted plane implies roughly 7.3 GiB of
  pnpm-cache downloads per CI run, ~2.85 TiB/month at 400 runs, plus browser
  caches and image pulls. This uses the post-#296 count of 27 setup jobs. Nothing about
  running on your own hardware makes GitHub's cache service local.
- **The plane a pilot would replace fails three runs in five, not one in two.**
  Counted from the retained evidence store rather than from prose: of the 86
  runs that reached a terminal state other than `cancelled`, **34 succeeded and
  52 did not** — `main` 12 of 29, `pr` 22 of 52, `nightly` 0 of 5. Counting
  cancellations as well, 34 of 108. Migrating required checks onto a plane with
  that record would be worse than the cost it saves, and nothing here explains
  the failures. **This correction strengthens the blocker**: the earlier "about
  half" was the charitable reading.
- **The tiers worth moving are the hardest to move.** `e2e` and `a11y` are 142 of
  190 billed minutes and both need container support, which forces the runner
  into a Linux guest, which is what breaks the sleep contract.
- **The cost figures are modelled, not metered,** because the billing API reads
  zero while the repository is public.
- **The security conclusion rests on one undemonstrated composition** — the
  check-forgery chain. It is the right way to bet, but it is a bet.
- **A pilot adds a second execution plane to a one-person operation that already
  carries one it cannot keep green.** That is the real cost, and it does not
  appear in any table above.

## References

- `.github/workflows/ci.yml` — job definitions, container pins (`:181`, `:232`),
  `--user 1001` (`:182`, `:233`), `release-gate` (`:430-443`)
- `.github/workflows/local-ci-shadow.yml` — the same-repository allowlist
  pattern to copy
- `.github/actions/playwright/action.yml:34` — architecture-blind cache key
- `playwright.config.ts:63-66` — the `-linux` snapshot template
- `.lighthouserc.json` — no throttling calibration
- `config/local-ci-contract.json` — VM and container budget, snapshot guard
- `ops/local-ci/host/lima-nabaperks-ci.yaml:61,64-65,79` — guest isolation
- `ops/local-ci/core/allowlist.mjs` — the fork boundary a runner does not have
- `ops/local-ci/profiles/nightly.json:33` — why `load-race` stays hosted
- `~/.nabaperks-local-ci/runs/<sha>/<profile>-<ts>-<short>/lane-result.json` —
  the retained local-run ledger the reliability figures are counted from
  (~4.3-day retention; not in the repository)
- [Local CI operator runbook](local-ci.md), [CI redesign](ci-redesign.md),
  [CI cost baseline](ci-cost-baseline.md)
