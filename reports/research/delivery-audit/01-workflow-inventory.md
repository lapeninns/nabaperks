# Workflow inventory — lapeninns/nabaperks

- Repo checkout: `/Users/amankumarshrestha/LapenInns Project/platform/naba-perks` (branch `codex/console-l8-sweep`, 32 commits ahead of origin/main).
- Audited: 2026-09-21, read-only. `git diff origin/main...HEAD -- .github/` is empty (every file below matches origin/main), so local `path:line` citations are authoritative for origin too.
- Workflow files found: **17** (the task brief said 19; the on-disk count is 17 — `admin-mfa-activation.yml`, `admin-mfa-bootstrap.yml`, `agent-watchdog.yml`, `ci.yml`, `codeql.yml`, `dependency-review.yml`, `factory-status.yml`, `local-ci-shadow.yml`, `local-ci-trusted-observer.yml`, `nightly-proof.yml`, `nightly.yml`, `production-database.yml`, `production-deploy.yml`, `production-smoke.yml`, `recovery-drill.yml`, `release-notes.yml`, `slo-report.yml`). No other workflow files exist in `.github/workflows/`.
- Anything not verifiable from the checked-out tree is flagged UNVERIFIED at the end; no live GitHub settings (branches/rulesets/environments/secrets) were read.

## Summary table

| File                            | Workflow name                          | Triggers (`on:`)                                                                                                                   | Concurrency (group / cancel)                           | Environments   | Reusable calls / workflow_run follows                                                                                       |
| ------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | -------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `admin-mfa-activation.yml`      | Activate production admin MFA          | `workflow_dispatch` (4 required inputs)                                                                                            | `production-release` / false                           | Production     | none; workflow_run: none                                                                                                    |
| `admin-mfa-bootstrap.yml`       | Publish production admin MFA bootstrap | `workflow_dispatch` (2 required inputs)                                                                                            | `production-release` / false                           | Production     | composite: `./.github/actions/setup`, `supabase/setup-cli`                                                                  |
| `agent-watchdog.yml`            | Agent watchdog                         | `schedule` `3/5 * * * *`; `workflow_dispatch`                                                                                      | `agent-watchdog` / false                               | none           | `actions/github-script`                                                                                                     |
| `ci.yml`                        | CI                                     | `push` [main]; `pull_request` [main]                                                                                               | `ci-<workflow>-<sha\|ref>` / false on push, true on PR | none           | composite: `./.github/actions/setup`, `./.github/actions/playwright`, `supabase/setup-cli`, `zaproxy/action-baseline`       |
| `codeql.yml`                    | CodeQL                                 | `push` [main]; `pull_request` [main]; `schedule` `27 3 * * 1`                                                                      | `codeql-<sha\|ref>` / false on push, true on PR        | none           | `github/codeql-action/*`                                                                                                    |
| `dependency-review.yml`         | Dependency review                      | `pull_request` [main]                                                                                                              | none                                                   | none           | `actions/dependency-review-action`                                                                                          |
| `factory-status.yml`            | Delivery decision report               | `workflow_dispatch`; `workflow_run` [CI, CodeQL, Production database promotion]; `pull_request_target`; `schedule` `17,47 * * * *` | `delivery-decision-report` / true                      | none           | none                                                                                                                        |
| `local-ci-shadow.yml`           | Local CI shadow observation            | `push` [main]; `pull_request` [main]                                                                                               | `local-ci-shadow-<ref>` / true                         | none           | none (hosted steps only)                                                                                                    |
| `local-ci-trusted-observer.yml` | Trusted local proof preparation        | `workflow_dispatch` (1 input)                                                                                                      | none                                                   | none           | none                                                                                                                        |
| `nightly-proof.yml`             | Local CI nightly proof                 | `schedule` `47 9 * * *`; `workflow_dispatch`                                                                                       | `local-ci-nightly-proof` / true                        | none           | none                                                                                                                        |
| `nightly.yml`                   | Nightly QA hardening                   | `schedule` `24 2 * * *`; `workflow_dispatch`                                                                                       | `nightly-qa-<ref>` / true                              | none           | composite: `./.github/actions/setup`, `./.github/actions/playwright`, `grafana/setup-k6-action`, `zaproxy/action-full-scan` |
| `production-database.yml`       | Production database promotion          | `workflow_run` ["CI"] completed, branches [main]; `workflow_dispatch` (2 inputs)                                                   | `production-release` / false                           | Production     | **`./.github/workflows/production-deploy.yml`** (reusable w/ 5 secrets + 3 inputs) + composites                             |
| `production-deploy.yml`         | Production deployment                  | `workflow_call` only (5 required secrets, 3 required inputs)                                                                       | none (inherits caller)                                 | Production     | composite: `./.github/actions/setup`, `supabase/setup-cli`, `anchore/sbom-action`, `actions/attest`                         |
| `production-smoke.yml`          | Production smoke                       | `schedule` `7/15 * * * *`; `workflow_run` ["Production database promotion"]; `workflow_dispatch` (1 optional input)                | `production-smoke` / true                              | Monitoring     | `actions/github-script`                                                                                                     |
| `recovery-drill.yml`            | Recovery drill                         | `workflow_dispatch` (3 inputs)                                                                                                     | `recovery-drill` / false                               | Recovery Drill | composite: `./.github/actions/setup`, `supabase/setup-cli`                                                                  |
| `release-notes.yml`             | Release notes                          | `push` [main]; `workflow_dispatch`                                                                                                 | `release-notes` / true                                 | none           | `release-drafter/release-drafter`                                                                                           |
| `slo-report.yml`                | Production SLO report                  | `schedule` `13 7 * * *`; `workflow_dispatch`                                                                                       | `production-slo-report` / true                         | Monitoring     | `actions/github-script`                                                                                                     |

Shared `production-release` group: `admin-mfa-activation`, `admin-mfa-bootstrap`, `production-database` (one lock, `cancel-in-progress: false`).

