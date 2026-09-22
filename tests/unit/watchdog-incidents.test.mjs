import assert from "node:assert/strict"
import { test } from "node:test"
import { reconcileWatchdogIncidents } from "../../scripts/watchdog-incidents.mjs"

// agent-watchdog.yml observes only the local CI plane and production health;
// it reports the nightly monitors as unobserved, exactly as the workflow does.
const NIGHTLY_UNOBSERVED = Object.freeze({ nightly: null, mutation: null })
// nightly.yml observes only its own jobs and leaves the other monitors alone.
const WATCHDOG_UNOBSERVED = Object.freeze({
  heartbeat: null,
  publicHealth: null,
})

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
  const failed = { heartbeat: false, publicHealth: true, ...NIGHTLY_UNOBSERVED }
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
    healthy: { heartbeat: true, publicHealth: true, ...NIGHTLY_UNOBSERVED },
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
    healthy: { heartbeat: false, publicHealth: false, ...NIGHTLY_UNOBSERVED },
  })
  assert.equal(writes.length, 2)
  await reconcileWatchdogIncidents({
    ...options,
    healthy: { heartbeat: true, publicHealth: true, ...NIGHTLY_UNOBSERVED },
  })
  assert.equal(issues[0].state, "open")
  assert.equal(writes.filter(([operation]) => operation === "update").length, 2)
})

