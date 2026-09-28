import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import {
  expectedLaneSeconds,
  lanesFit,
  longestFirst,
  median,
  runtimeBudget,
  scheduleLanes,
} from "../../ops/local-ci/core/lane-scheduler.mjs"
import { limaRollback } from "../support/local-ci-contracts.mjs"
import { buildLaneWorkspaceScript } from "../../ops/local-ci/agent/main.mjs"
import { nodeTestArguments } from "../../scripts/ci/node-test-runner.mjs"
import { createRunner } from "../../ops/local-ci/agent/runner.mjs"
import { digestLogBundle } from "../../ops/local-ci/core/digest.mjs"
import {
  command as benchmarkCommand,
  resourceSamplingSummary,
} from "../../ops/local-ci/benchmark.mjs"

// The admission arithmetic below is the Lima rollback's; the Docker Desktop
// runtime's shared-daemon arithmetic is tested at the end of this file.
const committed = JSON.parse(
  readFileSync(new URL("../../config/local-ci-contract.json", import.meta.url))
)
const contract = limaRollback(committed)
const lane = (id, extra = {}) => ({
  id,
  resources: { cpus: 2, memoryGb: 8 },
  concurrencyGroup: null,
  ...extra,
})
const tick = () => new Promise((resolve) => setImmediate(resolve))

test("benchmark sampling and cleanup run real child processes without an abort signal", async () => {
  const argv = [process.execPath, "-e", "process.stdout.write('sample')"]
  assert.equal(await benchmarkCommand(argv, { signal: null }), "sample")
  assert.equal(await benchmarkCommand(argv), "sample")
  await assert.rejects(
    benchmarkCommand(argv, { signal: AbortSignal.abort() }),
    { name: "AbortError" }
  )
})

test("qualification rejects sampler errors and a lane with no resource samples", () => {
  const sample = {
    containers: [{ Name: "nabaperks-ci-job-sha-e2e-chromium-1" }],
  }
  assert.equal(resourceSamplingSummary([sample], ["e2e-chromium"]).valid, true)
  assert.equal(
    resourceSamplingSummary(
      [sample, { error: "signal rejected" }],
      ["e2e-chromium"]
    ).valid,
    false
  )
  assert.equal(
    resourceSamplingSummary([sample], ["e2e-chromium", "e2e-mobile-safari"])
      .valid,
    false
  )
  assert.equal(resourceSamplingSummary([], []).valid, false)
})

test("four real admissions overlap within the VM budget and retain input result order", async () => {
  const lanes = ["a", "b", "c", "d", "e"].map((id) => lane(id))
  const releases = new Map()
  const started = []
  const pending = scheduleLanes({
    lanes,
    contract,
    run: async (entry) => {
      started.push(entry.id)
      await new Promise((resolve) => releases.set(entry.id, resolve))
      return entry.id
    },
  })
  await tick()
  assert.deepEqual(started, ["a", "b", "c", "d"])
  releases.get("c")()
  await tick()
  assert.deepEqual(started, ["a", "b", "c", "d", "e"])
  for (const id of ["e", "d", "b", "a"]) releases.get(id)()
  assert.deepEqual(await pending, {
    results: ["a", "b", "c", "d", "e"],
    peak: 4,
  })
})

test("CPU, aggregate memory, daemon reserve and exclusive services independently constrain admission", () => {
  assert.equal(
    lanesFit([lane("a"), lane("b"), lane("c"), lane("d")], contract),
    true
  )
  assert.equal(
    lanesFit([lane("a"), lane("b"), lane("c"), lane("d"), lane("e")], contract),
    false
  )
  const heavy = lane("heavy", { resources: { cpus: 8, memoryGb: 24 } })
  assert.equal(lanesFit([heavy, lane("a")], contract), true)
  assert.equal(lanesFit([heavy, lane("a"), lane("b")], contract), false)
  assert.equal(
    lanesFit(
      [
        lane("db1", { needsDaemon: true }),
        lane("db2", { needsDaemon: true }),
        lane("a"),
        lane("b"),
      ],
      contract
    ),
    false
  )
  assert.equal(
    lanesFit(
      [
        lane("a", { concurrencyGroup: "supabase-local" }),
        lane("b", { concurrencyGroup: "supabase-local" }),
      ],
      contract
    ),
    false
  )
})