---

## Per-workflow detail

### 1. `.github/workflows/admin-mfa-activation.yml` — "Activate production admin MFA"

- on: `workflow_dispatch` only. Inputs (all required, type string): `expected_revision`, `admin_user_id`, `credential_id`, `confirmation` (must equal `ACTIVATE_VERIFIED_ADMIN_MFA`).
- Concurrency: group `production-release`, `cancel-in-progress: false`.
- Permissions: top-level `contents: read`.
- Environments: `Production` on the single job `activate`.
- Secrets: `SUPABASE_ACCESS_TOKEN` (job env). Vars: `SUPABASE_PROJECT_REF`.
- Reusable calls: none. Marked-action checkout `actions/checkout@… # v7` (`ref: expected_revision`, `fetch-depth: 0`).
- Jobs:
  - `activate` — name "Activate independently verified admin MFA"; runs-on `ubuntu-latest`; `timeout-minutes: 5`; no needs/matrix/if.
  - Check-run name: "Activate independently verified admin MFA".
- Purpose: pinned-revision manual dispatch that calls the audited service-role RPC `public.activate_internal_admin_mfa` via Supabase Management API and records non-secret evidence in the step summary.

### 2. `.github/workflows/admin-mfa-bootstrap.yml` — "Publish production admin MFA bootstrap"

- on: `workflow_dispatch` only. Inputs (required): `expected_revision`, `confirmation` (= `PUBLISH_ADMIN_MFA_BOOTSTRAP`).
- Concurrency: `production-release` / false.
- Permissions: top-level `checks: read`, `contents: read`, `pull-requests: read`.
- Environments: `Production` on job `publish`.
- Secrets: `SUPABASE_ACCESS_TOKEN` (job env), `VERCEL_TOKEN` (step envs). Vars: `SUPABASE_PROJECT_REF`.
- Reusable calls: `./.github/actions/setup`; `supabase/setup-cli@…` (v3, version 2.106.0).
- Jobs:
  - `publish` — "Publish protected WebAuthn bootstrap"; `ubuntu-latest`; `timeout-minutes: 20`; no needs/matrix/if.
  - Check-run name: "Publish protected WebAuthn bootstrap".
- Purpose: one-route static `mfa.nabaperks.com` bootstrap site. Notably verifies prior successful check-runs on the exact revision: **"Release gate"**, **"Analyze (javascript-typescript)"** (app `github-actions`, completed, success), a single merged PR with matching tree, **"Review dependency changes"** on the reviewed head, the DB migration frontier, `admin-webauthn` function deploy, canonical Vercel identity, alias, TOTP-disabled readback. Deploys to Vercel preview target, not production target.

### 3. `.github/workflows/agent-watchdog.yml` — "Agent watchdog"

- on: `schedule` cron `3/5 * * * *`; `workflow_dispatch`.
- Concurrency: `agent-watchdog` / false.
- Permissions: top-level `contents: read`, `checks: read`.
- Environments: none. Secrets/vars: none (`vars.LOCAL_CI_WATCHDOG_ENABLED` gate read as var, plus `config/local-ci-contract.json`).
- Reusable calls: none.
- Jobs:
  - `heartbeat` — "Agent heartbeat freshness"; `if: vars.LOCAL_CI_WATCHDOG_ENABLED == 'true'`; `ubuntu-latest`; 5 min; output `healthy`; runs `scripts/check-agent-liveness.mjs`, `continue-on-error: true`.
  - `public-health` — "Public health watchdog"; deliberately ungated; `ubuntu-latest`; 2 min; `permissions: {}` (job-level empty); probes `https://nabaperks.com/api/health`.
  - `alerts` — "Deliver watchdog alerts"; needs `[heartbeat, public-health]`; `if: always()`; 5 min; permissions `contents: read`, `issues: write`; runs `scripts/watchdog-incidents.mjs` via `actions/github-script` to open/close one issue.
- Check-run names: "Agent heartbeat freshness", "Public health watchdog", "Deliver watchdog alerts".

### 4. `.github/workflows/ci.yml` — "CI" (run-name `CI head:<sha> base:<sha>`)

