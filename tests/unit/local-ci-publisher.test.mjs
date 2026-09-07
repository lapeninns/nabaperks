import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { createAttemptJournal } from "../../ops/local-ci/core/attempts.mjs"
import { loadContract } from "../../ops/local-ci/core/contract.mjs"
import { expectedAppSlug } from "../../ops/local-ci/core/app-identity.mjs"
import { publishDurableCheck } from "../../ops/local-ci/agent/publisher.mjs"
const contract = loadContract((path) => readFileSync(path, "utf8"))
const job = { ref: "refs/heads/main", sha: "a".repeat(40), profile: "main" }
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), "ci-publisher-"))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  return () => createAttemptJournal({ path: join(dir, "attempts.json") })
}
test("accepted creation with lost response reconciles one check across restart", async (t) => {
  const open = fixture(t)
  let journal = open()
  const id = journal.begin(job)
  journal.finish(id, "incomplete")
  const checks = []
  let updates = 0
  const github = {
    createCheckRun: async (payload) => {
      checks.push({
        id: 42,
        external_id: payload.externalId,
        name: payload.name,
        head_sha: payload.headSha,
        app: { id: contract.githubApp.appId, slug: expectedAppSlug(contract) },
      })
      throw new Error("response lost")
    },
    getCheckRunsForRef: async () => checks,
    updateCheckRun: async (checkId) => {
      assert.equal(checkId, 42)
      updates += 1
    },
  }
  const publish = () =>
    publishDurableCheck({
      github,
      contract,
      journal,
      attempt: journal.entries[0],
      payload: { status: "completed", conclusion: "failure" },
    })
  await assert.rejects(publish(), /response lost/)
  assert.equal(journal.entries[0].creationAttempted, true)
  journal = open()
  await publish()
  assert.equal(checks.length, 1)
  assert.equal(updates, 1)
  assert.equal(journal.entries[0].checkRunId, 42)
})
test("ambiguous creation stays pending if listing fails, is empty or has wrong provenance", async (t) => {
  const journal = fixture(t)()
  const id = journal.begin(job)
  journal.finish(id, "incomplete")
  journal.markCreationAttempted(id)
  for (const list of [
    async () => {
      throw new Error("offline")
    },
    async () => [],
    async () => [
      {
        id: 42,
        external_id: `nabaperks-attempt:${id}`,
        name: contract.checkName,
        head_sha: job.sha,
        app: { id: 999, slug: "impostor" },
      },
    ],
  ]) {
    await assert.rejects(
      publishDurableCheck({
        journal,
        contract,
        attempt: journal.entries[0],
        payload: { status: "completed" },
        github: {
          getCheckRunsForRef: list,
          createCheckRun: async () => assert.fail("must not blindly create"),
          updateCheckRun: async () =>
            assert.fail("must not update unverified proof"),
        },
      })
    )
    assert.equal(journal.entries[0].checkRunId, null)
    assert.equal(journal.entries[0].published, false)
  }
})
