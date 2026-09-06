import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { pathToFileURL } from "node:url"

export function validateProductionCandidate(metadata, expected) {
  assert.ok(
    metadata && typeof metadata === "object" && !Array.isArray(metadata),
    "deployment metadata must be an object"
  )
  assert.match(
    expected.revision ?? "",
    /^[a-f0-9]{40}$/,
    "candidate revision must be a full Git SHA"
  )
  assert.match(
    expected.projectId ?? "",
    /^prj_[A-Za-z0-9]+$/,
    "canonical project ID is required"
  )
  assert.match(
    expected.teamId ?? "",
    /^team_[A-Za-z0-9]+$/,
    "canonical team ID is required"
  )
  const url = new URL(expected.url)
  assert.equal(url.protocol, "https:", "candidate URL must use HTTPS")
  assert.equal(
    url.username + url.password + url.search + url.hash + url.port,
    "",
    "candidate URL must be a credential-free origin"
  )
  assert.equal(url.pathname, "/", "candidate URL must be an origin")
  assert.match(
    url.hostname,
    /^[a-z0-9-]+\.vercel\.app$/,
    "candidate URL must be an immutable Vercel host"
  )
  assert.match(
    metadata.id ?? "",
    /^dpl_[A-Za-z0-9]+$/,
    "immutable deployment ID is required"
  )
  if (expected.deploymentId !== undefined) {
    assert.equal(
      metadata.id,
      expected.deploymentId,
      "deployment ID changed after staging"
    )
  }
  assert.equal(metadata.url, url.hostname, "deployment URL mismatch")
  assert.equal(
    metadata.projectId,
    expected.projectId,
    "deployment project mismatch"
  )
  assert.equal(metadata.ownerId, expected.teamId, "deployment team mismatch")
  assert.equal(
    metadata.meta?.githubCommitSha,
    expected.revision,
    "deployment full revision mismatch"
  )
  assert.equal(
    metadata.target,
    "production",
    "deployment target must be production"
  )
  assert.equal(metadata.readyState, "READY", "deployment must be READY")
  return {
    deploymentId: metadata.id,
    projectId: metadata.projectId,
    teamId: metadata.ownerId,
    revision: expected.revision,
    target: "production",
    url: url.origin,
  }
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  try {
    const candidate = validateProductionCandidate(
      JSON.parse(readFileSync(0, "utf8")),
      {
        revision: process.env.EXPECTED_REVISION,
        projectId: process.env.CANONICAL_VERCEL_PROJECT_ID,
        teamId: process.env.CANONICAL_VERCEL_TEAM_ID,
        url: process.env.DEPLOYMENT_URL,
        deploymentId: process.env.EXPECTED_DEPLOYMENT_ID,
      }
    )
    console.log(JSON.stringify(candidate))
  } catch {
    console.error(
      "Production candidate verification failed; promotion is forbidden."
    )
    process.exitCode = 1
  }
}
