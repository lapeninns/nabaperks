import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

import { compareShadowEvidence } from "../../ops/local-ci/core/shadow-qualification.mjs"
import {
  CI_WORKFLOW_PATH,
  SINGLE_SHARD,
  buildHostedEvidence,
  buildLaneIndex,
  collectHostedEvidence,
  laneCountsFromLogs,
  stripRunnerTimestamps,
} from "../../scripts/ci/hosted-evidence.mjs"

/**
 * The hosted evidence producer, driven offline.
 *
 * The workflow text is the real `.github/workflows/ci.yml`, because the whole
 * value of this tool is that its lane vocabulary tracks the workflow: a matrix
 * that grows a project or a shard must change what these tests expect. The
 * provider is a fake - a job list and a log map - so nothing here touches a
 * network, and the interesting cases are the ones where the producer must
 * refuse rather than emit a document.
 */

const contract = JSON.parse(
  readFileSync("config/local-ci-contract.json", "utf8")
)
const workflowText = readFileSync(CI_WORKFLOW_PATH, "utf8")
const laneIds = Object.keys(contract.shadowMode.qualification.lanes)
const HEAD_SHA = "d5f5c36417efd114117ca75eb5e7866b9a7ac06d"
const PROJECTS = [
  "chromium",
  "mobile-safari",
  "desktop-firefox",
  "desktop-safari",
]

const run = {
  id: 34290952137,
  run_attempt: 1,
  status: "completed",
  conclusion: "success",
  head_sha: HEAD_SHA,
  head_branch: "main",
  html_url: "https://github.com/lapeninns/nabaperks/actions/runs/34290952137",
}

/**
 * A per-shard tally that clears this lane's floor and stays inside its skip
 * ceiling. Derived from the policy rather than written out, so retuning a
 * floor cannot leave this fixture quietly asserting the wrong thing.
 */
function shardTally(laneId, shards) {
  const limit = contract.shadowMode.qualification.lanes[laneId]
  const skipped = Math.floor(limit.maximumSkipped / shards)
  return {
    passed: Math.ceil(limit.minimumTests / shards) - skipped + 1,
    skipped,
  }
}

/** The single-job lanes' node:test totals, one test clear of the floor. */
const singleLaneTotal = (laneId) =>
  contract.shadowMode.qualification.lanes[laneId].minimumTests + 1

const stamped = (lines) =>
  lines.map((line) => `2026-09-08T23:32:28.8206370Z ${line}`).join("\n")

const playwrightLog = ({ passed, skipped }) =>
  stamped([
    "Running tests …",
    `  ${passed} passed (41.1s)`,
    ...(skipped ? [`  ${skipped} skipped`] : []),
  ])

const nodeTestLog = (tests) =>
  stamped([
    `ℹ tests ${tests}`,
    `ℹ pass ${tests}`,
    "ℹ fail 0",
    "ℹ skipped 0",
    "ℹ todo 0",
  ])

