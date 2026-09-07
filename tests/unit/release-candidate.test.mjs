import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { test } from "node:test"
import { validateProductionCandidate } from "../../scripts/release/candidate.mjs"

const expected = {
  revision: "a".repeat(40),
  projectId: "prj_example",
  teamId: "team_example",
  url: "https://candidate-example.vercel.app",
  deploymentId: "dpl_example",
}
const metadata = {
  id: "dpl_example",
  projectId: expected.projectId,
  ownerId: expected.teamId,
  url: "candidate-example.vercel.app",
  meta: { githubCommitSha: expected.revision },
  target: "production",
  readyState: "READY",
}

test("production candidate binds full revision and immutable provider identity", () => {
  assert.deepEqual(validateProductionCandidate(metadata, expected), {
    deploymentId: metadata.id,
    projectId: metadata.projectId,
    teamId: metadata.ownerId,
    revision: expected.revision,
    target: "production",
    url: expected.url,
  })
})

test("production candidate rejects wrong, missing and incomplete provider metadata", () => {
  for (const patch of [
    { id: "dpl_replaced" },
    { id: undefined },
    { projectId: "prj_other" },
    { ownerId: "team_other" },
    { url: "other.vercel.app" },
    { target: "preview" },
    { target: undefined },
    { readyState: "BUILDING" },
    { readyState: "ERROR" },
    { meta: {} },
    { meta: { githubCommitSha: "a".repeat(12) + "b".repeat(28) } },
  ])
    assert.throws(() =>
      validateProductionCandidate({ ...metadata, ...patch }, expected)
    )
  for (const invalid of [null, [], "READY"])
    assert.throws(() => validateProductionCandidate(invalid, expected))
})

test("production candidate rejects mutable or credential-bearing URLs and partial expected SHAs", () => {
  for (const url of [
    "https://nabaperks.com",
    "http://candidate-example.vercel.app",
    `${expected.url}/path`,
    `${expected.url}?x=1`,
    "https://secret@candidate-example.vercel.app",
    "https://candidate-example.vercel.app:8443",
  ]) {
    assert.throws(() =>
      validateProductionCandidate(metadata, { ...expected, url })
    )
  }
  assert.throws(() =>
    validateProductionCandidate(metadata, {
      ...expected,
      revision: "a".repeat(12),
    })
  )
})

test("candidate CLI exits nonzero and does not echo untrusted provider payloads", () => {
  const result = spawnSync(
    process.execPath,
    ["scripts/release/candidate.mjs"],
    {
      input: JSON.stringify({ secret: "do-not-echo-provider-value" }),
      encoding: "utf8",
      env: {},
    }
  )
  assert.equal(result.status, 1)
  assert.equal(result.stdout, "")
  assert.doesNotMatch(result.stderr, /do-not-echo-provider-value/)
})

test("candidate CLI consumes actual workflow environment and returns the immutable promotion ID", () => {
  const result = spawnSync(
    process.execPath,
    ["scripts/release/candidate.mjs"],
    {
      input: JSON.stringify(metadata),
      encoding: "utf8",
      env: {
        EXPECTED_REVISION: expected.revision,
        CANONICAL_VERCEL_PROJECT_ID: expected.projectId,
        CANONICAL_VERCEL_TEAM_ID: expected.teamId,
        DEPLOYMENT_URL: expected.url,
        EXPECTED_DEPLOYMENT_ID: expected.deploymentId,
      },
    }
  )
  assert.equal(result.status, 0, result.stderr)
  assert.equal(JSON.parse(result.stdout).deploymentId, expected.deploymentId)
})
