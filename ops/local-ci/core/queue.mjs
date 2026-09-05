/**
 * The agent's run queue, as a pure reducer.
 *
 * Every transition takes a state and returns a new state; nothing here reads
 * the clock, the filesystem or the network, so the scheduling rules that
 * decide which head SHA burns the machine's only run slot are testable
 * offline and deterministically.
 *
 * Three rules carry the weight:
 *
 *   1. `main` outranks `pr`. A broken default branch blocks every developer,
 *      so it never waits behind a pull request. `nightly` ranks last because
 *      nobody is blocked on it.
 *   2. A newer SHA for a ref supersedes every older SHA of that ref. A force
 *      push or a follow-up commit makes the in-flight run's answer useless -
 *      finishing it would spend an hour proving something about code that no
 *      longer exists at that ref.
 *   3. At most `agent.maxConcurrentJobs` runs at once. That is 1: the lanes
 *      inside a run already saturate the machine, and two concurrent runs
 *      would contend for the same ports and the same local Supabase stack.
 */

import {
  LocalCiError,
  deepClone,
  deepFreeze,
  describeValue,
  toIsoTimestamp,
} from "./contract.mjs"

export const QUEUE_SCHEMA = "nabaperks.local-ci-queue.v1"

export const JOB_STATUSES = Object.freeze([
  "queued",
  "running",
  "completed",
  "cancelled",
])

/** Terminal statuses a completion result may report. */
export const RESULT_STATUSES = Object.freeze([
  "success",
  "failure",
  "timed_out",
  "cancelled",
  "incomplete",
])

/**
 * Lower number wins. Explicit rather than derived from the ref so a `pr`
 * profile pointed at refs/heads/main still queues as pull-request work.
 */
export const PROFILE_PRIORITY = Object.freeze({
  main: 0,
  pr: 1,
  nightly: 2,
})

/** Priority used for a profile the table does not name. */
export const DEFAULT_PROFILE_PRIORITY = 3

/** Machine-readable reason recorded on a superseded job. */
export const CANCELLATION_SUPERSEDED = "superseded-by-newer-sha"

export class QueueError extends LocalCiError {}

const COMMIT_SHA = /^[0-9a-fA-F]{40}$/

/** True for a 40-character hexadecimal commit SHA, in either case. */
export function isCommitSha(value) {
  return typeof value === "string" && COMMIT_SHA.test(value)
}

function requireSha(value, label) {
  if (!isCommitSha(value)) {
    throw new QueueError(
      "INVALID_SHA",
      `${label} must be a 40-character hexadecimal commit SHA (received ${describeValue(value)})`
    )
  }
  // Stored lowercase so two spellings of one commit can never dedup apart.
  return value.toLowerCase()
}

function requireNonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new QueueError(
      "INVALID_JOB",
      `${label} must be a non-empty string (received ${describeValue(value)})`
    )
  }
  return value
}

function requireState(state) {
  if (
    typeof state !== "object" ||
    state === null ||
    state.schema !== QUEUE_SCHEMA ||
    !Array.isArray(state.jobs)
  ) {
    throw new QueueError(
      "INVALID_STATE",
      `queue state must be a ${QUEUE_SCHEMA} document created by createQueueState (received ${describeValue(state)})`
    )
  }
  return state
}

/** Priority for a profile name; unknown profiles queue behind the known ones. */
export function priorityForProfile(profile) {
  requireNonEmptyString(profile, "job.profile")
  return Object.hasOwn(PROFILE_PRIORITY, profile)
    ? PROFILE_PRIORITY[profile]
    : DEFAULT_PROFILE_PRIORITY
}

/** The dedup key. Two requests with the same key are the same unit of work. */
export function jobKey({ ref, sha, profile }) {
  return `${profile} ${ref} ${String(sha).toLowerCase()}`
}

/**
 * Seed a queue state from the contract, so the concurrency and depth limits
 * travel with the state and every reducer keeps the signature the runtime
 * expects.
 */
export function createQueueState(contract) {
  if (typeof contract !== "object" || contract === null) {
    throw new QueueError(
      "INVALID_CONTRACT",
      `createQueueState requires the validated contract (received ${describeValue(contract)})`
    )
  }
  const agent = contract.agent
  if (typeof agent !== "object" || agent === null) {
    throw new QueueError(
      "INVALID_CONTRACT",
      "createQueueState requires contract.agent; validate the contract first"
    )
  }
  const maxConcurrentJobs = agent.maxConcurrentJobs
  const queueDepthLimit = agent.queueDepthLimit
  if (!Number.isInteger(maxConcurrentJobs) || maxConcurrentJobs < 1) {
    throw new QueueError(
      "INVALID_CONTRACT",
      `contract.agent.maxConcurrentJobs must be a positive integer (received ${describeValue(maxConcurrentJobs)})`
    )
  }
  if (!Number.isInteger(queueDepthLimit) || queueDepthLimit < 1) {
    throw new QueueError(
      "INVALID_CONTRACT",
      `contract.agent.queueDepthLimit must be a positive integer (received ${describeValue(queueDepthLimit)})`
    )
  }
  return deepFreeze({
    schema: QUEUE_SCHEMA,
    maxConcurrentJobs,
    queueDepthLimit,
    nextSequence: 1,
    jobs: [],
  })
}