/** The 72 jobs a complete CI run publishes, with the logs the lane jobs wrote. */
function hostedRun() {
  const jobs = []
  const logs = new Map()
  let nextId = 100
  const add = (name, log = null, overrides = {}) => {
    const job = {
      id: (nextId += 1),
      name,
      status: "completed",
      conclusion: "success",
      started_at: "2026-09-08T23:30:35Z",
      completed_at: "2026-09-08T23:34:00Z",
      ...overrides,
    }
    jobs.push(job)
    if (log !== null) logs.set(job.id, log)
    return job
  }

  add("Fast lane (lint, typecheck, unit)", nodeTestLog(singleLaneTotal("fast")))
  add("Quality lane (hygiene sweeps)")
  add("DB behavioral moat", nodeTestLog(singleLaneTotal("db")))
  for (const project of PROJECTS) {
    for (let pack = 1; pack <= 8; pack += 1) {
      add(
        `E2E (${project}, pack ${pack})`,
        playwrightLog(shardTally(`e2e-${project}`, 8))
      )
    }
  }
  for (const project of ["chromium", "mobile-safari"]) {
    for (let shard = 1; shard <= 8; shard += 1) {
      add(
        `Accessibility (${project}, shard ${shard}/8)`,
        playwrightLog(shardTally(`a11y-${project}`, 8))
      )
    }
    for (let shard = 1; shard <= 4; shard += 1) {
      add(`Visual regression (${project}, shard ${shard}/4)`)
    }
  }
  for (const route of ["home", "pricing", "loyalty-for-pubs", "signup"]) {
    add(`Lighthouse (${route})`)
  }
  for (const name of [
    "Production build",
    "Typecheck and build",
    "E2E (DB-free harness tier)",
    "Accessibility sweep",
    "Visual regression",
    "Lighthouse CI",
    "ZAP baseline",
    "DB behavioral moat gate",
    "Release gate",
  ]) {
    add(name)
  }
  return { jobs, logs }
}

const build = ({ jobs, logs }, overrides = {}) =>
  buildHostedEvidence({
    contract,
    profile: "main",
    headSha: HEAD_SHA,
    run,
    jobs,
    workflowText,
    logsByJobId: logs,
    ...overrides,
  })

const laneOf = (document, laneId) =>
  document.lanes.find((lane) => lane.laneId === laneId)

test("the lane index derives its fan-out from the ci.yml matrix", () => {
  const index = buildLaneIndex(workflowText, laneIds)
  assert.deepEqual([...index.expected.keys()].sort(), [...laneIds].sort())
  assert.deepEqual(
    [...index.expected.get("e2e-chromium").shards],
    ["1", "2", "3", "4", "5", "6", "7", "8"]
  )
  assert.deepEqual(
    [...index.expected.get("a11y-mobile-safari").shards],
    ["1/8", "2/8", "3/8", "4/8", "5/8", "6/8", "7/8", "8/8"]
  )
  assert.deepEqual([...index.expected.get("db").shards], [SINGLE_SHARD])
  // The hygiene sweeps and the PDF proof share one hosted job.
  assert.equal(index.expected.get("print-kit").jobId, "quality")
})

test("hosted shards aggregate back into one lane per local project", () => {
  const document = build(hostedRun())
  assert.equal(document.plane, "hosted")
  assert.equal(document.schema, contract.evidence.resultSchema)
  assert.equal(document.headSha, HEAD_SHA)
  assert.equal(document.conclusion, "success")
  assert.equal(document.provider.runId, run.id)
  assert.equal(document.provider.jobCount, 72)
  assert.equal(document.nonLaneJobs.length, 21)

  const tally = shardTally("e2e-chromium", 8)
  const chromium = laneOf(document, "e2e-chromium")
  assert.equal(chromium.shards.length, 8)
  assert.equal(chromium.testsRun, (tally.passed + tally.skipped) * 8)
  assert.equal(chromium.testsPassed, tally.passed * 8)
  assert.equal(chromium.testsSkipped, tally.skipped * 8)
  assert.equal(chromium.countsParsed, true)
  assert.equal(chromium.countsExpected, true)
  assert.deepEqual(chromium.countSources, ["playwright"])
  assert.equal(chromium.jobIds.length, 8)
  assert.equal(new Set(chromium.jobIds).size, 8)

  assert.equal(laneOf(document, "fast").testsRun, singleLaneTotal("fast"))
  assert.equal(laneOf(document, "db").testsRun, singleLaneTotal("db"))
  const a11y = shardTally("a11y-chromium", 8)
  assert.equal(
    laneOf(document, "a11y-chromium").testsRun,
    (a11y.passed + a11y.skipped) * 8
  )
  // A command lane reports zero because zero is the truth there, and says so.
  const quality = laneOf(document, "quality")
  assert.equal(quality.testsRun, 0)
  assert.equal(quality.countsExpected, false)
  assert.deepEqual(quality.countSources, ["no-test-command"])
  assert.equal(laneOf(document, "print-kit").sourceJob, "quality")
})

