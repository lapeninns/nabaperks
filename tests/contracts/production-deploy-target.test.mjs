import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const workflow = readFileSync(
  new URL("../../.github/workflows/production-deploy.yml", import.meta.url),
  "utf8"
)

test("production deployment is bound to the source-owned canonical target", () => {
  assert.doesNotMatch(workflow, /vars\.VERCEL_(?:ORG|PROJECT)_ID/)
  assert.match(workflow, /scripts\/vercel-production-target\.mjs/)
  const verify = workflow.indexOf("Verify canonical Vercel project identity")
  const deploy = workflow.indexOf("pnpm exec vercel deploy")
  assert.ok(verify >= 0 && verify < deploy)
  assert.match(workflow, /\.id == \$id and \.slug == \$slug/)
  assert.match(
    workflow,
    /\.id == \$id and \.name == \$name and \.accountId == \$team_id/
  )
  assert.match(workflow, /--project="\$CANONICAL_VERCEL_PROJECT_ID"/)
  assert.match(workflow, /--scope="\$CANONICAL_VERCEL_SCOPE"/)
  assert.match(workflow, /release-vercel-target\.json/)
})

test("promotion retains explicit canonical scope and target evidence", () => {
  const promote = workflow.slice(workflow.indexOf("pnpm exec vercel promote"))
  assert.match(promote, /--scope="\$CANONICAL_VERCEL_SCOPE"/)
  assert.match(workflow, /\/v13\/deployments\/\$deployment_host/)
  assert.match(
    workflow,
    /\.projectId == \$project_id and \.ownerId == \$team_id and \.url == \$host/
  )
  assert.match(workflow, /Vercel target:/)
})
