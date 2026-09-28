import { requireHostedIdentity } from "./hosted-identity.mjs"
import { requireSameCheckoutTree } from "./checkout-proof.mjs"
import { splitLaneBase, splitLaneIds } from "./split-lanes.mjs"
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
  requireCondition(
    limits.pinnedHostedLanes === undefined ||
      (Array.isArray(limits.pinnedHostedLanes) &&
        limits.pinnedHostedLanes.every((id) =>
          Object.hasOwn(limits.lanes, id)
        )),
    "pinnedHostedLanes must name compared lanes"
  )
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

const sumCounts = (values) =>
  values.every((value) => isCount(value))
    ? values.reduce((total, value) => total + value, 0)
    : null

const allTrue = (values) =>
  values.every((value) => value === true)
    ? true
    : values.some((value) => value === false)
      ? false
      : null

function combineStatus(halves) {
  const statuses = halves.map((lane) => lane.status)
  for (const status of ["cancelled", "timed_out", "failure", "skipped"])
    if (statuses.includes(status)) return status
  return statuses.every((status) => status === "success")
    ? "success"
    : statuses[0]
}

/**
 * One project's two interleaved lanes, as the one lane its floors and the
 * hosted plane describe. Pure.
 *
 * Counts are summed, and stay null when either half has none, so half a
 * tally never reads as the project's. The status is the worst of the two,
 * and execution is proven only when both halves prove it.
 *
 * A project whose odd half failed and stopped the run before its even half
 * was admitted is a failed project, not one blocked by itself: its execution
 * is judged by the halves that ran, since a failed project can never qualify
 * and the failure it reports is real. A skipped half's blocker is kept only
 * when the project as a whole reads as skipped, and never when it is the
 * project's own other half.
 */
export function combineSplitLanes(projectId, halves, rename = (id) => id) {
  const [first] = halves
  const status = combineStatus(halves)
  const ran = halves.filter((lane) => lane.status !== "skipped")
  const judged =
    ["failure", "timed_out", "cancelled"].includes(status) && ran.length > 0
      ? ran
      : halves
  const executionVerified = allTrue(
    judged.map((lane) => lane.executionVerified)
  )
  const combined = {
    ...Object.fromEntries(
      ["schema", "plane", "profile", "headSha"]
        .filter((field) => first[field] !== undefined)
        .map((field) => [field, first[field]])
    ),
    laneId: projectId,
    status,
    durationSeconds: Math.max(
      ...halves.map((lane) =>
        typeof lane.durationSeconds === "number" ? lane.durationSeconds : 0
      )
    ),
    testsRun: sumCounts(halves.map((lane) => lane.testsRun)),
    testsPassed: sumCounts(halves.map((lane) => lane.testsPassed)),
    testsFailed: sumCounts(halves.map((lane) => lane.testsFailed)),
    testsSkipped: sumCounts(halves.map((lane) => lane.testsSkipped)),
    flaky: sumCounts(halves.map((lane) => lane.flaky)),
    executionStarted: allTrue(judged.map((lane) => lane.executionStarted)),
    ...(executionVerified === true ? { executionVerified: true } : {}),
  }
  const parsed = allTrue(halves.map((lane) => lane.countsParsed))
  if (parsed !== null) combined.countsParsed = parsed
  if (halves.some((lane) => lane.countsExpected === true))
    combined.countsExpected = true
  const blocker = halves
    .filter(
      (lane) =>
        lane.status === "skipped" && typeof lane.blockedByLaneId === "string"
    )
    .map((lane) => rename(lane.blockedByLaneId))
    .find((id) => id !== projectId)
  if (status === "skipped" && blocker !== undefined)
    combined.blockedByLaneId = blocker
  return combined
}

/**
 * Local evidence with each split project folded back into one lane, for the
 * project ids the policy expects. Pure. A lane whose pair is incomplete, or
 * whose project id already appears on its own, is left as it is and is then
 * refused as unexpected - never quietly counted as the project.
 */
export function aggregateSplitEvidence(evidence, expectedIds) {
  if (!Array.isArray(evidence?.lanes)) return evidence
  const byId = new Map(evidence.lanes.map((lane) => [lane?.laneId, lane]))
  const folded = new Set()
  for (const id of expectedIds) {
    if (byId.has(id)) continue
    if (splitLaneIds(id).every((half) => byId.has(half))) folded.add(id)
  }
  const rename = (id) => {
    const base = splitLaneBase(id)
    return base !== null && folded.has(base) ? base : id
  }
  const lanes = []
  for (const lane of evidence.lanes) {
    const base = splitLaneBase(lane?.laneId)
    if (base === null || !folded.has(base)) {
      lanes.push(
        typeof lane?.blockedByLaneId === "string"
          ? { ...lane, blockedByLaneId: rename(lane.blockedByLaneId) }
          : lane
      )
      continue
    }
    if (lane.laneId !== splitLaneIds(base)[0]) continue
    lanes.push(
      combineSplitLanes(
        base,
        splitLaneIds(base).map((half) => byId.get(half)),
        rename
      )
    )
  }
  return { ...evidence, lanes }
}

