/**
 * The poll loop: the one place where the pure core, the GitHub client and the
 * runner meet.
 *
 * A tick is a single, ordinary function call. It takes no timers, opens no
 * sockets of its own and reads no clock it was not handed, so a test drives a
 * whole day of agent behaviour - a force push mid-run, a fork pull request, a
 * queue at its depth limit - synchronously and offline. `start()` is nothing
 * more than `tick()` on an interval, and it is the only part of this file that
 * a test cannot reach.
 *
 * Six rules are enforced here rather than assumed:
 *
 *   - **A refused request is recorded and never enqueued.** Fork pull requests
 *     do not reach the queue, do not reach the runner and do not produce a
 *     local result; the hosted plane covers them in full. The refusal is kept
 *     in `refusals` so "we saw it and declined" is distinguishable from "we
 *     never saw it", which is the difference between a working allowlist and a
 *     broken poller.
 *
 *   - **The sleep assertion is scoped to a running job.** It is acquired
 *     immediately before the job starts and released in a `finally`, so an
 *     idle agent holds nothing and the Mac sleeps normally. The assertion is
 *     `caffeinate -i -m -w <pid>`: bound to a pid, it also releases itself if
 *     the agent dies, so there is no path that leaks a permanent assertion.
 *     The launchd plist deliberately does NOT wrap the agent in caffeinate;
 *     that would hold an assertion for the agent's entire lifetime, which is
 *     always. See ops/local-ci/host/com.nabaperks.local-ci.plist.
 *
 *   - **A tick never waits for the run it starts.** A profile has up to 75
 *     minutes; a tick that awaited it would stop polling for 75 minutes, and
 *     an agent that stops polling is one the liveness monitor reports dead and
 *     a force push cannot reach. The run is started, the tick returns, and the
 *     run is reachable through `settle()`. Single concurrency is unchanged -
 *     `contract.agent.maxConcurrentJobs` is 1 and no second job starts while
 *     one is in flight.
 *
 *   - **A run in flight is abortable.** The supersession rule is worth little
 *     if it can only cancel work that has not started, so the run is handed an
 *     AbortSignal: a newer SHA on its ref aborts it, and so does `stop()`.
 *
 *   - **A run that produced no record still completes its check.** Workspace
 *     preparation, runtime-env resolution and container startup all fail
 *     before the runner has anything to report. A check left `in_progress`
 *     there strands the bridge for its whole ceiling on a SHA that is never
 *     retried, because the queue entry is completed and later polls
 *     deduplicate it.
 *
 *   - **`stop()` settles the wait it interrupts.** Clearing the poll timer
 *     without settling the promise that timer was going to settle parks the
 *     loop on a promise nothing can resolve, and launchd escalates to SIGKILL
 *     when its ExitTimeOut expires.
 */

import { spawn } from "node:child_process"
import { publishAttempt } from "../core/attempts.mjs"
import { publishDurableCheck } from "./publisher.mjs"

import { LocalCiError, describeValue } from "../core/contract.mjs"
import { classifyRequest } from "../core/allowlist.mjs"
import {
  cancelObsolete,
  complete,
  createQueueState,
  enqueue,
  isQueueFull,
  queuedJobs,
  runningJobs,
  selectNext,
} from "../core/queue.mjs"
import { partitionLogs } from "../core/retention.mjs"
import {
  assertPublishable,
  redactSummaryText,
  renderCheckSummary,
} from "../core/summary.mjs"
import { matchesPinnedRepositoryId } from "./github.mjs"

export class LoopError extends LocalCiError {}

/** The default branch this plane treats as `main` work. */
export const DEFAULT_BRANCH_REF = "refs/heads/main"

/**
 * Why a run in flight was aborted. Both arrive at the runner as
 * `signal.reason.code`, so a cancelled run can say which of the two happened.
 */
export const ABORT_SUPERSEDED = "RUN_SUPERSEDED"
export const ABORT_STOPPING = "AGENT_STOPPING"

/**
 * The documented sleep assertion: `caffeinate -i -m -w <job pid>`.
 *
 *   -i  prevent idle system sleep
 *   -m  prevent disk sleep
 *   -w  exit when that pid exits, releasing the assertion
 *
 * The macOS persistent power-management settings CLI is forbidden anywhere
 * under ops/: it mutates global state that outlives the agent, where this
 * takes a scoped, self-releasing assertion.
 */