test("a blocked service does not prevent a later independent lane from starting", async () => {
  const started = []
  let release
  const pending = scheduleLanes({
    contract,
    lanes: [
      lane("db1", { concurrencyGroup: "supabase-local" }),
      lane("db2", { concurrencyGroup: "supabase-local" }),
      lane("browser"),
    ],
    run: async (entry) => {
      started.push(entry.id)
      if (entry.id === "db1")
        await new Promise((resolve) => {
          release = resolve
        })
    },
  })
  await tick()
  assert.deepEqual(started, ["db1", "browser"])
  release()
  await pending
  assert.deepEqual(started, ["db1", "browser", "db2"])
})

test("an infrastructure exception drains started siblings before workspace teardown can begin", async () => {
  let release
  let drained = false
  let rejected = false
  const pending = scheduleLanes({
    contract,
    lanes: [lane("broken"), lane("running")],
    run: async (entry) => {
      if (entry.id === "broken") throw new Error("log sink unavailable")
      await new Promise((resolve) => {
        release = resolve
      })
      drained = true
    },
  }).catch((error) => {
    rejected = true
    assert.match(error.message, /log sink/)
  })
  await tick()
  assert.equal(rejected, false)
  release()
  await pending
  assert.equal(drained, true)
  assert.equal(rejected, true)
})

test("invalid resource policy fails before running candidate code", async () => {
  for (const cpus of [0, -1, NaN, Infinity, 11])
    await assert.rejects(
      scheduleLanes({
        contract,
        lanes: [lane("bad", { resources: { cpus, memoryGb: 8 } })],
        run: () => assert.fail("must not run"),
      })
    )
})

test("lane clones have separate paths and Git objects and reject path traversal", () => {
  const sha = "a".repeat(40)
  const input = {
    workspace: `/var/lib/nabaperks-ci/runs/${sha}`,
    headSha: sha,
    remoteUrl: contract.remoteUrl,
  }
  const first = buildLaneWorkspaceScript({ ...input, laneId: "fast" })
  const second = buildLaneWorkspaceScript({ ...input, laneId: "quality" })
  assert.notEqual(first.destination, second.destination)
  assert.match(first.script, /git clone --no-hardlinks --no-checkout/)
  assert.doesNotMatch(first.script, /--shared|--reference|cp -al/)
  assert.throws(() =>
    buildLaneWorkspaceScript({ ...input, laneId: "../elsewhere" })
  )
  assert.throws(() =>
    buildLaneWorkspaceScript({
      ...input,
      workspace: "/other/path",
      laneId: "fast",
    })
  )
})

test("the local Node test cap preserves every original test and coverage argument", () => {
  const args = [
    "--experimental-test-coverage",
    "--test-coverage-lines=80",
    "--test",
    "tests/unit/example.test.mjs",
  ]
  assert.deepEqual(nodeTestArguments(args, "4"), [
    "--test-concurrency=4",
    ...args,
  ])
  assert.deepEqual(nodeTestArguments(args, undefined), args)
  for (const value of ["0", "33", "NaN", "4 --test-only", "1.5"])
    assert.throws(() => nodeTestArguments(args, value))
})

