import { requireHostedIdentity } from "./hosted-identity.mjs"
import { requireSameCheckoutTree } from "./checkout-proof.mjs"
/** Read-only same-SHA evidence comparison. This module never changes a gate. */
import {
  COUNT_FIELDS,
  hasCounts,
  indexEvidence,
  isCount,
  requireCondition,
} from "./shadow-evidence.mjs"

/**
 * profiles gates the duration-budget comparison; only streakProfiles may feed
 * the equivalence streak. Absent configuration stays at the narrower PR-only
 * policy rather than silently admitting every compared profile.
 *
 * The list is code-owned on purpose: configuration may only ever narrow it.
 * Widening the streak is a qualification-policy change that has to be reviewed
 * as code, so a contract edit alone must never make a new profile count
 * towards cutover evidence.
 */
const DEFAULT_STREAK_PROFILES = ["pr"]

function streakProfilesOf(limits) {
  const configured = limits?.streakProfiles
  if (configured === undefined) return DEFAULT_STREAK_PROFILES
  requireCondition(
    Array.isArray(configured) &&
      configured.length > 0 &&
      configured.every(
        (name) => typeof name === "string" && limits.profiles?.includes(name)
      ),
    "streakProfiles must name compared profiles"
  )
  const widened = configured.filter(
    (name) => !DEFAULT_STREAK_PROFILES.includes(name)
  )
  requireCondition(
    widened.length === 0,
    `streakProfiles may only narrow the code-owned streak policy; remove ${widened.join(", ")}`
  )
  return configured
}

function validateLimits(contract, profile) {
  const limits = contract?.shadowMode?.qualification
  requireCondition(
    limits?.profiles?.includes(profile),
    `No qualification policy for profile ${profile}`
  )
  streakProfilesOf(limits)
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
    requireHostedIdentity(hosted?.provider, profile, headSha)
    requireSameCheckoutTree(hosted, headSha)
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
        streakProfilesOf(limits).includes(profile) &&
        verdict === "equivalent" &&
        budgetSatisfied,
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

/**
 * Results must be supplied in attempt order. Repeating a SHA never adds one.
 * The contract is optional so the tally can be recomputed from stored results
 * alone; without it the narrower default policy applies.
 */
export function shadowEquivalenceStreak(results, required, contract) {
  requireCondition(
    Number.isSafeInteger(required) && required > 0,
    "Invalid streak length"
  )
  const streakProfiles = streakProfilesOf(contract?.shadowMode?.qualification)
  let heads = []
  for (const result of results) {
    const eligible =
      result?.eligibleForStreak === true &&
      result.verdict === "equivalent" &&
      streakProfiles.includes(result.profile) &&
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
