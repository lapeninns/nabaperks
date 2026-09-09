# Self-hosted GitHub Actions runner — pilot scoping and decision

Owner: Lapen Inns product operations
Repository: `lapeninns/nabaperks`
Candidate host: the operator's Apple M5 Pro Mac (18 cores, 64 GiB), already
running Lima VMs `nabaperks-ci` and the unrelated `nabatable-runner`
Scoping basis: worktree `codex/local-first-ci-20260909` at `905362a5d`, based on
`origin/main` `d5f5c3641`. Measurements taken 2026-09-09.

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
roughly **$362 per month**, and its shape is right — 80.0% of billed CI minutes
sit in `e2e` and `a11y`, exactly the two tiers with no x86-64 baseline
dependency and no 2-core-calibrated budget. But the saving is unavailable until
the repository goes private, the licensing question is answered, and the
machine has spare capacity it does not currently have.

Do the cheap moves first — landing PR #296, deleting `nightly.yml`, trimming the
smoke cadence — because they are cheap, not because they are larger. **They are
not larger.** Measured against the same model: the cheap moves take scenario (b)
to scenario (f), recovering about **22,700 billed minutes/month (~$144)**; a
pilot layered on top of (f) recovers a further **~48,400 billed minutes/month
(~$290)**. The runner is worth roughly twice the cheap moves. The argument for
doing the cheap moves first is that they add no execution plane and no security
surface — an argument about risk and effort, not about magnitude. An earlier
draft of this document claimed the opposite; the arithmetic above is the
correction.

If a pilot proceeds anyway, it must be justified on latency and independence
from GitHub, **not** on money, and it must start with `nightly.yml` on a
throwaway VM, not with the pull-request path.

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

Two corrections to the figures this scoping started from, both verified against
GitHub's own pricing reference (fetched 2026-09-09):

- The Linux 2-core x64 rate is **$0.006/min**, not $0.008 (arm64 is $0.005/min).
- GitHub "rounds the minutes and partial minutes each job uses up to the nearest
  whole minute", **per job**. With 72 jobs per CI run that turns 154.1 raw
  machine-minutes into **190 billed minutes**, a 23% surcharge.

Both figures were reproduced independently for run `34290952137`:
72 jobs, 154.1 raw minutes, 190 billed minutes.

### Inputs

| Input                                             | Value                                                                       | Confidence                                              |
| ------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------- |
| CI runs per month                                 | 402 (1,134 runs over 85.9 days; complete history, repo created 2026-06-13)  | verified                                                |
| Run-rate volatility                               | last-30d 235/mo, lifetime 402/mo, last-7d 922/mo                            | verified                                                |
| Billed minutes per CI run, today's 72-job shape   | 190                                                                         | verified                                                |
| Billed minutes per CI run, post-#296 48-job shape | ~159                                                                        | inferred from #296's own modelling plus per-job ceiling |
| Non-CI billed minutes per month                   | **~12,500**, 80% of it `nightly.yml`                                        | measured per workflow (table below)                     |
| `nightly.yml` per run                             | 285.6 raw / **355 billed** across 133 jobs (run `34323842337`, most recent) | verified                                                |
| Rate / quota                                      | $0.006 per minute over 3,000 free minutes                                   | verified rate; quota assumes Pro or Team                |

An earlier draft carried the non-CI figure as an inferred band of
12,000–15,000. It has since been measured, by sampling the five most recent runs
of every workflow and scaling that workflow's lifetime run count to a month:

| Workflow                | Runs/mo | Billed min/run | Billed min/mo |
| ----------------------- | ------- | -------------- | ------------- |
| `nightly.yml`           | 28      | 355            | **9,940**     |
| `codeql.yml`            | 406     | 2              | 811           |
| `production-smoke.yml`  | 419     | 1              | 419           |
| `dependency-review.yml` | 299     | 1              | 299           |
| `production-database`   | 38      | 21             | 795           |
| everything else         | —       | —              | ~205          |
| **total**               |         |                | **~12,470**   |

So `nightly.yml` alone, at its daily `24 2 * * *` cron, is **~9,900 billed
minutes per month — more than three times the entire quota from a single
workflow.** The earlier upper bound of 12,100 was not reachable: a daily cron
caps the workflow at ~30.4 runs/month, or ~10,800 billed minutes even if every
run were as heavy as the sample. The lower figure is the honest one and it does
not change the conclusion.

### Monthly cost, 400 CI runs/month, $0.006/min, 3,000 free minutes

