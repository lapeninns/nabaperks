/**
 * What the hosted bridge job should do next.
 *
 * `local-proof` runs on GitHub-hosted infrastructure and polls for the check
 * run the local plane publishes. It is the join between a plane GitHub can see
 * and a plane it cannot, and every interesting failure lives at that join: the
 * Mac is asleep, the VM is down, the head SHA moved, or something published a
 * check with the right name and the wrong provenance.
 *
 * The decision is a pure function of the check run, the requested SHA and two
 * timestamps. Nothing here polls, sleeps or reads the clock - the caller owns
 * the loop, this owns the rule.
 *
 * The rerun path is the one worth reading twice. When the Mac wakes after the
 * bridge has already timed out, a green local check exists for a SHA whose
 * hosted job has already reported failure. Re-running that job turns it green
 * without a human re-pushing. It is attempted at most once per SHA, because a
 * rerun loop against a check that keeps looking eligible would re-run the
 * hosted workflow forever.
 */

import { LocalCiError, describeValue, toEpochMs } from "./contract.mjs"
import {
  checkRunIdentityViolations,
  isOnlyHeadShaMismatch,
} from "./app-identity.mjs"

export const BRIDGE_ACTIONS = Object.freeze([
  "wait",
  "accept",
  "reject",
  "rerun",
])

/** Bridge outcomes a previous attempt may have recorded. */
export const BRIDGE_OUTCOMES = Object.freeze([
  "timed_out",
  "rejected",
  "accepted",
])

/**
 * One rerun per head SHA. The bridge cannot distinguish "the rerun has not
 * started yet" from "the rerun is eligible again", so the count is the guard.
 */
export const MAX_RERUNS_PER_SHA = 1

/** The Actions write operation a rerun needs the App to be allowed to make. */
export const RERUN_OPERATION = "rerun-failed-jobs"

export class BridgeError extends LocalCiError {}

const COMMIT_SHA = /^[0-9a-fA-F]{40}$/

/** The bridge's give-up ceiling, in milliseconds. */
export function bridgeTimeoutMs(contract) {
  if (
    typeof contract !== "object" ||
    contract === null ||
    typeof contract.bridge !== "object" ||
    contract.bridge === null
  ) {
    throw new BridgeError(
      "INVALID_CONTRACT",
      `bridge decisions require the validated contract (received ${describeValue(contract)})`
    )
  }
  const minutes = contract.bridge.timeoutMinutes
  if (
    typeof minutes !== "number" ||
    !Number.isFinite(minutes) ||
    minutes <= 0
  ) {
    throw new BridgeError(
      "INVALID_CONTRACT",
      `contract.bridge.timeoutMinutes must be a positive finite number (received ${describeValue(minutes)})`
    )
  }
  return minutes * 60_000
}

function normaliseInput(input) {
  if (typeof input !== "object" || input === null) {
    throw new BridgeError(
      "INVALID_INPUT",
      `decideBridgeAction requires an options object (received ${describeValue(input)})`
    )
  }
  const {
    checkRun = null,
    requestedSha,
    startedAt,
    now,
    contract,
    previousOutcome = null,
    rerunAttempts = 0,
  } = input

  if (typeof requestedSha !== "string" || !COMMIT_SHA.test(requestedSha)) {
    throw new BridgeError(
      "INVALID_INPUT",
      `requestedSha must be a 40-character hexadecimal commit SHA (received ${describeValue(requestedSha)})`
    )
  }
  const timeoutMs = bridgeTimeoutMs(contract)
  const startedAtMs = toEpochMs(startedAt, "startedAt")
  const nowMs = toEpochMs(now, "now")
  if (nowMs < startedAtMs) {
    throw new BridgeError(
      "INVALID_INPUT",
      `now (${new Date(nowMs).toISOString()}) precedes startedAt (${new Date(startedAtMs).toISOString()}); the bridge clock cannot run backwards`
    )
  }
  if (previousOutcome !== null && !BRIDGE_OUTCOMES.includes(previousOutcome)) {
    throw new BridgeError(
      "INVALID_INPUT",
      `previousOutcome must be null or one of ${BRIDGE_OUTCOMES.join(", ")} (received ${describeValue(previousOutcome)})`
    )
  }
  if (!Number.isInteger(rerunAttempts) || rerunAttempts < 0) {
    throw new BridgeError(
      "INVALID_INPUT",
      `rerunAttempts must be a non-negative integer (received ${describeValue(rerunAttempts)})`
    )
  }

  return {
    checkRun,
    requestedSha: requestedSha.toLowerCase(),
    contract,
    previousOutcome,
    rerunAttempts,
    timeoutMs,
    startedAtMs,
    nowMs,
    elapsedMs: nowMs - startedAtMs,
  }
}

function minutes(milliseconds) {
  return Math.floor(milliseconds / 60_000)
}

function rerunAllowed(contract) {
  const allowed = contract.githubApp?.allowedActionsWriteOperations ?? []
  return Array.isArray(allowed) && allowed.includes(RERUN_OPERATION)
}

