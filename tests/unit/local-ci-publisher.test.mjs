import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { createAttemptJournal } from "../../ops/local-ci/core/attempts.mjs"
import { loadContract } from "../../ops/local-ci/core/contract.mjs"
import { expectedAppSlug } from "../../ops/local-ci/core/app-identity.mjs"
import {
  publishDurableCheck,
  publishLaneProgress,
  renderProgressOutput,
} from "../../ops/local-ci/agent/publisher.mjs"
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

/* ------------------------------------------------------- lane progress */

const PROGRESS_SHA = "e".repeat(40)
const progress = (overrides = {}) => ({
  profile: "pr",
  ref: "refs/pull/7/head",
  headSha: PROGRESS_SHA,
  laneIds: ["fast", "quality", "e2e-chromium-odd"],
  lanes: [
    {
      laneId: "fast",
      status: "success",
      durationSeconds: 128,
      testsRun: 3218,
      testsPassed: 3218,
      testsFailed: 0,
      testsSkipped: 0,
      flaky: 0,
    },
    {
      laneId: "quality",
      status: "failure",
      durationSeconds: 20,
      testsRun: null,
      testsPassed: null,
      testsFailed: null,
      testsSkipped: null,
      flaky: null,
    },
    null,
  ],
  hostedOnly: [{ laneId: "db", reason: "requires privileged-daemon" }],
  ...overrides,
})

test("the progress output reports finished lanes and names the rest, with no conclusion", () => {
  const output = renderProgressOutput(progress(), contract)
  assert.equal(output.title, "pr — running: 2/3 lanes finished, 1 passed")
  assert.match(output.summary, /2 of 3 local lanes have finished; 1 passed/)
  assert.match(
    output.text,
    /\| fast \| success \| 2m 08s \| 3218 \| 3218 \| 0 \| 0 \| 0 \|/
  )
  // A missing tally is shown as missing, never as zero.
  assert.match(
    output.text,
    /\| quality \| failure \| 20s \| — \| — \| — \| — \| — \|/
  )
  assert.match(
    output.text,
    /## Still running or queued\n\n- `e2e-chromium-odd`/
  )
  assert.match(output.text, /`db` — requires privileged-daemon/)
  assert.doesNotMatch(output.text, /Log digest/)
  const done = renderProgressOutput(
    progress({
      lanes: progress().lanes.map((lane) => lane ?? progress().lanes[0]),
    }),
    contract
  )
  assert.match(done.text, /## Still running or queued\n\nNone\./)
})

test("the progress output goes through the same redaction and proof as the final summary", () => {
  const leaked = renderProgressOutput(
    progress({
      hostedOnly: [
        {
          laneId: "db",
          reason:
            "LOCAL_CI_GITHUB_APP_PRIVATE_KEY and sk_live_0123456789abcdef0123",
        },
      ],
    }),
    contract
  )
  assert.doesNotMatch(leaked.text, /LOCAL_CI_GITHUB_APP_PRIVATE_KEY|sk_live_/)
  assert.match(leaked.text, /\[redacted\]/)
})

test("lane progress updates the open check in place and skips a check that never opened", async () => {
  const updates = []
  const github = {
    updateCheckRun: async (id, payload) => updates.push({ id, payload }),
  }
  assert.equal(
    await publishLaneProgress({
      github,
      contract,
      checkRunId: null,
      progress: progress(),
    }),
    false
  )
  assert.equal(
    await publishLaneProgress({
      github,
      contract,
      checkRunId: 77,
      progress: progress(),
    }),
    true
  )
  assert.equal(updates.length, 1)
  assert.equal(updates[0].id, 77)
  assert.equal(updates[0].payload.status, "in_progress")
  assert.equal(updates[0].payload.conclusion, undefined)
})