| #   | Scenario                                                                 | Billed min/mo | Over quota | **Cost/month** |
| --- | ------------------------------------------------------------------------ | ------------- | ---------- | -------------- |
| a   | **Public, today**                                                        | 0             | 0          | **$0**         |
| b   | Private, everything hosted, today's shape                                | ~89,600       | 86,600     | ~$520          |
| c   | Private, everything hosted, post-#296                                    | ~77,200       | 74,200     | **~$445**      |
| d   | Private, recommended split, `nightly` still hosted                       | ~28,400       | 25,400     | ~$152          |
| e   | Private, recommended split + `nightly`/`production-database` self-hosted | ~16,900       | 13,900     | **~$83**       |
| f   | Private, **no runner**, `nightly` deleted and smoke cadence trimmed      | ~65,700       | 62,700     | ~$376          |

Scenarios (c) through (f) all assume PR #296 has landed. Without it, (f) is
impossible: CI alone at today's 190-billed-minute shape is 76,000 minutes/month,
above (f)'s whole total.

**Does the recommended split fit the free quota? No — and the table says so
rather than hiding it.** Scenario (e), the best case in this document, is
**~16,900 billed minutes against a 3,000-minute allowance: about 5.6x over,
13,900 chargeable minutes, ~$83/month.** No scenario except (a) fits. The
runner turns a $445 bill into an $83 bill; it does not turn it into a $0 bill,
and nothing in the ARM migration can, because the residual is `visual` and
`lighthouse`, which are pinned hosted for reasons that have nothing to do with
architecture.

**What the operator actually pays: $0 per month today.** The pilot's value in
the private world is scenario (c) minus scenario (e) — roughly **$362 per
month, $4,340 per year**. Scenario (f) shows that deleting `nightly.yml` without
any runner work is worth about $70/month on its own; the runner is what delivers
the rest — and, per the Decision section, roughly twice what the cheap moves do.

Two caveats attached to that saving:

- If the repository moves to a GitHub organisation on Team to keep CodeQL and
  dependency review alive, Code Security is an additional ongoing cost —
  approximately $30/month for a single active committer. That is roughly 40% of
  scenario (e)'s entire bill and it appears in none of the figures above.
  _Whether Code Security is purchasable at all on a personal-account plan is
  unverified._
- Break-even against a 3,000-minute quota: scenarios (b), (c) and (f) never fit.
  Scenario (e) fits free only below roughly 80 CI runs/month — a fifth of the
  measured pace.

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
out not to be load-bearing for this run at all. Rebuilding the scenario totals
from measured non-CI minutes rather than the earlier band gives (b) ~$513,
(c) ~$438, (e) ~$84, (f) ~$377 — within about 1.5% of the table, which is well
inside the model's own error bar. The table stands. The one input still resting
on nothing measured is the post-#296 per-run figure of ~159 billed minutes.

## Recommended job split

Machine-minutes from run `34290952137`, reproduced independently. Raw and billed
reconcile exactly to 154.1 and 190.

### Self-hosted arm64 — 126.1 raw / 152 billed minutes per run (80.0% of billed)

| Job       | `ci.yml` | Jobs      | Raw min   | Billed min |
| --------- | -------- | --------- | --------- | ---------- |
| `e2e`     | `:177`   | 32 + gate | 92.4      | 109        |
| `a11y`    | `:228`   | 16 + gate | 25.8      | 33         |
| `db`      | `:392`   | 1 + gate  | 3.1       | 4          |
| `quality` | `:90`    | 1         | 2.6       | 3          |
| `fast`    | `:48`    | 1 + gate  | 2.2       | 3          |
| **total** |          | **54**    | **126.1** | **152**    |

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
   Note where the damage lands: that composite is used by `quality`
   (`ci.yml:78`), `build` (`:110`) and `visual` (`:290`). Move `quality` to
   arm64 and it writes an arm64 browser bundle into the shared key that hosted
   **`visual`** then restores — so the failure crosses the plane boundary and
   breaks the one job this document hard-pins hosted for baseline safety.
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

Migrating everything movable still leaves 38 billed minutes per run hosted plus
CodeQL and dependency review. At 400 runs/month that is roughly 16,900 billed
minutes against a 3,000-minute quota — still about **five times over**.
**ARM migration alone does not get this repository under quota.** `visual` and
`lighthouse` are the binding constraint, and neither is an architecture problem.
PR #296 does not change this residual at all: it trims `e2e` and `a11y` shards,
which are exactly the jobs that leave the hosted meter anyway.

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
- If a pilot ever reaches equivalence, retire `ops/local-ci/agent`,
  `ops/local-ci/host`, `routing.mjs`, the proof envelope and policy, the trusted
  supervisor, the shadow observer and the nightly proof.
