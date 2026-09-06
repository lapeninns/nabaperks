/** Read-only same-SHA evidence comparison. This module never changes a gate. */
import {
  COUNT_FIELDS,
  hasCounts,
  indexEvidence,
  isCount,
  requireCondition,
} from "./shadow-evidence.mjs"

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

function compareLane(id, limit, local, hosted) {
  const selected = (lane) =>
    Object.fromEntries(
      ["status", ...COUNT_FIELDS, "flaky", "countsParsed", "blockedByLaneId"]
        .filter((field) => lane[field] !== undefined)
        .map((field) => [field, lane[field]])
    )
  const result = (verdict, reasons, blockedSkip = false) => ({
    laneId: id,
    minimumTests: limit.minimumTests,
    maximumSkipped: limit.maximumSkipped,
    local: selected(local),
    hosted: selected(hosted),
    verdict,
    equivalent: verdict === "equivalent",
    blockedSkip,
    reasons,
  })
  const skipped = [local, hosted].filter((lane) => lane.status === "skipped")
  if (skipped.length) {
    return result(
      "incomplete",
      ["lane did not run"],
      skipped.every((lane) => typeof lane.blockedByLaneId === "string")
    )
  }
  const reasons = []
  if (local.status !== hosted.status) reasons.push("status mismatch")
  // Hygiene commands legitimately have no parser tally, but test lanes must.
  const completeCounts = (lane) =>
    hasCounts(
      limit.kind === "commands" ? { ...lane, countsParsed: true } : lane
    )
  if (!completeCounts(local) || !completeCounts(hosted)) {
    return result(reasons.length ? "divergent" : "incomplete", [
      ...reasons,
      "missing machine-readable test counts",
    ])
  }
  for (const field of COUNT_FIELDS) {
    if (local[field] !== hosted[field]) reasons.push(`${field} mismatch`)
  }
  for (const [plane, lane] of [
    ["local", local],
    ["hosted", hosted],
  ]) {
    if (lane.testsRun < limit.minimumTests) reasons.push(`${plane} below floor`)
    if (lane.testsSkipped > limit.maximumSkipped)
      reasons.push(`${plane} exceeds skip ceiling`)
  }
  if (reasons.length) return result("divergent", reasons)
  if (local.status !== "success") {
    return result("incomplete", [
      "matching failure counts do not establish the same cause; independent failure evidence is required",
    ])
  }
  return result("equivalent", [])
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
    const incomplete = lanes.filter((lane) => lane.verdict === "incomplete")
    const divergent = lanes.some((lane) => lane.verdict === "divergent")
    const verdict = incomplete.some((lane) => !lane.blockedSkip)
      ? "incomplete"
      : divergent
        ? "divergent"
        : incomplete.length
          ? "incomplete"
          : "equivalent"
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
      reasons: lanes.flatMap((lane) =>
        lane.reasons.map((reason) => `${lane.laneId}: ${reason}`)
      ),
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
