# CI/CD remediation, 2026-09-30

Owner: lapeninns. Source analysis: `nabaperks-ci-analysis-2026-09-30.md`
(findings F1-F12, efficiency items 1-13, documentation items 1-11), checked
against main `894067714542fb8ecbb94257a81cee29bd1e5f08` on 30 September 2026.
Every claim was re-verified before any change; the report was treated as a set
of hypotheses.

## How it lands

| Step | Branch                           | Content                                                                                                                       | Gate path                                                                             |
| ---- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 1    | `claude/ci-remediation-stage`    | Everything that is not a CI input, plus restaged `config/ci-qualification-inputs/` and `config/ci-qualification-workflow.yml` | Main's planner classifies it `full` without comparison (executed locally)             |
| 2    | `claude/ci-remediation-activate` | Exactly the 12 staged inputs and `ci.yml`                                                                                     | Stage planner requires comparison; exact-tree qualification passes (executed locally) |
| 3    | not prepared                     | Delete the comparison machinery and bootstrap branches                                                                        | Normal full run after step 2                                                          |

Merge one at a time, each after its own green hosted CI. Do not use the
"Scoped CI recovery" ruleset swap for any of them. Batch the resulting
production releases as usual.

Rollback: revert step 2 (a CI-input change, so after step 2 it runs full
without comparison); step 1 reverts independently. Neither rollback weakens
validation: reverting restores the previous, stricter comparison requirement.

## What was verified, at which level

| Evidence                                                                                                                                                                                                                                                                                                                                                                                             | Level                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `pnpm quality:check` green on main (baseline, with CI fixture env), the stage tree and the activation tree (854 contract / 2,646 unit tests on the final tree)                                                                                                                                                                                                                                       | local                                                  |
| `pnpm build` then `next start`: all 44 `/dev` routes return 404, `/` returns 200                                                                                                                                                                                                                                                                                                                     | local integration                                      |
| Real planner and qualification code executed on synthetic merge candidates: PR1 `full` without comparison; PR2 qualifies (12 staged, 3,039 inputs); activation straight onto main and a staged activation with one extra edited test are both rejected; after activation a dependency PR is `full` without comparison; the gate rejects cancelled, skipped, missing, extra and unexpectedly-run jobs | local integration (gate code, not the GitHub platform) |
| ZAP with the pinned image and new rules: header-less server exit 1, hardened server exit 0, unreachable exit 3                                                                                                                                                                                                                                                                                       | local integration                                      |
| New SLO classifier on live data (read-only, 30-day window): 152 of 152 observed probes succeeded; the 43 "failures" never started (billing block); 18 runs had a passing probe but a failed alert or incident job                                                                                                                                                                                    | production read-only                                   |
| Auth-hook (chromium, 6 tests) and cron/readiness (mobile-safari, 28 tests) specs through the real harness with no skips                                                                                                                                                                                                                                                                              | local integration                                      |
| Hosted CI on either branch, platform concurrency behaviour, Dependabot discovery, live ZAP scan of the app with `fail_action`                                                                                                                                                                                                                                                                        | **not obtained** (no push was authorised)              |

## Finding closure

States: `verified` (executed evidence), `implemented_not_verified`,
`confirmed` (defect confirmed, not fixed), `disproved_with_evidence`,
`blocked_external`, `not_started`.

