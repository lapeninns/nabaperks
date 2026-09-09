import assert from "node:assert/strict"
import { EventEmitter } from "node:events"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { createContainerRuntime } from "../../ops/local-ci/agent/container.mjs"
import { loadContract } from "../../ops/local-ci/core/contract.mjs"
import { digestLogBundle } from "../../ops/local-ci/core/digest.mjs"
import {
  extractLaneSummary,
  renderCheckSummary,
} from "../../ops/local-ci/core/summary.mjs"
import {
  PUBLISH_MARGIN_MINUTES,
  createRunner,
  laneLogParts,
  laneServiceLogs,
  runDeadlineMs,
} from "../../ops/local-ci/agent/runner.mjs"

/**
 * local CI — what the runner does when a run runs long, when a container will
 * not start, and when a lane's evidence is incomplete.
 *
 * These three are one story. The agent-side ceiling has to expire before the
 * hosted bridge stops polling, and a run that expires has to still publish
 * something — which means a lane that cannot start must be a failed lane
 * rather than a thrown run, and the logs the result names must be logs that
 * exist. None of it is reachable through the argv builders, so the runner is
 * driven here with an injected clock and an injected container runtime.
 */

const CONTRACT_TEXT = readFileSync(
  fileURLToPath(
    new URL("../../config/local-ci-contract.json", import.meta.url)
  ),
  "utf8"
)
const contract = loadContract(() => CONTRACT_TEXT)

const HEAD_SHA = "a".repeat(40)
const MINUTE = 60_000

const readProfile = (path) =>
  JSON.parse(
    readFileSync(
      fileURLToPath(new URL(`../../${path}`, import.meta.url)),
      "utf8"
    )
  )

/** A lane with every field the runner and core/job-env.mjs read. */
const laneOf = (overrides = {}) => ({
  id: "fast",
  title: "Fast lane",
  arch: "any",
  concurrencyGroup: null,
  commands: ["pnpm test:unit"],
  teardownCommands: [],
  backgroundServices: [],
  runtimeEnv: [],
  env: {},
  timeoutMinutes: 45,
  continueOnError: false,
  ...overrides,
})

const profileOf = (lanes) => ({
  schema: contract.profileSchema,
  profile: "pr",
  baselineEnv: { CI: "1" },
  baselineRuntimeEnv: [],
  lanes,
})

/**
 * A clock the test moves by hand. `advance` is called by the fake container
 * runtime, so time passes exactly when a lane is running.
 */
function fakeClock(start = Date.UTC(2026, 8, 5, 9, 0, 0)) {
  let current = start
  return {
    now: () => current,
    advance: (ms) => {
      current += ms
    },
  }
}

/**
 * A container runtime that runs no container.
 *
 * `lanes` scripts each lane by id: how long it takes, what it prints, how it
 * exits. A lane whose scripted duration exceeds the `timeoutMs` it was given
 * is reported as timed out at that ceiling, which is what a real
 * `runContainer` does and what makes the run-level clamp observable.
 */
function fakeRuntime({ lanes = {}, workspaceLogs = {}, throwFor = {} } = {}) {
  const calls = []
  const reads = []
  return {
    calls,
    reads,
    async withJobContainer(options) {
      calls.push(options)
      const thrown = throwFor[options.laneId]
      if (thrown) throw thrown
      const script = lanes[options.laneId] ?? {}
      const wanted = script.durationMs ?? MINUTE
      const timedOut = wanted > options.timeoutMs
      const took = timedOut ? options.timeoutMs : wanted
      clock.advance(took)
      // `chunks` streams the lane's output as the real runtime does, in
      // buffers whose boundaries the script chooses; `output` is the simpler
      // string form the rest of these tests use.
      const chunks =
        script.chunks ??
        script.output ??
        `##local-ci## lane ${options.laneId} ok\n`
      const emitted = Array.isArray(chunks) ? chunks : [chunks]
      for (const chunk of emitted) options.onOutput?.(chunk, "stdout")
      const outputBytes = Buffer.concat(
        emitted.map((chunk) =>
          Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), "utf8")
        )
      )
      return {
        exitCode: timedOut ? 124 : (script.exitCode ?? 0),
        output: outputBytes.toString("utf8"),
        outputBytes,
        timedOut,
        cancelled: false,
        durationMs: took,
      }
    },
    async readWorkspaceLog({ name }) {
      reads.push(name)
      return (
        workspaceLogs[name] ?? {
          name,
          status: "absent",
          text: "",
          reason: `no file at ${name} when the lane ended`,
        }
      )
    },
  }
}