test("runner executes isolated containers concurrently and retains deterministic evidence order", async () => {
  const lanes = ["one", "two", "three", "four", "five"].map((id) => ({
    ...lane(id),
    title: id,
    arch: "any",
    commands: ["pnpm test:unit"],
    teardownCommands: [],
    backgroundServices: [],
    runtimeEnv: [],
    env: {},
    timeoutMinutes: 10,
    continueOnError: false,
  }))
  const releases = new Map()
  const calls = []
  const runner = createRunner({
    contract,
    arch: "arm64",
    workspaceHostPath: "/run/base",
    resolveRuntimeEnv: async () => ({}),
    prepareLaneWorkspace: async (entry) => `/run/lanes/${entry.id}`,
    containerRuntime: {
      withJobContainer: async (options) => {
        calls.push(options)
        await new Promise((resolve) => releases.set(options.laneId, resolve))
        const output = `##local-ci## ${options.laneId}\n`
        options.onOutput(output)
        return { exitCode: 0, output }
      },
    },
  })
  const pending = runner.runProfile({
    profile: {
      profile: "pr",
      lanes,
      baselineEnv: { CI: "1" },
      baselineRuntimeEnv: [],
    },
    headSha: "a".repeat(40),
  })
  await tick()
  assert.equal(calls.length, 4)
  assert.equal(new Set(calls.map((entry) => entry.workspaceHostPath)).size, 4)
  assert.deepEqual(calls[0].resources, { cpus: 2, memoryGb: 8 })
  releases.get("three")()
  await tick()
  assert.equal(calls.length, 5)
  for (const id of ["five", "four", "two", "one"]) releases.get(id)()
  const outcome = await pending
  assert.equal(outcome.peakConcurrentLanes, 4)
  assert.deepEqual(
    outcome.laneResults.map((entry) => entry.laneId),
    lanes.map((entry) => entry.id)
  )
  assert.equal(
    outcome.record.logDigest,
    digestLogBundle(lanes.map((entry) => `##local-ci## ${entry.id}\n`))
  )
})

test("workspace preparation receives the remaining deadline and cannot start a late container", async () => {
  let time = 0
  let preparation
  let containers = 0
  const abort = new AbortController()
  const runner = createRunner({
    contract,
    arch: "arm64",
    now: () => time,
    resolveRuntimeEnv: async () => ({}),
    prepareLaneWorkspace: async (_lane, options) => {
      preparation = options
      time += options.timeoutMs
      return "/run/private"
    },
    containerRuntime: {
      withJobContainer: async () => {
        containers++
        return { exitCode: 0 }
      },
    },
  })
  const outcome = await runner.runProfile({
    headSha: "a".repeat(40),
    signal: abort.signal,
    profile: {
      profile: "pr",
      baselineEnv: { CI: "1" },
      baselineRuntimeEnv: [],
      lanes: [
        lane("one", {
          title: "one",
          arch: "any",
          commands: ["true"],
          teardownCommands: [],
          backgroundServices: [],
          runtimeEnv: [],
          env: {},
          timeoutMinutes: 10,
          continueOnError: false,
        }),
      ],
    },
    writeEnvFile: async () => {
      time += 1234
      return "/env"
    },
  })
  assert.equal(preparation.signal, abort.signal)
  assert.equal(preparation.timeoutMs, Date.parse(outcome.deadlineAt) - 1234)
  assert.equal(containers, 0)
  assert.equal(outcome.deadlineExpired, true)
  assert.equal(outcome.record.conclusion, "timed_out")
})

/* ------------------------------------------- the shared Docker Desktop daemon */

test("the scheduler reads the active runtime's budget", () => {
  assert.deepEqual(runtimeBudget(committed), {
    kind: "docker-desktop",
    cpus: 18,
    memoryGb: 50,
    reserveCpus: 2,
    reserveMemoryGb: 4,
    externalMemoryFloorGb: 6,
    daemonAvailable: false,
  })
  assert.equal(runtimeBudget(contract).kind, "lima")
  assert.equal(runtimeBudget(contract).externalMemoryFloorGb, 0)
  assert.equal(runtimeBudget(contract).daemonAvailable, true)
})

test("other stacks' live memory shrinks admission, never below the floor", () => {
  const five = ["a", "b", "c", "d", "e"].map((id) => lane(id))
  assert.equal(lanesFit(five, committed), true)
  assert.equal(lanesFit(five, committed, { externalMemoryGb: 6 }), true)
  assert.equal(lanesFit(five, committed, { externalMemoryGb: 6.5 }), false)
  assert.equal(
    lanesFit(five.slice(0, 3), committed, { externalMemoryGb: 22 }),
    true
  )
  assert.equal(
    lanesFit(five.slice(0, 4), committed, { externalMemoryGb: 22 }),
    false
  )
  // A nonsense sample is ignored rather than trusted; the floor still holds.
  for (const sample of [-5, Number.NaN, Infinity])
    assert.equal(
      lanesFit([...five, lane("f")], committed, { externalMemoryGb: sample }),
      false
    )
})

