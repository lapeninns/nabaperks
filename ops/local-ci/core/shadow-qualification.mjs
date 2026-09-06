/** Read-only same-SHA evidence comparison. This module never changes a gate. */
const COUNT_FIELDS = ["testsRun", "testsPassed", "testsFailed", "testsSkipped"]
const COMPARABLE_STATUSES = new Set(["success", "failure", "timed_out"])
const SCHEMA = "nabaperks.lane-result.v1"

function requireCondition(condition, message) {
  if (!condition) throw new TypeError(message)
}

function isCount(value) {
  return Number.isSafeInteger(value) && value >= 0
}

function validateLimits(contract, profile) {
  const limits = contract?.shadowMode?.qualification
  requireCondition(
    limits?.profiles?.includes(profile),
    `No qualification policy for profile ${profile}`
  )
  requireCondition(
    isCount(limits.maxProfileDurationSeconds) &&
      limits.maxProfileDurationSeconds > 0,
    "Missing or invalid profile duration budget"
  )
  const lanes = Object.entries(limits.lanes ?? {})
  requireCondition(lanes.length > 0, "No expected comparison lanes")
  for (const [id, limit] of lanes) {
    requireCondition(
      isCount(limit?.minimumTests) && isCount(limit?.maximumSkipped),
      `${id}: missing or invalid test floor/skip ceiling`
    )
    requireCondition(
      (limit.kind === "tests" && limit.minimumTests > 0) ||
        (limit.kind === "commands" &&
          limit.minimumTests === 0 &&
          limit.maximumSkipped === 0),
      `${id}: only command-check lanes may have a zero test floor`
    )
  }
  return limits
}

function indexEvidence(evidence, plane, headSha, profile, expectedIds) {
  requireCondition(
    evidence?.schema === SCHEMA &&
      evidence.plane === plane &&
      evidence.headSha === headSha &&
      evidence.profile === profile,
    `${plane}: schema, plane, SHA or profile mismatch`
  )
  requireCondition(
    COMPARABLE_STATUSES.has(evidence.conclusion),
    `${plane}: incomplete or cancelled run`
  )
  requireCondition(Array.isArray(evidence.lanes), `${plane}: missing lanes`)
  const indexed = new Map()
  for (const lane of evidence.lanes) {
    const label = `${plane}/${lane?.laneId}`
    requireCondition(
      expectedIds.includes(lane?.laneId) && !indexed.has(lane.laneId),
      `${label}: unexpected or duplicate lane`
    )
    requireCondition(
      lane.schema === SCHEMA &&
        lane.plane === plane &&
        lane.headSha === headSha &&
        lane.profile === profile,
      `${label}: schema, plane, SHA or profile mismatch`
    )
    requireCondition(
      COMPARABLE_STATUSES.has(lane.status),
      `${label}: incomplete or cancelled lane`
    )
    requireCondition(
      COUNT_FIELDS.every((field) => isCount(lane[field])) &&
        isCount(lane.flaky),
      `${label}: missing or invalid counts`
    )
    requireCondition(
      lane.testsRun ===
        lane.testsPassed + lane.testsFailed + lane.testsSkipped + lane.flaky,
      `${label}: inconsistent counts`
    )
    requireCondition(
      lane.status !== "success" || (lane.testsFailed === 0 && lane.flaky === 0),
      `${label}: successful lane contains failures or flakes`
    )
    indexed.set(lane.laneId, lane)
  }
  for (const id of expectedIds) {
    requireCondition(indexed.has(id), `${plane}/${id}: missing expected lane`)
  }
  return indexed
}

function compareLane(id, limit, local, hosted) {
  const reasons = []
  if (local.status !== hosted.status) reasons.push("status mismatch")
  for (const field of COUNT_FIELDS) {
    if (local[field] !== hosted[field]) reasons.push(`${field} mismatch`)
  }
  for (const [plane, lane] of [
    ["local", local],
    ["hosted", hosted],
  ]) {
    if (lane.testsRun < limit.minimumTests) reasons.push(`${plane} below floor`)
    if (lane.testsSkipped > limit.maximumSkipped) {
      reasons.push(`${plane} exceeds skip ceiling`)
    }
  }
  const selected = (lane) =>
    Object.fromEntries(
      ["status", ...COUNT_FIELDS, "flaky"].map((field) => [field, lane[field]])
    )
  return {
    laneId: id,
    minimumTests: limit.minimumTests,
    maximumSkipped: limit.maximumSkipped,
    local: selected(local),
    hosted: selected(hosted),
    equivalent: reasons.length === 0,
    reasons,
  }
}

/**
 * publishedDurationSeconds is measured from the GitHub check's started_at to
 * completed_at, not the sum of lane times. Provider authenticity and complete
 * log collection are established by the operator before supplying evidence.
 */
export function compareShadowEvidence({
  contract,
  headSha,
  profile,
  local,
  hosted,
  publishedDurationSeconds,
}) {
  const base = {
    headSha,
    profile,
    verdict: "incomplete",
    eligibleForStreak: false,
  }
  try {
    requireCondition(/^[a-f0-9]{40}$/.test(headSha ?? ""), "Invalid head SHA")
    const limits = validateLimits(contract, profile)
    const ids = Object.keys(limits.lanes)
    const localLanes = indexEvidence(local, "local", headSha, profile, ids)
    const hostedLanes = indexEvidence(hosted, "hosted", headSha, profile, ids)
    requireCondition(
      Number.isFinite(publishedDurationSeconds) &&
        publishedDurationSeconds >= 0,
      "Missing or invalid published local check duration"
    )
    const lanes = ids.map((id) =>
      compareLane(id, limits.lanes[id], localLanes.get(id), hostedLanes.get(id))
    )
    const verdict = lanes.every((lane) => lane.equivalent)
      ? "equivalent"
      : "divergent"
    const budgetSatisfied =
      publishedDurationSeconds <= limits.maxProfileDurationSeconds
    return {
      ...base,
      verdict,
      eligibleForStreak:
        profile === "pr" && verdict === "equivalent" && budgetSatisfied,
      budget: {
        durationSeconds: publishedDurationSeconds,
        maximumSeconds: limits.maxProfileDurationSeconds,
        satisfied: budgetSatisfied,
      },
      lanes,
      reasons: [],
    }
  } catch (error) {
    return { ...base, reasons: [error.message], lanes: [] }
  }
}

/** Results must be supplied in attempt order. Repeating a SHA never adds one. */
export function shadowEquivalenceStreak(results, required) {
  requireCondition(
    Number.isSafeInteger(required) && required > 0,
    "Invalid streak length"
  )
  let heads = []
  for (const result of results) {
    const eligible =
      result?.eligibleForStreak === true &&
      result.verdict === "equivalent" &&
      result.profile === "pr" &&
      result.budget?.satisfied === true &&
      /^[a-f0-9]{40}$/.test(result.headSha ?? "")
    if (!eligible) heads = []
    else if (!heads.includes(result.headSha)) heads.push(result.headSha)
  }
  return {
    heads,
    length: heads.length,
    required,
    satisfied: heads.length >= required,
  }
}