/**
 * Every log part written into the run directory, by name.
 *
 * `bytes` is the file as `appendFileSync` would have left it; `files` is the
 * text view of the same file. The real sink appends buffers, so a fake that
 * concatenated chunks as strings would quietly repair a capture path that had
 * already lost bytes - and the digest tests below exist to catch exactly that.
 */
function fakeRunDirectory() {
  const bytes = new Map()
  const opened = []
  const files = {
    get: (name) => bytes.get(name)?.toString("utf8"),
    has: (name) => bytes.has(name),
  }
  return {
    bytes,
    files,
    opened,
    openLaneLog(name) {
      opened.push(name)
      bytes.set(name, Buffer.alloc(0))
      return {
        write(chunk) {
          const part = Buffer.isBuffer(chunk)
            ? chunk
            : Buffer.from(String(chunk), "utf8")
          bytes.set(name, Buffer.concat([bytes.get(name), part]))
        },
        close() {},
      }
    },
  }
}

let clock = fakeClock()

function runnerFor({ runtime, runDir, arch = "arm64" }) {
  return createRunner({
    contract,
    containerRuntime: runtime,
    resolveRuntimeEnv: async () => ({}),
    openLaneLog: (name) => runDir.openLaneLog(name),
    hostEnv: {},
    arch,
    image: "ghcr.io/lapeninns/nabaperks-ci:2026-09-01",
    daemonImage: "docker:27.5.1-dind",
    workspaceHostPath: "/var/lib/nabaperks-ci/runs/head",
    now: () => clock.now(),
  })
}

test("the run deadline expires before the bridge does, and before any profile could finish on lane timeouts alone", () => {
  const deadlineMinutes = runDeadlineMs(contract) / MINUTE
  assert.ok(PUBLISH_MARGIN_MINUTES > 0, "publishing needs a margin of its own")
  assert.equal(
    deadlineMinutes,
    contract.bridge.timeoutMinutes - PUBLISH_MARGIN_MINUTES
  )
  assert.ok(
    deadlineMinutes < contract.bridge.timeoutMinutes,
    "the agent-side ceiling must expire strictly before the hosted bridge gives up"
  )

  // The defect this exists for: every profile's lanes, summed, outlast the
  // bridge by a wide margin, so per-lane timeouts alone can never bound a run.
  for (const [name, path] of Object.entries(contract.profiles)) {
    const laneMinutes = readProfile(path).lanes.reduce(
      (total, lane) => total + lane.timeoutMinutes,
      0
    )
    assert.ok(
      laneMinutes > contract.bridge.timeoutMinutes,
      `${name} sums to ${laneMinutes} lane-minutes, so this test is only meaningful while that is past the bridge's ${contract.bridge.timeoutMinutes}`
    )
    assert.ok(
      deadlineMinutes < laneMinutes,
      `${name}: the run deadline must bind before the lanes' own timeouts could`
    )
  }
})

test("a bridge ceiling that leaves no publishing margin is refused rather than rounded away", () => {
  for (const timeoutMinutes of [PUBLISH_MARGIN_MINUTES, 1]) {
    assert.throws(
      () =>
        runDeadlineMs({
          ...contract,
          bridge: { ...contract.bridge, timeoutMinutes },
        }),
      (error) => error.code === "INVALID_CONTRACT",
      `bridge.timeoutMinutes ${timeoutMinutes} leaves nothing to publish in`
    )
  }
})

