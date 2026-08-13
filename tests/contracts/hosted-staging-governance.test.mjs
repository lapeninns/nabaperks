import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

const read = (path) => readFileSync(path, "utf8")

test("hosted staging has a dedicated immutable non-production workflow", () => {
  const workflow = read(".github/workflows/hosted-staging.yml")
  assert.match(workflow, /^name: Hosted staging proof/m)
  assert.match(workflow, /environment: Staging/)
  assert.match(workflow, /STAGING_MODE: hosted/)
  assert.match(workflow, /test "\$EXPECTED_REVISION" = "\$GITHUB_SHA"/)
  assert.match(
    workflow,
    /test "\$STAGING_SUPABASE_PROJECT_REF" != "\$PRODUCTION_SUPABASE_PROJECT_REF"/
  )
  assert.match(
    workflow,
    /STAGING_OWNER_NAMESPACE: staging-\$\{\{ github\.run_id \}\}-\$\{\{ github\.run_attempt \}\}/
  )
  assert.match(workflow, /node scripts\/check-supabase-migrations\.mjs/)
  assert.match(workflow, /run: pnpm smoke:staging/)
  assert.match(workflow, /retention-days: 365/)
  assert.match(workflow, /if-no-files-found: error/)
  assert.match(workflow, /if: always\(\)/)
  assert.match(
    workflow,
    /rollbackVerified == true and[\s\S]*redactionVerified == true and[\s\S]*resendReplayVerified == true/
  )
  assert.match(read("docs/operations/agent-readiness.md"), /Tasks 27 and 28/)
  assert.doesNotMatch(workflow, /environment: Production|workflow_run:|push:/)
  assert.doesNotMatch(workflow, /supabase db (push|reset)|vercel deploy/)
})

test("hosted staging emits rollback, redaction, migration and durable replay receipts", () => {
  const script = read("scripts/check-staging-release.mjs")
  assert.match(script, /STAGING_OWNER_NAMESPACE/)
  assert.match(script, /PRODUCTION_SUPABASE_PROJECT_REF/)
  assert.match(script, /STAGING_EVIDENCE_PATH/)
  assert.match(script, /rollbackVerified/)
  assert.match(script, /redactionVerified/)
  assert.match(script, /resendReplayVerified/)
  assert.match(script, /delivered_at/)
  assert.match(script, /updated_at/)
  assert.match(script, /writeFile/)
})