export const CAFFEINATE_PATH = "/usr/bin/caffeinate"
export const CAFFEINATE_FLAGS = Object.freeze(["-i", "-m", "-w"])

export const TICK_OUTCOMES = Object.freeze([
  "idle",
  "queued",
  "ran",
  "queue-full",
  "error",
])

function fail(code, message) {
  throw new LoopError(code, `local-ci loop: ${message}`)
}

function requireObject(value, label) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(
      "INVALID_INPUT",
      `${label} must be an object (received ${describeValue(value)})`
    )
  }
  return value
}

/** The poll cadence in milliseconds, from the contract. Pure. */
export function pollIntervalMs(contract) {
  const seconds = contract?.agent?.pollIntervalSeconds
  if (
    typeof seconds !== "number" ||
    !Number.isFinite(seconds) ||
    seconds <= 0
  ) {
    fail(
      "INVALID_CONTRACT",
      `contract.agent.pollIntervalSeconds must be a positive finite number (received ${describeValue(seconds)})`
    )
  }
  return Math.round(seconds * 1000)
}

/**
 * Turn what the GitHub client returned into candidate job requests. Pure.
 *
 * The default branch's candidate carries the contract's own repository as its
 * head repository, because it was read from that repository's ref endpoint -
 * the allowlist comparison there is structural rather than discriminating, and
 * it is the pull request candidates where it does the real work.
 */
export function candidatesFrom({
  mainRef = null,
  pullRequests = [],
  contract,
}) {
  requireObject(contract, "contract")
  const candidates = []
  if (mainRef && typeof mainRef.sha === "string") {
    candidates.push(
      Object.freeze({
        event: "push",
        profile: "main",
        ref: mainRef.ref ?? DEFAULT_BRANCH_REF,
        sha: mainRef.sha,
        headRepository: contract.repository,
        baseRepository: contract.repository,
        headRepositoryId: contract.githubApp?.repositoryId ?? null,
        number: null,
      })
    )
  }
  for (const pull of pullRequests) {
    candidates.push(
      Object.freeze({
        event: "pull_request",
        profile: "pr",
        ref: pull.ref,
        sha: pull.sha,
        headRepository: pull.headRepository,
        baseRepository: pull.baseRepository,
        headRepositoryId: pull.headRepositoryId ?? null,
        number: pull.number ?? null,
      })
    )
  }
  return Object.freeze(candidates)
}

/**
 * Split candidates into what this plane may run and what it must not. Pure.
 *
 * The repository-id pin is checked here as well as the full name: a repository
 * can be renamed, and a rename that produced the allowlisted full name would
 * pass a name-only check. When the contract still carries the null sentinel
 * the pin is not yet available and the exact-name match stands alone.
 */
export function classifyCandidates(candidates, contract) {
  const local = []
  const hostedFork = []
  const refused = []
  for (const candidate of candidates) {
    const verdict = classifyRequest(candidate, contract)
    const record = Object.freeze({ candidate, verdict })
    if (verdict.classification === "hosted-fork") {
      hostedFork.push(record)
      continue
    }
    if (verdict.classification !== "local") {
      refused.push(record)
      continue
    }
    if (!matchesPinnedRepositoryId(candidate.headRepositoryId, contract)) {
      refused.push(
        Object.freeze({
          candidate,
          verdict: Object.freeze({
            ...verdict,
            classification: "refused",
            code: "REPOSITORY_ID_MISMATCH",
            reason: `head repository id ${describeValue(candidate.headRepositoryId)} is not the pinned contract.githubApp.repositoryId; a renamed repository can present the allowlisted full name, and the id cannot be renamed`,
          }),
        })
      )
      continue
    }
    local.push(record)
  }
  return Object.freeze({
    local: Object.freeze(local),
    hostedFork: Object.freeze(hostedFork),
    refused: Object.freeze(refused),
  })
}

/**
 * The job-scoped power assertion. **Impure** - it spawns a process.
 *
 * `acquire` is a no-op when an assertion is already held, so a re-entrant
 * caller cannot leak a second `caffeinate`. `release` is safe to call when
 * nothing is held, which is what makes the `finally` in `executeJob`
 * unconditional and `stop()` free to release on its way out.
 */
