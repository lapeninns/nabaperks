import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

const workflow = readFileSync(".github/workflows/staging-deploy.yml", "utf8")
const nextConfig = readFileSync("next.config.ts", "utf8")
const releaseRevision = readFileSync(
  "lib/observability/release-revision.ts",
  "utf8"
)

test("hosted Staging deployment is manual, protected and exact-revision", () => {
  assert.match(workflow, /\non:\n  workflow_dispatch:/)
  assert.doesNotMatch(
    workflow,
    /\n  (push|pull_request|schedule|workflow_run):/
  )
  assert.match(workflow, /environment: Staging/)
  assert.match(workflow, /test "\$GITHUB_REF" = "refs\/heads\/main"/)
  assert.match(workflow, /\^\[a-f0-9\]\{40\}\$/)
  assert.match(workflow, /DEPLOY_STAGING_APPLICATION/)
  assert.match(workflow, /ref: \$\{\{ inputs\.expected_revision \}\}/)
  assert.match(workflow, /git rev-parse HEAD/)
  assert.match(workflow, /git rev-parse origin\/main/)
})

test("hosted Staging deploys only to the custom target and proves before the explicit alias", () => {
  assert.match(workflow, /vercel deploy[\s\S]*--target=staging/)
  assert.doesNotMatch(workflow, /--prebuilt|vercel pull|vercel build/)
  assert.doesNotMatch(workflow, /--prod|vercel promote/)
  assert.match(
    workflow,
    /--build-env NABAPERKS_BUILD_REVISION="\$EXPECTED_REVISION"/
  )
  assert.match(workflow, /--env NABAPERKS_BUILD_REVISION="\$EXPECTED_REVISION"/)
  assert.match(workflow, /STAGING_MODE: hosted/)
  assert.match(workflow, /run: pnpm smoke:staging/)
  assert.match(workflow, /secrets\.STAGING_MONITOR_SECRET/)
  assert.match(workflow, /secrets\.STAGING_SUPABASE_DB_URL/)
  assert.match(workflow, /secrets\.STAGING_VERCEL_AUTOMATION_BYPASS_SECRET/)

  const proof = workflow.indexOf("run: pnpm smoke:staging")
  const alias = workflow.indexOf("vercel alias set")
  assert.ok(proof > -1 && alias > proof)
})

test("release identity is baked, runtime-injected and mismatch-safe", () => {
  assert.match(nextConfig, /process\.env\.NABAPERKS_BUILD_REVISION/)
  assert.match(nextConfig, /process\.env\.VERCEL_GIT_COMMIT_SHA/)
  assert.match(nextConfig, /Build revision must be a full Git SHA/)
  assert.match(nextConfig, /env: \{ NABAPERKS_BUILD_REVISION:/)
  assert.match(releaseRevision, /buildRevision/)
  assert.match(releaseRevision, /runtimeRevision/)
  assert.match(releaseRevision, /revision-mismatch/)
  assert.match(releaseRevision, /invalid-revision/)
})

test("hosted Staging alias cannot target a production-owned domain", () => {
  assert.match(
    workflow,
    /STAGING_APP_ALIAS: \$\{\{ vars\.STAGING_APP_ALIAS \}\}/
  )
  assert.ok(workflow.includes("nabaperks.com"))
  assert.ok(workflow.includes("www.nabaperks.com"))
  assert.ok(workflow.includes("nabaperks.vercel.app"))
  assert.ok(workflow.includes("candidate.nabaperks.com"))
  assert.ok(workflow.includes("*.vercel.app"))
})