function withJobs(state, jobs, extra = {}) {
  return deepFreeze({ ...state, ...extra, jobs })
}

/** Every job currently waiting, in insertion order. */
export function queuedJobs(state) {
  return requireState(state).jobs.filter((job) => job.status === "queued")
}

/** Every job currently executing. Length is bounded by maxConcurrentJobs. */
export function runningJobs(state) {
  return requireState(state).jobs.filter((job) => job.status === "running")
}

/** Look a job up by id, or null. */
export function findJob(state, jobId) {
  return requireState(state).jobs.find((job) => job.id === jobId) ?? null
}

/** True once the waiting jobs reach agent.queueDepthLimit. */
export function isQueueFull(state) {
  return queuedJobs(state).length >= requireState(state).queueDepthLimit
}

/**
 * The ordering rule, exposed so tests and the runtime agree on it: priority
 * ascending, then enqueue sequence ascending. Sequence is a strict total order
 * by construction, so the comparison never falls back on anything unstable.
 */
export function compareJobs(left, right) {
  if (left.priority !== right.priority) return left.priority - right.priority
  return left.sequence - right.sequence
}

function cancelOn(state, predicate, code, reason, now) {
  const cancelledAt =
    now === null || now === undefined ? null : toIsoTimestamp(now, "now")
  const cancelled = []
  const jobs = state.jobs.map((job) => {
    if (!predicate(job)) return job
    cancelled.push(job.id)
    return deepFreeze({
      ...job,
      status: "cancelled",
      cancelledAt,
      cancellationCode: code,
      cancellationReason: reason,
    })
  })
  if (cancelled.length === 0) return { state, cancelled: Object.freeze([]) }
  return {
    state: withJobs(state, jobs),
    cancelled: Object.freeze(cancelled),
  }
}

/**
 * Cancel every queued or running job for `ref` whose SHA is not `newSha`.
 *
 * Exposed separately from `enqueue` because the runtime also calls it on a
 * force push that produces no new job of its own - the old run still has to
 * stop, whether or not a replacement is queued.
 *
 * `now` is optional; when omitted the cancellation is recorded with a null
 * timestamp rather than the reducer reaching for the clock.
 *
 * Returns `{ state, cancelled }` where `cancelled` is the frozen list of
 * cancelled job ids. When nothing matched, `state` is the input by reference.
 */
export function cancelObsolete(state, ref, newSha, now = null) {
  requireState(state)
  requireNonEmptyString(ref, "ref")
  const sha = requireSha(newSha, "newSha")
  return cancelOn(
    state,
    (job) =>
      job.ref === ref &&
      job.sha !== sha &&
      (job.status === "queued" || job.status === "running"),
    CANCELLATION_SUPERSEDED,
    `superseded by ${sha} on ${ref}`,
    now
  )
}

/**
 * Enqueue a job request.
 *
 * `job` is `{ ref, sha, profile, priority?, metadata? }`. `now` is required -
 * the enqueue timestamp is part of the record, and taking it as an argument is
 * what keeps the reducer deterministic.
 *
 * Enqueuing a newer SHA for a ref supersedes the older SHAs of that ref first,
 * so the returned state never holds two live jobs for one ref.
 *
 * Deduplication is by `(ref, sha, profile)` against every job that has not
 * been cancelled, so re-delivering a webhook is a no-op that returns the
 * existing job rather than a second run of identical work.
 *
 * Returns `{ state, job, deduplicated, cancelled }`.
 */
