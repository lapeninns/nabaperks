import { check } from "k6"
import http from "k6/http"

import {
  assertFinalRaceState,
  summariseRaceResponses,
} from "./race-contract.js"
import {
  assertLoadEnvironment,
  resolveSafeLoadTarget,
} from "./target-safety.js"

// RACE_STATE_URL must return the authenticated post-race readback:
// { runId, isolated: true, targetEnvironment, stamp: {
//   winnerCount: 1, earnedEventDelta: 1 }, redeem: {
//   winnerCount: 1, redeemedRewardDelta: 1 } }.
const STAMP_URL = __ENV.STAMP_RACE_URL
const REDEEM_URL = __ENV.REDEEM_RACE_URL
const STATE_URL = __ENV.RACE_STATE_URL
const AUTH_TOKEN = __ENV.STAMP_RACE_AUTH_TOKEN
const STAMP_BODY = __ENV.STAMP_RACE_BODY || "{}"
const REDEEM_BODY = __ENV.REDEEM_RACE_BODY || "{}"
const RUN_ID = __ENV.RACE_RUN_ID
const CONTENDERS = Number.parseInt(__ENV.RACE_CONTENDERS || "8", 10)

if (!STAMP_URL || !REDEEM_URL || !STATE_URL) {
  throw new Error(
    "STAMP_RACE_URL, REDEEM_RACE_URL, and RACE_STATE_URL are required"
  )
}
if (!AUTH_TOKEN || !RUN_ID) {
  throw new Error("STAMP_RACE_AUTH_TOKEN and RACE_RUN_ID are required")
}
if (!Number.isSafeInteger(CONTENDERS) || CONTENDERS < 2 || CONTENDERS > 32) {
  throw new Error("RACE_CONTENDERS must be an integer from 2 to 32")
}

const target = resolveSafeLoadTarget({
  urls: [STAMP_URL, REDEEM_URL, STATE_URL],
  mode: __ENV.LOAD_TARGET_MODE || "local",
  isolatedStagingOrigin: __ENV.LOAD_ISOLATED_STAGING_ORIGIN,
  isolatedStagingConfirmed: __ENV.LOAD_ISOLATED_STAGING_CONFIRMED,
})
const expectedRaceStatuses = http.expectedStatuses(200, 201, 202, 400, 409, 429)

export const options = {
  scenarios: {
    stamp_redeem_race: {
      executor: "shared-iterations",
      vus: 1,
      iterations: 1,
      maxDuration: "45s",
    },
  },
  thresholds: {
    checks: ["rate==1"],
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<1000"],
  },
}

export function setup() {
  const response = http.get(`${target.origin}/api/health`)
  if (response.status !== 200) {
    throw new Error(`race target health check returned HTTP ${response.status}`)
  }
  assertLoadEnvironment(response.json(), target.mode)
}

export default function stampRedeemRaceScenario() {
  const params = {
    headers: {
      authorization: `Bearer ${AUTH_TOKEN}`,
      "content-type": "application/json",
      "x-race-run-id": RUN_ID,
    },
    responseCallback: expectedRaceStatuses,
  }

  const stamp = runRace(STAMP_URL, STAMP_BODY, params, "stamp")
  check(stamp, {
    "stamp race has exactly one winner": (result) => result.winnerCount === 1,
    "stamp race has only expected contention losers": (result) =>
      result.settled && result.expectedLoserCount === CONTENDERS - 1,
  })

  const redeem = runRace(REDEEM_URL, REDEEM_BODY, params, "redeem")
  check(redeem, {
    "redeem race has exactly one winner": (result) => result.winnerCount === 1,
    "redeem race has only expected contention losers": (result) =>
      result.settled && result.expectedLoserCount === CONTENDERS - 1,
  })

  const state = http.get(STATE_URL, {
    headers: {
      authorization: `Bearer ${AUTH_TOKEN}`,
      "x-race-run-id": RUN_ID,
    },
  })
  let stateError = ""
  try {
    if (state.status !== 200) {
      throw new Error(`race state returned HTTP ${state.status}`)
    }
    assertFinalRaceState(state.json(), { mode: target.mode, runId: RUN_ID })
  } catch (error) {
    stateError = error instanceof Error ? error.message : String(error)
  }
  check(stateError, {
    "final database state preserves single-winner invariants": (message) =>
      message === "",
  })
}

function runRace(url, body, params, operation) {
  const requests = Array.from({ length: CONTENDERS }, () => ({
    body,
    method: "POST",
    params: {
      ...params,
      tags: { operation },
    },
    url,
  }))
  return summariseRaceResponses(http.batch(requests))
}