/**
 * Policy lanes the local run left to the hosted plane on purpose. A lane
 * qualifies only when the policy lists it as pinnable, the local summary
 * itself reports it hosted-only, and no local result for it exists; it is
 * then recorded as pinned-hosted, never as equivalent or passed.
 */
function pinnedHostedLanes(limits, local) {
  const pinnable = Array.isArray(limits.pinnedHostedLanes)
    ? limits.pinnedHostedLanes
    : []
  const reported = Array.isArray(local?.hostedOnlyLanes)
    ? local.hostedOnlyLanes.map((entry) =>
        typeof entry === "string" ? entry : entry?.laneId
      )
    : []
  const ran = new Set((local?.lanes ?? []).map((lane) => lane?.laneId))
  return pinnable.filter(
    (id) =>
      Object.hasOwn(limits.lanes, id) && reported.includes(id) && !ran.has(id)
  )
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
    localExecutionVerified: false,
  }
  try {
    requireCondition(/^[a-f0-9]{40}$/.test(headSha ?? ""), "Invalid head SHA")
    requireHostedIdentity(hosted?.provider, profile, headSha)
    requireSameCheckoutTree(hosted, headSha)
    const limits = validateLimits(contract, profile)
    const ids = Object.keys(limits.lanes)
    const pinned = pinnedHostedLanes(limits, local)
    const localIds = ids.filter((id) => !pinned.includes(id))
    const localLanes = indexEvidence(
      aggregateSplitEvidence(local, localIds),
      "local",
      headSha,
      profile,
      localIds
    )
    // Skipped lanes are already non-qualifying; retain their blocker diagnostics.
    const unverified = [...localLanes.values()].filter(
      (lane) =>
        lane.status !== "skipped" &&
        (lane.executionStarted !== true || lane.executionVerified !== true)
    )
    requireCondition(
      unverified.length === 0,
      `Unverified local validation execution: ${unverified.map((lane) => lane.laneId).join(", ")}`
    )
    const hostedLanes = indexEvidence(hosted, "hosted", headSha, profile, ids)
    requireCondition(
      Number.isFinite(publishedDurationSeconds) &&
        publishedDurationSeconds >= 0,
      "Missing or invalid published local check duration"
    )
    const lanes = ids.map((id) =>
      pinned.includes(id)
        ? {
            laneId: id,
            minimumTests: limits.lanes[id].minimumTests,
            maximumSkipped: limits.lanes[id].maximumSkipped,
            local: null,
            hosted: Object.fromEntries(
              ["status", ...COUNT_FIELDS, "flaky"]
                .filter((field) => hostedLanes.get(id)[field] !== undefined)
                .map((field) => [field, hostedLanes.get(id)[field]])
            ),
            verdict: "pinned-hosted",
            equivalent: false,
            blockedSkip: false,
            reasons: [
              "the local runtime leaves this lane to the hosted plane; it is recorded as pinned-hosted, not as passed",
            ],
          }
        : compareLane(
            id,
            limits.lanes[id],
            localLanes.get(id),
            hostedLanes.get(id)
          )
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
    const localExecutionVerified = [...localLanes.values()].every(
      (lane) =>
        lane.executionStarted === true && lane.executionVerified === true
    )
    const budgetSatisfied =
      publishedDurationSeconds <= limits.maxProfileDurationSeconds
    return {
      ...base,
      verdict,
      localExecutionVerified,
      eligibleForStreak:
        streakProfilesOf(limits).includes(profile) &&
        verdict === "equivalent" &&
        localExecutionVerified &&
        budgetSatisfied,
      budget: {
        durationSeconds: publishedDurationSeconds,
        maximumSeconds: limits.maxProfileDurationSeconds,
        satisfied: budgetSatisfied,
      },
      pinnedHosted: pinned,
      lanes,
      reasons: lanes
        .filter((lane) => lane.verdict !== "pinned-hosted")
        .flatMap((lane) =>
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
      result.localExecutionVerified === true &&
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
