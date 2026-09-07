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
  const validateAt = workflow.indexOf(
    'node scripts/release/candidate.mjs <<<"$deployment_metadata" > "$candidate_file"'
  )
  const identityAt = workflow.indexOf(
    'deployment_id="$(jq -er \'.deploymentId\' "$candidate_file")"'
  )
  const promoteAt = workflow.indexOf(
    'pnpm exec vercel promote "$deployment_id"'
  )
  assert.ok(
    validateAt >= 0 && identityAt > validateAt && promoteAt > identityAt
  )
  const validator = readFileSync(
    new URL("../../scripts/release/candidate.mjs", import.meta.url),
    "utf8"
  )
  const compactValidator = validator.replace(/\s+/g, "")
  const containsValidator = (source) =>
    compactValidator.includes(source.replace(/\s+/g, ""))
  for (const binding of [
    "metadata.projectId, expected.projectId",
    "metadata.ownerId, expected.teamId",
    "metadata.url, url.hostname",
    "metadata.meta?.githubCommitSha, expected.revision",
    'metadata.target, "production"',
    'metadata.readyState, "READY"',
  ])
    assert.ok(containsValidator(`assert.equal(${binding}`), binding)
  assert.ok(
    containsValidator('assert.match(expected.revision ?? "", /^[a-f0-9]{40}$/')
  )
  assert.ok(
    containsValidator('assert.match(metadata.id ?? "", /^dpl_[A-Za-z0-9]+$/')
  )
  for (const binding of [
    "revision: process.env.EXPECTED_REVISION",
    "projectId: process.env.CANONICAL_VERCEL_PROJECT_ID",
    "teamId: process.env.CANONICAL_VERCEL_TEAM_ID",
    "url: process.env.DEPLOYMENT_URL",
  ])
    assert.ok(containsValidator(binding), binding)
  assert.match(validator, /process\.exitCode = 1/)
  assert.doesNotMatch(workflow, /vercel promote "\$DEPLOYMENT_URL"/)
  assert.match(workflow, /Vercel target:/)
})
