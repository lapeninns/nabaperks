import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { loadContract } from "../../ops/local-ci/core/contract.mjs"
import {
  CANCELLATION_SUPERSEDED,
  QueueError,
  cancelObsolete,
  complete,
  createQueueState,
  enqueue,
  findJob,
  isQueueFull,
  queuedJobs,
  runningJobs,
  selectNext,
} from "../../ops/local-ci/core/queue.mjs"

/**
 * local CI — the run queue. Every transition is a reducer over an explicit
 * `now`, so the scheduling rules that decide which head SHA burns the
 * machine's only run slot are pinned here rather than observed in production:
 * main outranks pr, a newer SHA supersedes an older one for the same ref, an
 * identical request is deduplicated, and one job runs at a time.
 */

const CONTRACT_PATH = fileURLToPath(
  new URL("../../config/local-ci-contract.json", import.meta.url)
)

const contract = loadContract(
  (path) => readFileSync(path, "utf8"),
  CONTRACT_PATH
)

const T0 = Date.parse("2026-09-04T09:00:00.000Z")
const MAIN_REF = "refs/heads/main"
const PR_REF = "refs/pull/41/head"

const sha = (seed) => String(seed).repeat(40).slice(0, 40)

const SHA_A = sha("a")
const SHA_B = sha("b")
const SHA_C = sha("c")

test("priority: a main job queued after a pull request job is selected first", () => {
  let state = createQueueState(contract)
  state = enqueue(state, { ref: PR_REF, sha: SHA_A, profile: "pr" }, T0).state
  state = enqueue(
    state,
    { ref: MAIN_REF, sha: SHA_B, profile: "main" },
    T0 + 1000
  ).state

  const first = selectNext(state, T0 + 2000)
  assert.equal(first.job.profile, "main")
  assert.equal(first.job.sha, SHA_B)
  assert.equal(first.job.priority, 0)
  assert.equal(first.job.status, "running")
  assert.equal(first.job.startedAt, new Date(T0 + 2000).toISOString())

  // The pull request is not lost, only outranked.
  assert.deepEqual(
    queuedJobs(first.state).map((job) => job.profile),
    ["pr"]
  )
})

test("priority: jobs of equal priority are selected first in, first out", () => {
  let state = createQueueState(contract)
  for (const [index, headSha] of [SHA_A, SHA_B, SHA_C].entries()) {
    state = enqueue(
      state,
      { ref: `refs/pull/${index + 1}/head`, sha: headSha, profile: "pr" },
      T0 + index
    ).state
  }

  const order = []
  for (let step = 0; step < 3; step += 1) {
    const selected = selectNext(state, T0 + 100 + step)
    order.push(selected.job.sha)
    // Finish it, so the single run slot is free for the next selection.
    state = complete(
      selected.state,
      selected.job.id,
      { status: "success" },
      T0 + 200 + step
    ).state
  }
  assert.deepEqual(order, [SHA_A, SHA_B, SHA_C])
})

test("priority: nightly queues behind both main and pr, and an unknown profile behind all three", () => {
  let state = createQueueState(contract)
  state = enqueue(
    state,
    { ref: "refs/heads/experiment", sha: sha("e"), profile: "experiment" },
    T0
  ).state
  state = enqueue(
    state,
    { ref: "refs/heads/nightly", sha: sha("d"), profile: "nightly" },
    T0 + 1
  ).state
  state = enqueue(
    state,
    { ref: PR_REF, sha: SHA_A, profile: "pr" },
    T0 + 2
  ).state
  state = enqueue(
    state,
    { ref: MAIN_REF, sha: SHA_B, profile: "main" },
    T0 + 3
  ).state

  const order = []
  for (let step = 0; step < 4; step += 1) {
    const selected = selectNext(state, T0 + 100 + step)
    order.push(selected.job.profile)
    state = complete(
      selected.state,
      selected.job.id,
      { status: "success" },
      T0 + 200 + step
    ).state
  }
  assert.deepEqual(order, ["main", "pr", "nightly", "experiment"])
})

