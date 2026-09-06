import test from "node:test"
import assert from "node:assert/strict"
import { readDeployedBaseline } from "../../scripts/release/deployed-baseline.mjs"

const target = { projectId: "prj_example", teamId: "team_example" }
const alias = {
  alias: "nabaperks.com",
  projectId: target.projectId,
  deploymentId: "dpl_example",
  deployment: { id: "dpl_example", url: "nabaperks-example.vercel.app" },
}
const metadata = {
  id: "dpl_example",
  projectId: target.projectId,
  ownerId: target.teamId,
  url: alias.deployment.url,
  target: "production",
  readyState: "READY",
  meta: { githubCommitSha: "a".repeat(40) },
}

function read(responses) {
  let index = 0
  return readDeployedBaseline({
    target,
    now: () => 1000,
    getJson: async () => responses[index++],
  })
}

test("baseline is the full SHA of the stable canonical public alias", async () => {
  const result = await read([alias, metadata, alias])
  assert.equal(result.revision, "a".repeat(40))
  assert.equal(result.deploymentId, "dpl_example")
})

test("wrong project, short revision, unready build and changing alias fail before admission", async () => {
  for (const values of [
    [{ ...alias, projectId: "prj_other" }, metadata, alias],
    [alias, { ...metadata, meta: { githubCommitSha: "a".repeat(12) } }, alias],
    [alias, { ...metadata, readyState: "BUILDING" }, alias],
    [alias, { ...metadata, ownerId: "team_other" }, alias],
    [
      alias,
      metadata,
      {
        ...alias,
        deploymentId: "dpl_changed",
        deployment: { id: "dpl_changed", url: "changed.vercel.app" },
      },
    ],
  ])
    await assert.rejects(read(values))
})