| ID  | Report              | State                                                         | Change and evidence                                                                                                                                                                                                                                              | Outstanding                                                                                      |
| --- | ------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| R01 | F1                  | verified (local)                                              | CI-input PRs run all nine roots without the comparison (`plan-checks.mjs`); ADR `docs/decisions/ci-qualification-replacement.md`; gate code executed as above                                                                                                    | Hosted run of steps 1 and 2; step 3 cleanup                                                      |
| R02 | F1                  | blocked_external                                              | Confirmed: a candidate `ci.yml` can publish a green `Release gate`; no `integration_id`. Trusted producer designed in the ADR                                                                                                                                    | App, environment and ruleset change by an admin                                                  |
| R03 | F1                  | confirmed                                                     | #411 and #413 merged with `Release gate` failed via a seconds-long ruleset check swap (versions 51367657/664, 51397256/267), not a bypass actor. Drift: `require_last_push_approval` false vs checker true; no `integration_id`; environments allow admin bypass | Owner decision on governance drift                                                               |
| R04 | F1                  | verified                                                      | Existing verifier rejects cancelled/skipped/missing/extra/unexpected jobs (executed); comparison-now-skipped path accepted                                                                                                                                       | None in repo                                                                                     |
| R05 | F6                  | disproved_with_evidence (safety) / not_started (value)        | Uncertain scope falls back to full; renames force full; a missing commit fails selection closed. The targeted profiles were used 0 times in 98 runs                                                                                                              | Decide whether to keep public-pages selection; add adversarial allowlist fixtures if kept        |
| R06 | F11                 | verified (unit)                                               | Eligibility `if:` plus private concurrency group for ineligible sources; shell re-proves event, branch, repository, workflow path and SHA (executed with 8 hostile inputs); live main re-read before `vercel promote`                                            | Hosted: a failed main CI must produce a skipped promotion                                        |
| R07 | F4                  | implemented_not_verified (hosted)                             | Production-build probe that every `/dev` route returns 404 in the ZAP root (verified locally)                                                                                                                                                                    | Production-mode journeys for critical flows; dev OTP refusal against a built server              |
| R08 | F4                  | not_started                                                   | Three builds confirmed (CI, staging, Vercel remote)                                                                                                                                                                                                              | Decide prebuilt versus promote-tested-deployment; verify with pinned Vercel CLI                  |
| R09 | F4                  | not_started                                                   | Attestation covers the source tarball, not served output                                                                                                                                                                                                         | Record deployment ID and output digest in the ledger                                             |
| R10 | F11                 | implemented_not_verified                                      | Live-main recheck before database writes and before promotion; ineligible runs no longer displace pending releases                                                                                                                                               | Drills: rapid pushes, delayed approval, cancellation around promote                              |
| R11 | F9                  | not_started (upgrade) / implemented (drill inputs)            | Recovery drill: inputs via env, CLI 2.106.0; production ref stays a literal denylist (the Production-environment variable is not readable there)                                                                                                                 | PR-time populated-upgrade job; re-run the drill once to confirm the CLI output format            |
| R12 | F9                  | verified                                                      | `persist-credentials: false` on every checkout; no `--token` (pinned CLI reads `VERCEL_TOKEN`, checked in source); API-key listing never written to disk; contract test fails on the old workflows                                                               | None in repo                                                                                     |
| R13 | F10                 | verified (offline)                                            | One SHA and label per action (8 checkout and 2 upload-artifact comments corrected against real tags; pnpm pins unified); Dependabot `directories` includes composite actions and ignores Playwright; lockfile/image contract                                     | Confirm Dependabot discovery in the next weekly run                                              |
| R14 | F2                  | verified (local drill of the action command line)             | FAIL rules loaded via `-c` (missed in the first draft, caught in review), `-I`, `fail_action`, digest-pinned scanner, report completion check; owned, expiring exceptions                                                                                        | Hosted run on the activation PR                                                                  |
| R15 | F12                 | verified (unit and live pnpm)                                 | Audit off PRs; fail-closed main-push release step; daily issue workflow. `--ignore-registry-errors` shown to exit 0 on an unreachable registry                                                                                                                   | Hosted run on main; notification routing                                                         |
| R16 | Eff. 1              | disproved_with_evidence (correctness) / not_started (balance) | Tiling assertion and list/runtime inventory equivalence exist; empty shards already rejected (test added). No empty shards today (all 32 per project hold 10-18 tests)                                                                                           | Duration-weighted packs need hosted benchmarks                                                   |
| R17 | Eff. 2              | not_started                                                   | Fresh servers kept; OOM rationale documented in code                                                                                                                                                                                                             | Controlled cold/warm comparison                                                                  |
| R18 | Test notes          | implemented (partial)                                         | 401 skips now fail unless reusing a caller server (verified through the harness)                                                                                                                                                                                 | Quarantine tag, hosted skip ceiling, device coverage gap statement                               |
| R19 | Test notes          | verified                                                      | `updateSnapshots: "none"` under CI; behavioural test proves no file is written, with a control                                                                                                                                                                   | Four orphan firefox/safari Linux baselines to review                                             |
| R20 | 3.4                 | not_started                                                   | SLO flake classification only                                                                                                                                                                                                                                    | Lighthouse and harness flake diagnosis                                                           |
| R21 | Eff. 5, 6, 12, 13   | implemented (partial)                                         | `quality:check` adds tokens and claims checks; AGENTS.md states hosted-only checks. Kept: `tsc` plus `next build` (same tsconfig; fast lane gives earlier feedback), rollups (consumed by `hosted-evidence.mjs` and contract tests)                              | Remove rollups and bootstrap branches in step 3; AI-review triggers                              |
| R22 | Eff. 3, 4           | not_started                                                   |                                                                                                                                                                                                                                                                  | Needs hosted measurements                                                                        |
| R23 | F5                  | not_started                                                   |                                                                                                                                                                                                                                                                  | Parity statement for arm64 local versus x64 hosted                                               |
| R24 | F5                  | confirmed                                                     | `trusted-supervisor.mjs` has no caller                                                                                                                                                                                                                           | Decide with R25                                                                                  |
| R25 | F5                  | blocked_external                                              | Host observed: launchd agent loaded, Lima VM running; `LOCAL_CI_MODE=shadow`. Clearing the variable selects the dormant path (safe)                                                                                                                              | Owner: retire or repair; if retiring, stop agent and VM, clear variables, revoke App credentials |
| R26 | F3, F8, Eff. 10, 11 | verified (partial) / blocked_external                         | Probe-job SLO classification (unit plus live data), smoke and factory-status concurrency, five timeouts                                                                                                                                                          | `PRODUCTION_ALERT_WEBHOOK_URL` does not exist in any scope; external uptime monitor              |
| R27 | 3.x                 | not_started                                                   |                                                                                                                                                                                                                                                                  | Reconcile 98/83 and 99/74 denominators                                                           |
| R28 | F7, section 7       | implemented (partial)                                         | Docs 1, 2, 4, 5, 6, 7, 10 and 11 corrected or annotated; item 3 accurate                                                                                                                                                                                         | `local-ci-contract.json` cutover step and skip ceilings (with R25)                               |