export function createSleepAssertion({
  spawnFn = spawn,
  pid = process.pid,
  logger = null,
  path = CAFFEINATE_PATH,
} = {}) {
  let child = null
  const log = (level, message) => {
    if (logger && typeof logger[level] === "function") logger[level](message)
  }
  return Object.freeze({
    get held() {
      return child !== null
    },
    acquire() {
      if (child !== null) return false
      try {
        child = spawnFn(path, [...CAFFEINATE_FLAGS, String(pid)], {
          stdio: "ignore",
          detached: false,
        })
        child.once("error", (error) => {
          log("warn", `could not hold a sleep assertion: ${error.message}`)
          child = null
        })
        child.once("exit", () => {
          child = null
        })
        return true
      } catch (error) {
        log("warn", `could not hold a sleep assertion: ${error.message}`)
        child = null
        return false
      }
    },
    release() {
      if (child === null) return false
      try {
        child.kill("SIGTERM")
      } catch {
        // Already gone: -w releases the assertion when the watched pid exits,
        // so there is nothing left to clean up.
      }
      child = null
      return true
    },
  })
}

/**
 * Build the loop.
 *
 * Every dependency is injected: `github` (ops/local-ci/agent/github.mjs),
 * `runner`, `heartbeat`, `sleepAssertion`, `loadProfile`, `now`, `sleep`,
 * `logger` and a `logStore` for the retention sweep. Nothing here reaches for
 * the clock, the network, the filesystem or the process environment on its
 * own.
 */