test("the longest expected lane is admitted first, with history before timeouts", () => {
  assert.equal(median([]), null)
  assert.equal(median([3, 1, 2]), 2)
  assert.equal(median([4, 1, 2, 3]), 2.5)
  assert.equal(median([5, Number.NaN, -1]), 5)
  assert.equal(expectedLaneSeconds({ timeoutMinutes: 30 }, []), 1800)
  assert.equal(
    expectedLaneSeconds({ timeoutMinutes: 30 }, [900, 100, 800, 700, 600, 1]),
    700
  )
  const lanes = [
    lane("fast", { timeoutMinutes: 20 }),
    lane("quality", { timeoutMinutes: 15 }),
    lane("e2e-a-odd", { timeoutMinutes: 30 }),
    lane("e2e-a-even", { timeoutMinutes: 30 }),
  ]
  assert.deepEqual(
    longestFirst(lanes).map(({ lane: entry }) => entry.id),
    ["e2e-a-odd", "e2e-a-even", "fast", "quality"]
  )
  const history = { quality: 2000, "e2e-a-even": 100 }
  assert.deepEqual(
    longestFirst(lanes, (entry) => history[entry.id] ?? null).map(
      ({ lane: entry, index }) => [entry.id, index]
    ),
    [
      ["quality", 1],
      ["e2e-a-odd", 2],
      ["fast", 0],
      ["e2e-a-even", 3],
    ]
  )
})

test("admission order is longest first while results keep profile order", async () => {
  const lanes = [
    lane("short", { timeoutMinutes: 1 }),
    lane("long", { timeoutMinutes: 60 }),
    lane("middle", { timeoutMinutes: 10 }),
  ]
  const started = []
  const outcome = await scheduleLanes({
    lanes,
    contract: {
      ...committed,
      agent: { ...committed.agent, maxConcurrentLanes: 1 },
    },
    run: async (entry) => {
      started.push(entry.id)
      return entry.id
    },
  })
  assert.deepEqual(started, ["long", "middle", "short"])
  assert.deepEqual(outcome.results, ["short", "long", "middle"])
})

test("an idle scheduler waits for other stacks' memory instead of spinning or overcommitting", async () => {
  let time = 0
  const samples = [45, 45, 10]
  const sleeps = []
  const started = []
  const outcome = await scheduleLanes({
    lanes: [lane("browser")],
    contract: committed,
    externalMemoryGb: () => samples.shift() ?? 10,
    admissionPollMs: 15_000,
    sleep: async (ms) => {
      sleeps.push(ms)
      time += ms
    },
    now: () => time,
    run: async (entry) => {
      started.push(entry.id)
    },
  })
  assert.deepEqual(sleeps, [15_000, 15_000])
  assert.deepEqual(started, ["browser"])
  assert.equal(outcome.peak, 1)

  time = 0
  await assert.rejects(
    scheduleLanes({
      lanes: [lane("browser")],
      contract: committed,
      externalMemoryGb: async () => 45,
      admissionPollMs: 60_000,
      admissionWaitMs: 180_000,
      sleep: async (ms) => {
        time += ms
      },
      now: () => time,
      run: () => assert.fail("must not run without memory"),
    }),
    /No lane could be admitted for 3 minutes/
  )
})

test("an unreadable external-memory sample falls back to the floor", async () => {
  const started = []
  await scheduleLanes({
    lanes: ["a", "b", "c", "d", "e", "f"].map((id) => lane(id)),
    contract: committed,
    externalMemoryGb: async () => {
      throw new Error("docker stats failed")
    },
    run: async (entry) => {
      started.push(entry.id)
      await tick()
    },
  })
  assert.equal(started.length, 6)
})

/* ------------------------------------------------------ the runner, per lane */

