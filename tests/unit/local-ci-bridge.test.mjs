import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import {
  loadContract,
  validateContract,
} from "../../ops/local-ci/core/contract.mjs"
import {
  BridgeError,
  MAX_RERUNS_PER_SHA,
  bridgeTimeoutMs,
  decideBridgeAction,
  describeBridgeState,
} from "../../ops/local-ci/core/bridge.mjs"

/**
 * local CI — what the hosted bridge job does next.
 *
 * `local-proof` runs on GitHub-hosted infrastructure and polls for a check run
 * published by a plane GitHub cannot see, so every interesting failure lives
 * at that join: the Mac is asleep, the head SHA moved, or something published
 * a check with the right name and the wrong provenance. The decision is a pure
 * function of the check run, the requested SHA and two timestamps.
 */

const CONTRACT_TEXT = readFileSync(
  fileURLToPath(
    new URL("../../config/local-ci-contract.json", import.meta.url)
  ),
  "utf8"
)

const contract = loadContract(() => CONTRACT_TEXT)

const REQUESTED_SHA = "d".repeat(40)
const OTHER_SHA = "e".repeat(40)
const STARTED_AT = Date.parse("2026-09-04T09:00:00.000Z")
const TIMEOUT_MS = contract.bridge.timeoutMinutes * 60_000

const checkRun = (overrides = {}) => ({
  id: 77,
  name: contract.checkName,
  head_sha: REQUESTED_SHA,
  status: "completed",
  conclusion: "success",
  app: { id: 1234567, slug: "nabaperks-local-ci" },
  ...overrides,
})

const decide = (overrides = {}) =>
  decideBridgeAction({
    checkRun: null,
    requestedSha: REQUESTED_SHA,
    startedAt: STARTED_AT,
    now: STARTED_AT,
    contract,
    ...overrides,
  })

test("bridge timeout: waiting before the ceiling, rejecting after it", () => {
  assert.equal(contract.bridge.timeoutMinutes, 120)
  assert.equal(bridgeTimeoutMs(contract), TIMEOUT_MS)

  for (const elapsedMs of [0, 60_000, TIMEOUT_MS - 60_000, TIMEOUT_MS - 1]) {
    const decision = decide({ now: STARTED_AT + elapsedMs })
    assert.equal(decision.action, "wait", `at ${elapsedMs}ms`)
    assert.match(decision.reason, /never reported|check run for/)
  }

  for (const elapsedMs of [TIMEOUT_MS, TIMEOUT_MS + 60_000]) {
    const decision = decide({ now: STARTED_AT + elapsedMs })
    assert.equal(decision.action, "reject", `at ${elapsedMs}ms`)
    assert.match(decision.reason, /the local plane never reported/)
  }
})

test("bridge timeout: an in-progress run is waited on, then rejected at the ceiling", () => {
  const running = checkRun({ status: "in_progress", conclusion: null })
  assert.equal(
    decide({ checkRun: running, now: STARTED_AT + 60_000 }).action,
    "wait"
  )
  const timedOut = decide({ checkRun: running, now: STARTED_AT + TIMEOUT_MS })
  assert.equal(timedOut.action, "reject")
  assert.match(timedOut.reason, /still .*in_progress.* after the 120-minute/)
})

test("the bridge accepts only a completed, successful check that is provably ours", () => {
  const accepted = decide({
    checkRun: checkRun(),
    now: STARTED_AT + 30 * 60_000,
  })
  assert.deepEqual(Object.keys(accepted).sort(), ["action", "reason"])
  assert.equal(accepted.action, "accept")

  for (const conclusion of ["failure", "cancelled", "timed_out", "neutral"]) {
    const decision = decide({ checkRun: checkRun({ conclusion }) })
    assert.equal(decision.action, "reject", conclusion)
    assert.match(decision.reason, /only "success" is accepted/)
  }
})

test("an impostor check is rejected immediately, long before the timeout", () => {
  // Waiting cannot turn a check published by the wrong App into ours.
  for (const overrides of [
    { app: { id: 15368, slug: "github-actions" } },
    { app: null },
    { name: "Local CI proof" },
  ]) {
    const decision = decide({
      checkRun: checkRun(overrides),
      now: STARTED_AT + 60_000,
    })
    assert.equal(decision.action, "reject")
    assert.match(decision.reason, /check run identity refused/)
  }
})

test("a check for a different commit is waited on, because ours may still arrive", () => {
  const older = checkRun({ head_sha: OTHER_SHA })
  const waiting = decide({ checkRun: older, now: STARTED_AT + 60_000 })
  assert.equal(waiting.action, "wait")
  assert.match(waiting.reason, /different commit/)

  const expired = decide({ checkRun: older, now: STARTED_AT + TIMEOUT_MS })
  assert.equal(expired.action, "reject")
  assert.match(expired.reason, /check run identity refused/)
})