export function createLoop({
  contract,
  github,
  runner,
  loadProfile,
  heartbeat = null,
  sleepAssertion = null,
  logStore = null,
  attempts = null,
  now = () => Date.now(),
  sleep = null,
  logger = null,
} = {}) {
  requireObject(contract, "contract")
  requireObject(github, "github")
  requireObject(runner, "runner")
  if (typeof loadProfile !== "function") {
    fail(
      "INVALID_INPUT",
      `createLoop requires a loadProfile(name) function (received ${describeValue(loadProfile)})`
    )
  }

  const log = (level, message) => {
    if (logger && typeof logger[level] === "function") logger[level](message)
  }

  const canSweep = Boolean(logStore) && typeof logStore.list === "function"
  if (!canSweep) {
    // The contract promises `agent.logRetentionDays` of evidence and no more.
    // With no store this loop can delete nothing, so that promise is quietly
    // untrue and the run evidence grows until the disk is full. Said once, at
    // construction, rather than every poll: a warning repeated every minute is
    // one an operator learns to scroll past.
    log(
      "warn",
      `no logStore was given to createLoop, so the ${contract.agent?.logRetentionDays}-day retention sweep can never run; run evidence under ${contract.evidence?.artifactRoot ?? "the evidence root"} will accumulate until the disk fills`
    )
  }

  let queue = createQueueState(contract)
  const refusals = []
  let polling = false
  let stopping = false
  let generation = 0
  let timer = null
  let notifyStop = null
  // The run this loop started and has not yet observed finishing, and the most
  // recent one whatever its state. `settle()` reads the second so a caller can
  // still take the outcome of a run that finished between two ticks.
  let inFlight = null
  let lastRun = null

  const checkNameFor = (job) =>
    job.profile === "nightly" ? contract.nightlyCheckName : contract.checkName

  async function publishStart(job, attemptId = null) {
    try {
      if (attemptId) {
        await publishDurableCheck({
          github,
          contract,
          journal: attempts,
          attempt: attempts.entries.find((entry) => entry.id === attemptId),
          payload: {
            status: "in_progress",
            startedAt: new Date(now()).toISOString(),
            output: {
              title: `${job.profile} — running`,
              summary: `Running durable attempt for ${job.sha}.`,
            },
          },
        })
        return attempts.entries.find((entry) => entry.id === attemptId)
          .checkRunId
      }
      const created = await github.createCheckRun({
        name: checkNameFor(job),
        headSha: job.sha,
        status: "in_progress",
        startedAt: new Date(now()).toISOString(),
        output: {
          title: `${job.profile} — running`,
          summary: `The local plane claimed \`${job.sha}\` on \`${job.ref}\` and is running the \`${job.profile}\` profile.`,
        },
      })
      return created?.id ?? null
    } catch (error) {
      // A publish failure must not lose the run. The bridge treats a missing
      // check as "not reported yet" and keeps waiting, which is the correct
      // reading of a machine that ran the work but could not say so.
      log(
        "error",
        `could not open a check run for ${job.sha}: ${error.message}`
      )
      return null
    }
  }

  async function publishResult(
    job,
    checkRunId,
    record,
    attemptId = null,
    stillOwned = () => true
  ) {
    const output = renderCheckSummary(record, contract)
    const payload = {
      status: "completed",
      conclusion: record.conclusion,
      completedAt: new Date(now()).toISOString(),
      output,
    }
    try {
      if (attemptId)
        return await publishDurableCheck({
          github,
          contract,
          journal: attempts,
          attempt: attempts.entries.find((entry) => entry.id === attemptId),
          payload,
          stillOwned,
        })
      if (checkRunId === null) {
        await github.createCheckRun({
          name: checkNameFor(job),
          headSha: job.sha,
          ...payload,
        })
        return true
      }
      await github.updateCheckRun(checkRunId, payload)
      return true
    } catch (error) {
      log(
        "error",
        `could not publish the result for ${job.sha}: ${error.message}`
      )
      return false
    }
  }

  /**
   * The check output for a run that produced no record.
   *
   * `renderCheckSummary` needs lanes, counts and a log digest, and this path
   * has none of them - the failure happened before the runner produced
   * anything. So the output is built here and put through the same redaction
   * and the same proof pass the rendered summary uses: an unexpected error
   * message is exactly where a token turns up, and this text goes to GitHub.
   * A detail that cannot be proved clean is replaced wholesale rather than
   * withheld, because the check still has to complete.
   */
  function renderIncompleteOutput(job, error, cancelled) {
    const title = `${job.profile} — ${cancelled ? "cancelled" : "did not run"}`
    const detail = cancelled
      ? `The local plane cancelled \`${job.sha}\` on \`${job.ref}\` before the run produced a result.`
      : `The local plane claimed \`${job.sha}\` on \`${job.ref}\` and could not run it, so there is no lane result to report.`
    const parts = {
      title: redactSummaryText(title, contract),
      summary: redactSummaryText(
        `${detail}\n\n**Error:** ${error?.message ?? String(error)}`,
        contract
      ),
    }
    try {
      assertPublishable(parts, contract)
      return parts
    } catch (proofError) {
      log(
        "warn",
        `the failure detail for ${job.sha} did not survive the publishable-output proof and was withheld: ${proofError.message}`
      )
      return {
        title: `local run — ${cancelled ? "cancelled" : "did not run"}`,
        summary:
          "The local plane could not run this commit. The failure detail was withheld because it did not survive the publishable-output proof; the agent log on the host carries it.",
      }
    }
  }

  /**
   * Complete the check run for a job whose run threw.
   *
   * Deliberately failure-tolerant. It runs on the error path, and letting a
   * GitHub outage throw from here would replace the real failure - the one the
   * operator has to fix - with a reporting failure.
   */
  async function publishIncomplete(
    job,
    checkRunId,
    error,
    cancelled,
    attemptId = null,
    stillOwned = () => true
  ) {
    try {
      const payload = {
        status: "completed",
        conclusion: cancelled ? "cancelled" : "failure",
        completedAt: new Date(now()).toISOString(),
        output: renderIncompleteOutput(job, error, cancelled),
      }
      if (attemptId)
        return await publishDurableCheck({
          github,
          contract,
          journal: attempts,
          attempt: attempts.entries.find((entry) => entry.id === attemptId),
          payload,
          stillOwned,
        })
      if (checkRunId === null) {
        await github.createCheckRun({
          name: checkNameFor(job),
          headSha: job.sha,
          ...payload,
        })
        return true
      }
      await github.updateCheckRun(checkRunId, payload)
      return true
    } catch (publishError) {
      log(
        "error",
        `could not complete the check run for ${job.sha} after the run failed: ${publishError.message}`
      )
      return false
    }
  }

  async function sweepRetention(instant) {
    // null rather than 0: "there is no store to sweep" and "nothing had aged
    // out" are different facts, and this number is published in the tick
    // result where a zero reads as a healthy sweep.
    if (!canSweep) return null
    try {
      const entries = await logStore.list()
      if (stopping) return 0
      const running_ = runningJobs(queue).map((job) => job.id)
      const partition = partitionLogs(entries, instant, contract, {
        runningJobIds: running_,
      })
      for (const entry of partition.expired) {
        if (stopping) break
        await logStore.remove(entry)
      }
      return partition.expired.length
    } catch (error) {
      log("warn", `retention sweep failed: ${error.message}`)
      return 0
    }
  }

  async function executeJob(job, signal, attemptId) {
    let checkRunId = null
    // Acquired here, not at the top of the tick: an idle agent must hold no
    // power assertion, or the Mac never sleeps again.
    sleepAssertion?.acquire()
    try {
      const profile = await loadProfile(job.profile)
      signal?.throwIfAborted()
      checkRunId = await publishStart(job, attemptId)
      signal?.throwIfAborted()
      let outcome = await runner.runProfile({
        profile,
        ref: job.ref,
        headSha: job.sha,
        signal,
      })
      if (signal?.aborted)
        outcome = {
          ...outcome,
          record: { ...outcome.record, conclusion: "cancelled" },
        }
      if (attemptId)
        attempts.finish(
          attemptId,
          signal?.reason?.code === ABORT_SUPERSEDED
            ? "superseded"
            : outcome.record.conclusion,
          outcome.record
        )
      if (attemptId)
        await publishAttempt(attempts, attemptId, () =>
          publishResult(job, checkRunId, outcome.record, attemptId)
        )
      else await publishResult(job, checkRunId, outcome.record)
      const applied = complete(
        queue,
        job.id,
        {
          status:
            outcome.record.conclusion === "success"
              ? "success"
              : outcome.record.conclusion === "timed_out"
                ? "timed_out"
                : outcome.record.conclusion === "cancelled"
                  ? "cancelled"
                  : "failure",
          conclusion: outcome.record.conclusion,
          logDigest: outcome.record.logDigest,
          lanes: outcome.record.lanes.length,
        },
        now()
      )
      queue = applied.state
      return outcome
    } catch (error) {
      const cancelled = signal?.aborted === true
      log(
        "error",
        `run for ${job.sha} ${cancelled ? "was cancelled" : "failed"}: ${error.message}`
      )
      // Persist incomplete execution before publishing. The durable journal
      // permits one bounded infrastructure retry after publication/backoff;
      // an unjournalled caller retains the original queue deduplication.
      if (attemptId)
        attempts.finish(
          attemptId,
          signal?.reason?.code === ABORT_SUPERSEDED
            ? "superseded"
            : cancelled
              ? "cancelled"
              : "incomplete"
        )
      if (attemptId)
        await publishAttempt(attempts, attemptId, () =>
          publishIncomplete(job, checkRunId, error, cancelled, attemptId)
        )
      else await publishIncomplete(job, checkRunId, error, cancelled)
      const applied = complete(
        queue,
        job.id,
        {
          status: cancelled ? "cancelled" : "incomplete",
          error: error.message,
        },
        now()
      )
      queue = applied.state
      throw error
    } finally {
      // Unconditional: cancelled, failed, timed out or thrown, the assertion
      // is released here and the machine is free to sleep again.
      sleepAssertion?.release()
    }
  }

  /**
   * Start a job and return without waiting for it. The returned entry carries
   * the promise; `settle()` is how a caller takes the outcome.
   */
  function startJob(job) {
    const controller = new AbortController()
    const entry = { job, controller, completion: null }
    const attemptId = attempts?.begin(job) ?? null
    entry.completion = executeJob(job, controller.signal, attemptId).then(
      (outcome) => {
        if (inFlight === entry) inFlight = null
        return outcome
      },
      (error) => {
        if (inFlight === entry) inFlight = null
        throw error
      }
    )
    // Observed here so a run nobody settles can never take the process down
    // with an unhandled rejection. `settle()` re-raises it for a caller that
    // wants it, and `executeJob` has already logged it.
    entry.completion.catch(() => {})
    inFlight = entry
    lastRun = entry
    return entry
  }

  function abortInFlight(code, message) {
    if (inFlight === null || inFlight.controller.signal.aborted) return false
    inFlight.controller.abort(new LoopError(code, `local-ci loop: ${message}`))
    return true
  }

  return Object.freeze({
    get state() {
      return queue
    },
    get refusals() {
      return Object.freeze([...refusals])
    },
    get busy() {
      return inFlight !== null
    },

    /**
     * One poll. Lists the default branch head and every open pull request,
     * classifies each, enqueues what this plane owns, cancels superseded SHAs
     * - aborting one in flight - and starts at most one job.
     *
     * It does not wait for the job it starts: that is what keeps the next poll
     * and the next heartbeat on schedule through a 75-minute profile. Use
     * `settle()` to take the run's outcome.
     *
     * Returns a record of what happened; it throws only when the poll itself
     * could not be made, so a caller on a timer keeps ticking.
     */
    async tick() {
      const ownGeneration = generation
      const stopped = () => stopping || generation !== ownGeneration
      const stopResult = () =>
        Object.freeze({ outcome: "idle", reason: "the agent is stopping" })
      if (stopping) {
        return Object.freeze({
          outcome: "idle",
          reason: "the agent is stopping",
        })
      }
      if (polling) {
        return Object.freeze({
          outcome: "idle",
          reason: "a poll is already in flight",
        })
      }
      polling = true
      const instant = now()
      try {
        const [mainRef, pullRequests] = await Promise.all([
          github.getRef(DEFAULT_BRANCH_REF),
          github.listOpenPullRequests(),
        ])
        // stop() may have run while the provider reads were pending.
        if (stopped()) {
          return Object.freeze({
            outcome: "idle",
            reason: "the agent is stopping",
          })
        }
        const candidates = candidatesFrom({ mainRef, pullRequests, contract })
        const classified = classifyCandidates(candidates, contract)

        for (const entry of classified.refused) {
          refusals.push(
            Object.freeze({
              at: new Date(instant).toISOString(),
              ref: entry.candidate.ref,
              sha: entry.candidate.sha,
              code: entry.verdict.code,
              reason: entry.verdict.reason,
            })
          )
          log("warn", `refused ${entry.candidate.ref}: ${entry.verdict.reason}`)
        }
        for (const entry of classified.hostedFork) {
          log(
            "info",
            `${entry.candidate.ref} is a fork pull request; it stays on the GitHub-hosted plane and this plane produces no result for it`
          )
        }

        // Supersede first, so a force push stops an in-flight run even when the
        // replacement SHA cannot be enqueued because the queue is full.
        for (const entry of classified.local) {
          if (typeof entry.candidate.sha !== "string") continue
          const cancelled = cancelObsolete(
            queue,
            entry.candidate.ref,
            entry.candidate.sha,
            instant
          )
          queue = cancelled.state
          for (const id of cancelled.cancelled) {
            log("info", `cancelled ${id}: superseded on ${entry.candidate.ref}`)
            // Cancelling the queue entry of a job that is already executing
            // only renames it. The run itself stops because of this abort, and
            // without it the machine spends the next hour proving something
            // about code that is no longer at that ref.
            if (inFlight !== null && inFlight.job.id === id) {
              abortInFlight(
                ABORT_SUPERSEDED,
                `run ${id} was superseded by ${entry.candidate.sha} on ${entry.candidate.ref}`
              )
              log("info", `aborting the run in flight for ${id}`)
            }
          }
        }

        // Re-publish durable terminal evidence before admitting any retry.
        // Interrupted work can only publish failure, never a fabricated success.
        for (const attempt of attempts?.entries ?? []) {
          if (stopped()) return stopResult()
          if (
            attempt.status === "running" ||
            attempt.publish === false ||
            attempt.published ||
            (inFlight &&
              inFlight.job.sha === attempt.sha &&
              inFlight.job.ref === attempt.ref &&
              inFlight.job.profile === attempt.profile)
          )
            continue
          await publishAttempt(
            attempts,
            attempt.id,
            () =>
              attempt.record
                ? publishResult(
                    attempt,
                    attempt.checkRunId,
                    attempt.record,
                    attempt.id,
                    () => !stopped()
                  )
                : publishIncomplete(
                    attempt,
                    attempt.checkRunId,
                    new Error(`Durable attempt ended ${attempt.status}`),
                    ["cancelled", "superseded"].includes(attempt.status),
                    attempt.id,
                    () => !stopped()
                  ),
            () => !stopped()
          )
          if (stopped()) return stopResult()
        }

        if (stopped()) return stopResult()
        let queuedCount = 0
        for (const entry of classified.local) {
          if (attempts && !attempts.eligible(entry.candidate)) continue
          if (isQueueFull(queue)) {
            log(
              "warn",
              `queue is at its depth limit (${contract.agent.queueDepthLimit}); ${entry.candidate.ref} waits for the next tick`
            )
            break
          }
          const result = enqueue(
            queue,
            {
              retry: attempts !== null,
              ref: entry.candidate.ref,
              sha: entry.candidate.sha,
              profile: entry.candidate.profile,
              metadata: {
                event: entry.candidate.event,
                pullRequest: entry.candidate.number,
              },
            },
            instant
          )
          queue = result.state
          if (!result.deduplicated) queuedCount += 1
        }

        // One job at a time, guarded on `inFlight` rather than on the queue's
        // own concurrency check: a superseded job stops counting as running the
        // moment it is cancelled, while the process it started is still winding
        // down, and starting a second run into that would put two of them on
        // the same ports and the same local Supabase stack.
        let started = null
        if (stopped()) return stopResult()
        if (inFlight === null) {
          const selected = selectNext(queue, instant)
          queue = selected.state
          if (selected.job !== null) started = startJob(selected.job)
        }
        const runningId = inFlight === null ? null : inFlight.job.id

        const swept = await sweepRetention(instant)
        if (stopped()) return stopResult()
        const beat = heartbeat ? await heartbeat.ping() : null
        if (stopped()) return stopResult()

        const common = {
          queued: queuedCount,
          waiting: queuedJobs(queue).length,
          refused: classified.refused.length,
          hostedFork: classified.hostedFork.length,
          running: runningId,
          swept,
          heartbeat: beat,
        }

        if (started === null) {
          return Object.freeze({
            outcome: queuedCount > 0 ? "queued" : "idle",
            ...common,
          })
        }

        return Object.freeze({
          outcome: "ran",
          job: started.job,
          ...common,
        })
      } finally {
        polling = false
      }
    },

    /**
     * Wait for the run this loop started most recently and return its outcome,
     * or null when it has never started one.
     *
     * A run no longer finishes inside the tick that started it, so this is how
     * a caller takes its result: `start()` on its way out, a test between two
     * ticks. It re-raises whatever the run threw.
     */
    async settle() {
      if (lastRun === null) return null
      return await lastRun.completion
    },

    /**
     * Tick forever, `contract.agent.pollIntervalSeconds` apart. **Impure.**
     * A failing tick is logged and the loop continues: a transient GitHub
     * outage must not take the agent down, and launchd restarting it would
     * lose the queue.
     */
    async start() {
      generation += 1
      stopping = false
      const interval = pollIntervalMs(contract)
      const stopped = new Promise((resolve) => {
        notifyStop = resolve
      })
      const wait =
        sleep ??
        ((ms) =>
          new Promise((resolve) => {
            timer = setTimeout(resolve, ms)
          }))
      log("info", `polling every ${Math.round(interval / 1000)}s`)
      while (!stopping) {
        try {
          const result = await Promise.race([this.tick(), stopped])
          if (stopping) break
          if (result.outcome !== "idle") {
            log("info", `tick: ${JSON.stringify(result.outcome)}`)
          }
        } catch (error) {
          log("error", `tick failed: ${error.message}`)
        }
        if (stopping) break
        // Raced against `stopped` so a SIGTERM arriving mid-wait returns now
        // rather than a poll interval later. The race covers an injected
        // `sleep` too: `stop()` cannot reach inside one of those either.
        await Promise.race([wait(interval), stopped])
      }
      // `stop()` aborted the run in flight; waiting for it here is what gets
      // its cancelled check published before the process exits.
      try {
        await this.settle()
      } catch {
        // Already logged by `executeJob`, and a run that ended badly is not a
        // shutdown that ended badly.
      }
    },

    /**
     * Ask `start()` to return: wake the poll wait, abort the run in flight,
     * release the assertion.
     *
     * The wake is the part that is easy to miss. `start()` is parked on a
     * promise that only the poll timer settles, and clearing that timer
     * without settling it leaves the loop awaiting something nothing can
     * resolve - until launchd's ExitTimeOut expires and SIGKILL arrives, two
     * minutes after the agent had already finished its work.
     *
     * The run in flight is aborted rather than waited for. A profile has 75
     * minutes and launchd has 120 seconds, so the real choice is between a
     * check completed as `cancelled` and a check left `in_progress` by a
     * killed process.
     */
    stop() {
      generation += 1
      stopping = true
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      if (notifyStop) {
        const resolve = notifyStop
        notifyStop = null
        resolve()
      }
      abortInFlight(ABORT_STOPPING, "the agent is stopping")
      sleepAssertion?.release()
    },
  })
}
