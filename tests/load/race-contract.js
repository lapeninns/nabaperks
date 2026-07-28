const WINNER_STATUSES = new Set([200, 201, 202])
const CONTENTION_STATUSES = new Set([400, 409, 429])
const CONTENTION_MESSAGE =
  /already|concurrent|conflict|consumed|rate.?limit|redeem|reward|stamp|used/i

export function summariseRaceResponses(responses) {
  const winners = responses.filter((response) =>
    WINNER_STATUSES.has(response.status)
  )
  const expectedLosers = responses.filter(isExpectedContentionLoser)

  return {
    expectedLoserCount: expectedLosers.length,
    settled:
      winners.length + expectedLosers.length === responses.length &&
      responses.length > 1,
    winnerCount: winners.length,
  }
}

export function assertFinalRaceState(payload, { mode, runId }) {
  if (!payload || typeof payload !== "object") {
    throw new Error("race state payload is invalid")
  }
  if (payload.runId !== runId) {
    throw new Error("race state does not belong to this run")
  }
  if (payload.isolated !== true) {
    throw new Error("race state did not confirm an isolated fixture")
  }
  if (mode === "isolated-staging" && payload.targetEnvironment !== "staging") {
    throw new Error("race state did not confirm isolated staging")
  }
  assertInvariant(payload.stamp, "winnerCount", 1, "stamp winner count")
  assertInvariant(
    payload.stamp,
    "earnedEventDelta",
    1,
    "earned stamp event delta"
  )
  assertInvariant(payload.redeem, "winnerCount", 1, "redeem winner count")
  assertInvariant(
    payload.redeem,
    "redeemedRewardDelta",
    1,
    "redeemed reward delta"
  )
}

function isExpectedContentionLoser(response) {
  if (!CONTENTION_STATUSES.has(response.status)) return false
  if (response.status !== 400) return true
  return CONTENTION_MESSAGE.test(String(response.body ?? ""))
}

function assertInvariant(value, key, expected, label) {
  if (!value || value[key] !== expected) {
    throw new Error(`${label} must equal ${expected}`)
  }
}
