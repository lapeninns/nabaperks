import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { decideAgentLiveness } from "../../ops/local-ci/core/agent-liveness.mjs"
import { createGitHubHeartbeat } from "../../ops/local-ci/agent/github-heartbeat.mjs"
import { checkAgentLiveness } from "../../scripts/check-agent-liveness.mjs"

const contract = JSON.parse(
  readFileSync("config/local-ci-contract.json", "utf8")
)
const now = Date.parse("2026-09-05T12:00:00Z")
const heartbeat = (changes = {}) => ({
  id: 123,
  name: contract.agentLiveness.checkName,
  head_sha: contract.agentLiveness.anchorSha,
  app: { id: contract.githubApp.appId, slug: "nabaperks-local-ci" },
  status: "completed",
  conclusion: "success",
  completed_at: new Date(now).toISOString(),
  ...changes,
})

test("heartbeat requires fresh successful evidence from the pinned App and anchor", () => {
  assert.equal(
    decideAgentLiveness({ runs: [heartbeat()], contract, now }).fresh,
    true
  )
  for (const changes of [
    { completed_at: new Date(now - 20 * 60_000 - 1).toISOString() },
    { completed_at: new Date(now + 60_001).toISOString() },
    { completed_at: null },
    { completed_at: "invalid" },
    { status: "in_progress" },
    { conclusion: "failure" },
    { app: { id: 1, slug: "nabaperks-local-ci" } },
    { app: { id: contract.githubApp.appId, slug: "github-actions" } },
    { head_sha: "a".repeat(40) },
    { name: "Nabaperks Local CI" },
  ])
    assert.equal(
      decideAgentLiveness({ runs: [heartbeat(changes)], contract, now }).fresh,
      false,
      JSON.stringify(changes)
    )
  assert.equal(decideAgentLiveness({ runs: [], contract, now }).fresh, false)
  assert.equal(
    decideAgentLiveness({
      runs: [
        heartbeat({ completed_at: new Date(now - 20 * 60_000).toISOString() }),
      ],
      contract,
      now,
    }).fresh,
    true
  )
  assert.throws(() =>
    decideAgentLiveness({
      runs: [],
      contract: { ...contract, githubApp: { appId: null } },
      now,
    })
  )
})

test("publisher keeps a single check, respects cadence, and recovers from API failure", async () => {
  let clock = now
  const calls = []
  let fail = false
  const publisher = createGitHubHeartbeat({
    contract,
    now: () => clock,
    github: {
      createCheckRun: async (args) => {
        calls.push(["create", args])
        return { id: 12 }
      },
      updateCheckRun: async (id, args) => {
        calls.push(["update", id, args])
        if (fail) throw new Error("secret")
      },
    },
  })
  assert.equal((await publisher.ping()).sent, true)
  assert.equal((await publisher.ping()).sent, false)
  clock += 5 * 60_000
  assert.equal((await publisher.ping()).sent, true)
  assert.equal(calls[1][1], 12)
  assert.equal(calls[0][1].headSha, contract.agentLiveness.anchorSha)
  clock += 5 * 60_000
  fail = true
  assert.equal((await publisher.ping()).sent, false)
  assert.equal((await publisher.ping()).sent, true)
  assert.deepEqual(
    calls.map((c) => c[0]),
    ["create", "update", "update", "create"]
  )
})

test("reader authenticates only to GitHub and scans past spoofed first-page runs", async () => {
  const urls = []
  const result = await checkAgentLiveness({
    contract,
    token: "test-token",
    now,
    fetchImpl: async (url, options) => {
      urls.push(url)
      assert.equal(url.origin, "https://api.github.com")
      assert.equal(options.redirect, "error")
      assert.equal(options.headers.authorization, "Bearer test-token")
      return {
        ok: true,
        json: async () => ({
          check_runs:
            urls.length === 1
              ? Array.from({ length: 100 }, () => heartbeat({ app: null }))
              : [heartbeat()],
        }),
      }
    },
  })
  assert.equal(result.fresh, true)
  assert.equal(urls[1].searchParams.get("page"), "2")
  assert.ok(urls[0].pathname.includes("lapeninns/nabaperks/commits/"))
  for (const response of [
    { ok: false, status: 403 },
    { ok: true, json: async () => ({}) },
  ]) {
    await assert.rejects(
      checkAgentLiveness({
        contract,
        token: "test-token",
        fetchImpl: async () => response,
      })
    )
  }
})
