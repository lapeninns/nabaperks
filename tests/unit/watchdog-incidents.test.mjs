import assert from "node:assert/strict"
import { test } from "node:test"
import { reconcileWatchdogIncidents } from "../../scripts/watchdog-incidents.mjs"

function fixture() {
  const issues = []
  const writes = []
  const github = {
    rest: {
      issues: {
        listForRepo: async () => ({
          data: issues.filter((issue) => issue.state === "open"),
        }),
        create: async (fields) => {
          writes.push(["create", fields])
          const issue = {
            ...fields,
            number: issues.length + 1,
            state: "open",
            user: { login: "github-actions[bot]", type: "Bot" },
          }
          issues.push(issue)
          return { data: issue }
        },
        update: async (fields) => {
          writes.push(["update", fields])
          Object.assign(
            issues.find((issue) => issue.number === fields.issue_number),
            fields
          )
        },
      },
    },
  }
  return {
    issues,
    writes,
    options: {
      github,
      repository: { owner: "lapeninns", repo: "nabaperks" },
      runUrl: "https://github.com/lapeninns/nabaperks/actions/runs/123",
      assignee: "lapeninns",
    },
  }
}

test("one incident per outage, quiet repeats, recovery close, and new outage notification", async () => {
  const { options, issues, writes } = fixture()
  const failed = { heartbeat: false, publicHealth: true }
  let results = await reconcileWatchdogIncidents({
    ...options,
    healthy: failed,
  })
  assert.equal(results[0].action, "opened")
  assert.deepEqual(writes[0][1].assignees, ["lapeninns"])
  results = await reconcileWatchdogIncidents({ ...options, healthy: failed })
  assert.equal(results[0].action, "unchanged")
  assert.equal(writes.length, 1, "unchanged outage sends no update or comment")
  results = await reconcileWatchdogIncidents({
    ...options,
    healthy: { heartbeat: true, publicHealth: true },
  })
  assert.equal(results[0].action, "closed")
  assert.equal(issues[0].state, "closed")
  assert.match(issues[0].body, /Recovery observed/)
  await reconcileWatchdogIncidents({ ...options, healthy: failed })
  assert.equal(writes.length, 3)
  assert.equal(issues[1].state, "open")
})

test("each monitor alerts independently and human issues are never changed", async () => {
  const { options, issues, writes } = fixture()
  issues.push({
    number: 1,
    state: "open",
    title: "[Watchdog] Local CI agent heartbeat cannot be verified",
    body: "<!-- nabaperks-watchdog:heartbeat:v1 -->",
    user: { login: "lapeninns", type: "User" },
  })
  await reconcileWatchdogIncidents({
    ...options,
    healthy: { heartbeat: false, publicHealth: false },
  })
  assert.equal(writes.length, 2)
  await reconcileWatchdogIncidents({
    ...options,
    healthy: { heartbeat: true, publicHealth: true },
  })
  assert.equal(issues[0].state, "open")
  assert.equal(writes.filter(([operation]) => operation === "update").length, 2)
})

test("unusable inputs and provider listing failures cannot create duplicate or false recovery alerts", async () => {
  const { options, writes } = fixture()
  const valid = { ...options, healthy: { heartbeat: true, publicHealth: true } }
  for (const input of [
    { healthy: { heartbeat: "false", publicHealth: true } },
    { assignee: undefined },
    { repository: { owner: "lapeninns" } },
    { runUrl: "https://example.com/run/123" },
    {
      runUrl:
        "https://user:password@github.com/lapeninns/nabaperks/actions/runs/123",
    },
  ])
    await assert.rejects(reconcileWatchdogIncidents({ ...valid, ...input }))
  options.github.rest.issues.listForRepo = async () => {
    throw new Error("provider unavailable")
  }
  await assert.rejects(reconcileWatchdogIncidents(valid))
  assert.equal(writes.length, 0)
})
