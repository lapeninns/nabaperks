import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import {
  lanesFit,
  scheduleLanes,
} from "../../ops/local-ci/core/lane-scheduler.mjs"
import { buildLaneWorkspaceScript } from "../../ops/local-ci/agent/main.mjs"
import { nodeTestArguments } from "../../scripts/ci/node-test-runner.mjs"
import { createRunner } from "../../ops/local-ci/agent/runner.mjs"
import { digestLogBundle } from "../../ops/local-ci/core/digest.mjs"
import {
  command as benchmarkCommand,
  resourceSamplingSummary,
} from "../../ops/local-ci/benchmark.mjs"

const contract = JSON.parse(
  readFileSync(new URL("../../config/local-ci-contract.json", import.meta.url))
)
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