- on: `push` branches `[main]` (line 6); `pull_request` branches `[main]` (line 8).
- Concurrency: group `ci-${{ github.workflow }}-${{ push && github.sha || github.ref }}` (line 28); `cancel-in-progress: ${{ event == 'pull_request' }}` (line 29) — main-push runs never cancel each other (each commit keyed by its own SHA).
- Permissions: top-level `contents: read`. No environments. No real secrets — the whole workflow runs on non-secret fixture env (CI `NEXT_PUBLIC_*`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_*`, `RESEND_API_KEY`, `TWILIO_*`, `CUSTOMER_SESSION_SECRET`, `CUSTOMER_PHONE_HMAC_SECRET`, `CUSTOMER_PHONE_ENCRYPTION_KEY`, etc.), plus per-job fixtures (`CUSTOMER_DEV_OTP_CODE: 424242`, `CUSTOMER_SESSION_SECRET` etc. on `fast`).
- Reusable calls: `./.github/actions/setup` (selection only when `hashFiles` matches, plus documentation, targeted-browser, targeted-visual, selection-comparison, fast, quality, build, e2e, a11y, visual, lighthouse, zap-baseline, db, release-gate); `./.github/actions/playwright` (targeted-visual, fast, quality, visual); `supabase/setup-cli` (db); `zaproxy/action-baseline` (zap-baseline).
- Environments: none.
- Jobs (id — check-run name, needs, if, timeout, matrix):
  - `selection` — "Select required checks" (line 70); no needs; 5 min; outputs `plan`, `profile`, `comparison`; runs `scripts/ci/plan-checks.mjs` from the reviewed base SHA for PRs.
  - `documentation` — "Documentation validation" (126); needs selection; if `profile == 'documentation'` OR (`public-pages` AND plan contains `documentation`) OR `comparison == 'true'`; 5 min; artifact `ci-documentation-evidence`.
  - `targeted-browser` — "Affected page browser checks" (147); needs selection; if `public-pages` OR comparison; 15 min; container `mcr.microsoft.com/playwright:v1.62.1-noble@sha256:dcc5…`; loops projects `chromium mobile-safari desktop-firefox desktop-safari`; artifact `targeted-browser`.
  - `targeted-visual` — "Affected page visual checks" (177); needs `[selection, fast]`; if `public-pages` OR comparison; 15 min; runs `.github/actions/playwright` for chromium + mobile-safari; artifact `targeted-visual`.
  - `selection-comparison` — "Verify targeted and full outcomes" (208); needs `[selection, e2e, a11y, visual, documentation, targeted-browser, targeted-visual]`; `if: always() && comparison == 'true'`; 15 min; runs `scripts/ci/compare-targeted-evidence.mjs` from reviewed base; artifact `ci-selection-comparison`.
  - `fast` — "Fast lane (lint, typecheck, unit)" (305); needs selection; `if: profile in ['full','public-pages']`; 10 min; runs `run-workload.mjs fast`, `run-workload.mjs coverage`; uploads `coverage`.
  - `quality` — "Quality lane (hygiene sweeps)" (349); needs selection; same if; 10 min; `run-workload.mjs quality`, poster geometry + production print-kit PDF proofs.
  - `build` — "Production build" (402); needs selection; same if; 10 min; uploads `next-build` artifact (retention 1 day) shared with Lighthouse + ZAP.
  - `build-gate` — "Typecheck and build" (421); needs `[selection, fast, quality, build]`; `if: always() && profile in ['full','public-pages']`; 1 min; asserts all three lane results are success.
  - `e2e` — "E2E (`${{ matrix.project }}`, pack `${{ matrix.pack }}`)" (440); needs selection; `if: profile == 'full'`; 30 min; matrix `project: [chromium, mobile-safari, desktop-firefox, desktop-safari]` × `pack: [1..4]` = 16 jobs (4 packs × 8 original /32 shards); uploads `playwright-report-<project>-<job-index>`.
  - `e2e-gate` — "E2E (DB-free harness tier)" (491); needs `[selection, e2e]`; `if: always() && profile == 'full'`; 1 min.
  - `a11y` — "Accessibility (`project`, shard `n/4`)" (505); needs selection; `if: full`; 20 min; matrix project×shard `1/4..4/4` = 8 jobs; uploads `ci-a11y-json-*` when comparison.
  - `a11y-gate` — "Accessibility sweep" (551); needs `[selection, a11y]`; `if: always() && full`; 1 min.
  - `visual` — "Visual regression (`project`, shard `n/4`)" (564); needs `[selection, fast]`; `if: full`; 20 min; matrix 2×4 = 8 jobs; `--update-snapshots=none` under comparison; uploads `ci-visual-json-*`.
  - `visual-gate` — "Visual regression" (612); needs `[selection, visual]`; `if: always() && full`; 1 min.
  - `lighthouse` — "Lighthouse (`route`)" (625); needs `[selection, build]`; `if: full`; 10 min; matrix include: home, pricing, loyalty-for-pubs, signup (4 jobs); downloads `next-build`; uploads `lighthouse-report-<route>`.
  - `lighthouse-gate` — "Lighthouse CI" (660); needs `[selection, lighthouse]`; `if: always() && full`; 1 min.
  - `zap-baseline` — "ZAP baseline" (673); needs `[selection, build]`; `if: full`; 10 min; `zaproxy/action-baseline` against `http://127.0.0.1:3000`, `allow_issue_writing: false`. **No gate job** (root verdicts through `Release gate` only).
  - `db` — "DB behavioral moat" (705); needs selection; `if: full`; 12 min; local Supabase (`supabase start`, `pnpm db:seed`, `pnpm test:db`, `supabase stop --no-backup`); `SUPABASE_DB_URL` loopback fixture.
  - `db-gate` — "DB behavioral moat gate" (727); needs `[selection, db]`; `if: always() && full`; 1 min; comment (lines 728-733) states it is the "Stable required-check name so branch protection can block a merge".
  - `release-gate` — "Release gate" (743); needs all 15: fast, quality, build, e2e, a11y, visual, lighthouse, zap-baseline, db, selection, documentation, targeted-browser, targeted-visual, selection-comparison; `if: always()`; 5 min; runs `scripts/ci/verify-impact-evidence.mjs` from reviewed policy (bootstrap fallback uses `scripts/ci/verify-required-evidence.mjs` against `REQUIRED_HOSTED_JOBS`).
- Check-run names: as above. No top-level `workflow_call`/`workflow_run`; no environments; no secrets.
- Note: `nightly-proof.yml` header comment (lines ~13-16) references "The advisory `local-proof` bridge in ci.yml", but the current `ci.yml` contains **no** local-proof job (grep found none) — the local observation now lives solely in `local-ci-shadow.yml`. The comment is stale relative to HEAD (same file as origin/main, so also stale on origin).

### 5. `.github/workflows/codeql.yml` — "CodeQL" (run-name `CodeQL head:<sha> base:<sha>`)

- on: `push` [main]; `pull_request` [main]; `schedule` `27 3 * * 1`.
- Concurrency: group `codeql-${{ push && github.sha || github.ref }}`; `cancel-in-progress: ${{ event == 'pull_request' }}` (comment lines 13-19: `Analyze (javascript-typescript)` is a required check, so main-push runs must not be cancelled).
- Permissions: none at workflow level; job `analyze` sets `security-events: write`, `contents: read`, `actions: read`.
- Environments: none. Secrets: none (implicit `github.token`).
- Reusable calls: `github/codeql-action/init` and `/analyze` (@cdf488f… # v4), `queries: security-extended`, category `/language:javascript-typescript`.
- Jobs:
  - `analyze` — "Analyze (`${{ matrix.language }}`)"; `ubuntu-latest`; no timeout-minutes; matrix `language: [javascript-typescript]`, `fail-fast: false`.
  - Check-run name: "Analyze (javascript-typescript)".

### 6. `.github/workflows/dependency-review.yml` — "Dependency review" (run-name `Dependency review head:<sha> base:<sha>`)

- on: `pull_request` branches `[main]`.
- Permissions: top-level `contents: read`. No environments/secrets.
- Reusable calls: `actions/dependency-review-action` (@a1d282b… # v5) — `fail-on-severity: high`, `deny-licenses: AGPL-1.0-or-later, AGPL-3.0-or-later, GPL-2.0-or-later, GPL-3.0-or-later`, `comment-summary-in-pr: on-failure`.
- Jobs:
  - `review` — "Review dependency changes"; `ubuntu-latest`; no timeout → uses org default.
  - Check-run name: "Review dependency changes".

### 7. `.github/workflows/factory-status.yml` — "Delivery decision report"

- on: `workflow_dispatch`; `workflow_run` `workflows: [CI, CodeQL, Production database promotion]`, `types: [completed]` (lines 5-6); `pull_request_target` types `[opened, synchronize, reopened, ready_for_review]`; `schedule` `17,47 * * * *`.
- Concurrency: `delivery-decision-report` / true.
- Permissions: top-level `contents: read`, `actions: read`, `checks: read`, `pull-requests: read`.
- Environments: none. Secrets: none (`GH_TOKEN: ${{ github.token }}`).
- Reusable calls: none (metadata-only inspection; checks out `main` with `persist-credentials: false`, runs `scripts/ci/factory-status.mjs --summary`).
- Jobs:
  - `report` — no `name:` → check-run name is the job id "report"; `ubuntu-latest`; `timeout-minutes: 5`; no needs/matrix/if.

### 8. `.github/workflows/local-ci-shadow.yml` — "Local CI shadow observation"

- on: `push` [main]; `pull_request` [main].
- Concurrency: `local-ci-shadow-<ref>` / true.
- Permissions: top-level `contents: read`.
- Environments: none. Secrets: none (uses `github.token`, `vars.LOCAL_CI_MODE`).
- Reusable calls: none.
- Jobs:
  - `local-proof` — "Local CI proof"; allowlisted `if:` — `vars.LOCAL_CI_MODE != ''` AND ((PR with `head.repo.full_name == github.repository`) OR (push to `refs/heads/main`)); `ubuntu-latest`; 2 min; `continue-on-error: true`; job-level permissions `contents: read`, `checks: read`; checks out **base SHA** on PRs (never the candidate), runs `scripts/check-local-ci-proof.mjs` with `LOCAL_CI_OBSERVE_ONCE: "true"`.
  - Check-run name: "Local CI proof". Header comment (lines ~9-12): "Never trigger release workflows from this observer or add its check to required merge contexts."

### 9. `.github/workflows/local-ci-trusted-observer.yml` — "Trusted local proof preparation"

- on: `workflow_dispatch` only, input `candidate_revision` (required, string).
- Concurrency: none.
- Permissions: top-level `contents: read`, `checks: read`.
- Environments: none. Secrets: none (`github.token`).
- Reusable calls: none.
- Jobs:
  - `observe` — "Trusted observation (hosted routing retained)"; `ubuntu-latest`; 2 min; requires `refs/heads/main` + 40-hex SHA, verifies checkout, runs `scripts/ci/observe-trusted-local-proof.mjs`.
  - Check-run name: "Trusted observation (hosted routing retained)".

### 10. `.github/workflows/nightly-proof.yml` — "Local CI nightly proof"

- on: `schedule` `47 9 * * *`; `workflow_dispatch`.
- Concurrency: `local-ci-nightly-proof` / true.
- Permissions: top-level `contents: read`, `checks: read` (no `issues` scope by design — comment lines 24-31).
- Environments: none. Secrets: none (uses `github.token`, `vars.LOCAL_CI_MODE`).
- Reusable calls: none.
- Jobs:
  - `freshness` — "Nightly proof freshness"; `if: vars.LOCAL_CI_MODE != ''`; `ubuntu-latest`; 10 min; `continue-on-error: true`; job permissions restated (`contents: read`, `checks: read`); runs `scripts/check-nightly-proof.mjs` (max age configurable via `config/local-ci-contract.json` `nightlyProof.maxAgeHours`, enforcement currently "advisory" per header comment).
  - Check-run name: "Nightly proof freshness".

### 11. `.github/workflows/nightly.yml` — "Nightly QA hardening"

- on: `schedule` `24 2 * * *`; `workflow_dispatch`.
- Concurrency: `nightly-qa-<ref>` / true.
- Permissions: top-level `contents: read`.
- Environments: none.
- Secrets: `STAMP_RACE_AUTH_TOKEN` (job `load-race` env). Vars: `STAMP_RACE_URL`, `REDEEM_RACE_URL`, `STAMP_RACE_BODY`, `REDEEM_RACE_BODY` (gates and env on `load-race`).
- Reusable calls: `./.github/actions/setup` (cross-browser, mutation, load, zap-full); `./.github/actions/playwright` (cross-browser, mutation); `grafana/setup-k6-action` (load, load-race); `zaproxy/action-full-scan` (zap-full).
- Jobs:
  - `cross-browser` — "Full cross-browser Playwright (`project`, shard `n/32`)"; `ubuntu-latest`; 45 min; matrix `project` × 32 shards = 128 jobs; `pnpm test:e2e --project=… --grep-invert @visual --shard=…`; uploads `nightly-playwright-report-<project>-<job-index>` on failure.
  - `cross-browser-gate` — "Full cross-browser Playwright"; needs `cross-browser`; `if: always()`; 1 min.
  - `mutation` — "Mutation testing"; `ubuntu-latest`; 90 min; installs chromium, `pnpm mutation:check`; uploads `stryker-report`.
  - `load` — "k6 load checks"; 20 min; k6 `tests/load/public-routes.js` against local prod build.
  - `load-race` — "Authenticated stamp and redeem race checks"; `if: vars.STAMP_RACE_URL != '' && vars.REDEEM_RACE_URL != ''`; 15 min; `k6 run tests/load/stamp-redeem-race.js`.
  - `zap-full` — "ZAP full scan"; 30 min; `zaproxy/action-full-scan` against local prod build, `allow_issue_writing: false`.
- Check-run names: job `name:`s above (`cross-browser-gate` reports "Full cross-browser Playwright").

### 12. `.github/workflows/production-database.yml` — "Production database promotion"

- on: `workflow_run` `workflows: ["CI"]` types `[completed]` branches `[main]` (lines 4-7); `workflow_dispatch` inputs `expected_revision` (required) + `confirmation` (= `PROMOTE_PRODUCTION_DATABASE`) (lines 8-16).
- Concurrency: `production-release` / false (lines 20-21) — shared with admin-mfa workflows.
- Permissions: top-level `contents: read`, `actions: read`.
- Environments: `Production` on jobs `baseline` and `promote`.
- Secrets: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` (job `promote` env); `VERCEL_TOKEN` (step envs in `baseline`, `promote` recheck step, and forwarded to the reusable call). Vars: `SUPABASE_PROJECT_REF`. Forwarded to `production-deploy.yml`: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_SEND_EMAIL_HOOK_SECRET`, `PRODUCTION_ALERT_WEBHOOK_SECRET`, `PRODUCTION_MONITOR_SECRET`, `VERCEL_TOKEN` (lines 446-451).
- Reusable workflow call: jobs:
  - `preflight` — "Production database preflight" (line ~44); 12 min; `workflow_run` path requires source CI conclusion success; `workflow_dispatch` path requires main + confirmation; then `gh run list` requires successful `ci.yml` and `codeql.yml` for the exact revision (retry loop 60 attempts for codeql).
  - `staging` — "Cost-neutral ephemeral release proof"; needs `baseline`; `if: baseline.outputs.application_required == 'true'`; 25 min; permissions `contents: read`; ephemeral Supabase CLI stack + loopback HTTPS prod build; `pnpm smoke:staging`, merchant-id-verification e2e.
  - `baseline` — "Authenticate the deployed baseline"; needs `preflight`; environment `Production`; 10 min; outputs `artifact_id`, `application_required`; runs `scripts/release/deployed-baseline.mjs` with `VERCEL_TOKEN`, `scripts/release/no-deployment.mjs`; uploads `release-baseline-<run_id>-<attempt>` and (when no app deployment needed) `production-unchanged-<run_id>-<attempt>`.
  - `qualification` — "Qualify runtime without production credentials"; needs `[baseline, staging]`; `if: application_required == 'true'`; 45 min; permissions `contents: read`, `actions: read`; runs `scripts/release/qualify-runtime.mjs` + `stage-ledger.mjs qualify`; uploads `release-qualification-*`.
  - `promote` — "Database promotion"; needs `[baseline, qualification]`; `if: application_required == 'true'`; environment `Production`; 45 min; `supabase link` + `db push` (dry-run then `--include-all`), migration-ledger readback, stage-ledger record; uploads `production-database-stage-<run_id>-<attempt>`.
  - `application` — "Promote and prove the same application candidate"; needs `promote`; `uses: ./.github/workflows/production-deploy.yml` (line 445) with 5 secrets (above), 3 inputs (`expected_revision`, `release_run_id`, `release_run_attempt`), and job permissions `contents: read`, `actions: read`, `id-token: write`, `attestations: write`, `artifact-metadata: write` (lines 452-456).
- Check-run names: the five job names above + the downstream deploy job names.

### 13. `.github/workflows/production-deploy.yml` — "Production deployment"

- on: `workflow_call` only. `secrets` (all `required: true`): `SUPABASE_ACCESS_TOKEN`, `SUPABASE_SEND_EMAIL_HOOK_SECRET`, `PRODUCTION_ALERT_WEBHOOK_SECRET`, `PRODUCTION_MONITOR_SECRET`, `VERCEL_TOKEN`. `inputs` (all required): `expected_revision` (string), `release_run_id` (string), `release_run_attempt` (string).
- Permissions: top-level `contents: read`, `actions: read`.
- Environments: `Production` on job `deploy`.
- Reusable calls: `./.github/actions/setup`; `supabase/setup-cli` (v3, 2.106.0); `anchore/sbom-action` (@3ad7283… v0.24.2, `syft-version: v1.49.0`); `actions/attest` (@1e69f48… v4.2.2, twice: provenance bundle + SBOM bundle).
- Jobs:
  - `preflight` — "Production deployment preflight"; 2 min; binds the release owner: asserts `GITHUB_REPOSITORY == lapeninns/nabaperks`, `RELEASE_RUN_ID/ATTEMPT` match the run, caller workflow path is exactly `.github/workflows/production-database.yml` (via `gh api`), and (for `workflow_run` sources) source CI run path/branch/event/revision; for `workflow_dispatch` requires `PROMOTE_PRODUCTION_DATABASE` confirmation on main.
  - `deploy` — "Production deployment"; needs `preflight`; environment `Production`; 30 min; permissions `contents: read`, `actions: read`, `id-token: write`, `attestations: write`, `artifact-metadata: write`; downloads the exact parent `production-database-stage-<run_id>-<attempt>` artifact, verifies stage-ledger chain, canonical Vercel identity, deploys `production-alert` + `admin-webauthn` functions, SBOM + provenance attestation, stages (no-domain) production deploy, verifies staged liveness/readiness + auth-hook signing-secret alignment, promotes, activates & reads back the passwordless Data API guard + Auth config (hooks, MFA all off, passkey off, `rate_limit_email_sent: 60`), then verifies exact public revision + readiness and records the verified stage bundle.
- Check-run names: "Production deployment preflight", "Production deployment".
- Call graph position: the only caller is `production-database.yml:application`; `preflight` hard-fails on any other caller.

### 14. `.github/workflows/production-smoke.yml` — "Production smoke"

- on: `schedule` `7/15 * * * *`; `workflow_run` `workflows: ["Production database promotion"]` types `[completed]`; `workflow_dispatch` input `expected_revision` (optional).
- Concurrency: `production-smoke` / true.
- Permissions: top-level `contents: read`. env: `EXPECTED_REVISION` set only on dispatch.
- Environments: `Monitoring` on all three jobs.
- Secrets: `PRODUCTION_MONITOR_SECRET` (probes env); `PRODUCTION_ALERT_WEBHOOK_URL`, `PRODUCTION_ALERT_WEBHOOK_SECRET` (incident + resolve-incident env).
- Reusable calls: `actions/github-script` only.
- Jobs:
  - `probes` — "Liveness and readiness"; `if: event != workflow_run || (workflow_run.conclusion == 'success' && workflow_run.head_branch == 'main')`; 7 min; permissions `contents: read`, `actions: read`; on `workflow_run` resolves the released candidate from the bound artifact (`scripts/release/read-candidate-artifact.mjs`) and verifies exact release artifact + successful public proof; probes `https://nabaperks.com/api/health` and `/api/readiness` (authorized with `PRODUCTION_MONITOR_SECRET`); enforces probe latency via `config/production-slos.json`.
  - `incident` — "Error to insight"; needs probes; `if: always() && probes.result == 'failure'`; permissions `contents: read`, `issues: write`; creates/updates issue `[Production alert] Nabaperks readiness failure` with labels `bug`, `area: platform`, `priority: p0-critical`, and pages external channel via `scripts/notify-production-alert.mjs trigger`.
  - `resolve-incident` — "Resolve recovered production alert"; needs probes; `if: always() && probes.result == 'success'`; permissions `actions: read`, `contents: read`, `issues: write`; requires two consecutive distinct scheduled successes (`scripts/production-smoke-recovery-core.mjs`) before resolving/close.
- Check-run names: "Liveness and readiness", "Error to insight", "Resolve recovered production alert".

### 15. `.github/workflows/recovery-drill.yml` — "Recovery drill"

- on: `workflow_dispatch` only. Inputs (required): `backup_id` (numeric), `restore_project_ref` (20-char lowercase), `confirmation` (= `VERIFY_NON_PRODUCTION_RESTORE`).
- Concurrency: `recovery-drill` / false.
- Permissions: top-level `contents: read`.
- Environments: `Recovery Drill` on job `verify`.
- Secrets: `SUPABASE_BACKUP_READ_TOKEN` (verify step env), `RESTORE_DRILL_DB_URL` (verify step env). Vars: `RESTORE_DRILL_PROJECT_REF`, `RECOVERY_RTO_MINUTES`, `RESTORE_DRILL_STARTED_AT`, `RESTORE_DRILL_LINEAGE_SHA256`, `RESTORE_DRILL_SOURCE_MANIFEST_SHA256`, `RESTORE_DRILL_LINEAGE_JSON`, `RESTORE_DRILL_SOURCE_MANIFEST_JSON` (all on verify job).
- Reusable calls: `./.github/actions/setup`; `supabase/setup-cli` (@… # v1.6.0, version 2.75.0).
- Jobs:
  - `preflight` — "Prove safe recovery target"; 3 min; asserts main, confirmation, project-ref format and != production ref `skonlhwstejberyzobep`, numeric backup id.
  - `verify` — "Verify restored backup"; needs `preflight`; environment `Recovery Drill`; 15 min; `supabase backups list` + `projects list`, materialises reviewed lineage/source-manifest vars into 0600 files, runs `scripts/check-restored-backup.mjs`, uploads `recovery-drill-<backup_id>` evidence artifact (retention 365).
- Check-run names: "Prove safe recovery target", "Verify restored backup".

### 16. `.github/workflows/release-notes.yml` — "Release notes"

- on: `push` [main]; `workflow_dispatch`.
- Concurrency: `release-notes` / true.
- Permissions: top-level `contents: write`, `pull-requests: read`.
- Environments: none. Secrets: `GITHUB_TOKEN` (passed to release-drafter).
- Reusable calls: `release-drafter/release-drafter` (@34d8067… # v7).
- Jobs:
  - `draft` — "Update draft release notes"; `ubuntu-latest`; no timeout.
  - Check-run name: "Update draft release notes".

### 17. `.github/workflows/slo-report.yml` — "Production SLO report"

- on: `schedule` `13 7 * * *`; `workflow_dispatch`.
- Concurrency: `production-slo-report` / true.
- Permissions: top-level `actions: read`, `contents: read`, `issues: write`.
- Environments: `Monitoring` on the single job.
- Secrets: `PRODUCTION_ALERT_WEBHOOK_URL`, `PRODUCTION_ALERT_WEBHOOK_SECRET` (paging steps).
- Reusable calls: `actions/github-script` only.
- Jobs:
  - `availability` — "30-day availability and error budget"; `ubuntu-latest`; 10 min; runs `scripts/check-production-slo.mjs` (`config/production-slos.json`), classifies state (warming/breached/compliant/error), uploads `production-slo-<run_id>` artifact (retention 365), opens/updates issue `[Production alert] Nabaperks 30-day SLO breach` (`area: platform, priority: p1-high`) and pages on breach/error, closes on recovery, and enforces the SLO gate (`test "$SLO_OUTCOME" = "success"`).
  - Check-run name: "30-day availability and error budget".

---

## `.github/actions/*` (composite actions)

### `.github/actions/setup/action.yml` — "Setup project"

- Description: "Install pnpm, Node.js, and project dependencies with caching."
- Inputs: none.
- Steps: `pnpm/action-setup` (@0ebf471… # v6) → `actions/setup-node` (@8207627… # v7, `node-version-file: .nvmrc`, `cache: pnpm`) → `pnpm install --frozen-lockfile` (bash).
- Used by: ci.yml (most jobs), production-database.yml (staging), production-deploy.yml (deploy), admin-mfa-bootstrap.yml (publish), nightly.yml (cross-browser, mutation, load, zap-full), recovery-drill.yml (verify).

### `.github/actions/playwright/action.yml` — "Install Playwright browser"

- Description: installs one Playwright browser for a project, cached on the installed `@playwright/test` version.
- Inputs: `project` (required; chromium, desktop-firefox, mobile-safari, desktop-safari).
- Steps: resolve browser (chromium→chromium, desktop-firefox→firefox, mobile-safari/desktop-safari→webkit); version from `@playwright/test/package.json`; `actions/cache` (@55cc83… # v6) on `~/.cache/ms-playwright` keyed `playwright-<os>-<browser>-<version>`; `playwright install --with-deps <browser>` on miss, `playwright install-deps` on hit.
- Used by: ci.yml (targeted-visual, fast, quality, visual), production-database.yml (staging), nightly.yml (cross-browser, mutation).

---

## Support files

### `.github/CODEOWNERS`

Content: default `* @lapeninns @amanshresthaa`; `/.github/` and `/DESIGN.md` (build & deployment); `/supabase/`, `/lib/supabase/`, `/lib/security/` (trust boundary: data model, RLS, security-definer RPCs); `/lib/stripe/`, `/app/api/` (billing & external integrations). All directives name the same two owners. Used for code-owner review routing and branch-protection "require review from Code Owners".

### `.github/dependabot.yml`

- npm ecosystem at `/`: weekly, Monday 06:00 Europe/London, `open-pull-requests-limit: 10`, labels `["dependencies"]`, commit prefixes `chore(deps)` / `chore(deps-dev)`, version cooldown (`default-days: 5`, major 14, minor 7, patch 3), groups: `production-minor-patch` (production deps, minor+patch) and `development` (dev deps, minor+patch).
- github-actions ecosystem at `/`: weekly Monday 06:00 Europe/London, labels `["dependencies", "area: ci"]`, prefix `chore(ci)`, one group `github-actions` patterns `["*"]`.

### `.github/release-drafter.yml`

Release Drafter v7 config consumed by `release-notes.yml`: name/tag template `v$RESOLVED_VERSION`; categories Breaking (`type: breaking`), Product (`type: feature`, `enhancement`), Fixes (`type: bug`, `bug`), Maintenance (`type: chore`, `dependencies`, `documentation`); exclude `skip-changelog`; version-resolver major/minor/patch label mapping, default patch.

### `.github/pull_request_template.md`

Sections: Summary; Verification (checkboxes `pnpm typecheck`, `pnpm build`); Design System (DESIGN.md/globals.css/shared-components alignment; plain British English, no emoji/exclamation marks).

### `.github/ISSUE_TEMPLATE/`

Directory exists (issue templates not part of this task; contents not read).

---

## Workflow call graph

```
CI (ci.yml)
  ├─ workflow_run "CI" [completed], branches [main] ──► production-database.yml   (production-database.yml:4-7)
  ├─ workflow_run "CI" [completed]                  ──► factory-status.yml        (factory-status.yml:5-6)
CodeQL (codeql.yml)
  └─ workflow_run "CodeQL" [completed]              ──► factory-status.yml
Production database promotion (production-database.yml)
  ├─ workflow_call (reusable)                       ──► production-deploy.yml     (production-database.yml:445, job `application`, needs `promote`)
  ├─ workflow_run "Production database promotion"   ──► production-smoke.yml      (production-smoke.yml:6-7)
  └─ workflow_run "Production database promotion"   ──► factory-status.yml
Everything else (admin-mfa-*, agent-watchdog, dependency-review, local-ci-*,
  nightly*, recovery-drill, release-notes, slo-report): no callers; scheduled/
  dispatched/push-triggered standalone workflows.
```

Key structural facts:

- `production-deploy.yml` is reachable **only** via `production-database.yml` (workflow_call-only `on:`, and its `preflight` asserts the run's `.path` is `.github/workflows/production-database.yml`).
- `workflow_run` triggers match by **workflow name**, not filename: "CI", "CodeQL", "Production database promotion" (factory-status/production-smoke/production-database as listed).
- No workflow uses an external reusable workflow (`owner/repo/...@ref`) — all reusable use is in-repo composite actions plus the one in-repo `production-deploy.yml` reusable.

---

## Nine hosted roots → ci.yml jobs / check names

Policy sources: `docs/operations/ci-redesign.md` (Phase 1: "Release gate … requires successful results from all nine hosted roots: fast, quality, build, e2e, a11y, visual, lighthouse, zap-baseline and db"); `docs/operations/change-aware-ci.md` ("Initial scope" table: Documentation / Public pages / Full=all nine); code `scripts/ci/verify-required-evidence.mjs` (`REQUIRED_HOSTED_JOBS = ["fast","quality","build","e2e","a11y","visual","lighthouse","zap-baseline","db"]`) and `scripts/ci/impact-plan-contract.mjs` (`ALL_WORKLOADS` first nine = `FULL_WORKLOADS`; profiles: `documentation` → `["documentation"]`, `public-pages` → `["fast","quality","build","targeted-browser","targeted-visual"]`).

| Root         | ci.yml job(s)                                                        | Check-run name(s)                                                     | Required?                 |
| ------------ | -------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------- |
| fast         | `fast` (ci.yml:305)                                                  | Fast lane (lint, typecheck, unit)                                     | pending governance worker |
| quality      | `quality` (ci.yml:349)                                               | Quality lane (hygiene sweeps)                                         | pending governance worker |
| build        | `build` (ci.yml:402)                                                 | Production build                                                      | pending governance worker |
| e2e          | `e2e` (ci.yml:440, 16 matrix jobs) + `e2e-gate` (ci.yml:491)         | E2E (project, pack N) ×16; rollup "E2E (DB-free harness tier)"        | pending governance worker |
| a11y         | `a11y` (ci.yml:505, 8 matrix jobs) + `a11y-gate` (ci.yml:551)        | Accessibility (project, shard N/4) ×8; rollup "Accessibility sweep"   | pending governance worker |
| visual       | `visual` (ci.yml:564, 8 matrix jobs) + `visual-gate` (ci.yml:612)    | Visual regression (project, shard N/4) ×8; rollup "Visual regression" | pending governance worker |
| lighthouse   | `lighthouse` (ci.yml:625, 4 routes) + `lighthouse-gate` (ci.yml:660) | Lighthouse (route) ×4; rollup "Lighthouse CI"                         | pending governance worker |
| zap-baseline | `zap-baseline` (ci.yml:673)                                          | ZAP baseline (no dedicated gate job; verdict via Release gate)        | pending governance worker |
| db           | `db` (ci.yml:705) + `db-gate` (ci.yml:727)                           | DB behavioral moat; rollup "DB behavioral moat gate"                  | pending governance worker |
| (aggregate)  | `release-gate` (ci.yml:743)                                          | Release gate                                                          | pending governance worker |

Job-level `if:` profile gates: `fast`/`quality`/`build`/`build-gate` require `profile ∈ {full, public-pages}`; `e2e`/`a11y`/`visual`/`lighthouse`/`zap-baseline`/`db` and their rollup gates require `profile == full`. The `Release gate` (`if: always()`) drives the actual merge/release verdict by runtime needs-evaluation, not by GitHub's required-checks mechanism.

---

## Which jobs plausibly publish required-status-check names

Evidence file-side (live branch-protection/ruleset state is a GitHub setting, not in the repo — see UNVERIFIED):

- `ci.yml`: `release-gate` → "Release gate" is explicitly treated as required exact-main release evidence by `admin-mfa-bootstrap.yml` (verifies a successful "Release gate" check on the revision) and by `production-database.yml` preflight (requires successful whole CI at the revision). `db-gate` → "DB behavioral moat gate" comment states it is a "Stable required-check name so branch protection can block a merge" (ci.yml:728-733). Rollup gates "Typecheck and build", "E2E (DB-free harness tier)", "Accessibility sweep", "Visual regression", "Lighthouse CI" exist precisely as stable merge-visible names over matrix jobs.
- `codeql.yml`: "Analyze (javascript-typescript)" — required for exact-main DB promotion (admin-mfa-bootstrap verification; production-database preflight requires successful `codeql.yml`).
- `dependency-review.yml`: "Review dependency changes" — verified as required-success on the reviewed head by `admin-mfa-bootstrap.yml`.
- `local-ci-shadow.yml`: "Local CI proof" — explicitly not to become a required merge context.
- All other workflows are dispatch-only, scheduled, or metadata/production-consumed; no file-side evidence they feed required contexts.

---

## Cross-cutting observations

- Only three environment names exist: `Production`, `Monitoring`, `Recovery Drill` (see table).
- The `production-release` concurrency group serialises admin MFA activation/bootstrap and the database promotion workflow; everything else uses its own group.
- Main-push CI runs are protected from cancellation (per-commit concurrency key) so "Release gate" evidence survives at exact SHAs; CodeQL keys identically.
- CI profile selection is executed from the reviewed base SHA on PRs (candidate code never judges itself), and `selection-comparison` / `release-gate` re-verify from reviewed policy.
- Secrets referenced in the whole set (names only): `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_SEND_EMAIL_HOOK_SECRET`, `SUPABASE_BACKUP_READ_TOKEN`, `VERCEL_TOKEN`, `PRODUCTION_ALERT_WEBHOOK_SECRET`, `PRODUCTION_ALERT_WEBHOOK_URL`, `PRODUCTION_MONITOR_SECRET`, `RESTORE_DRILL_DB_URL`, `STAMP_RACE_AUTH_TOKEN`, `GITHUB_TOKEN`.
- Vars referenced (names only): `SUPABASE_PROJECT_REF`, `LOCAL_CI_MODE`, `LOCAL_CI_WATCHDOG_ENABLED`, `STAMP_RACE_URL`, `STAMP_RACE_BODY`, `REDEEM_RACE_URL`, `REDEEM_RACE_BODY`, `RESTORE_DRILL_PROJECT_REF`, `RECOVERY_RTO_MINUTES`, `RESTORE_DRILL_STARTED_AT`, `RESTORE_DRILL_LINEAGE_SHA256`, `RESTORE_DRILL_SOURCE_MANIFEST_SHA256`, `RESTORE_DRILL_LINEAGE_JSON`, `RESTORE_DRILL_SOURCE_MANIFEST_JSON`.

## UNVERIFIED (could not be confirmed from the read-only checkout)

1. Live branch-protection / ruleset required-status-check configuration (which check-run names are actually required contexts on `main`) — a GitHub settings state, not in `.github/`; needs a `gh api` read that was outside this read-only file audit.
2. Live environment definitions and protection rules (`Production`, `Monitoring`, `Recovery Drill`) — names are cited from workflows, but secrets/vars per environment, approval counts and wait timers are unverified.
3. The task brief's stated file count of 19; the on-disk count is 17 (no other workflow files exist in `.github/workflows/`).
4. `nightly-proof.yml` header's claim of a `local-proof` bridge in `ci.yml` — the current `ci.yml` has no such job (observation now lives in `local-ci-shadow.yml`); whether the comment was ever accurate on a past revision is unverified.
5. `ISSUE_TEMPLATE/` contents (not read; out of scope).
6. Whether `docs/operations/ci-redesign.md` Phase-2 shard reductions (e2e 32→16 jobs, a11y 16→8) match the shipped `ci.yml` — the shipped matrices match Phase 2, but the docs describe rollout expectations, not guarantees; the "required?" column for all nine roots is left as **pending governance worker** per instructions.
