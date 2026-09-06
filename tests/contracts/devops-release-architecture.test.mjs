import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

function read(path) {
  return readFileSync(path, "utf8")
}

test("CI exposes one stable release gate over complete hosted proof", () => {
  const ci = read(".github/workflows/ci.yml")
  const releaseGate = ci.slice(ci.indexOf("\n  release-gate:"))
  assert.match(releaseGate, /name: Release gate/)
  assert.match(releaseGate, /timeout-minutes: 3/)
  for (const dependency of [
    "fast",
    "quality",
    "build",
    "e2e",
    "a11y",
    "visual",
    "lighthouse",
    "zap-baseline",
    "db",
  ]) {
    assert.match(releaseGate, new RegExp(`      - ${dependency}\\n`))
  }
  assert.match(releaseGate, /if: \$\{\{ always\(\) \}\}/)
  assert.match(releaseGate, /CI_REQUIRED_EVIDENCE: \$\{\{ toJSON\(needs\) \}\}/)
  assert.match(releaseGate, /node scripts\/ci\/verify-required-evidence\.mjs/)
  assert.doesNotMatch(ci, /\n  local-proof:/)
})

test("successful application promotion verifies the exact production revision", () => {
  const smoke = read(".github/workflows/production-smoke.yml")

  assert.match(smoke, /workflow_run:/)
  assert.match(smoke, /workflows: \["Production deployment"\]/)
  assert.match(smoke, /workflow_run\.conclusion == 'success'/)
  assert.match(smoke, /workflow_run\.head_branch == 'main'/)
  assert.match(smoke, /workflow_run\.head_sha/)
  assert.match(smoke, /timeout-minutes: 7/)
  assert.match(smoke, /EXPECTED_REVISION:0:12/)
  assert.match(smoke, /for attempt in \{1\.\.30\}/)
  assert.match(smoke, /\.signals\.cronJobs[\s\S]*length == 7/)
  assert.match(smoke, /Production did not expose expected revision/)
})

test("production CD attests immutable source, builds remotely, verifies and then promotes", () => {
  const workflow = read(".github/workflows/production-deploy.yml")

  assert.match(workflow, /workflows: \["Production database promotion"\]/)
  assert.match(workflow, /name: Production deployment preflight/)
  assert.match(workflow, /needs: preflight/)
  assert.match(workflow, /environment: Production/)
  assert.match(workflow, /git rev-parse origin\/main/)
  assert.doesNotMatch(workflow, /pnpm exec vercel pull/)
  assert.doesNotMatch(workflow, /pnpm exec vercel build --prod/)
  assert.doesNotMatch(workflow, /--prebuilt/)
  assert.match(workflow, /git archive --format=tar/)
  assert.match(workflow, /runner\.temp.*release-source\.tgz/)
  assert.match(workflow, /syft-version: v1\.49\.0/)
  assert.match(workflow, /uses: actions\/attest@[a-f0-9]{40}/)
  assert.match(workflow, /sbom-path:.*runner\.temp.*release-sbom\.cdx\.json/)
  assert.match(workflow, /pnpm exec vercel deploy/)
  assert.match(workflow, /--prod/)
  assert.match(workflow, /--skip-domain/)
  assert.match(workflow, /--no-wait/)
  assert.match(workflow, /--archive=tgz/)
  assert.match(workflow, /Verify staged liveness and dependency readiness/)
  assert.match(workflow, /for attempt in \{1\.\.90\}/)
  assert.match(workflow, /\.checks\.operational == "ok"/)
  assert.doesNotMatch(workflow, /SENTRY_/)
  assert.doesNotMatch(workflow, /ops:sentry:check/)
  assert.doesNotMatch(workflow, /check-sentry-release\.mjs/)
  assert.match(workflow, /PROMOTE_PRODUCTION_APPLICATION/)
  assert.doesNotMatch(workflow, /pnpm dlx|npm install --global|@latest/)

  const attest = workflow.indexOf("Attest source provenance")
  const stage = workflow.indexOf("Stage a hosted production build")
  const verify = workflow.indexOf(
    "Verify staged liveness and dependency readiness"
  )
  const promote = workflow.indexOf("Promote the verified staged deployment")
  assert.ok(attest > -1 && stage > attest && verify > stage && promote > verify)
  assert.ok(
    workflow.indexOf("PROMOTE_PRODUCTION_APPLICATION") <
      workflow.indexOf("environment: Production")
  )
})