/**
 * The full decision, with the arithmetic that produced it.
 *
 * `decideBridgeAction` returns only `{ action, reason }` because that is what
 * the bridge script consumes and what the tests compare; this is the same
 * decision with `elapsedMinutes`, `timeoutMinutes` and `timedOut` attached,
 * for logging and for diagnosing a bridge that behaved unexpectedly.
 */
export function describeBridgeState(input) {
  const state = normaliseInput(input)
  const decision = decide(state)
  return Object.freeze({
    action: decision.action,
    reason: decision.reason,
    elapsedMinutes: minutes(state.elapsedMs),
    timeoutMinutes: minutes(state.timeoutMs),
    timedOut: state.elapsedMs >= state.timeoutMs,
    requestedSha: state.requestedSha,
  })
}

function decide(state) {
  const {
    checkRun,
    requestedSha,
    contract,
    previousOutcome,
    rerunAttempts,
    timeoutMs,
    elapsedMs,
  } = state
  const timedOut = elapsedMs >= timeoutMs
  const elapsed = minutes(elapsedMs)
  const budget = minutes(timeoutMs)
  const expected = { requestedSha, checkName: contract.checkName }

  if (checkRun === null || checkRun === undefined) {
    if (timedOut) {
      return {
        action: "reject",
        reason: `no ${JSON.stringify(contract.checkName)} check run for ${requestedSha} after ${elapsed} of ${budget} minutes; the local plane never reported`,
      }
    }
    return {
      action: "wait",
      reason: `no ${JSON.stringify(contract.checkName)} check run for ${requestedSha} yet; ${elapsed} of ${budget} minutes elapsed`,
    }
  }

  const violations = checkRunIdentityViolations(checkRun, contract, expected)
  if (violations.length > 0) {
    // A head-SHA mismatch on an otherwise valid check is not an impostor: it
    // is an older run of the same plane, and the one for this commit may still
    // arrive. Anything else is a provenance failure and no amount of waiting
    // makes a check published by the wrong App acceptable.
    if (isOnlyHeadShaMismatch(checkRun, contract, expected) && !timedOut) {
      return {
        action: "wait",
        reason: `the newest ${JSON.stringify(contract.checkName)} check is for a different commit (${violations.join("; ")}); ${elapsed} of ${budget} minutes elapsed`,
      }
    }
    return {
      action: "reject",
      reason: `check run identity refused: ${violations.join("; ")}`,
    }
  }

  if (checkRun.status !== "completed") {
    if (timedOut) {
      return {
        action: "reject",
        reason: `the local run for ${requestedSha} was still ${describeValue(checkRun.status)} after the ${budget}-minute bridge timeout`,
      }
    }
    return {
      action: "wait",
      reason: `the local run for ${requestedSha} is ${describeValue(checkRun.status)}; ${elapsed} of ${budget} minutes elapsed`,
    }
  }

  if (checkRun.conclusion !== "success") {
    return {
      action: "reject",
      reason: `the local run for ${requestedSha} concluded ${describeValue(checkRun.conclusion)}; only "success" is accepted`,
    }
  }

  // Completed, successful, and provably ours. The only question left is
  // whether this is the first look or the Mac-came-back-from-sleep look.
  if (previousOutcome === "timed_out") {
    if (rerunAttempts >= MAX_RERUNS_PER_SHA) {
      return {
        action: "reject",
        reason: `a successful local check exists for ${requestedSha}, but ${rerunAttempts} rerun(s) have already been attempted for this SHA (limit ${MAX_RERUNS_PER_SHA}); re-run the workflow by hand`,
      }
    }
    if (!rerunAllowed(contract)) {
      return {
        action: "reject",
        reason: `a successful local check exists for ${requestedSha}, but the App is not permitted to call ${JSON.stringify(RERUN_OPERATION)} (contract.githubApp.allowedActionsWriteOperations)`,
      }
    }
    return {
      action: "rerun",
      reason: `the bridge timed out earlier and a successful ${JSON.stringify(contract.checkName)} check now exists for ${requestedSha}; re-running the timed-out job once`,
    }
  }

  return {
    action: "accept",
    reason: `the local plane reported success for ${requestedSha} after ${elapsed} minute(s)`,
  }
}

/**
 * Decide what the bridge should do.
 *
 * Input is `{ checkRun, requestedSha, startedAt, now, contract,
 * previousOutcome?, rerunAttempts? }`:
 *
 *   - `checkRun` is the candidate check run, or null when none exists yet.
 *   - `startedAt` is when this bridge job began waiting; `now` is the poll
 *     instant. Both are explicit so the timeout is deterministic in tests.
 *   - `previousOutcome` is what an earlier bridge attempt for this SHA
 *     recorded; `"timed_out"` is what unlocks the rerun path.
 *   - `rerunAttempts` is how many reruns have already been requested for this
 *     SHA.
 *
 * Returns exactly `{ action, reason }`, where `action` is one of
 * BRIDGE_ACTIONS. `accept` is returned only for a completed check run with
 * conclusion `"success"` whose identity passes and whose head SHA is the
 * requested one; every other conclusion is `reject`.
 */
export function decideBridgeAction(input) {
  const state = normaliseInput(input)
  const { action, reason } = decide(state)
  return Object.freeze({ action, reason })
}
