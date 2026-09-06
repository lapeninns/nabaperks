/** Validate published evidence without confusing missing tallies with zeros. */
export const COUNT_FIELDS = [
  "testsRun",
  "testsPassed",
  "testsFailed",
  "testsSkipped",
]
const STATUSES = new Set(["success", "failure", "timed_out", "skipped"])
const SCHEMA = "nabaperks.lane-result.v1"

export function requireCondition(condition, message) {
  if (!condition) throw new TypeError(message)
}

export function isCount(value) {
  return Number.isSafeInteger(value) && value >= 0
}

export function hasCounts(lane) {
  return (
    lane.countsParsed !== false &&
    COUNT_FIELDS.every((field) => isCount(lane[field])) &&
    isCount(lane.flaky)
  )
}

function validateCounts(lane, label) {
  for (const field of [...COUNT_FIELDS, "flaky"]) {
    requireCondition(
      lane[field] == null || isCount(lane[field]),
      `${label}: invalid counts`
    )
  }
  if (![...COUNT_FIELDS, "flaky"].every((field) => isCount(lane[field]))) return
  requireCondition(
    lane.testsRun ===
      lane.testsPassed + lane.testsFailed + lane.testsSkipped + lane.flaky,
    `${label}: inconsistent counts`
  )
  requireCondition(
    lane.status !== "success" || (lane.testsFailed === 0 && lane.flaky === 0),
    `${label}: successful lane contains failures or flakes`
  )
}

function validateConclusion(evidence, plane) {
  const statuses = evidence.lanes.map((lane) => lane.status)
  requireCondition(
    evidence.deadlineExpired !== true ||
      statuses.some((status) => ["skipped", "timed_out"].includes(status)),
    `${plane}: expired deadline has no interrupted lane`
  )
  const expected =
    evidence.deadlineExpired === true || statuses.includes("timed_out")
      ? "timed_out"
      : statuses.includes("failure")
        ? "failure"
        : "success"
  requireCondition(
    evidence.conclusion === expected,
    `${plane}: run conclusion disagrees with lane statuses`
  )
}

export function indexEvidence(evidence, plane, headSha, profile, expectedIds) {
  requireCondition(
    evidence?.schema === SCHEMA &&
      evidence.plane === plane &&
      evidence.headSha === headSha &&
      evidence.profile === profile,
    `${plane}: schema, plane, SHA or profile mismatch`
  )
  requireCondition(
    ["success", "failure", "timed_out"].includes(evidence.conclusion),
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
      STATUSES.has(lane.status),
      `${label}: incomplete or cancelled lane`
    )
    for (const field of ["countsParsed", "countsExpected"]) {
      requireCondition(
        lane[field] === undefined || typeof lane[field] === "boolean",
        `${label}: invalid ${field}`
      )
    }
    validateCounts(lane, label)
    indexed.set(lane.laneId, lane)
  }
  for (const id of expectedIds) {
    requireCondition(indexed.has(id), `${plane}/${id}: missing expected lane`)
    const lane = indexed.get(id)
    if (lane.blockedByLaneId == null) continue
    const blocker = indexed.get(lane.blockedByLaneId)
    requireCondition(
      lane.status === "skipped" &&
        expectedIds.indexOf(lane.blockedByLaneId) < expectedIds.indexOf(id) &&
        ["failure", "timed_out"].includes(blocker?.status),
      `${plane}/${id}: invalid blocking lane`
    )
  }
  validateConclusion(evidence, plane)
  return indexed
}