test("a run that outlives its deadline skips the rest, tears down and publishes a timed-out conclusion", async () => {
  clock = fakeClock()
  const deadlineMinutes = runDeadlineMs(contract) / MINUTE
  const profile = profileOf([
    laneOf({ id: "one" }),
    laneOf({ id: "two" }),
    laneOf({ id: "three" }),
    laneOf({ id: "four" }),
  ])
  const runtime = fakeRuntime({
    lanes: {
      one: { durationMs: 40 * MINUTE },
      two: { durationMs: 40 * MINUTE },
      // Exactly the clamped remainder, so this lane succeeds and the run is
      // out of time with a lane still unstarted - a slow run, not a hung one.
      three: { durationMs: 30 * MINUTE },
      four: { durationMs: 40 * MINUTE },
    },
  })
  const runDir = fakeRunDirectory()

  const outcome = await runnerFor({ runtime, runDir }).runProfile({
    profile,
    ref: "refs/pull/12/head",
    headSha: HEAD_SHA,
  })

  assert.equal(outcome.deadlineExpired, true)
  assert.deepEqual(
    outcome.laneResults.map((lane) => lane.status),
    ["success", "success", "success", "skipped"]
  )
  assert.equal(runtime.calls.length, 3, "the fourth lane never started")

  // The lane that straddles the deadline gets what is left of the run, not the
  // 45 minutes its own profile entry allows.
  assert.deepEqual(
    runtime.calls.map((call) => call.timeoutMs / MINUTE),
    [45, 45, 30]
  )

  assert.equal(outcome.record.conclusion, "timed_out")
  const deadlineFailure = outcome.record.failures.find((entry) =>
    entry.title.includes("whole-profile deadline")
  )
  assert.ok(
    deadlineFailure,
    "the run says why it stopped, not only that it did"
  )
  assert.equal(deadlineFailure.laneId, null)
  assert.match(
    deadlineFailure.message,
    new RegExp(`${deadlineMinutes} minutes`)
  )
  assert.match(deadlineFailure.message, /1 lane\(s\) never ran/)

  // A lane that never ran wrote nothing, so it names no log part: the record's
  // manifest may only name files a reader can actually open.
  assert.deepEqual(outcome.laneResults.at(-1).logParts, [])

  // And the whole thing is publishable, which is the point of stopping early.
  const summary = renderCheckSummary(outcome.record, contract)
  assert.match(summary.title, /^timed_out/)
  assert.match(summary.text, /whole-profile deadline/)
})

test("a lane still running at the deadline is stopped there, not at its own longer timeout", async () => {
  clock = fakeClock()
  const deadlineMs = runDeadlineMs(contract)
  const profile = profileOf([
    // The nightly mutation lane's budget: longer on its own than the whole run
    // is allowed to take.
    laneOf({ id: "mutation", timeoutMinutes: 120 }),
    laneOf({ id: "after" }),
  ])
  const runtime = fakeRuntime({
    lanes: { mutation: { durationMs: 200 * MINUTE } },
  })
  const runDir = fakeRunDirectory()

  const outcome = await runnerFor({ runtime, runDir }).runProfile({
    profile,
    headSha: HEAD_SHA,
  })

  assert.equal(runtime.calls[0].timeoutMs, deadlineMs)
  assert.ok(
    runtime.calls[0].timeoutMs < 120 * MINUTE,
    "the run ceiling wins over a lane that declares more than the run has"
  )
  assert.equal(outcome.laneResults[0].status, "timed_out")
  assert.equal(outcome.laneResults[0].timedOut, true)
  assert.equal(outcome.laneResults[1].status, "skipped")
  assert.equal(outcome.record.conclusion, "timed_out")
})