test("unusable inputs and provider listing failures cannot create duplicate or false recovery alerts", async () => {
  const { options, writes } = fixture()
  const valid = {
    ...options,
    healthy: { heartbeat: true, publicHealth: true, ...NIGHTLY_UNOBSERVED },
  }
  for (const input of [
    {
      healthy: {
        heartbeat: "false",
        publicHealth: true,
        ...NIGHTLY_UNOBSERVED,
      },
    },
    // Omitting a monitor is not the same as reporting it unobserved.
    { healthy: { heartbeat: true, publicHealth: true } },
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

test("a paused monitor neither opens an incident nor closes a standing one", async () => {
  // Pausing the local CI plane is a deliberate operator action, not an
  // outage: `null` says nobody looked. It must not open an incident, and it
  // must not close one either, because closing asserts a recovery that no
  // observation supports. Production health is a separate monitor and keeps
  // reporting normally while the local one is paused.
  const { options, issues, writes } = fixture()

  let results = await reconcileWatchdogIncidents({
    ...options,
    healthy: { heartbeat: null, publicHealth: true, ...NIGHTLY_UNOBSERVED },
  })
  assert.equal(results[0].monitor, "heartbeat")
  assert.equal(results[0].state, "not monitored")
  assert.equal(results[0].action, "none")
  assert.equal(writes.length, 0, "an unmonitored component writes nothing")
  assert.equal(issues.length, 0)

  // A standing incident survives the monitor being switched off.
  await reconcileWatchdogIncidents({
    ...options,
    healthy: { heartbeat: false, publicHealth: true, ...NIGHTLY_UNOBSERVED },
  })
  assert.equal(issues.length, 1)
  assert.equal(issues[0].state, "open")

  results = await reconcileWatchdogIncidents({
    ...options,
    healthy: { heartbeat: null, publicHealth: true, ...NIGHTLY_UNOBSERVED },
  })
  assert.equal(results[0].state, "not monitored")
  assert.equal(results[0].issue, 1, "the standing incident is still named")
  assert.equal(issues[0].state, "open", "pausing is not a recovery")

  // Production health still opens its own incident while local CI is paused.
  results = await reconcileWatchdogIncidents({
    ...options,
    healthy: { heartbeat: null, publicHealth: false, ...NIGHTLY_UNOBSERVED },
  })
  const publicResult = results.find((row) => row.monitor === "publicHealth")
  assert.equal(publicResult.action, "opened")

  // A non-boolean that is not null is still rejected.
  await assert.rejects(
    () =>
      reconcileWatchdogIncidents({
        ...options,
        healthy: {
          heartbeat: "paused",
          publicHealth: true,
          ...NIGHTLY_UNOBSERVED,
        },
      }),
    /Every watchdog observation is required/
  )
})

test("a failed nightly opens one standing issue, repeats stay silent and the first green run closes it", async () => {
  const { options, issues, writes } = fixture()
  const nightly = (healthy) => ({
    ...options,
    healthy: { ...WATCHDOG_UNOBSERVED, nightly: healthy, mutation: null },
  })

  let results = await reconcileWatchdogIncidents(nightly(false))
  const opened = results.find((row) => row.monitor === "nightly")
  assert.equal(opened.action, "opened")
  assert.equal(writes.length, 1, "exactly one issue is opened")
  const [operation, fields] = writes[0]
  assert.equal(operation, "create")
  assert.equal(fields.title, "[Watchdog] Nightly QA hardening failed")
  assert.ok(fields.body.startsWith("<!-- nabaperks-watchdog:nightly:v1 -->"))
  assert.match(
    fields.body,
    /First observed: https:\/\/github\.com\/lapeninns\/nabaperks\/actions\/runs\/123/
  )
  assert.match(fields.body, /actions\/workflows\/nightly\.yml/)
  assert.match(fields.body, /docs\/operations\/nightly\.md/)
  assert.doesNotMatch(
    fields.body,
    /agent-watchdog\.yml|local-ci-watchdog\.md|heartbeat/
  )
  assert.deepEqual(fields.assignees, ["lapeninns"])

  results = await reconcileWatchdogIncidents(nightly(false))
  const repeated = results.find((row) => row.monitor === "nightly")
  assert.equal(repeated.action, "unchanged")
  assert.equal(repeated.issue, opened.issue)
  assert.equal(
    writes.length,
    1,
    "a repeated failure sends no issue, update or comment"
  )

  const recoveryUrl = "https://github.com/lapeninns/nabaperks/actions/runs/456"
  results = await reconcileWatchdogIncidents({
    ...nightly(true),
    runUrl: recoveryUrl,
  })
  assert.equal(
    results.find((row) => row.monitor === "nightly").action,
    "closed"
  )
  assert.equal(writes.length, 2)
  assert.equal(writes[1][0], "update")
  assert.equal(writes[1][1].state_reason, "completed")
  assert.equal(issues.length, 1, "recovery closes the same issue")
  assert.equal(issues[0].state, "closed")
  assert.match(issues[0].body, new RegExp(`Recovery observed: ${recoveryUrl}$`))

  // No other monitor acted during the nightly-only observations.
  for (const monitor of ["heartbeat", "publicHealth", "mutation"])
    assert.equal(results.find((row) => row.monitor === monitor).action, "none")
})

test("nightly observations never open or close the local CI and production incidents", async () => {
  const { options, issues, writes } = fixture()
  await reconcileWatchdogIncidents({
    ...options,
    healthy: { heartbeat: false, publicHealth: false, ...NIGHTLY_UNOBSERVED },
  })
  assert.equal(issues.length, 2)
  for (const issue of issues) {
    assert.match(issue.body, /actions\/workflows\/agent-watchdog\.yml/)
    assert.match(
      issue.body,
      /Follow docs\/operations\/local-ci-watchdog\.md\.$/
    )
  }

  const results = await reconcileWatchdogIncidents({
    ...options,
    healthy: { ...WATCHDOG_UNOBSERVED, nightly: true, mutation: true },
  })
  assert.equal(writes.length, 2, "a green nightly run writes nothing to them")
  assert.ok(issues.every((issue) => issue.state === "open"))
  for (const monitor of ["heartbeat", "publicHealth"]) {
    const row = results.find((entry) => entry.monitor === monitor)
    assert.equal(row.state, "not monitored")
    assert.equal(row.action, "none")
  }
})

test("weekly mutation testing has its own incident and a run that skips it is not a recovery", async () => {
  const { options, issues, writes } = fixture()
  const observe = (nightly, mutation) =>
    reconcileWatchdogIncidents({
      ...options,
      healthy: { ...WATCHDOG_UNOBSERVED, nightly, mutation },
    })

  let results = await observe(true, false)
  assert.equal(
    results.find((row) => row.monitor === "mutation").action,
    "opened"
  )
  assert.equal(results.find((row) => row.monitor === "nightly").action, "none")
  assert.equal(writes.length, 1)
  assert.equal(writes[0][1].title, "[Watchdog] Weekly mutation testing failed")
  assert.ok(
    writes[0][1].body.startsWith("<!-- nabaperks-watchdog:mutation:v1 -->")
  )
  assert.match(writes[0][1].body, /docs\/operations\/nightly\.md/)

  // A daily run skips mutation testing: it says nothing about that job.
  results = await observe(true, null)
  const skipped = results.find((row) => row.monitor === "mutation")
  assert.equal(skipped.state, "not monitored")
  assert.equal(skipped.action, "none")
  assert.equal(skipped.issue, 1)
  assert.equal(
    issues[0].state,
    "open",
    "a run without mutation is not a recovery"
  )
  assert.equal(writes.length, 1)

  results = await observe(true, true)
  assert.equal(
    results.find((row) => row.monitor === "mutation").action,
    "closed"
  )
  assert.equal(issues[0].state, "closed")
})
