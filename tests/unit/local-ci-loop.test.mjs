import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import {
  loadContract,
  validateContract,
} from "../../ops/local-ci/core/contract.mjs"
import { logDigest } from "../../ops/local-ci/core/digest.mjs"
import { queuedJobs, runningJobs } from "../../ops/local-ci/core/queue.mjs"
import {
  ABORT_STOPPING,
  ABORT_SUPERSEDED,
  CAFFEINATE_FLAGS,
  CAFFEINATE_PATH,
  DEFAULT_BRANCH_REF,
  candidatesFrom,
  classifyCandidates,
  createLoop,
  createSleepAssertion,
  pollIntervalMs,
} from "../../ops/local-ci/agent/loop.mjs"

/**
 * local CI — the poll loop, driven synchronously.
 *
 * A tick is an ordinary function call over injected dependencies, so a test
 * drives a day of agent behaviour offline: a fork pull request arriving, a
 * force push landing mid-run, a run throwing. Five rules are asserted rather
 * than assumed - a refused request is recorded and never enqueued; the sleep
 * assertion is acquired for a running job and released in a `finally`; a tick
 * returns without waiting for the run it started; a superseding SHA and a
 * SIGTERM both abort a run in flight; and every run completes its check run,
 * including the ones that never produced a record.
 *
 * A run no longer finishes inside the tick that started it, so a test that
 * asserts on a run's effects takes it with `settle()`.
 */

const CONTRACT_TEXT = readFileSync(
  fileURLToPath(
    new URL("../../config/local-ci-contract.json", import.meta.url)
  ),
  "utf8"
)

const contract = loadContract(() => CONTRACT_TEXT)

const MAIN_SHA = "a".repeat(40)
const PR_SHA = "b".repeat(40)
const FORK_SHA = "c".repeat(40)
const NEW_MAIN_SHA = "d".repeat(40)
const NOW = Date.parse("2026-09-04T09:00:00.000Z")