export function enqueue(state, job, now) {
  requireState(state)
  if (typeof job !== "object" || job === null) {
    throw new QueueError(
      "INVALID_JOB",
      `enqueue requires a job object (received ${describeValue(job)})`
    )
  }
  if (now === undefined || now === null) {
    throw new QueueError(
      "MISSING_TIMESTAMP",
      "enqueue requires an explicit `now`; this reducer never reads the clock"
    )
  }

  const ref = requireNonEmptyString(job.ref, "job.ref")
  const sha = requireSha(job.sha, "job.sha")
  const profile = requireNonEmptyString(job.profile, "job.profile")
  const enqueuedAt = toIsoTimestamp(now, "now")

  let priority
  if (job.priority === undefined) {
    priority = priorityForProfile(profile)
  } else if (Number.isInteger(job.priority)) {
    priority = job.priority
  } else {
    throw new QueueError(
      "INVALID_JOB",
      `job.priority must be an integer when supplied (received ${describeValue(job.priority)})`
    )
  }

  const key = jobKey({ ref, sha, profile })
  const existing = state.jobs.find(
    (candidate) => candidate.key === key && candidate.status !== "cancelled"
  )
  if (existing) {
    // Deliberately before the supersede pass: an identical request cancels
    // nothing, and returning early keeps a redelivered webhook side-effect
    // free.
    return {
      state,
      job: existing,
      deduplicated: true,
      cancelled: Object.freeze([]),
    }
  }

  const superseded = cancelObsolete(state, ref, sha, now)
  const sequence = superseded.state.nextSequence
  const created = deepFreeze({
    id: `job-${String(sequence).padStart(6, "0")}`,
    key,
    ref,
    sha,
    profile,
    priority,
    sequence,
    status: "queued",
    enqueuedAt,
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    cancellationCode: null,
    cancellationReason: null,
    result: null,
    metadata: deepClone(job.metadata ?? null),
  })

  return {
    state: withJobs(superseded.state, [...superseded.state.jobs, created], {
      nextSequence: sequence + 1,
    }),
    job: created,
    deduplicated: false,
    cancelled: superseded.cancelled,
  }
}

/**
 * Pick the next job to run and mark it running.
 *
 * Returns `{ state, job }`. `job` is null - and `state` is the input by
 * reference - when nothing is waiting or when `maxConcurrentJobs` runs are
 * already in flight.
 *
 * `now` is optional; when omitted `startedAt` is recorded as null rather than
 * the reducer reaching for the clock.
 */
export function selectNext(state, now = null) {
  requireState(state)
  if (runningJobs(state).length >= state.maxConcurrentJobs) {
    return { state, job: null }
  }
  const candidates = queuedJobs(state)
  if (candidates.length === 0) return { state, job: null }

  const next = [...candidates].sort(compareJobs)[0]
  const startedAt =
    now === null || now === undefined ? null : toIsoTimestamp(now, "now")
  const started = deepFreeze({ ...next, status: "running", startedAt })
  const jobs = state.jobs.map((job) => (job.id === next.id ? started : job))
  return { state: withJobs(state, jobs), job: started }
}

/**
 * Record a terminal result for a running job.
 *
 * `result` must carry a `status` from RESULT_STATUSES; the rest of the
 * document is stored verbatim (cloned, then frozen) as the run's evidence.
 *
 * Completing a job that was cancelled while it ran is not an error - that race
 * is normal after a force push. It returns `applied: false` and leaves the
 * cancellation record intact, because the cancellation is the true outcome.
 *
 * Returns `{ state, job, applied }`.
 */
export function complete(state, jobId, result, now = null) {
  requireState(state)
  requireNonEmptyString(jobId, "jobId")
  if (typeof result !== "object" || result === null) {
    throw new QueueError(
      "INVALID_RESULT",
      `complete requires a result object (received ${describeValue(result)})`
    )
  }
  if (!RESULT_STATUSES.includes(result.status)) {
    throw new QueueError(
      "INVALID_RESULT",
      `result.status must be one of ${RESULT_STATUSES.join(", ")} (received ${describeValue(result.status)})`
    )
  }

  const job = findJob(state, jobId)
  if (!job) {
    throw new QueueError(
      "UNKNOWN_JOB",
      `no job with id ${JSON.stringify(jobId)} in the queue`
    )
  }
  if (job.status === "cancelled") {
    return { state, job, applied: false }
  }
  if (job.status === "completed") {
    throw new QueueError(
      "ALREADY_COMPLETED",
      `job ${jobId} already completed with status ${JSON.stringify(job.result?.status)}`
    )
  }
  if (job.status !== "running") {
    throw new QueueError(
      "NOT_RUNNING",
      `job ${jobId} is ${JSON.stringify(job.status)}; only a running job can complete`
    )
  }

  const completedAt =
    now === null || now === undefined ? null : toIsoTimestamp(now, "now")
  const finished = deepFreeze({
    ...job,
    status: "completed",
    completedAt,
    result: deepClone(result),
  })
  const jobs = state.jobs.map((entry) =>
    entry.id === jobId ? finished : entry
  )
  return { state: withJobs(state, jobs), job: finished, applied: true }
}