test("the evidence digest separates two logs that differ only in bytes a decode would fold together", async () => {
  // The finding this exists for. `core/digest.mjs` hashes bytes rather than a
  // decoding of them, but that bought nothing while the capture path decoded
  // every chunk on arrival: both logs reached the digest as `A<U+FFFD>B` and
  // attested to one and the same hash. The property has to hold from the
  // process's stdout to the published record, not in the digest unit alone.
  const digestOfLaneLog = async (bytes) => {
    clock = fakeClock()
    const runDir = fakeRunDirectory()
    const outcome = await runnerFor({
      runtime: fakeRuntime({ lanes: { fast: { chunks: [bytes] } } }),
      runDir,
    }).runProfile({
      profile: profileOf([laneOf({ id: "fast" })]),
      headSha: HEAD_SHA,
    })
    return { outcome, runDir }
  }

  const lone = Buffer.from([0x41, 0x80, 0x42])
  const invalid = Buffer.from([0x41, 0xff, 0x42])
  const first = await digestOfLaneLog(lone)
  const second = await digestOfLaneLog(invalid)

  assert.deepEqual(
    first.runDir.bytes.get("fast.log"),
    lone,
    "the run directory holds the bytes the lane wrote, undecoded"
  )
  assert.deepEqual(second.runDir.bytes.get("fast.log"), invalid)
  assert.equal(
    first.runDir.files.get("fast.log"),
    second.runDir.files.get("fast.log"),
    "the two logs are indistinguishable once decoded, which is the whole risk"
  )
  assert.notEqual(
    first.outcome.laneResults[0].logDigest,
    second.outcome.laneResults[0].logDigest,
    "the lane digest must separate them"
  )
  assert.notEqual(
    first.outcome.record.logDigest,
    second.outcome.record.logDigest,
    "and so must the run digest the check publishes"
  )

  // §6.4 rebuilds from the file on disk, and must land on the same value.
  assert.equal(
    first.outcome.record.logDigest,
    digestLogBundle([first.runDir.bytes.get("fast.log")])
  )
  assert.equal(
    second.outcome.record.logDigest,
    digestLogBundle([second.runDir.bytes.get("fast.log")])
  )
})

test("a lane's log survives a multi-byte character split across two stream chunks", async () => {
  clock = fakeClock()
  // Valid UTF-8 throughout: this is corruption of a good log, not a question
  // about invalid bytes. `£` is `C2 A3`, and the chunk boundary falls between.
  const written = Buffer.from("lane says £5 and ✓\n", "utf8")
  const boundary = written.indexOf(0xc2) + 1
  const runDir = fakeRunDirectory()
  const outcome = await runnerFor({
    runtime: fakeRuntime({
      lanes: {
        fast: {
          chunks: [written.subarray(0, boundary), written.subarray(boundary)],
        },
      },
    }),
    runDir,
  }).runProfile({
    profile: profileOf([laneOf({ id: "fast" })]),
    headSha: HEAD_SHA,
  })

  assert.deepEqual(
    runDir.bytes.get("fast.log"),
    written,
    "the log file must be byte-identical to what the lane wrote"
  )
  assert.equal(runDir.files.get("fast.log"), "lane says £5 and ✓\n")
  assert.ok(
    !runDir.files.get("fast.log").includes("�"),
    "no replacement character may appear in a log that was valid UTF-8"
  )
  assert.equal(
    outcome.record.logDigest,
    digestLogBundle([written]),
    "and the digest attests to those bytes"
  )
})

test("the log a lane writes reaches the published digest byte for byte, through the real container runtime", async () => {
  clock = fakeClock()
  // Nothing is stubbed here but the operating system's `spawn`: the real
  // `createContainerRuntime` and the real runner carry these bytes from the
  // process's stdout to `record.logDigest`. The two tests above pin the
  // property at each end; this one pins the seam between them, which is where
  // it was actually lost - a decode inside `runContainer` made every layer
  // above it hash a U+FFFD text no matter how careful `core/digest.mjs` was.
  const written = Buffer.from("héllo ÿ\n", "binary")
  assert.ok(
    written.toString("utf8").includes("�"),
    "the fixture has to contain bytes a decode would destroy, or it proves nothing"
  )

  const spawnFn = (executable, args) => {
    const child = new EventEmitter()
    child.stdout = new EventEmitter()
    child.stderr = new EventEmitter()
    child.pid = 4242
    const isJobRun =
      args.includes("run") &&
      args.some((argument) => String(argument).includes("nabaperks-ci-job-"))
    setImmediate(() => {
      // Split so a byte pair lands either side of a chunk boundary.
      if (isJobRun) {
        child.stdout.emit("data", written.subarray(0, 2))
        child.stdout.emit("data", written.subarray(2))
      }
      child.emit("close", 0, null)
    })
    return child
  }

  const runDir = fakeRunDirectory()
  const outcome = await runnerFor({
    runtime: createContainerRuntime({ contract, spawnFn }),
    runDir,
  }).runProfile({
    profile: profileOf([laneOf({ id: "fast" })]),
    headSha: HEAD_SHA,
  })

  assert.deepEqual(
    runDir.bytes.get("fast.log"),
    written,
    "the run directory holds what the lane wrote, byte for byte"
  )
  assert.equal(
    outcome.record.logDigest,
    digestLogBundle([written]),
    "and the digest the check publishes attests to those bytes"
  )
  assert.notEqual(
    outcome.record.logDigest,
    digestLogBundle([Buffer.from(written.toString("utf8"), "utf8")]),
    "a digest over the decoded text would be a different value, and is what this plane used to publish"
  )
})