- Keep regardless of outcome, because they are plane-agnostic:
  `config/ci-workloads.json`, `scripts/ci/run-workload.mjs`,
  `scripts/ci/hosted-evidence.mjs`, `ops/local-ci/compare-shadow.mjs`,
  `ops/local-ci/core/shadow-{evidence,qualification}.mjs`, and the watchdog
  incident reconciler repointed at the runners API.

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
      A hosted-only preflight job whose output feeds `runs-on`, gated on a
      repository variable, proven on a real pull request to be a complete no-op
      that changes no check name. This must exist first, because it is what
      prevents the revert-deadlock described below. Understand its limit: it
      controls _your_ runs, not a fork's — a hostile pull request supplies its
      own workflow file and never reads the variable.
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
- [ ] **12. Pilot one cheap tier only.** `db` — 3.1 raw minutes, no browsers, no
      baselines, no budgets. Not `e2e`, even though that is where the money is:
      32 jobs is the wrong blast radius for a first attempt. Or better, pilot
      `nightly.yml`, which blocks no merge at all.
- [ ] **13. Rehearse tier-3 rollback before you need it.** Destroy and recreate
      the pilot VM from its YAML once, on a quiet day, and time it. A rollback
      nobody has performed is not a rollback.

## Rollback

### Tier 1 — repository variable, roughly 30 seconds, no pull request

`runs-on` accepts the `vars` context (confirmed in GitHub's context-availability
table; note `env` is **not** available there, so an env-based indirection will
not work). A hosted-only preflight job reads a kill-switch variable and the
runner's live status, and emits either `ubuntu-latest` or the runner label;
every routed tier consumes that output. Check names never change, so branch
protection is never touched.

```
gh variable set SELF_HOSTED_PILOT --body off
gh run cancel <run-id>       # ci.yml sets cancel-in-progress, so a push also works
```

The preflight must run on `ubuntu-latest`, with a short timeout, no checkout,
and every error path defaulting to `ubuntu-latest`. Its worst possible outcome
must be "everything runs hosted".

**Tier 1 is an availability control, not a security control.** For
`pull_request` from a fork the workflow file comes from the attacker's head
commit, so it contains whatever `runs-on` the attacker wrote — the preflight
job, the kill-switch variable and the whole indirection are simply absent from
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

| Burden                   | Detail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runner updates           | Twelve releases in ~12.5 months (~34-day cadence) against a documented 30-day update requirement. Leave auto-update **on**; `--disableupdate` creates a permanent recurring chore.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| OS and image maintenance | GitHub: "you are responsible for updating the operating system and all other software". The Lima base image references a rolling Ubuntu 24.04 arm64 cloud image with no digest — pin it before relying on reproducibility.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Disk                     | `~/.lima/nabaperks-ci` is already 36 GiB; the guest holds two 4.36 GiB job images. Each runner instance adds a `_work` tree (~1.0 GiB `node_modules`, up to 2.7 GiB `.next`). Put `docker system prune` and `_work` cleanup in `ACTIONS_RUNNER_HOOK_JOB_COMPLETED` so hygiene is automatic.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Sleep                    | `pmset -g custom` shows `sleep 1` on both AC and battery, currently held off only by a manually started Amphetamine session and Electron apps. The bespoke agent holds a **job-scoped** `caffeinate` because it decides on the host when to claim work. A runner is assigned work **inside the guest**, which cannot take a macOS power assertion. Either the Mac never sleeps, or the runner is intermittently offline.                                                                                                                                                                                                                                                                                                                                                                           |
| Reboot                   | The runner service on macOS is a LaunchAgent, starting at user login rather than boot — auto-login required, and FileVault blocks it. Already documented for the bespoke agent.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Mid-run drops            | A sleep, lid close, Wi-Fi change or VPN toggle breaks the long poll and GitHub fails the job with "lost communication with the server" — a **red required check on a green change**, which trains reflexive re-runs and corrodes the gate.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Parallelism              | One runner instance takes one job at a time. Approaching the hosted fan-out of 72 jobs means N registrations, N `_work` trees, N services, N update paths — on a machine with zero spare cores.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Home uplink              | **The largest unmodelled operational cost, and it does not go away.** `actions/cache` is backed by GitHub's storage, not the host, and it downloads on every cache hit whether or not the path is already warm locally. The `setup-node`/pnpm entry alone is **~0.27 GiB** (measured from `gh api .../actions/caches`), restored by ~54 self-hosted jobs per run: roughly **14 GiB inbound per CI run, ~5–6 TB/month at 400 runs**, over a residential connection, plus browser caches and any image pull. Hosted runners get this from inside GitHub's network at LAN speed, which is why "Initialize containers" is only 29 s there. Either accept the transfer, or explicitly bypass `actions/cache` on the self-hosted plane and rely on a pre-warmed guest — a design decision, not a detail. |
| Steady state             | Realistically 45–90 minutes per month per runner instance, plus sole on-call for a frozen merge gate.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

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
- 1,134 CI runs since 2026-06-15 (complete history) = 402/month, with a
  235–922/month band by window.