test("automatic rerun: a timed-out bridge plus a later successful check for this SHA reruns once", () => {
  const rerun = decide({
    checkRun: checkRun(),
    now: STARTED_AT + 5 * 60_000,
    previousOutcome: "timed_out",
    rerunAttempts: 0,
  })
  assert.equal(rerun.action, "rerun")
  assert.match(rerun.reason, /re-running the timed-out job once/)

  // Only once per SHA: the bridge cannot tell "the rerun has not started yet"
  // from "the rerun is eligible again", so the count is the guard.
  const second = decide({
    checkRun: checkRun(),
    now: STARTED_AT + 5 * 60_000,
    previousOutcome: "timed_out",
    rerunAttempts: MAX_RERUNS_PER_SHA,
  })
  assert.equal(second.action, "reject")
  assert.match(second.reason, /rerun\(s\) have already been attempted/)
  assert.match(second.reason, /re-run the workflow by hand/)
})

test("automatic rerun: the SHA has to match, and the check has to be green", () => {
  // A green check for a different commit is not evidence about this one.
  const otherCommit = decide({
    checkRun: checkRun({ head_sha: OTHER_SHA }),
    now: STARTED_AT + 5 * 60_000,
    previousOutcome: "timed_out",
  })
  assert.notEqual(otherCommit.action, "rerun")

  const red = decide({
    checkRun: checkRun({ conclusion: "failure" }),
    now: STARTED_AT + 5 * 60_000,
    previousOutcome: "timed_out",
  })
  assert.equal(red.action, "reject")

  // And a first look at a green check is an acceptance, not a rerun.
  assert.equal(decide({ checkRun: checkRun() }).action, "accept")
  assert.equal(
    decide({ checkRun: checkRun(), previousOutcome: "rejected" }).action,
    "accept"
  )
})

test("automatic rerun: refused when the contract does not authorise the Actions write", () => {
  const raw = JSON.parse(CONTRACT_TEXT)
  const noRerun = validateContract({
    ...raw,
    githubApp: { ...raw.githubApp, allowedActionsWriteOperations: [] },
  })
  const decision = decideBridgeAction({
    checkRun: checkRun(),
    requestedSha: REQUESTED_SHA,
    startedAt: STARTED_AT,
    now: STARTED_AT + 5 * 60_000,
    contract: noRerun,
    previousOutcome: "timed_out",
  })
  assert.equal(decision.action, "reject")
  assert.match(decision.reason, /not permitted to call "rerun-failed-jobs"/)
})

test("describeBridgeState shows the arithmetic behind the decision", () => {
  const state = describeBridgeState({
    checkRun: null,
    requestedSha: REQUESTED_SHA.toUpperCase(),
    startedAt: STARTED_AT,
    now: STARTED_AT + 90 * 60_000,
    contract,
  })
  assert.equal(state.action, "wait")
  assert.equal(state.elapsedMinutes, 90)
  assert.equal(state.timeoutMinutes, 120)
  assert.equal(state.timedOut, false)
  assert.equal(state.requestedSha, REQUESTED_SHA)
})

test("the bridge refuses inputs that would make its answer meaningless", () => {
  assert.throws(
    () => decide({ requestedSha: "not-a-sha" }),
    (error) => error instanceof BridgeError && error.code === "INVALID_INPUT"
  )
  assert.throws(
    () => decide({ now: STARTED_AT - 1000 }),
    (error) => {
      assert.match(error.message, /clock cannot run backwards/)
      return true
    }
  )
  assert.throws(
    () => decide({ previousOutcome: "gave_up" }),
    (error) => error.code === "INVALID_INPUT"
  )
  assert.throws(
    () => decide({ rerunAttempts: -1 }),
    (error) => error.code === "INVALID_INPUT"
  )
  assert.throws(
    () => bridgeTimeoutMs({ bridge: { timeoutMinutes: 0 } }),
    (error) => error.code === "INVALID_CONTRACT"
  )
})

test("timestamps may arrive as Dates, ISO strings or epoch milliseconds", () => {
  const asNumbers = decide({ now: STARTED_AT + TIMEOUT_MS })
  const asDates = decide({
    startedAt: new Date(STARTED_AT),
    now: new Date(STARTED_AT + TIMEOUT_MS),
  })
  const asStrings = decide({
    startedAt: new Date(STARTED_AT).toISOString(),
    now: new Date(STARTED_AT + TIMEOUT_MS).toISOString(),
  })
  assert.deepEqual(asDates, asNumbers)
  assert.deepEqual(asStrings, asNumbers)
})
