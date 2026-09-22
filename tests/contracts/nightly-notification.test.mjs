import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

const CHECKOUT =
  "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7"
const GITHUB_SCRIPT =
  "actions/github-script@3a2844b7e9c422d3c10d287c895573f7108da1b3 # v9"

function read(path) {
  return readFileSync(path, "utf8")
}

// Split the workflow's `jobs:` map into one text block per job id. The
// workflow is plain two-space YAML, so a job starts at a two-space key.
function jobBlocks(workflow) {
  const body = workflow.slice(
    workflow.indexOf("\njobs:\n") + "\njobs:\n".length
  )
  const starts = [...body.matchAll(/^ {2}([a-z0-9-]+):\n/gm)]
  return new Map(
    starts.map((match, index) => [
      match[1],
      body.slice(match.index, starts[index + 1]?.index ?? body.length),
    ])
  )
}

test("nightly failures reach one read-only-observed, issue-writing notify job", () => {
  const nightly = read(".github/workflows/nightly.yml")
  const jobs = jobBlocks(nightly)

  assert.match(nightly, /\npermissions:\n {2}contents: read\n\n/)
  assert.doesNotMatch(
    nightly,
    /checks: write|actions: write|pull-requests: write/
  )
  assert.equal((nightly.match(/issues: write/g) ?? []).length, 1)

  const issueWriters = [...jobs].filter(([, block]) =>
    block.includes("issues: write")
  )
  assert.deepEqual(
    issueWriters.map(([id]) => id),
    ["notify"],
    "only the notify job may write issues"
  )
  // Every observation job inherits the workflow's contents: read only.
  for (const [id, block] of jobs) {
    if (id === "notify") continue
    assert.doesNotMatch(block, /permissions:/, `${id} keeps contents: read`)
  }

  const notify = jobs.get("notify")
  assert.match(notify, /name: Reconcile nightly incident/)
  assert.match(
    notify,
    /needs: \[cross-browser-gate, mutation, load, zap-full\]/,
    "load-race is gone and the gate stands in for the shard matrix"
  )
  assert.match(
    notify,
    /if: \$\{\{ always\(\) && \(github\.event_name == 'schedule' \|\| github\.event_name == 'workflow_dispatch'\) \}\}/
  )
  assert.match(notify, /timeout-minutes: 2\n/)
  assert.match(notify, /permissions:\n {6}contents: read\n {6}issues: write\n/)
  assert.ok(notify.includes(`uses: ${CHECKOUT}`))
  assert.match(notify, /persist-credentials: false/)
  assert.ok(notify.includes(`uses: ${GITHUB_SCRIPT}`))
  // A superseded run is cancelled by its successor: that is no observation.
  assert.match(notify, /if: \$\{\{ !cancelled\(\) \}\}/)
  assert.match(notify, /scripts\/watchdog-incidents\.mjs/)
  assert.match(notify, /reconcileWatchdogIncidents/)

  // Health comes only from job results, through env indirection.
  assert.match(
    notify,
    /NIGHTLY_HEALTHY: \$\{\{ needs\.cross-browser-gate\.result == 'success' && needs\.load\.result == 'success' && needs\.zap-full\.result == 'success' \}\}/
  )
  // Mutation's weekly skip must never keep the nightly incident open, so the
  // nightly health expression does not read the mutation result at all.
  const nightlyHealth = notify.match(/NIGHTLY_HEALTHY: .*\n/)[0]
  assert.doesNotMatch(nightlyHealth, /mutation/)
  assert.match(
    notify,
    /MUTATION_MONITORED: \$\{\{ needs\.mutation\.result != 'skipped' \}\}/
  )
  assert.match(
    notify,
    /MUTATION_HEALTHY: \$\{\{ needs\.mutation\.result == 'success' \}\}/
  )
  const script = notify.slice(notify.indexOf("script: |"))
  assert.doesNotMatch(script, /\$\{\{/, "no expressions inside the script")
  // The nightly observer never speaks for the local CI or production monitors.
  assert.match(script, /heartbeat: null,/)
  assert.match(script, /publicHealth: null,/)
  assert.match(script, /nightly: process\.env\.NIGHTLY_HEALTHY === 'true',/)
  assert.match(
    script,
    /mutation: process\.env\.MUTATION_MONITORED === 'true' \? process\.env\.MUTATION_HEALTHY === 'true' : null,/
  )
  assert.match(
    script,
    /runUrl: `https:\/\/github\.com\/\$\{context\.repo\.owner\}\/\$\{context\.repo\.repo\}\/actions\/runs\/\$\{context\.runId\}`/
  )
  assert.match(script, /contract\.agentLiveness\.notificationAssignee/)
  assert.equal(
    JSON.parse(read("config/local-ci-contract.json")).agentLiveness
      .notificationAssignee,
    "lapeninns"
  )
})

test("nightly incidents use their own marker, title and runbook", () => {
  const incidents = read("scripts/watchdog-incidents.mjs")
  assert.match(incidents, /nightly: "Nightly QA hardening failed",/)
  assert.match(incidents, /mutation: "Weekly mutation testing failed",/)
  assert.match(incidents, /<!-- nabaperks-watchdog:\$\{kind\}:v1 -->/)
  assert.match(incidents, /workflow: "nightly\.yml",/)
  assert.match(incidents, /runbook: "docs\/operations\/nightly\.md",/)
})

test("the local CI watchdog reports the nightly monitors as unobserved", () => {
  const watchdog = read(".github/workflows/agent-watchdog.yml")
  const alerts = watchdog.slice(watchdog.indexOf("  alerts:"))
  assert.match(alerts, /nightly: null,/)
  assert.match(alerts, /mutation: null,/)
})

test("nightly scope stays cut down: weekly mutation, 16 shards, no race job", () => {
  const nightly = read(".github/workflows/nightly.yml")
  const jobs = jobBlocks(nightly)

  // Monday's run is the only scheduled run that adds mutation testing. The
  // two schedules never fire together, so neither run supersedes the other.
  assert.match(
    nightly,
    /schedule:\n(?: {4}#.*\n)* {4}- cron: "24 2 \* \* 0,2-6"\n(?: {4}#.*\n)* {4}- cron: "24 2 \* \* 1"\n {2}workflow_dispatch:\n/
  )
  assert.doesNotMatch(nightly, /cron: "24 2 \* \* \*"/)
  assert.match(
    jobs.get("mutation"),
    /if: \$\{\{ github\.event_name == 'workflow_dispatch' \|\| github\.event\.schedule == '24 2 \* \* 1' \}\}/
  )
  for (const id of ["cross-browser", "load", "zap-full"])
    assert.doesNotMatch(jobs.get(id), /\n {4}if:/, `${id} runs every night`)

  const shards = jobs.get("cross-browser").match(/\b(\d+)\/(\d+),/g) ?? []
  assert.deepEqual(
    shards,
    Array.from({ length: 16 }, (_, index) => `${index + 1}/16,`)
  )
  assert.match(
    jobs.get("cross-browser"),
    /project: \[chromium, mobile-safari, desktop-firefox, desktop-safari\]/
  )

  assert.equal(jobs.has("load-race"), false)
  assert.doesNotMatch(nightly, /secrets\.|STAMP_RACE|REDEEM_RACE/)
  assert.deepEqual(
    [...jobs.keys()],
    [
      "cross-browser",
      "cross-browser-gate",
      "mutation",
      "load",
      "zap-full",
      "notify",
    ]
  )
})