## Independent adversarial review

A separate reviewer attacked the integrated branches (read-only). Outcome:

- **Blocker, fixed:** the pinned ZAP action appends `-c` only when the rules
  file has IGNORE lines, so the first draft never loaded the FAIL rules and
  would have passed a header-less app (reproduced: exit 0). `cmd_options` now
  passes `-c .zap/rules.tsv` (exit 1); the contract test asserts it.
- **Fixed:** the stale-release check ran only before `vercel promote`, after
  migrations were already applied; it now also runs before `supabase db push`.
- **Fixed (documentation):** the vulnerability policy now states that any
  severity blocks release (the previous PR threshold, unchanged), and that
  exception handling by pnpm is unverified.
- **Fixed (comment):** factory-status grouping is per PR only for
  pull-request events.
- **Accepted, recorded:** the credential-hygiene contract scans workflows but
  not composite actions or `github-script` bodies (no current violations); the
  Supabase CLI 2.106.0 `backups list` prints `null` for an empty list, which
  makes the recovery drill fail closed.
- Could not break: release eligibility and downstream skipping, token handling,
  credential removal, the planner and gate state machine, stage/activate
  qualification (re-run independently), audit fail-closed paths, SLO
  classification.

## External actions (not performed)

Each needs the named authority. None was attempted.

1. **Alert receiver (R26).** Target: repository or `Monitoring` environment
   secret `PRODUCTION_ALERT_WEBHOOK_URL` (it exists nowhere; production-deploy
   derives the URL from the project ref instead). Permission: repository admin.
   Verify: dispatch `slo-report.yml`; the page step must succeed. Rollback:
   delete the secret.
2. **Trusted gate producer (R02).** Target: new GitHub App, an environment
   restricted to `main`, and the ruleset's required check with
   `integration_id`. Permission: owner. Verify: a PR whose `ci.yml` posts a
   same-named check stays blocked. Rollback: restore the current ruleset
   version. Do not require the new check before its producer is proven.
3. **Governance drift (R03).** Decide whether `require_last_push_approval`
   should be true (the checker expects it) and record admin-bypass policy for
   environments.
4. **Local CI (R25).** Decide retire or repair. Retire: `launchctl bootout`
   the agent, stop the `nabaperks-ci` VM, clear `LOCAL_CI_MODE` and
   `LOCAL_CI_WATCHDOG_ENABLED`, revoke the App credentials, then delete code in
   a reviewed PR.
5. **External uptime monitor (R26/F8).** GitHub delivered about 6 of 96 daily
   smoke runs; sub-hour detection needs an external service.

## Measurement limits

No hosted run of these branches exists, so no timing, cost or flake-rate
improvement is claimed. The SLO numbers above cover one 30-day window and the
classification of billing-blocked jobs relies on GitHub's job metadata (no
runner and no steps).