test("stale SHA cancellation: a newer SHA cancels the queued job for that ref", () => {
  let state = createQueueState(contract)
  state = enqueue(
    state,
    { ref: MAIN_REF, sha: SHA_A, profile: "main" },
    T0
  ).state

  const pushed = enqueue(
    state,
    { ref: MAIN_REF, sha: SHA_B, profile: "main" },
    T0 + 5000
  )
  assert.equal(pushed.cancelled.length, 1)
  const cancelled = findJob(pushed.state, pushed.cancelled[0])
  assert.equal(cancelled.sha, SHA_A)
  assert.equal(cancelled.status, "cancelled")
  assert.equal(cancelled.cancellationCode, CANCELLATION_SUPERSEDED)
  assert.equal(cancelled.cancelledAt, new Date(T0 + 5000).toISOString())

  // Exactly one live job for the ref, and it is the new SHA.
  assert.deepEqual(
    queuedJobs(pushed.state).map((job) => job.sha),
    [SHA_B]
  )
})

test("stale SHA cancellation: a newer SHA cancels a running job for that ref", () => {
  let state = createQueueState(contract)
  state = enqueue(
    state,
    { ref: MAIN_REF, sha: SHA_A, profile: "main" },
    T0
  ).state
  const selected = selectNext(state, T0 + 1000)
  assert.equal(selected.job.status, "running")

  const superseded = cancelObsolete(selected.state, MAIN_REF, SHA_B, T0 + 2000)
  assert.deepEqual(superseded.cancelled, [selected.job.id])
  assert.equal(findJob(superseded.state, selected.job.id).status, "cancelled")
  assert.equal(runningJobs(superseded.state).length, 0)
})

test("stale SHA cancellation: a different ref is never touched", () => {
  let state = createQueueState(contract)
  state = enqueue(
    state,
    { ref: MAIN_REF, sha: SHA_A, profile: "main" },
    T0
  ).state
  state = enqueue(
    state,
    { ref: PR_REF, sha: SHA_C, profile: "pr" },
    T0 + 1
  ).state

  const superseded = cancelObsolete(state, MAIN_REF, SHA_B, T0 + 2)
  assert.equal(superseded.cancelled.length, 1)

  const untouched = queuedJobs(superseded.state).find(
    (job) => job.ref === PR_REF
  )
  assert.equal(untouched.sha, SHA_C)
  assert.equal(untouched.status, "queued")
  assert.equal(untouched.cancellationCode, null)
})

test("stale SHA cancellation: a completed job is never re-cancelled", () => {
  let state = createQueueState(contract)
  state = enqueue(
    state,
    { ref: MAIN_REF, sha: SHA_A, profile: "main" },
    T0
  ).state
  const selected = selectNext(state, T0 + 1)
  state = complete(
    selected.state,
    selected.job.id,
    { status: "success" },
    T0 + 2
  ).state

  const superseded = cancelObsolete(state, MAIN_REF, SHA_B, T0 + 3)
  assert.deepEqual(superseded.cancelled, [])
  // Nothing matched, so the same state comes back by reference.
  assert.equal(superseded.state, state)
  assert.equal(findJob(state, selected.job.id).status, "completed")
})

test("deduplication: the same ref, SHA and profile enqueued twice yields one job", () => {
  const state = createQueueState(contract)
  const first = enqueue(state, { ref: PR_REF, sha: SHA_A, profile: "pr" }, T0)
  const second = enqueue(
    first.state,
    { ref: PR_REF, sha: SHA_A, profile: "pr" },
    T0 + 30_000
  )

  assert.equal(first.deduplicated, false)
  assert.equal(second.deduplicated, true)
  assert.equal(second.job.id, first.job.id)
  assert.equal(
    second.state,
    first.state,
    "a redelivery must be side-effect free"
  )
  assert.equal(second.state.jobs.length, 1)
  assert.deepEqual(second.cancelled, [])
})

test("deduplication: SHA case does not create a second job", () => {
  const state = createQueueState(contract)
  const first = enqueue(state, { ref: PR_REF, sha: SHA_A, profile: "pr" }, T0)
  const second = enqueue(
    first.state,
    { ref: PR_REF, sha: SHA_A.toUpperCase(), profile: "pr" },
    T0 + 1
  )
  assert.equal(second.deduplicated, true)
  assert.equal(second.state.jobs.length, 1)
  assert.equal(first.job.sha, SHA_A, "SHAs are stored lowercase")
})

test("deduplication: a different profile for the same commit is separate work", () => {
  const state = createQueueState(contract)
  const first = enqueue(
    state,
    { ref: MAIN_REF, sha: SHA_A, profile: "main" },
    T0
  )
  const second = enqueue(
    first.state,
    { ref: MAIN_REF, sha: SHA_A, profile: "nightly" },
    T0 + 1
  )
  assert.equal(second.deduplicated, false)
  assert.equal(second.state.jobs.length, 2)
})