const runnableLane = (id, extra = {}) => ({
  ...lane(id),
  title: id,
  arch: "any",
  commands: ["pnpm test:unit"],
  teardownCommands: [],
  backgroundServices: [],
  runtimeEnv: [],
  env: {},
  timeoutMinutes: 10,
  continueOnError: false,
  ...extra,
})

test("the runner offers each finished lane in profile order, and waits for delivery before returning", async () => {
  const lanes = [
    runnableLane("one"),
    runnableLane("two"),
    runnableLane("db", { needsDaemon: true, requires: ["privileged-daemon"] }),
  ]
  const releases = new Map()
  const snapshots = []
  let delivered = 0
  const scripts = []
  const runner = createRunner({
    contract: committed,
    arch: "arm64",
    workspaceHostPath: "/run/base",
    resolveRuntimeEnv: async () => ({}),
    prepareLaneWorkspace: async (entry) => `/run/lanes/${entry.id}`,
    hostedOnlyRequirements: ["privileged-daemon"],
    laneScriptPrelude: ["pnpm install --offline --frozen-lockfile"],
    containerRuntime: {
      withJobContainer: async (options) => {
        scripts.push(options.command[2])
        await new Promise((resolve) => releases.set(options.laneId, resolve))
        const output = `##local-ci## ${options.laneId}\n`
        options.onOutput(output)
        return { exitCode: 0, output }
      },
    },
  })
  const pending = runner.runProfile({
    profile: {
      profile: "pr",
      lanes,
      baselineEnv: { CI: "1" },
      baselineRuntimeEnv: [],
    },
    headSha: "a".repeat(40),
    onLaneComplete: async (snapshot) => {
      snapshots.push(snapshot)
      await tick()
      delivered += 1
    },
  })
  await tick()
  releases.get("two")()
  await tick()
  await tick()
  releases.get("one")()
  const outcome = await pending
  assert.equal(delivered, 2, "every delivery settles before runProfile returns")
  assert.deepEqual(
    snapshots.map((snapshot) =>
      snapshot.lanes.map((entry) => entry?.laneId ?? null)
    ),
    [
      [null, "two"],
      ["one", "two"],
    ]
  )
  assert.deepEqual(snapshots[0].laneIds, ["one", "two"])
  assert.deepEqual(
    snapshots[0].hostedOnly.map((entry) => entry.laneId),
    ["db"]
  )
  assert.match(snapshots[0].hostedOnly[0].reason, /privileged-daemon/)
  assert.deepEqual(
    outcome.record.hostedOnlyLanes.map((entry) => entry.laneId),
    ["db"]
  )
  // The prelude runs inside the trap, before the lane's own first command.
  for (const script of scripts) {
    const prelude = script.indexOf("pnpm install --offline --frozen-lockfile")
    assert.ok(prelude > script.indexOf("trap __lci_cleanup EXIT"))
    assert.ok(prelude < script.indexOf("command 1/1: pnpm test:unit"))
  }
})

test("a failing progress delivery is logged and never changes the run", async () => {
  const warnings = []
  const runner = createRunner({
    contract: committed,
    arch: "arm64",
    workspaceHostPath: "/run/base",
    resolveRuntimeEnv: async () => ({}),
    prepareLaneWorkspace: async (entry) => `/run/lanes/${entry.id}`,
    logger: {
      warn: (message) => warnings.push(message),
      error() {},
      info() {},
    },
    containerRuntime: {
      withJobContainer: async (options) => {
        options.onOutput("ok\n")
        return { exitCode: 0, output: "ok\n" }
      },
    },
  })
  const outcome = await runner.runProfile({
    profile: {
      profile: "pr",
      lanes: [runnableLane("one")],
      baselineEnv: { CI: "1" },
      baselineRuntimeEnv: [],
    },
    headSha: "a".repeat(40),
    onLaneComplete: async () => {
      throw new Error("GitHub 502")
    },
  })
  assert.equal(outcome.record.conclusion, "success")
  assert.match(
    warnings.join(" "),
    /could not publish lane progress: GitHub 502/
  )
})
