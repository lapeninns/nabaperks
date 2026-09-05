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
 * Two rules are enforced here rather than assumed:
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
 */

import { spawn } from "node:child_process"

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
import { renderCheckSummary } from "../core/summary.mjs"
import { matchesPinnedRepositoryId } from "./github.mjs"

export class LoopError extends LocalCiError {}

/** The default branch this plane treats as `main` work. */
export const DEFAULT_BRANCH_REF = "refs/heads/main"

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
 * nothing is held, which is what makes the `finally` in `tick` unconditional.
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
 * `logger` and an optional `logStore` for the retention sweep. Nothing here
 * reaches for the clock, the network, the filesystem or the process
 * environment on its own.
 */
export function createLoop({
  contract,
  github,
  runner,
  loadProfile,
  heartbeat = null,
  sleepAssertion = null,
  logStore = null,
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

  let queue = createQueueState(contract)
  const refusals = []
  let running = false
  let stopping = false
  let timer = null

  async function publishStart(job) {
    try {
      const created = await github.createCheckRun({
        name:
          job.profile === "nightly"
            ? contract.nightlyCheckName
            : contract.checkName,
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

  async function publishResult(job, checkRunId, record) {
    const output = renderCheckSummary(record, contract)
    const payload = {
      status: "completed",
      conclusion: record.conclusion,
      completedAt: new Date(now()).toISOString(),
      output,
    }
    try {
      if (checkRunId === null) {
        await github.createCheckRun({
          name:
            job.profile === "nightly"
              ? contract.nightlyCheckName
              : contract.checkName,
          headSha: job.sha,
          ...payload,
        })
        return
      }
      await github.updateCheckRun(checkRunId, payload)
    } catch (error) {
      log(
        "error",
        `could not publish the result for ${job.sha}: ${error.message}`
      )
    }
  }

  async function sweepRetention(instant) {
    if (!logStore || typeof logStore.list !== "function") return 0
    try {
      const entries = await logStore.list()
      const running_ = runningJobs(queue).map((job) => job.id)
      const partition = partitionLogs(entries, instant, contract, {
        runningJobIds: running_,
      })
      for (const entry of partition.expired) {
        await logStore.remove(entry)
      }
      return partition.expired.length
    } catch (error) {
      log("warn", `retention sweep failed: ${error.message}`)
      return 0
    }
  }

  async function executeJob(job) {
    const profile = await loadProfile(job.profile)
    const checkRunId = await publishStart(job)
    // Acquired here, not at the top of the tick: an idle agent must hold no
    // power assertion, or the Mac never sleeps again.
    sleepAssertion?.acquire()
    try {
      const outcome = await runner.runProfile({
        profile,
        ref: job.ref,
        headSha: job.sha,
      })
      await publishResult(job, checkRunId, outcome.record)
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
      log("error", `run for ${job.sha} failed: ${error.message}`)
      const applied = complete(
        queue,
        job.id,
        { status: "incomplete", error: error.message },
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

  return Object.freeze({
    get state() {
      return queue
    },
    get refusals() {
      return Object.freeze([...refusals])
    },
    get busy() {
      return running
    },

    /**
     * One poll. Lists the default branch head and every open pull request,
     * classifies each, enqueues what this plane owns, cancels superseded SHAs,
     * and runs at most one job.
     *
     * Returns a record of what happened; it throws only when the poll itself
     * could not be made, so a caller on a timer keeps ticking.
     */
    async tick() {
      if (running) {
        return Object.freeze({ outcome: "idle", reason: "a job is in flight" })
      }
      running = true
      const instant = now()
      try {
        const [mainRef, pullRequests] = await Promise.all([
          github.getRef(DEFAULT_BRANCH_REF),
          github.listOpenPullRequests(),
        ])
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
          }
        }

        let queuedCount = 0
        for (const entry of classified.local) {
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

        const selected = selectNext(queue, instant)
        queue = selected.state
        const swept = await sweepRetention(instant)
        const beat = heartbeat ? await heartbeat.ping() : null

        if (selected.job === null) {
          return Object.freeze({
            outcome: queuedCount > 0 ? "queued" : "idle",
            queued: queuedCount,
            waiting: queuedJobs(queue).length,
            refused: classified.refused.length,
            hostedFork: classified.hostedFork.length,
            swept,
            heartbeat: beat,
          })
        }

        const outcome = await executeJob(selected.job)
        return Object.freeze({
          outcome: "ran",
          job: selected.job,
          conclusion: outcome.record.conclusion,
          queued: queuedCount,
          waiting: queuedJobs(queue).length,
          refused: classified.refused.length,
          hostedFork: classified.hostedFork.length,
          swept,
          heartbeat: beat,
        })
      } finally {
        running = false
      }
    },

    /**
     * Tick forever, `contract.agent.pollIntervalSeconds` apart. **Impure.**
     * A failing tick is logged and the loop continues: a transient GitHub
     * outage must not take the agent down, and launchd restarting it would
     * lose the queue.
     */
    async start() {
      stopping = false
      const interval = pollIntervalMs(contract)
      const wait =
        sleep ??
        ((ms) =>
          new Promise((resolve) => {
            timer = setTimeout(resolve, ms)
            timer.unref?.()
          }))
      log("info", `polling every ${Math.round(interval / 1000)}s`)
      while (!stopping) {
        try {
          const result = await this.tick()
          if (result.outcome !== "idle") {
            log("info", `tick: ${JSON.stringify(result.outcome)}`)
          }
        } catch (error) {
          log("error", `tick failed: ${error.message}`)
        }
        if (stopping) break
        await wait(interval)
      }
    },

    /** Ask `start()` to return after the current tick. */
    stop() {
      stopping = true
      if (timer) clearTimeout(timer)
      sleepAssertion?.release()
    },
  })
}