test("a container runtime that cannot start a lane fails that lane, and the run still publishes", async () => {
  clock = fakeClock()
  const profile = profileOf([laneOf({ id: "fast" }), laneOf({ id: "quality" })])
  const runtime = fakeRuntime({
    throwFor: {
      fast: new Error(
        "local-ci container: could not create the job-private network"
      ),
    },
  })
  const runDir = fakeRunDirectory()

  const outcome = await runnerFor({ runtime, runDir }).runProfile({
    profile,
    headSha: HEAD_SHA,
  })

  assert.equal(outcome.laneResults[0].status, "failure")
  assert.deepEqual(outcome.laneResults[0].logParts, ["fast.log"])
  assert.equal(outcome.laneResults[1].status, "skipped")
  assert.equal(outcome.record.conclusion, "failure")
  assert.equal(outcome.laneResults[1].blockedByLaneId, "fast")
  const published = extractLaneSummary(
    renderCheckSummary(outcome.record, contract).text
  )
  assert.equal(published.lanes[1].blockedByLaneId, "fast")
  assert.equal(published.lanes[0].countsParsed, false)

  // The reason reaches the lane's own log, so the evidence says why the lane
  // has nothing in it rather than leaving an empty file behind.
  assert.match(
    runDir.files.get("fast.log"),
    /could not create the job-private network/
  )
  assert.equal(
    outcome.laneResults[0].logDigest,
    digestLogBundle([runDir.bytes.get("fast.log")]),
    "the digest is over the bytes the log file actually holds"
  )
  assert.ok(renderCheckSummary(outcome.record, contract).title)
})

test("a declared background-service log is copied into the run directory and hashed into the evidence", async () => {
  clock = fakeClock()
  const lane = laneOf({
    id: "print-kit",
    backgroundServices: [
      {
        id: "print-kit-preview",
        command: "pnpm exec next dev",
        logFile: "print-kit-preview.log",
        readiness: { url: "http://127.0.0.1:3000/", attempts: 3 },
      },
    ],
  })
  const serviceText = "ready on 127.0.0.1:3000\ncompiled /dev/poster-preview\n"
  const laneText = "##local-ci## lane print-kit ok\n"
  const runtime = fakeRuntime({
    lanes: { "print-kit": { output: laneText } },
    workspaceLogs: {
      "print-kit-preview.log": {
        name: "print-kit-preview.log",
        status: "captured",
        text: serviceText,
        reason: null,
      },
    },
  })
  const runDir = fakeRunDirectory()

  const outcome = await runnerFor({ runtime, runDir }).runProfile({
    profile: profileOf([lane]),
    headSha: HEAD_SHA,
  })

  // It is read out of the workspace under the name the service writes, and
  // stored under a lane-qualified one so two lanes cannot overwrite each other.
  assert.deepEqual(runtime.reads, ["print-kit-preview.log"])
  assert.deepEqual(
    laneServiceLogs(lane).map((part) => part.stored),
    ["print-kit.print-kit-preview.log"]
  )
  assert.deepEqual(laneLogParts(lane), [
    "print-kit.log",
    "print-kit.print-kit-preview.log",
  ])

  // Two parts that resolved to one file name would leave a digest matching
  // neither of them, so the naming refuses rather than overwrites.
  assert.throws(
    () =>
      laneServiceLogs(
        laneOf({
          id: "print-kit",
          backgroundServices: [
            { id: "one", logFile: "preview.log" },
            { id: "two", logFile: "preview.log" },
          ],
        })
      ),
    (error) => error.code === "DUPLICATE_LOG_PART"
  )

  const result = outcome.laneResults[0]
  assert.deepEqual(result.logParts, [
    "print-kit.log",
    "print-kit.print-kit-preview.log",
  ])
  assert.deepEqual(result.missingLogParts, [])
  assert.equal(
    runDir.files.get("print-kit.print-kit-preview.log"),
    serviceText,
    "the log named in the evidence is in the evidence directory, not in a worktree about to be deleted"
  )

  // The digest covers every part the record names — the lane's and the run's.
  assert.equal(result.logDigest, digestLogBundle([laneText, serviceText]))
  assert.equal(
    outcome.record.logDigest,
    digestLogBundle([laneText, serviceText])
  )

  // docs/operations/local-ci.md §6.4 verbatim: rebuild the digest from the
  // bytes on disk, in the order the record names them. Bytes, not a decoding
  // of them, which is what §6.4's `readFile` now asks for.
  const rebuilt = digestLogBundle(
    outcome.laneResults
      .flatMap((entry) => entry.logParts)
      .map((name) => runDir.bytes.get(name))
  )
  assert.equal(rebuilt, outcome.record.logDigest)
})