const deferred = () => {
  let resolve
  const promise = new Promise((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

/**
 * A liveness assertion needs a bound, or a regression hangs the test run
 * instead of failing it. The timer is the test's own; the loop is still driven
 * entirely by injected values.
 */
const returnsPromptly = (promise) => {
  const timeout = new Promise((resolve) => {
    const handle = setTimeout(() => resolve("still waiting"), 2000)
    handle.unref?.()
  })
  return Promise.race([promise.then(() => "returned"), timeout])
}

const pull = (overrides = {}) => ({
  event: "pull_request",
  number: 41,
  ref: "refs/pull/41/head",
  sha: PR_SHA,
  headRepository: contract.repository,
  headRepositoryId: contract.githubApp.repositoryId,
  baseRepository: contract.repository,
  ...overrides,
})

const FORK_PULL = pull({
  number: 42,
  ref: "refs/pull/42/head",
  sha: FORK_SHA,
  headRepository: "contributor/nabaperks",
  headRepositoryId: 5150,
})

const record = (headSha, conclusion = "success") => ({
  profile: "pr",
  headSha,
  conclusion,
  durationSeconds: 60,
  logDigest: logDigest(`run ${headSha}`),
  lanes: [
    {
      laneId: "fast",
      status: conclusion === "success" ? "success" : "failure",
      durationSeconds: 60,
      testsRun: 10,
      testsPassed: conclusion === "success" ? 10 : 9,
      testsFailed: conclusion === "success" ? 0 : 1,
      testsSkipped: 0,
    },
  ],
})

/** A github client over fixed values; every call is recorded. */
const fakeGitHub = ({ mainSha = MAIN_SHA, pulls = [] } = {}) => {
  const created = []
  const updated = []
  return {
    created,
    updated,
    async getRef(ref) {
      return { ref, sha: mainSha, type: "commit" }
    },
    async listOpenPullRequests() {
      return pulls
    },
    async createCheckRun(payload) {
      created.push(payload)
      return { id: 1000 + created.length }
    },
    async updateCheckRun(id, payload) {
      updated.push({ id, ...payload })
      return { id }
    },
  }
}

const fakeRunner = (behaviour = () => null) => {
  const runs = []
  return {
    runs,
    async runProfile({ profile, ref, headSha }) {
      runs.push({ profile: profile.profile, ref, headSha })
      const thrown = behaviour({ headSha })
      if (thrown instanceof Error) throw thrown
      return { record: record(headSha, thrown ?? "success") }
    },
  }
}

const fakeSleepAssertion = () => {
  const events = []
  return {
    events,
    acquire() {
      events.push("acquire")
      return true
    },
    release() {
      events.push("release")
      return true
    },
  }
}

const buildLoop = ({ github, runner, sleepAssertion, ...rest } = {}) =>
  createLoop({
    contract,
    github,
    runner,
    sleepAssertion,
    loadProfile: async (name) => ({ profile: name, lanes: [] }),
    now: () => NOW,
    ...rest,
  })

/** A contract whose allowlist names a repository this plane never sees. */
const elsewhereContract = () => {
  const raw = JSON.parse(CONTRACT_TEXT)
  return validateContract({
    ...raw,
    allowedHeadRepository: "someone-else/nabaperks",
  })
}

test("routing: a fork pull request is never enqueued and never reaches the runner", async () => {
  const github = fakeGitHub({ pulls: [pull(), FORK_PULL] })
  const runner = fakeRunner()
  const loop = buildLoop({ github, runner })

  const first = await loop.tick()
  await loop.settle()
  assert.equal(first.outcome, "ran")
  assert.equal(first.hostedFork, 1)
  assert.equal(first.refused, 0)

  const shas = loop.state.jobs.map((job) => job.sha)
  assert.equal(
    shas.includes(FORK_SHA),
    false,
    "the fork head SHA must never enter the queue"
  )
  assert.deepEqual(shas.sort(), [MAIN_SHA, PR_SHA].sort())
  assert.equal(
    runner.runs.some((run) => run.headSha === FORK_SHA),
    false
  )
  assert.equal(
    github.created.some((entry) => entry.headSha === FORK_SHA),
    false,
    "no check run is published for work this plane did not do"
  )

  // main outranks the pull request, so it is the one that ran.
  assert.equal(first.job.profile, "main")
  assert.deepEqual(
    runner.runs.map((run) => run.headSha),
    [MAIN_SHA]
  )
})

test("routing: a refused candidate is recorded, so declining is distinguishable from never seeing it", async () => {
  const raw = JSON.parse(CONTRACT_TEXT)
  const elsewhere = validateContract({
    ...raw,
    repository: "lapeninns/nabaperks",
    allowedHeadRepository: "someone-else/nabaperks",
  })
  const github = fakeGitHub({ pulls: [pull()] })
  const runner = fakeRunner()
  const loop = createLoop({
    contract: elsewhere,
    github,
    runner,
    loadProfile: async (name) => ({ profile: name }),
    now: () => NOW,
  })

  const result = await loop.tick()
  assert.equal(result.outcome, "idle")
  assert.equal(result.refused, 2)
  assert.equal(loop.state.jobs.length, 0)
  assert.equal(runner.runs.length, 0)
  assert.equal(loop.refusals.length, 2)
  for (const refusal of loop.refusals) {
    assert.equal(refusal.at, new Date(NOW).toISOString())
    assert.match(refusal.reason, /is not exactly/)
  }
})

test("routing: a renamed repository presenting the allowlisted name is refused on the pinned id", () => {
  const raw = JSON.parse(CONTRACT_TEXT)
  const pinned = validateContract({
    ...raw,
    githubApp: { ...raw.githubApp, repositoryId: 998877 },
  })

  const candidates = candidatesFrom({
    mainRef: { ref: DEFAULT_BRANCH_REF, sha: MAIN_SHA },
    pullRequests: [
      pull({ headRepositoryId: pinned.githubApp.repositoryId }),
      pull({ number: 43, headRepositoryId: 4242 }),
    ],
    contract: pinned,
  })
  const classified = classifyCandidates(candidates, pinned)

  assert.equal(classified.local.length, 2)
  assert.equal(classified.refused.length, 1)
  assert.equal(classified.refused[0].verdict.code, "REPOSITORY_ID_MISMATCH")
  assert.match(classified.refused[0].verdict.reason, /cannot be renamed/)
})

test("routing: candidates carry the main ref first, and a fork pull request is classified hosted", () => {
  const candidates = candidatesFrom({
    mainRef: { ref: DEFAULT_BRANCH_REF, sha: MAIN_SHA },
    pullRequests: [FORK_PULL],
    contract,
  })
  assert.deepEqual(
    candidates.map((candidate) => candidate.profile),
    ["main", "pr"]
  )
  const classified = classifyCandidates(candidates, contract)
  assert.deepEqual(
    classified.local.map((entry) => entry.candidate.sha),
    [MAIN_SHA]
  )
  assert.deepEqual(
    classified.hostedFork.map((entry) => entry.candidate.sha),
    [FORK_SHA]
  )
  assert.deepEqual(classified.refused, [])
})

test("the sleep assertion is acquired for a job and released when it finishes", async () => {
  const sleepAssertion = fakeSleepAssertion()
  const github = fakeGitHub()
  const runner = {
    runs: [],
    async runProfile({ headSha }) {
      // Held for the duration of the run, and only for the duration.
      assert.deepEqual(sleepAssertion.events, ["acquire"])
      this.runs.push(headSha)
      return { record: record(headSha) }
    },
  }
  const loop = buildLoop({ github, runner, sleepAssertion })

  const result = await loop.tick()
  await loop.settle()
  assert.equal(result.outcome, "ran")
  assert.deepEqual(sleepAssertion.events, ["acquire", "release"])
})

test("the sleep assertion is released in a finally even when the run throws", async () => {
  const sleepAssertion = fakeSleepAssertion()
  const github = fakeGitHub()
  const boom = new Error("the container daemon wedged")
  const runner = fakeRunner(() => boom)
  const loop = buildLoop({ github, runner, sleepAssertion })

  await loop.tick()
  await assert.rejects(() => loop.settle(), /the container daemon wedged/)
  assert.deepEqual(
    sleepAssertion.events,
    ["acquire", "release"],
    "a thrown run must not leave the Mac awake forever"
  )

  // The job is recorded as incomplete rather than left running, and the loop
  // is free to tick again.
  const job = loop.state.jobs.find((entry) => entry.sha === MAIN_SHA)
  assert.equal(job.status, "completed")
  assert.equal(job.result.status, "incomplete")
  assert.equal(loop.busy, false)
  assert.equal(runningJobs(loop.state).length, 0)
})

test("a thrown run completes its check run rather than leaving it in_progress forever", async () => {
  const github = fakeGitHub()
  const runner = fakeRunner(
    () => new Error("the workspace could not be prepared")
  )
  const loop = buildLoop({ github, runner })

  await loop.tick()
  await assert.rejects(() => loop.settle(), /workspace could not be prepared/)

  // Nothing retries this SHA - the queue entry is completed and every later
  // poll deduplicates it - so a check left in_progress is one the bridge waits
  // out its whole ceiling for.
  assert.equal(github.created.length, 1)
  assert.equal(github.created[0].status, "in_progress")
  assert.equal(github.updated.length, 1)
  assert.equal(github.updated[0].id, 1001)
  assert.equal(github.updated[0].status, "completed")
  assert.equal(github.updated[0].conclusion, "failure")
  assert.match(github.updated[0].output.summary, /could not be prepared/)
  assert.match(github.updated[0].output.title, /did not run/)
})

test("a thrown run whose check was never opened publishes a completed one instead", async () => {
  const created = []
  const github = {
    ...fakeGitHub(),
    async createCheckRun(payload) {
      if (payload.status === "in_progress") {
        throw new Error("GitHub returned HTTP 500")
      }
      created.push(payload)
      return { id: 7 }
    },
  }
  const loop = buildLoop({
    github,
    runner: fakeRunner(() => new Error("docker never came up")),
  })

  await loop.tick()
  await assert.rejects(() => loop.settle(), /docker never came up/)

  assert.equal(created.length, 1)
  assert.equal(created[0].headSha, MAIN_SHA)
  assert.equal(created[0].name, contract.checkName)
  assert.equal(created[0].status, "completed")
  assert.equal(created[0].conclusion, "failure")
})

test("a GitHub outage while reporting a thrown run does not mask the run's own error", async () => {
  const errors = []
  const github = {
    ...fakeGitHub(),
    async updateCheckRun() {
      throw new Error("GitHub returned HTTP 502")
    },
  }
  const loop = buildLoop({
    github,
    runner: fakeRunner(() => new Error("the container daemon wedged")),
    logger: { error: (message) => errors.push(message) },
  })

  await loop.tick()
  await assert.rejects(
    () => loop.settle(),
    /the container daemon wedged/,
    "the reporting failure must not replace the failure an operator has to fix"
  )
  assert.equal(
    errors.some((message) => /could not complete the check run/.test(message)),
    true
  )
})

test("a host secret named in a thrown run's message never reaches the published check", async () => {
  const secret = contract.hostSecrets[1]
  const github = fakeGitHub()
  const loop = buildLoop({
    github,
    runner: fakeRunner(() => new Error(`could not read ${secret} from disk`)),
  })

  await loop.tick()
  await assert.rejects(() => loop.settle(), /could not read/)
  assert.equal(github.updated.length, 1)
  assert.equal(github.updated[0].output.summary.includes(secret), false)
  assert.match(github.updated[0].output.summary, /\[redacted\]/)
})

test("an idle tick holds no sleep assertion at all", async () => {
  const sleepAssertion = fakeSleepAssertion()
  const loop = createLoop({
    contract: elsewhereContract(),
    github: fakeGitHub(),
    runner: fakeRunner(),
    sleepAssertion,
    loadProfile: async (name) => ({ profile: name }),
    now: () => NOW,
  })

  assert.equal((await loop.tick()).outcome, "idle")
  assert.deepEqual(sleepAssertion.events, [])
})

test("the run is published as in_progress and then completed on the same check run", async () => {
  const github = fakeGitHub()
  const loop = buildLoop({ github, runner: fakeRunner() })
  await loop.tick()
  await loop.settle()

  assert.equal(github.created.length, 1)
  assert.equal(github.created[0].name, contract.checkName)
  assert.equal(github.created[0].headSha, MAIN_SHA)
  assert.equal(github.created[0].status, "in_progress")

  assert.equal(github.updated.length, 1)
  assert.equal(github.updated[0].id, 1001)
  assert.equal(github.updated[0].status, "completed")
  assert.equal(github.updated[0].conclusion, "success")
  assert.match(github.updated[0].output.text, /Log digest: [0-9a-f]{64}$/)
})

test("a second tick deduplicates the same head SHA rather than re-running it", async () => {
  const github = fakeGitHub()
  const runner = fakeRunner()
  const loop = buildLoop({ github, runner })

  assert.equal((await loop.tick()).outcome, "ran")
  await loop.settle()
  const second = await loop.tick()
  assert.equal(second.outcome, "idle")
  assert.deepEqual(
    runner.runs.map((run) => run.headSha),
    [MAIN_SHA]
  )
  assert.equal(loop.state.jobs.length, 1)
})

test("a force push on the default branch supersedes the queued SHA", async () => {
  const runner = fakeRunner()
  let mainSha = MAIN_SHA
  const github = {
    ...fakeGitHub(),
    async getRef(ref) {
      return { ref, sha: mainSha }
    },
    async listOpenPullRequests() {
      return []
    },
    async createCheckRun() {
      return { id: 1 }
    },
    async updateCheckRun() {
      return { id: 1 }
    },
  }
  const loop = buildLoop({ github, runner })

  await loop.tick()
  await loop.settle()
  mainSha = NEW_MAIN_SHA
  await loop.tick()
  await loop.settle()

  assert.deepEqual(
    runner.runs.map((run) => run.headSha),
    [MAIN_SHA, NEW_MAIN_SHA]
  )
  assert.deepEqual(queuedJobs(loop.state), [])
  assert.equal(loop.state.jobs.length, 2)
})

test("a failing run is published as a failure and the loop keeps going", async () => {
  const github = fakeGitHub({ pulls: [pull()] })
  const runner = fakeRunner(({ headSha }) =>
    headSha === MAIN_SHA ? "failure" : null
  )
  const loop = buildLoop({ github, runner })

  const first = await loop.tick()
  assert.equal(first.outcome, "ran")
  const outcome = await loop.settle()
  assert.equal(outcome.record.conclusion, "failure")
  assert.equal(github.updated[0].conclusion, "failure")

  const second = await loop.tick()
  await loop.settle()
  assert.equal(second.outcome, "ran")
  assert.equal(second.job.profile, "pr")
})

test("a check-run publish failure does not lose the run", async () => {
  const github = {
    ...fakeGitHub(),
    async createCheckRun() {
      throw new Error("GitHub returned HTTP 500")
    },
    async updateCheckRun() {
      throw new Error("GitHub returned HTTP 500")
    },
  }
  const runner = fakeRunner()
  const loop = buildLoop({ github, runner })

  const result = await loop.tick()
  await loop.settle()
  assert.equal(result.outcome, "ran")
  assert.deepEqual(
    runner.runs.map((run) => run.headSha),
    [MAIN_SHA]
  )
  assert.equal(
    loop.state.jobs.find((job) => job.sha === MAIN_SHA).result.status,
    "success"
  )
})

test("the tick returns while the run is still going, so polling and the heartbeat continue", async () => {
  const gate = deferred()
  const entered = deferred()
  const github = fakeGitHub()
  const beats = []
  const heartbeat = {
    async ping() {
      beats.push(NOW)
      return { sent: true, reason: "ok" }
    },
  }
  const runner = {
    runs: [],
    async runProfile({ headSha }) {
      this.runs.push(headSha)
      entered.resolve()
      await gate.promise
      return { record: record(headSha) }
    },
  }
  const loop = buildLoop({ github, runner, heartbeat })

  const ticking = loop.tick()
  await entered.promise
  assert.equal(
    await returnsPromptly(ticking),
    "returned",
    "a tick that waits for its run stops polling for the length of a profile"
  )
  const first = await ticking
  assert.equal(first.outcome, "ran")
  assert.equal(
    loop.busy,
    true,
    "the tick returned while the profile was still running"
  )

  // The tick that a blocking loop could never reach: it polls, it reports the
  // job in flight, and it beats the heartbeat the liveness monitor watches.
  const second = await loop.tick()
  assert.equal(second.outcome, "idle")
  assert.equal(second.running, first.job.id)
  assert.equal(beats.length, 2, "an agent mid-run must not go silent")

  gate.resolve()
  const outcome = await loop.settle()
  assert.equal(outcome.record.conclusion, "success")
  assert.equal(loop.busy, false)
  assert.deepEqual(
    runner.runs,
    [MAIN_SHA],
    "polling through a run must not start a second one"
  )
  assert.equal(github.created.length, 1)
})

test("a force push during a run aborts it and the replacement SHA runs next", async () => {
  const entered = deferred()
  let mainSha = MAIN_SHA
  let observedSignal = null
  const github = fakeGitHub()
  const runner = {
    runs: [],
    async runProfile({ headSha, signal }) {
      this.runs.push(headSha)
      if (headSha !== MAIN_SHA) return { record: record(headSha) }
      observedSignal = signal
      entered.resolve()
      if (!signal.aborted) {
        await new Promise((resolve) =>
          signal.addEventListener("abort", resolve, { once: true })
        )
      }
      // What the real runner does with an aborted signal: stop the lanes and
      // report the run cancelled.
      return { record: record(headSha, "cancelled") }
    },
  }
  const loop = createLoop({
    contract,
    github,
    runner,
    loadProfile: async (name) => ({ profile: name, lanes: [] }),
    now: () => NOW,
  })
  const originalGetRef = github.getRef
  github.getRef = async (ref) => ({
    ...(await originalGetRef(ref)),
    sha: mainSha,
  })

  const ticking = loop.tick()
  await entered.promise
  assert.equal(await returnsPromptly(ticking), "returned")
  assert.equal((await ticking).outcome, "ran")

  mainSha = NEW_MAIN_SHA
  const second = await loop.tick()
  assert.equal(
    observedSignal.aborted,
    true,
    "supersession must be able to stop work already in flight"
  )
  assert.equal(observedSignal.reason.code, ABORT_SUPERSEDED)
  assert.equal(second.queued, 1)

  const outcome = await loop.settle()
  assert.equal(outcome.record.conclusion, "cancelled")
  assert.equal(github.updated.length, 1)
  assert.equal(github.updated[0].status, "completed")
  assert.equal(github.updated[0].conclusion, "cancelled")

  const third = await loop.tick()
  await loop.settle()
  assert.equal(third.outcome, "ran")
  assert.deepEqual(runner.runs, [MAIN_SHA, NEW_MAIN_SHA])
})

test("stop() settles the wait it interrupts instead of parking until launchd kills the agent", async () => {
  const parked = deferred()
  const loop = createLoop({
    contract: elsewhereContract(),
    github: fakeGitHub(),
    runner: fakeRunner(),
    loadProfile: async (name) => ({ profile: name }),
    now: () => NOW,
    // A wait nothing but `stop()` can settle - which is exactly the shape of
    // the real one once its timer has been cleared.
    sleep: () => {
      parked.resolve()
      return new Promise(() => {})
    },
  })

  const started = loop.start()
  await parked.promise
  loop.stop()

  assert.equal(
    await returnsPromptly(started),
    "returned",
    "a SIGTERM while idle must return from start(), not wait out launchd's ExitTimeOut"
  )
})

test("stop() aborts the run in flight so its check does not stay in_progress", async () => {
  const entered = deferred()
  let observedSignal = null
  const github = fakeGitHub()
  const runner = {
    runs: [],
    async runProfile({ headSha, signal }) {
      this.runs.push(headSha)
      observedSignal = signal
      entered.resolve()
      if (!signal.aborted) {
        await new Promise((resolve) =>
          signal.addEventListener("abort", resolve, { once: true })
        )
      }
      return { record: record(headSha, "cancelled") }
    },
  }
  const loop = buildLoop({
    github,
    runner,
    sleep: () => new Promise(() => {}),
  })

  const started = loop.start()
  await entered.promise
  loop.stop()

  assert.equal(await returnsPromptly(started), "returned")
  assert.equal(observedSignal.aborted, true)
  assert.equal(observedSignal.reason.code, ABORT_STOPPING)
  assert.equal(loop.busy, false)
  assert.equal(github.updated.length, 1)
  assert.equal(github.updated[0].status, "completed")
  assert.equal(
    github.updated[0].conclusion,
    "cancelled",
    "start() must not return before the aborted run has reported"
  )
})

test("expired logs are swept, and a running job's log is never swept", async () => {
  const removed = []
  const day = 24 * 60 * 60 * 1000
  const logStore = {
    async list() {
      return [
        { id: "old", createdAt: NOW - 40 * day },
        { id: "recent", createdAt: NOW - day },
        { id: "running", createdAt: NOW - 40 * day, status: "running" },
      ]
    },
    async remove(entry) {
      removed.push(entry.id)
    },
  }
  const loop = buildLoop({
    github: fakeGitHub(),
    runner: fakeRunner(),
    logStore,
  })

  const result = await loop.tick()
  await loop.settle()
  assert.equal(result.swept, 1)
  assert.deepEqual(removed, ["old"])
})

test("a loop with no log store says so at startup rather than reporting a swept-nothing sweep", async () => {
  const warnings = []
  const loop = buildLoop({
    github: fakeGitHub(),
    runner: fakeRunner(),
    logger: { warn: (message) => warnings.push(message) },
  })

  assert.equal(
    warnings.some(
      (message) =>
        /retention sweep can never run/.test(message) &&
        message.includes(String(contract.agent.logRetentionDays))
    ),
    true,
    "a retention promise this loop cannot keep must be loud at construction"
  )

  const result = await loop.tick()
  await loop.settle()
  assert.equal(
    result.swept,
    null,
    "null is 'there is no store to sweep'; 0 would read as a healthy sweep"
  )
})

test("the sleep assertion is a scoped caffeinate bound to the agent's own pid", () => {
  const spawned = []
  const child = {
    once() {},
    kill(signal) {
      spawned.push(`kill ${signal}`)
    },
  }
  const assertion = createSleepAssertion({
    spawnFn: (path, args) => {
      spawned.push([path, ...args].join(" "))
      return child
    },
    pid: 4242,
  })

  assert.equal(assertion.held, false)
  assert.equal(assertion.acquire(), true)
  assert.equal(assertion.held, true)
  // Re-entrant: a second acquire does not leak a second caffeinate.
  assert.equal(assertion.acquire(), false)
  assert.equal(assertion.release(), true)
  assert.equal(assertion.release(), false, "releasing nothing is safe")

  assert.deepEqual(spawned, [
    `${CAFFEINATE_PATH} ${CAFFEINATE_FLAGS.join(" ")} 4242`,
    "kill SIGTERM",
  ])
  assert.deepEqual(CAFFEINATE_FLAGS, ["-i", "-m", "-w"])
})

test("a caffeinate that cannot be spawned is a warning, not a failed run", () => {
  const warnings = []
  const assertion = createSleepAssertion({
    spawnFn: () => {
      throw new Error("ENOENT")
    },
    logger: { warn: (message) => warnings.push(message) },
  })
  assert.equal(assertion.acquire(), false)
  assert.equal(assertion.held, false)
  assert.equal(warnings.length, 1)
})

test("the poll cadence comes from the contract", () => {
  assert.equal(
    pollIntervalMs(contract),
    contract.agent.pollIntervalSeconds * 1000
  )
  assert.throws(
    () => pollIntervalMs({ agent: { pollIntervalSeconds: 0 } }),
    (error) => error.code === "INVALID_CONTRACT"
  )
})

test("createLoop refuses to exist without the dependencies it must be given", () => {
  assert.throws(
    () => createLoop({ contract, github: fakeGitHub(), runner: fakeRunner() }),
    (error) => error.code === "INVALID_INPUT"
  )
  assert.throws(
    () =>
      createLoop({
        contract,
        runner: fakeRunner(),
        loadProfile: async () => {},
      }),
    (error) => error.code === "INVALID_INPUT"
  )
})

test("stop during provider reads cannot start a new job", async () => {
  const pending = deferred()
  const github = fakeGitHub()
  github.getRef = () => pending.promise
  const runner = fakeRunner()
  const loop = buildLoop({ github, runner })
  const tick = loop.tick()
  loop.stop()
  pending.resolve({ sha: MAIN_SHA })
  assert.equal((await tick).outcome, "idle")
  await loop.settle()
  assert.equal(runner.runs.length, 0)
  assert.equal(github.created.length, 0)
  assert.equal((await loop.tick()).outcome, "idle")
})