test("a job that cannot be placed refuses the whole document", () => {
  const fixture = hostedRun()
  fixture.jobs.push({
    id: 999,
    name: "Mutation testing (chromium)",
    status: "completed",
    conclusion: "success",
    started_at: run.started_at,
    completed_at: run.completed_at,
  })
  assert.throws(() => build(fixture), /matches no .*ci\.yml job/)
})

test("a shard reported twice refuses rather than inflating the lane", () => {
  const fixture = hostedRun()
  const shard = fixture.jobs.find(
    (job) => job.name === "E2E (chromium, pack 3)"
  )
  fixture.jobs.push({ ...shard, id: shard.id + 500_000 })
  assert.throws(() => build(fixture), /shard 3 is reported by two jobs/)
  assert.throws(
    () => build(fixture),
    /double-counted shard inflates hosted counts/
  )
})

test("a shard the matrix declares and the run omits refuses", () => {
  const fixture = hostedRun()
  fixture.jobs = fixture.jobs.filter(
    (job) => job.name !== "E2E (chromium, pack 3)"
  )
  assert.throws(
    () => build(fixture),
    /lane e2e-chromium is missing hosted shard\(s\) 3/
  )
})

test("a missing required validation root refuses", () => {
  for (const [name, root] of [
    ["Production build", "build"],
    ["ZAP baseline", "zap-baseline"],
    ["Visual regression (chromium, shard 1/4)", "visual"],
  ]) {
    const fixture = hostedRun()
    fixture.jobs = fixture.jobs.filter(
      (job) => !job.name.startsWith(name.split(" (")[0])
    )
    assert.throws(
      () => build(fixture),
      new RegExp(`no job for the required validation root ${root}`),
      name
    )
  }
})

test("an unfinished or uncomparable job outcome refuses", () => {
  for (const overrides of [
    { status: "in_progress", conclusion: null },
    { conclusion: "cancelled" },
    { conclusion: "neutral" },
  ]) {
    const fixture = hostedRun()
    const shard = fixture.jobs.find(
      (job) => job.name === "Accessibility (chromium, shard 2/8)"
    )
    Object.assign(shard, overrides)
    assert.throws(
      () => build(fixture),
      /a11y-chromium shard 2\/8/,
      JSON.stringify(overrides)
    )
  }
})

test("counts unavailable for one shard make the whole lane unavailable", () => {
  const fixture = hostedRun()
  const shard = fixture.jobs.find(
    (job) => job.name === "E2E (chromium, pack 5)"
  )
  fixture.logs.delete(shard.id)
  const lane = laneOf(build(fixture), "e2e-chromium")
  assert.equal(lane.countsParsed, false)
  assert.equal(lane.countsExpected, true)
  for (const field of [
    "testsRun",
    "testsPassed",
    "testsFailed",
    "testsSkipped",
    "flaky",
  ]) {
    assert.equal(lane[field], null, field)
  }
})

test("an unreadable tally is never reported as zero", () => {
  const unreadable = laneCountsFromLogs({
    kind: "tests",
    status: "success",
    logs: ["nothing this parser recognises"],
  })
  assert.equal(unreadable.countsParsed, false)
  assert.equal(unreadable.testsRun, null)
  assert.equal(
    laneCountsFromLogs({ kind: "tests", status: "success", logs: [] }).testsRun,
    null
  )
})

test("the runner's timestamp prefix is removed before the tallies are read", () => {
  assert.equal(
    stripRunnerTimestamps("2026-09-08T23:32:10.9788328Z   9 passed (45.4s)"),
    "  9 passed (45.4s)"
  )
  assert.equal(
    laneCountsFromLogs({
      kind: "tests",
      status: "success",
      logs: ["2026-09-08T23:32:10.9788328Z   9 passed (45.4s)"],
    }).testsRun,
    9
  )
})