test("a declared log that never appeared is recorded as missing, and an empty one is not the same fact", async () => {
  const lane = laneOf({
    id: "print-kit",
    backgroundServices: [
      { id: "print-kit-preview", command: "pnpm exec next dev" },
    ],
  })
  const laneText = "##local-ci## lane print-kit ok\n"

  clock = fakeClock()
  const absentRunDir = fakeRunDirectory()
  const absent = await runnerFor({
    runtime: fakeRuntime({ lanes: { "print-kit": { output: laneText } } }),
    runDir: absentRunDir,
  }).runProfile({ profile: profileOf([lane]), headSha: HEAD_SHA })

  const missed = absent.laneResults[0]
  assert.deepEqual(missed.logParts, ["print-kit.log"])
  assert.deepEqual(
    missed.missingLogParts.map((entry) => entry.name),
    ["print-kit.print-kit-preview.log"]
  )
  assert.match(missed.missingLogParts[0].reason, /no file at/)
  assert.equal(
    absentRunDir.files.has("print-kit.print-kit-preview.log"),
    false,
    "nothing is written for a log that was never there"
  )
  const raised = absent.record.failures.find((entry) =>
    entry.title.includes("print-kit.print-kit-preview.log")
  )
  assert.ok(raised, "an incomplete evidence bundle is stated, not omitted")
  assert.equal(raised.laneId, "print-kit")

  clock = fakeClock()
  const emptyRunDir = fakeRunDirectory()
  const empty = await runnerFor({
    runtime: fakeRuntime({
      lanes: { "print-kit": { output: laneText } },
      workspaceLogs: {
        "print-kit-preview.log": {
          name: "print-kit-preview.log",
          status: "captured",
          text: "",
          reason: null,
        },
      },
    }),
    runDir: emptyRunDir,
  }).runProfile({ profile: profileOf([lane]), headSha: HEAD_SHA })

  // A service that logged nothing and a service whose log vanished must not
  // arrive at the same record.
  assert.deepEqual(empty.laneResults[0].logParts, [
    "print-kit.log",
    "print-kit.print-kit-preview.log",
  ])
  assert.deepEqual(empty.laneResults[0].missingLogParts, [])
  assert.equal(emptyRunDir.files.get("print-kit.print-kit-preview.log"), "")
  assert.notEqual(empty.record.logDigest, absent.record.logDigest)
  assert.equal(
    empty.record.failures.some((entry) =>
      entry.title.includes("print-kit.print-kit-preview.log")
    ),
    false
  )
})

test("cancellation during fixture creation does not launch the lane", async () => {
  const controller = new AbortController()
  const runner = createRunner({
    contract,
    containerRuntime: {
      withJobContainer: () =>
        assert.fail("cancelled fixture setup must not launch"),
    },
    resolveRuntimeEnv: async () => ({}),
    hostEnv: {},
    arch: "arm64",
    image: "ghcr.io/lapeninns/nabaperks-ci:2026-09-01",
    workspaceHostPath: "/unused",
  })
  const outcome = await runner.runProfile({
    profile: profileOf([laneOf()]),
    ref: "refs/heads/main",
    headSha: HEAD_SHA,
    signal: controller.signal,
    writeEnvFile: async () => {
      controller.abort()
      return "/unused.env"
    },
  })
  assert.equal(outcome.record.conclusion, "cancelled")
  assert.equal(outcome.laneResults[0].status, "cancelled")
})
