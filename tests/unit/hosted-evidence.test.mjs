import assert from "node:assert/strict"
import { withCheckoutProof } from "../helpers/checkout-proof.mjs"
import { readFileSync } from "node:fs"
import { test } from "node:test"

import { compareShadowEvidence } from "../../ops/local-ci/core/shadow-qualification.mjs"
import {
  CI_WORKFLOW_PATH,
  CONTRACT_PATH,
  REPO_ROOT,
  SINGLE_SHARD,
  buildHostedEvidence,
  buildLaneIndex,
  collectHostedEvidence,
  laneCountsFromLogs,
  main,
  readAtSha,
  resolveRepository,
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

const contract = JSON.parse(readFileSync(CONTRACT_PATH, "utf8"))
const workflowText = readFileSync(CI_WORKFLOW_PATH, "utf8")
const laneIds = Object.keys(contract.shadowMode.qualification.lanes)
const HEAD_SHA = "d5f5c36417efd114117ca75eb5e7866b9a7ac06d"
const PROJECTS = [
  "chromium",
  "mobile-safari",
  "desktop-firefox",
  "desktop-safari",
]

/**
 * The hosted fan-out ci.yml declares. Named rather than repeated so that a
 * regrouping of the same tests - four packs of eight /32 shards instead of
 * eight of four, four accessibility shards instead of eight - is a one-line
 * fixture change and cannot quietly leave an assertion counting the old shape.
 */
const E2E_PACKS = 4
const A11Y_SHARDS = 4
const VISUAL_SHARDS = 4
const NON_LANE_JOBS = 21
const TOTAL_JOBS =
  3 + PROJECTS.length * E2E_PACKS + 2 * (A11Y_SHARDS + VISUAL_SHARDS) + 13

const run = {
  id: 34290952137,
  run_attempt: 1,
  status: "completed",
  conclusion: "success",
  head_sha: HEAD_SHA,
  head_branch: "main",
  event: "push",
  path: CI_WORKFLOW_PATH,
  repository: { full_name: "lapeninns/nabaperks" },
  head_repository: { full_name: "lapeninns/nabaperks" },
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

/**
 * The quality job's steps, in the order and under the names the Actions API
 * reports them for run 34290952137. The hygiene sweep is one step; the four
 * that follow are the print-kit lane, so this fixture is what lets the two
 * lanes be told apart from one hosted job.
 */
const QUALITY_WORKLOAD_STEPS = [
  "Set up job",
  "Run actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1",
  "Run ./.github/actions/setup",
  "Run shared quality validation commands",
  "Install PDF QA tooling",
  "Install Chromium for production print-kit rendering",
  "Verify pdf-lib poster geometry",
  "Verify production preview print-kit PDFs",
]
const QUALITY_TEARDOWN_STEPS = [
  "Post Install Chromium for production print-kit rendering",
  "Post Run ./.github/actions/setup",
  "Post Run actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1",
  "Complete job",
]

/**
 * That step list once `failedStep` has failed. A step the runner never reached
 * is absent from the API's list rather than reported as skipped, which is how
 * a hygiene failure hides the print-kit steps; teardown still runs.
 */
function qualityJobSteps(failedStep = null) {
  const stopAt =
    failedStep === null
      ? QUALITY_WORKLOAD_STEPS.length
      : QUALITY_WORKLOAD_STEPS.indexOf(failedStep) + 1
  assert.ok(stopAt > 0, `unknown quality step ${failedStep}`)
  return [
    ...QUALITY_WORKLOAD_STEPS.slice(0, stopAt),
    ...QUALITY_TEARDOWN_STEPS,
  ].map((name, index) => ({
    name,
    number: index + 1,
    status: "completed",
    conclusion: name === failedStep ? "failure" : "success",
  }))
}

/** The quality job as the run reports it, optionally with one step failed. */
function withQualityFailure(fixture, failedStep) {
  const job = fixture.jobs.find(
    (candidate) => candidate.name === "Quality lane (hygiene sweeps)"
  )
  job.conclusion = "failure"
  job.steps = qualityJobSteps(failedStep)
  return fixture
}

/** The 48 jobs a complete CI run publishes, with the logs the lane jobs wrote. */
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
  add("Quality lane (hygiene sweeps)", null, { steps: qualityJobSteps() })
  add("DB behavioral moat", nodeTestLog(singleLaneTotal("db")))
  for (const project of PROJECTS) {
    for (let pack = 1; pack <= E2E_PACKS; pack += 1) {
      add(
        `E2E (${project}, pack ${pack})`,
        playwrightLog(shardTally(`e2e-${project}`, E2E_PACKS))
      )
    }
  }
  for (const project of ["chromium", "mobile-safari"]) {
    for (let shard = 1; shard <= A11Y_SHARDS; shard += 1) {
      add(
        `Accessibility (${project}, shard ${shard}/${A11Y_SHARDS})`,
        playwrightLog(shardTally(`a11y-${project}`, A11Y_SHARDS))
      )
    }
    for (let shard = 1; shard <= VISUAL_SHARDS; shard += 1) {
      add(`Visual regression (${project}, shard ${shard}/${VISUAL_SHARDS})`)
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
  withCheckoutProof(
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
  )

const laneOf = (document, laneId) =>
  document.lanes.find((lane) => lane.laneId === laneId)

test("the lane index derives its fan-out from the ci.yml matrix", () => {
  const index = buildLaneIndex(workflowText, laneIds)
  assert.deepEqual([...index.expected.keys()].sort(), [...laneIds].sort())
  assert.deepEqual(
    [...index.expected.get("e2e-chromium").shards],
    ["1", "2", "3", "4"]
  )
  assert.deepEqual(
    [...index.expected.get("a11y-mobile-safari").shards],
    ["1/4", "2/4", "3/4", "4/4"]
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
  assert.equal(document.provider.jobCount, TOTAL_JOBS)
  assert.equal(document.nonLaneJobs.length, NON_LANE_JOBS)

  const tally = shardTally("e2e-chromium", E2E_PACKS)
  const chromium = laneOf(document, "e2e-chromium")
  assert.equal(chromium.shards.length, E2E_PACKS)
  assert.equal(chromium.testsRun, (tally.passed + tally.skipped) * E2E_PACKS)
  assert.equal(chromium.testsPassed, tally.passed * E2E_PACKS)
  assert.equal(chromium.testsSkipped, tally.skipped * E2E_PACKS)
  assert.equal(chromium.countsParsed, true)
  assert.equal(chromium.countsExpected, true)
  assert.deepEqual(chromium.countSources, ["playwright"])
  assert.equal(chromium.jobIds.length, E2E_PACKS)
  assert.equal(new Set(chromium.jobIds).size, E2E_PACKS)

  assert.equal(laneOf(document, "fast").testsRun, singleLaneTotal("fast"))
  assert.equal(laneOf(document, "db").testsRun, singleLaneTotal("db"))
  const a11y = shardTally("a11y-chromium", A11Y_SHARDS)
  assert.equal(
    laneOf(document, "a11y-chromium").testsRun,
    (a11y.passed + a11y.skipped) * A11Y_SHARDS
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
      (job) => job.name === "Accessibility (chromium, shard 2/4)"
    )
    Object.assign(shard, overrides)
    assert.throws(
      () => build(fixture),
      /a11y-chromium shard 2\/4/,
      JSON.stringify(overrides)
    )
  }
})

test("counts unavailable for one shard make the whole lane unavailable", () => {
  const fixture = hostedRun()
  const shard = fixture.jobs.find(
    (job) => job.name === "E2E (chromium, pack 3)"
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
    fixture.jobs.find((job) => job.name === "E2E (chromium, pack 3)").id
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
  const packs = shardTally("e2e-chromium", E2E_PACKS)
  assert.equal(
    laneOf(document, "e2e-chromium").testsRun,
    (packs.passed + packs.skipped) * E2E_PACKS
  )
  // Logs are read only for the lanes that have counts to read: the fast and
  // DB lanes plus every e2e pack and accessibility shard.
  assert.equal(
    requested.filter((path) => path.endsWith("/logs")).length,
    2 + PROJECTS.length * E2E_PACKS + 2 * A11Y_SHARDS
  )
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

test("evidence from anywhere but the pinned repository is refused", () => {
  // A fork's Actions configuration is outside the trust boundary, and nothing
  // downstream inspects provider.repository, so the refusal belongs here.
  assert.throws(
    () => build(hostedRun(), { repository: "someone/nabaperks-fork" }),
    /must come from the pinned repository lapeninns\/nabaperks/
  )
  assert.equal(
    build(hostedRun()).provider.repository,
    contract.repository,
    "the pinned repository is what provenance records"
  )
  assert.throws(
    () =>
      build(hostedRun(), {
        run: { ...run, repository: { full_name: "someone/nabaperks-fork" } },
      }),
    /pinned repository/
  )
  assert.throws(
    () =>
      build(hostedRun(), {
        run: { ...run, path: ".github/workflows/local-ci-shadow.yml" },
      }),
    /pinned repository, workflow/
  )
})

test("--repo may restate the pinned repository and never redirect", () => {
  assert.equal(
    resolveRepository({ contract, requested: undefined }),
    contract.repository
  )
  assert.equal(
    resolveRepository({ contract, requested: contract.repository }),
    contract.repository
  )
  assert.throws(
    () => resolveRepository({ contract, requested: "someone/nabaperks-fork" }),
    /--repo may only restate the pinned repository lapeninns\/nabaperks/
  )
  assert.throws(
    () => resolveRepository({ contract: {}, requested: undefined }),
    /independently pinned repository/
  )
})

test("the two lanes sharing the quality job get their own steps' status", () => {
  const hygieneFailed = build(
    withQualityFailure(hostedRun(), "Run shared quality validation commands")
  )
  assert.equal(laneOf(hygieneFailed, "quality").status, "failure")
  // The print-kit steps never ran, so the lane did not run; charging it with
  // the hygiene failure would misattribute a failure whose steps all passed.
  const printKit = laneOf(hygieneFailed, "print-kit")
  assert.equal(printKit.status, "skipped")
  assert.deepEqual(
    printKit.shards[0].steps.map((step) => step.conclusion),
    [null, null, null, null]
  )

  // The mirror image: the sweeps passed and the PDF proof did not.
  const proofFailed = build(
    withQualityFailure(hostedRun(), "Verify production preview print-kit PDFs")
  )
  assert.equal(laneOf(proofFailed, "quality").status, "success")
  assert.equal(laneOf(proofFailed, "print-kit").status, "failure")
  assert.equal(proofFailed.conclusion, "failure")
  assert.deepEqual(laneOf(proofFailed, "quality").shards[0].steps, [
    { name: "Run shared quality validation commands", conclusion: "success" },
  ])

  // The tooling installs belong to the lane that needs them.
  const toolingFailed = build(
    withQualityFailure(hostedRun(), "Install PDF QA tooling")
  )
  assert.equal(laneOf(toolingFailed, "quality").status, "success")
  assert.equal(laneOf(toolingFailed, "print-kit").status, "failure")
})

test("a hygiene failure is not reported as a print-kit divergence", () => {
  const passing = build(hostedRun())
  const local = {
    ...passing,
    plane: "local",
    lanes: passing.lanes.map((lane) => ({ ...lane, plane: "local" })),
  }
  const comparison = compareShadowEvidence({
    contract,
    headSha: HEAD_SHA,
    profile: "main",
    local,
    hosted: build(
      withQualityFailure(hostedRun(), "Run shared quality validation commands")
    ),
    publishedDurationSeconds: 1200,
  })
  const laneVerdict = (laneId) =>
    comparison.lanes.find((lane) => lane.laneId === laneId)
  assert.deepEqual(laneVerdict("print-kit").reasons, ["lane did not run"])
  assert.equal(laneVerdict("print-kit").verdict, "incomplete")
  // The lane that did fail is still reported as a mismatch, on its own steps.
  assert.deepEqual(laneVerdict("quality").reasons, ["status mismatch"])
  assert.equal(laneVerdict("quality").verdict, "divergent")
})

test("a split lane whose steps cannot be read refuses", () => {
  const qualityJob = (fixture) =>
    fixture.jobs.find((job) => job.name === "Quality lane (hygiene sweeps)")

  const noSteps = hostedRun()
  delete qualityJob(noSteps).steps
  assert.throws(() => build(noSteps), /carries no step list/)

  const missingStep = hostedRun()
  const job = qualityJob(missingStep)
  job.steps = job.steps.filter(
    (step) => step.name !== "Verify pdf-lib poster geometry"
  )
  assert.throws(
    () => build(missingStep),
    /concluded success without running step "Verify pdf-lib poster geometry"/
  )

  const cancelledStep = hostedRun()
  qualityJob(cancelledStep).steps = qualityJobSteps().map((step) =>
    step.name === "Install PDF QA tooling"
      ? { ...step, conclusion: "cancelled" }
      : step
  )
  assert.throws(
    () => build(cancelledStep),
    /step "Install PDF QA tooling" concluded "cancelled"/
  )
})

test("a renamed ci.yml step refuses instead of reading as a lane that did not run", () => {
  const renamed = workflowText.replace(
    "      - name: Verify pdf-lib poster geometry",
    "      - name: Verify poster geometry"
  )
  assert.notEqual(renamed, workflowText)
  assert.throws(
    () => buildLaneIndex(renamed, laneIds),
    /declares no step "Verify pdf-lib poster geometry", which lane print-kit is derived from/
  )
})

test("the workflow and the contract are read out of git at the evidence SHA", async () => {
  const requested = []
  const exec = async (file, args) => {
    requested.push([file, ...args])
    return { stdout: "{}" }
  }
  await readAtSha({ sha: HEAD_SHA, path: CONTRACT_PATH, exec })
  await readAtSha({ sha: HEAD_SHA, path: CI_WORKFLOW_PATH, exec })
  assert.deepEqual(requested, [
    ["git", "-C", REPO_ROOT, "show", `${HEAD_SHA}:${CONTRACT_PATH}`],
    ["git", "-C", REPO_ROOT, "show", `${HEAD_SHA}:${CI_WORKFLOW_PATH}`],
  ])

  // Real git, so this is the refusal an operator actually meets, and the
  // contract that comes back is the committed one rather than the checkout's.
  await assert.rejects(
    readAtSha({ sha: "0".repeat(40), path: CONTRACT_PATH }),
    (error) => {
      assert.match(error.message, /cannot read config\/local-ci-contract\.json/)
      assert.match(error.message, /git fetch origin 0{40}/)
      return true
    }
  )
  const committed = JSON.parse(
    await readAtSha({ sha: "HEAD", path: CONTRACT_PATH })
  )
  assert.equal(committed.repository, contract.repository)
})

test("the CLI reads its policy at --sha and cannot be pointed at a fork", async () => {
  const fixture = hostedRun()
  const reader = {
    json: async (path) =>
      path.includes("/jobs?")
        ? { total_count: fixture.jobs.length, jobs: fixture.jobs }
        : run,
    text: async () => {
      throw new Error("no log")
    },
  }
  const requested = []
  const readAtShaImpl = async ({ sha, path }) => {
    requested.push(`${sha}:${path}`)
    return path === CONTRACT_PATH ? JSON.stringify(contract) : workflowText
  }
  const written = []
  const argv = [
    "--sha",
    HEAD_SHA,
    "--run-id",
    String(run.id),
    "--profile",
    "main",
    "--no-logs",
    "--out",
    "hosted-evidence.json",
  ]
  const code = await main(argv, {
    readAtShaImpl,
    writeFileImpl: async (path, json) => written.push([path, json]),
    reader,
  })
  assert.equal(code, 0)
  assert.deepEqual(requested.sort(), [
    `${HEAD_SHA}:${CI_WORKFLOW_PATH}`,
    `${HEAD_SHA}:${CONTRACT_PATH}`,
  ])
  const document = JSON.parse(written[0][1])
  assert.equal(document.headSha, HEAD_SHA)
  assert.equal(document.provider.repository, contract.repository)

  await assert.rejects(
    main([...argv, "--repo", "someone/nabaperks-fork"], {
      readAtShaImpl,
      writeFileImpl: async () => {},
      reader,
    }),
    /--repo may only restate the pinned repository/
  )
})

test("a split job that fails outside every lane's steps cannot be attributed", () => {
  const fixture = hostedRun()
  const job = fixture.jobs.find(
    (candidate) => candidate.name === "Quality lane (hygiene sweeps)"
  )
  // A checkout failure: no step any lane claims ever ran, so neither lane can
  // carry the failure and the run must not report a clean success instead.
  job.conclusion = "failure"
  job.steps = [
    {
      name: "Set up job",
      number: 1,
      status: "completed",
      conclusion: "success",
    },
    {
      name: "Run actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1",
      number: 2,
      status: "completed",
      conclusion: "failure",
    },
    {
      name: "Complete job",
      number: 3,
      status: "completed",
      conclusion: "success",
    },
  ]
  assert.throws(
    () => build(fixture),
    /concluded failure, but no lane it carries reports a failure/
  )
})

test("a candidate cannot move the verifier repository pin to a fork", () => {
  const candidate = structuredClone(contract)
  candidate.repository = "someone/nabaperks-fork"
  assert.throws(
    () => resolveRepository({ contract: candidate }),
    /independently pinned repository/
  )
  assert.throws(
    () =>
      build(hostedRun(), {
        contract: candidate,
        repository: candidate.repository,
      }),
    /pinned repository/
  )
})

test("hosted profile identity requires the matching event and canonical main branch", () => {
  assert.throws(() => build(hostedRun(), { profile: "pr" }), /event and branch/)
  assert.throws(
    () => build(hostedRun(), { run: { ...run, head_branch: "codex/feature" } }),
    /event and branch/
  )
  assert.throws(
    () => build(hostedRun(), { run: { ...run, event: "workflow_dispatch" } }),
    /event and branch/
  )
  assert.throws(
    () =>
      build(hostedRun(), {
        run: { ...run, head_repository: { full_name: "someone/fork" } },
      }),
    /pinned repository/
  )
  const pr = build(hostedRun(), {
    profile: "pr",
    run: { ...run, event: "pull_request", head_branch: "codex/feature" },
  })
  assert.equal(pr.provider.event, "pull_request")
  assert.equal(pr.provider.headBranch, "codex/feature")
  assert.equal(pr.provider.headSha, HEAD_SHA)
})

test("coloured hosted Playwright and node tallies retain their counts", () => {
  const counts = laneCountsFromLogs({
    kind: "tests",
    status: "success",
    logs: [
      stamped([
        "\u001b[32m  8 passed\u001b[0m (41s)",
        "\u001b[36m  2 skipped\u001b[0m",
      ]),
      stamped([
        "\u001b[32mℹ tests 4\u001b[0m",
        "ℹ pass 4",
        "ℹ fail 0",
        "ℹ skipped 0",
        "ℹ todo 0",
      ]),
    ],
  })
  assert.equal(counts.testsRun, 14)
  assert.equal(counts.testsPassed, 12)
  assert.equal(counts.testsSkipped, 2)
  assert.equal(counts.countsParsed, true)
})