- Nightly run `34323842337`: **133** jobs (131 success, 1 cancelled, 1 skipped;
  the run's own conclusion is `cancelled`, but only one job was), 285.6 raw,
  355 billed minutes. `nightly.yml` cron is `24 2 * * *`; 79 runs to date.
- Non-CI monthly total ~12,470 billed minutes, from sampling the five most
  recent runs of every workflow and scaling lifetime run counts to a month.
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
- Local plane reliability: `main` 11 success / 14 failure / 9 cancelled /
  1 timed out; `pr` 19 / 21 / 11; no `nightly` run has ever succeeded — recorded
  in `docs/operations/local-ci.md:77-81`. One `main` run on `d5f5c3641`
  completed in 947 s across 10 lanes and 4,089 tests.
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
- Post-#296 billed minutes per run (~159) — modelled from #296's own job-count
  reduction plus the per-job round-up ceiling, not metered. It is the one input
  in the cost table that no measurement in this document supports.
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
- **The ~14 GiB/run cache-transfer figure** is `0.27 GiB × ~54 self-hosted jobs`
  from live cache sizes and this run's job counts. The per-entry size and the
  job count are measured; that every job re-downloads on a self-hosted runner
  follows from how `actions/cache` works and was not observed here.

### Open questions the operator must answer

1. **Is the repository actually going private, and why?** If it stays public the
   whole cost model is $0 and the pilot has no financial justification at all.
2. **Will Code Security be bought, and can it be bought on this account?** It is
   the only path that keeps two of the three required checks alive on a private
   repository, and at ~$30/month it is ~40% of the recommended split's bill.
   Whether a personal account can purchase it is unverified.
3. **Does GitHub accept a check run from an arbitrary App as satisfying a
   required context that omits `integration_id`?** This is the load-bearing
   inference of the security section. It deserves a controlled test on a scratch
   repository, and fixing it (adding `integration_id`) is cheap enough to do
   without waiting for the answer.
4. **Which plan is the account on?** `gh api user` returns `plan: null`. Free is
   2,000 minutes rather than 3,000, which shifts every private figure and every
   break-even by roughly a third.
5. **Will the operator accept that the Mac stops sleeping?** That is the only
   clean answer to the power-assertion problem, and it is a lifestyle and power
   decision, not a technical one. If not, the pilot must be designed around an
   intermittently offline runner from day one.
6. **Does `nightly.yml` still earn its ~9,900 billed minutes per month?** It
   re-runs a matrix that already ran that day, and it is 80% of all non-CI
   minutes. If it is redundant, deleting it is the single largest cost reduction
   available that costs nothing and adds no plane.
7. **Why does `production-smoke.yml` run so often?** 1,183 runs over 86 days is
   **13.8/day**, not the 18–21/day an earlier draft asserted. And it is not
   "free money": measured at ~1 billed minute per run, the whole workflow is
   ~419 billed minutes/month, so a fourfold cadence cut saves ~314 minutes —
   about **$1.90/month**. Ask the question for observability reasons if you
   like; do not put it in the cost case. `nightly.yml` is where the money is,
   by a factor of twenty-four.
8. **Is the local plane's ~50% success rate an ARM problem, a scheduler problem
   or an agent-maturity problem?** No architecture-specific cause was found, so
   it cannot be attributed. If it is a workload defect it will follow the
   workload onto a runner and the migration will not fix reliability.
9. **What is `nabatable-runner` doing, and is its 6 vCPU / 12 GiB genuinely
   reserved at all times?** It is the only potential slack on the machine.
10. **Would regenerating the 65 `visual` baselines on ARM be acceptable,** losing
    x86-64 pixel coverage? That one decision moves 17 billed minutes per run and
    is the larger half of the residual hosted spend.
11. **What is the actual upstream and downstream bandwidth of the operator's
    connection, and is a metered or fair-use cap in play?** The plan implies
    roughly 14 GiB of inbound `actions/cache` traffic per CI run (~5–6 TB/month
    at 400 runs). If that is unacceptable, the design must bypass
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
  `actions/cache` on the self-hosted plane moves roughly 14 GiB per CI run onto
  a residential uplink, ~5–6 TB/month at the measured pace. Nothing about
  running on your own hardware makes GitHub's cache service local.
- **The plane a pilot would replace fails about half its runs** (`main` 11/35,
  `pr` 19/51, no nightly ever green). Migrating required checks onto a plane with
  that record would be worse than the cost it saves, and nothing here explains
  the failures.
- **The tiers worth moving are the hardest to move.** `e2e` and `a11y` are 141 of
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
- [Local CI operator runbook](local-ci.md), [CI redesign](ci-redesign.md),
  [CI cost baseline](ci-cost-baseline.md)