test("the emitted document is what compareShadowEvidence reads", () => {
  const hosted = build(hostedRun())
  const local = {
    ...hosted,
    plane: "local",
    lanes: hosted.lanes.map((lane) => ({ ...lane, plane: "local" })),
  }
  const equivalent = compareShadowEvidence({
    contract,
    headSha: HEAD_SHA,
    profile: "main",
    local,
    hosted,
    publishedDurationSeconds: 1200,
  })
  assert.equal(
    equivalent.verdict,
    "equivalent",
    JSON.stringify(equivalent.reasons)
  )

  // The same comparison, with one hosted lane's counts honestly unavailable,
  // must say "cannot assert equivalence" rather than "equivalent".
  const fixture = hostedRun()
  fixture.logs.delete(
    fixture.jobs.find((job) => job.name === "E2E (chromium, pack 5)").id
  )
  const incomplete = compareShadowEvidence({
    contract,
    headSha: HEAD_SHA,
    profile: "main",
    local,
    hosted: build(fixture),
    publishedDurationSeconds: 1200,
  })
  assert.equal(incomplete.verdict, "incomplete")
  assert.ok(
    incomplete.reasons.includes(
      "e2e-chromium: missing machine-readable test counts"
    ),
    JSON.stringify(incomplete.reasons)
  )
})

test("the collector never asks the provider to change anything", async () => {
  const fixture = hostedRun()
  const requested = []
  const reader = {
    json: async (path) => {
      requested.push(path)
      if (path.includes("/jobs?")) {
        return { total_count: fixture.jobs.length, jobs: fixture.jobs }
      }
      return run
    },
    text: async (path) => {
      requested.push(path)
      const id = Number(path.match(/jobs\/(\d+)\/logs/)[1])
      const log = fixture.logs.get(id)
      if (log === undefined) throw new Error("no log")
      return log
    },
  }
  const document = await collectHostedEvidence({
    contract,
    workflowText,
    reader,
    sha: HEAD_SHA,
    runId: run.id,
    profile: "main",
    repository: contract.repository,
  })
  const packs = shardTally("e2e-chromium", 8)
  assert.equal(
    laneOf(document, "e2e-chromium").testsRun,
    (packs.passed + packs.skipped) * 8
  )
  // Logs are read only for the lanes that have counts to read.
  assert.equal(requested.filter((path) => path.endsWith("/logs")).length, 50)
  assert.ok(
    requested.every(
      (path) => !path.includes("rerun") && !path.includes("check-runs")
    )
  )
})

test("a run for another head is never accepted as evidence", () => {
  assert.throws(
    () => build(hostedRun(), { headSha: "a".repeat(40) }),
    /is for head d5f5c364/
  )
  assert.throws(
    () => build(hostedRun(), { profile: "shadow" }),
    /no qualification policy/
  )
})

test("provenance names the repository the run was actually read from", () => {
  // A fork's run must not be filed under the pinned canonical repository.
  const forked = build(hostedRun(), { repository: "someone/nabaperks-fork" })
  assert.equal(forked.provider.repository, "someone/nabaperks-fork")
  assert.equal(
    build(hostedRun()).provider.repository,
    contract.repository,
    "the contract repository stays the default"
  )
  assert.throws(
    () =>
      build(hostedRun(), {
        run: { ...run, repository: { full_name: "someone/nabaperks-fork" } },
      }),
    /belongs to someone\/nabaperks-fork, not lapeninns\/nabaperks/
  )
  assert.throws(
    () =>
      build(hostedRun(), {
        run: { ...run, path: ".github/workflows/local-ci-shadow.yml" },
      }),
    /is a run of \.github\/workflows\/local-ci-shadow\.yml/
  )
})