test("nightly browser hardening is isolated, bounded and has a stable gate", () => {
  const nightly = read(".github/workflows/nightly.yml")

  assert.match(nightly, /STRIPE_LAUNCH_PRICE_ID: price_launch_ci/)
  assert.match(
    nightly,
    /project: \[chromium, mobile-safari, desktop-firefox, desktop-safari\]/
  )
  assert.match(
    nightly,
    /name: Full cross-browser Playwright \(\$\{\{ matrix\.project \}\}, shard \$\{\{ matrix\.shard \}\}\)/
  )
  assert.match(
    nightly,
    /name: Full cross-browser Playwright\n    needs: cross-browser/
  )
  for (const timeout of [45, 90, 20, 15, 30]) {
    assert.match(nightly, new RegExp(`timeout-minutes: ${timeout}`))
  }
})

test("production database promotion is CI-led, protected and exact-revision", () => {
  const workflow = read(".github/workflows/production-database.yml")

  assert.match(workflow, /workflow_dispatch:/)
  assert.match(workflow, /workflow_run:/)
  assert.match(workflow, /workflows: \["CI"\]/)
  assert.match(workflow, /branches: \[main\]/)
  assert.doesNotMatch(workflow, /\n  (push|pull_request|schedule):/)
  assert.match(workflow, /test \"\$GITHUB_REF\" = \"refs\/heads\/main\"/)
  assert.match(workflow, /test \"\$EXPECTED_REVISION\" = \"\$GITHUB_SHA\"/)
  assert.match(workflow, /PROMOTE_PRODUCTION_DATABASE/)
  assert.match(workflow, /actions: read/)
  assert.match(workflow, /require_successful_workflow ci\.yml 1/)
  assert.match(workflow, /require_successful_workflow codeql\.yml 60/)
  assert.match(workflow, /--event push/)
  assert.match(workflow, /\.conclusion == \"success\"/)
  assert.match(workflow, /attempt <= attempts/)
  assert.match(workflow, /environment: Production/)
  assert.match(workflow, /name: Cost-neutral ephemeral release proof/)
  assert.match(workflow, /export_fixture STRIPE_LAUNCH_PRICE_ID/)
  assert.doesNotMatch(workflow, /environment: Staging/)
  assert.match(workflow, /STAGING_MODE: ephemeral/)
  assert.match(workflow, /supabase start/)
  assert.match(workflow, /node scripts\/check-supabase-migrations\.mjs --local/)
  assert.match(workflow, /pnpm build/)
  assert.match(workflow, /pnpm start/)
  assert.match(workflow, /supabase db push --linked --dry-run --include-all/)
  // The promote job must carry the linked auth-hook defaults: the CLI parses
  // config.toml hooks even for db push, and their absence stalled the first
  // production promotion for a week (2026-07-31 incident).
  assert.match(
    workflow,
    /SUPABASE_SEND_EMAIL_HOOK_URI: https:\/\/nabaperks\.com\/api\/auth\/hooks\/send-email/
  )
  assert.match(workflow, /run: pnpm smoke:staging/)
  assert.match(workflow, /needs: staging/)
  assert.doesNotMatch(workflow, /secrets\.STAGING_/)
  assert.match(workflow, /secrets\.SUPABASE_ACCESS_TOKEN/)
  assert.match(workflow, /secrets\.SUPABASE_DB_PASSWORD/)
  assert.match(workflow, /vars\.SUPABASE_PROJECT_REF/)
  assert.match(workflow, /git rev-parse origin\/main/)

  const promoteJob = workflow.indexOf("\n  promote:")
  const dryRun = workflow.indexOf(
    "supabase db push --linked --dry-run --include-all",
    promoteJob
  )
  const apply = workflow.indexOf(
    "supabase db push --linked --include-all",
    promoteJob
  )
  const verify = workflow.indexOf(
    "node scripts/check-supabase-migrations.mjs",
    promoteJob
  )
  assert.ok(dryRun > -1 && apply > dryRun && verify > apply)
  assert.doesNotMatch(workflow, /supabase (db reset|seed|migration repair)/)
  assert.doesNotMatch(workflow, /--force/)
})

test("staging proof is isolated, exact-revision, replay-safe and rollback-only", () => {
  const script = read("scripts/check-staging-release.mjs")

  assert.match(script, /STAGING_SUPABASE_PROJECT_REF/)
  assert.match(script, /STAGING_MODE/)
  assert.match(script, /EPHEMERAL_MODE/)
  assert.match(script, /fixed loopback origin/)
  assert.match(script, /\.hostname\.includes\(projectRef\)/)
  assert.match(script, /health\.targetEnvironment/)
  assert.match(script, /health\.environment/)
  assert.match(script, /"staging"/)
  assert.match(script, /"preview"/)
  assert.match(script, /join_customer_membership_with_first_stamp/)
  assert.match(script, /issue_self_service_stamp/)
  assert.match(script, /throw ROLLBACK/)
  assert.match(script, /stripe-signature/)
  assert.match(script, /replay\.duplicate/)
  assert.match(script, /svix-signature/)
  assert.match(script, /x-vercel-protection-bypass/)
  assert.match(script, /delete from public\.stripe_webhook_events/)
  assert.match(script, /required\(env, "STAGING_APP_URL"\)/)
})

test("recovery drill verifies a recent physical backup on a protected disposable target", () => {
  const workflow = read(".github/workflows/recovery-drill.yml")
  const verifier = read("scripts/check-restored-backup.mjs")

  assert.match(workflow, /workflow_dispatch:/)
  assert.match(workflow, /VERIFY_NON_PRODUCTION_RESTORE/)
  assert.match(workflow, /environment: Recovery Drill/)
  assert.match(
    workflow,
    /test "\$RESTORE_PROJECT_REF" != "skonlhwstejberyzobep"/
  )
  assert.match(workflow, /supabase backups list/)
  assert.match(workflow, /supabase projects list/)
  assert.match(workflow, /check-restored-backup\.mjs/)
  assert.match(workflow, /retention-days: 365/)
  assert.match(workflow, /secrets\.SUPABASE_BACKUP_READ_TOKEN/)
  assert.match(workflow, /secrets\.RESTORE_DRILL_DB_URL/)
  assert.match(verifier, /set transaction read only/)
  assert.match(verifier, /restore drill must never target production/)
  assert.match(verifier, /restored migration ledger/)
  assert.match(verifier, /restored core tables/)
  assert.match(verifier, /restored core RPCs/)
  assert.match(verifier, /restored public constraints/)
  assert.match(verifier, /restored public indexes/)
  assert.match(verifier, /active database cron jobs/)
})

test("scheduled smoke history produces a fail-closed rolling SLO and error budget", () => {
  const config = read("config/production-slos.json")
  const workflow = read(".github/workflows/slo-report.yml")
  const script = read("scripts/check-production-slo.mjs")
  const smoke = read(".github/workflows/production-smoke.yml")

  assert.match(config, /"availabilityObjective": 0\.999/)
  assert.match(config, /"minimumCoverageRatio": 0\.95/)
  assert.match(config, /"minimumObservationDays": 7/)
  assert.match(config, /"probeSchedule": "7\/15 \* \* \* \*"/)
  assert.match(workflow, /cron: "13 7 \* \* \*"/)
  assert.match(workflow, /actions: read/)
  assert.match(workflow, /environment: Monitoring/)
  assert.match(workflow, /check-production-slo\.mjs/)
  assert.match(workflow, /retention-days: 365/)
  assert.match(workflow, /warming\|breached\|compliant/)
  assert.match(workflow, /outputs\.state == 'breached'/)
  assert.match(workflow, /outputs\.state == 'error'/)
  assert.match(workflow, /outputs\.state == 'compliant'/)
  assert.match(workflow, /priority: p1-high/)
  assert.match(
    workflow,
    /notify-production-alert\.mjs trigger availability-slo/
  )
  assert.match(
    workflow,
    /notify-production-alert\.mjs resolve availability-slo/
  )
  assert.match(workflow, /test "\$SLO_OUTCOME" = "success"/)
  assert.match(script, /event", "schedule"/)
  assert.match(script, /status", "completed"/)
  assert.match(script, /consumedUnavailableSamples = failedSamples/)
  assert.match(script, /slo-report\.yml\/runs/)
  assert.match(script, /\? "warming"/)
  assert.match(script, /\? "compliant"/)
  assert.match(script, /: "breached"/)
  assert.match(script, /availabilityRatio >= config\.availabilityObjective/)
  assert.match(script, /errorRate/)
  assert.match(workflow, /Error rate:/)
  assert.match(smoke, /check-production-probe-latency\.mjs/)
  assert.match(config, /"livenessResponseMs": 3000/)
  assert.match(config, /"readinessResponseMs": 5000/)
})

test("the DevOps maturity contract distinguishes repository and provider proof", () => {
  const maturity = read("docs/operations/devops-maturity.md")

  assert.match(maturity, /Deployment Checks/)
  assert.match(maturity, /GitHub ruleset/)
  assert.match(maturity, /independent reviewer/)
  assert.match(maturity, /point-in-time recovery/i)
  assert.match(maturity, /restore drill/i)
  assert.match(maturity, /Release gate/)
})
