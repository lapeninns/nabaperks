---
name: qa
description: >
  Run QA tests for Nabaperks. Analyzes git diff to determine affected areas,
  runs configured functional flows with multiple personas, and generates
  diff-targeted tests. Uses agent-browser for web testing.
---

# QA Orchestrator

**SCOPE: This skill performs manual and functional QA only.** Verify that the application works by interacting with it as a real user would through a browser or API call. Do not run or report on CI checks, linting, ESLint, typecheck, unit tests, Vitest, Playwright suites, or static analysis. Those are handled by separate workflows.

## Step 1: Load Configuration

Read `.factory/skills/qa/config.yaml` for environment URLs, credentials, personas, app definitions, cleanup, and failure-learning mode.

## Step 2: Determine Target Environment

Use `default_target` from config unless the user specifies a different target. Respect all environment restrictions.

For this project, the default target is `local` and execution is local-only. Do not rely on GitHub Actions, remote automation, a Factory API key, preview deployments, staging, or production. Start or use the local Supabase stack and local dev server for the checked-out branch.

## Step 3: Analyze Git Diff

Run `git diff` to determine what changed. Map changed files to apps using `apps.<app>.path_patterns` in config.

Files that do not match any app path pattern, for example `.factory/skills/**`, `.github/**`, or docs-only changes, are not associated with an app. Do not run app test flows for them.

For each affected app:

- Read that app sub-skill from `.factory/skills/qa-<app-name>/SKILL.md`.
- Run only flows relevant to the diff, plus adjacent integration checks that prove the changed behavior works.
- Generate an ad-hoc test if no existing flow directly covers the change.

For apps not affected by the diff:

- Do not load or run the module.
- Do not run its pre-flight checks.
- Do not run unrelated smoke flows.

If no app is affected, report as `:grey_question: INCONCLUSIVE`: "No app code changed, QA not applicable for this diff."

## Step 4: Pre-flight Checks

Run pre-flight checks only for affected apps.

For the `web` app:

- Confirm the target is local.
- For local target, verify a Supabase stack and seeded data are available. If not, report affected flows as BLOCKED with the missing command or env var.
- If the dev server is not already running, start it from the checked-out branch with `pnpm dev`.
- Confirm `CUSTOMER_DEV_OTP_CODE=424242` is set for local customer OTP flows.

Never silently skip a flow. If a flow cannot complete, report it as BLOCKED with what was tried and how the user can fix it.

## Step 5: Execute Diff-Relevant Flows Only

Use the app sub-skill menu as a menu, not a checklist.

Selection rules:

1. Prioritize tests that directly verify the behavioral change in the diff.
2. Include adjacent integration tests only when they prove the change reaches the real user flow.
3. Do not test unrelated areas.
4. Include at least one related negative or boundary test.
5. If unsure what changed, mark QA as INCONCLUSIVE rather than PASS.

Do not run automated test suites. Functional QA means direct browser interaction, route/API probing, and evidence capture.

## Step 6: Evidence Capture

After each significant test step, capture evidence.

For web app testing with agent-browser:

- Use `agent-browser snapshot` as primary evidence.
- Save screenshots under `./qa-results/$RUN_ID/`.
- Do not embed image markdown in reports. Reference screenshot filenames as downloadable artifacts.
- Put all text snapshots and screenshot references inside one collapsed details block in the report.

Evidence quality rules:

- Show something relevant and changed in each snapshot.
- Label each snapshot with what it proves.
- Prefer concise accessibility-tree text over large images.

## Step 7: Test Quality Gate

Before reporting PASS, verify:

- At least half the tests directly exercise changed behavior.
- At least one negative or boundary condition related to the change was attempted.
- Every skipped or impossible flow is recorded as BLOCKED, not omitted.
- The result table only contains user-facing behavior or specific behavioral checks, not setup steps.

## Step 8: Handle Failures

Never abort the entire QA run for one failed flow. Report the failed flow as FAIL or BLOCKED, include what was tried, and continue with other affected flows.

Use these result values:

- `:white_check_mark: PASS`
- `:x: FAIL`
- `:no_entry: BLOCKED`
- `:warning: FLAKY`
- `:grey_question: INCONCLUSIVE`

## Step 9: Generate Report

Write `./qa-results/report.md` using `.factory/skills/qa/REPORT-TEMPLATE.md`.

Report rules:

- Start with `## QA Report`.
- Include the test results table immediately after the heading.
- Keep the report concise.
- Include a short `### Action Required` section only if something needs action.
- Put all evidence in one collapsed `<details>` block.
- Do not include verbose setup metadata or a behavioral change summary.

## Step 10: Suggested Skill Updates

Read `failure_learning` from config.

If a BLOCKED or FAIL result reveals a new testing-environment insight that would help future QA runs, add a `## Suggested Skill Updates (N issues found)` section to the report.

Suggest updates only for environment or workflow knowledge, such as missing env vars, auth-wall behavior, test account requirements, locale assumptions, or third-party timing. Do not suggest updates for selector mistakes or expected UI text changes from the diff.

For `suggest_in_report`, include the suggested update in the report only. Do not write `qa-results/skill-updates.json`, commit files, open PRs, or call remote automation.