test("concurrency: never more than one job runs at a time", () => {
  assert.equal(contract.agent.maxConcurrentJobs, 1)

  let state = createQueueState(contract)
  state = enqueue(
    state,
    { ref: MAIN_REF, sha: SHA_A, profile: "main" },
    T0
  ).state
  state = enqueue(
    state,
    { ref: PR_REF, sha: SHA_B, profile: "pr" },
    T0 + 1
  ).state

  const first = selectNext(state, T0 + 2)
  assert.notEqual(first.job, null)
  assert.equal(runningJobs(first.state).length, 1)

  const second = selectNext(first.state, T0 + 3)
  assert.equal(second.job, null, "the run slot is taken")
  assert.equal(second.state, first.state)
  assert.equal(runningJobs(second.state).length, 1)

  const finished = complete(
    first.state,
    first.job.id,
    { status: "success" },
    T0 + 4
  )
  const third = selectNext(finished.state, T0 + 5)
  assert.equal(third.job.sha, SHA_B)
  assert.equal(runningJobs(third.state).length, 1)
})

test("selectNext returns null on an empty queue without touching the state", () => {
  const state = createQueueState(contract)
  const selected = selectNext(state, T0)
  assert.equal(selected.job, null)
  assert.equal(selected.state, state)
})

test("the queue refuses to grow past agent.queueDepthLimit", () => {
  let state = createQueueState(contract)
  for (let index = 0; index < contract.agent.queueDepthLimit; index += 1) {
    assert.equal(isQueueFull(state), false)
    state = enqueue(
      state,
      {
        ref: `refs/pull/${index + 1}/head`,
        sha: sha(String(index)),
        profile: "pr",
      },
      T0 + index
    ).state
  }
  assert.equal(isQueueFull(state), true)
  assert.equal(queuedJobs(state).length, contract.agent.queueDepthLimit)
})

test("completing a job that was cancelled mid-run reports applied false, not an error", () => {
  let state = createQueueState(contract)
  state = enqueue(
    state,
    { ref: MAIN_REF, sha: SHA_A, profile: "main" },
    T0
  ).state
  const selected = selectNext(state, T0 + 1)
  const superseded = cancelObsolete(selected.state, MAIN_REF, SHA_B, T0 + 2)

  const finished = complete(
    superseded.state,
    selected.job.id,
    { status: "success" },
    T0 + 3
  )
  assert.equal(finished.applied, false)
  assert.equal(finished.job.status, "cancelled")
  assert.equal(finished.state, superseded.state)
})

test("the queue refuses malformed input rather than scheduling it", () => {
  const state = createQueueState(contract)
  assert.throws(
    () =>
      enqueue(state, { ref: MAIN_REF, sha: "cafebabe", profile: "main" }, T0),
    (error) => error instanceof QueueError && error.code === "INVALID_SHA"
  )
  assert.throws(
    () => enqueue(state, { ref: MAIN_REF, sha: SHA_A, profile: "main" }),
    (error) => error.code === "MISSING_TIMESTAMP"
  )
  assert.throws(
    () => enqueue(state, { ref: "", sha: SHA_A, profile: "main" }, T0),
    (error) => error.code === "INVALID_JOB"
  )
  assert.throws(
    () => complete(state, "job-000001", { status: "success" }, T0),
    (error) => error.code === "UNKNOWN_JOB"
  )
  assert.throws(
    () => complete(state, "job-000001", { status: "exploded" }, T0),
    (error) => error.code === "INVALID_RESULT"
  )
})

test("a queued job cannot complete, and a completed job cannot complete twice", () => {
  let state = createQueueState(contract)
  const queued = enqueue(
    state,
    { ref: MAIN_REF, sha: SHA_A, profile: "main" },
    T0
  )
  assert.throws(
    () => complete(queued.state, queued.job.id, { status: "success" }, T0),
    (error) => error.code === "NOT_RUNNING"
  )

  const selected = selectNext(queued.state, T0 + 1)
  state = complete(
    selected.state,
    selected.job.id,
    { status: "success" },
    T0 + 2
  ).state
  assert.throws(
    () => complete(state, selected.job.id, { status: "success" }, T0 + 3),
    (error) => error.code === "ALREADY_COMPLETED"
  )
})
