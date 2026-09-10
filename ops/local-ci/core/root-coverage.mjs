/**
 * How much of the hosted plane's required work a set of local lanes covers.
 *
 * The published check reports a lane count, and a lane count is not a coverage
 * claim. A run can say `10/10 lanes` while four of the nine roots ci.yml
 * requires never executed here at all, and a reader - human, or the automation
 * that will one day decide whether this plane can be trusted - reads 10/10 and
 * concludes local CI ran everything. So the roots with no local lane are
 * computed here and published as a stated fact, alongside the lane count
 * rather than instead of it.
 *
 * The lane-to-root mapping is a table and two named rules, not a chain of
 * conditionals, because it is the thing a reviewer has to check against
 * ci.yml, and a table can be read against a workflow file line by line.
 *
 * Resolution is total. Every lane id resolves to a root or is reported as
 * covering none - never dropped - because a dropped lane is exactly how a
 * coverage claim starts overstating itself.
 *
 * Coverage counts explicit validation-start markers. Status alone does not prove
 * execution; a failed setup never ran, while cancellation can follow execution.
 * Counting a root without every mapped lane starting would
 * be the same overstatement in a smaller place: a run that stopped at its
 * first failure would still publish `5/9 required roots local` and name e2e,
 * a11y and db among them. Those lanes are not dropped either - they are
 * published in `notRunLanes`, because a profile that declared a lane and did
 * not run it is a fact the evidence has to carry.
 */

import { LocalCiError, describeValue } from "./contract.mjs"
import { FULL_HOSTED_ROOTS } from "./routing.mjs"

export class RootCoverageError extends LocalCiError {}

function fail(code, message) {
  throw new RootCoverageError(code, `local-ci root coverage: ${message}`)
}

/**
 * Why a lane covers no required root.
 *
 * `local-only` is a declaration and `unknown` is a defect: the first says the
 * lane's hosted counterpart is not a required root, the second says nothing in
 * this module recognises the lane at all. Both are published, because a lane
 * whose coverage nobody can account for must not read as coverage.
 */
export const UNMAPPED_KINDS = Object.freeze([
  "local-only",
  "not-required",
  "unknown",
])

/** Recorded runs require an explicit execution marker; status is not proof. */
export function laneExecuted(executionStarted) {
  return executionStarted === true
}

/**
 * Lanes that correspond to no required root, and where their work sits instead.
 *
 * Consulted before every other rule, so a lane whose id merely looks like a
 * root's cannot be read as covering it - `zap-full` is nightly.yml's full scan
 * and does not stand in for the required `zap-baseline`.
 */
export const ROOTLESS_LANES = Object.freeze({
  "print-kit":
    "transcribed from the last two steps of ci.yml's quality job and split out for its disjoint dependency set; the hosted work is inside that job, not a required root of its own",
  mutation:
    "nightly.yml's mutation job; the merge gate requires no such root, so it stands in for nothing here",
  load: "nightly.yml's k6 job; the merge gate requires no such root",
  "db-stress":
    "nightly.yml's concurrency stress job; the required `db` root is the behavioural moat, which the `db` lane runs",
  "zap-full":
    "nightly.yml's full ZAP scan; the required `zap-baseline` root is a different, shorter scan and this lane is not a substitute for it",
})

/**
 * Lane-id prefix to root, for the per-project browser lanes.
 *
 * ci.yml runs `e2e` and `a11y` as one matrixed job each; the local plane
 * splits each matrix into a lane per project, so the prefix is the join
 * between the two vocabularies.
 */
export const LANE_ROOT_PREFIXES = Object.freeze([
  Object.freeze({ prefix: "e2e-", root: "e2e" }),
  Object.freeze({ prefix: "a11y-", root: "a11y" }),
])

function requireLaneId(value, path) {
  if (typeof value !== "string" || value.trim() === "") {
    fail(
      "COVERAGE_SHAPE",
      `${path} must be a non-empty string (received ${describeValue(value)})`
    )
  }
  return value
}

/**
 * The root one lane executes.
 *
 * Returns `{ known, root, reason }`. `known: false` is the honest answer for a
 * lane id no rule accounts for; it is never guessed into a root.
 */
export function rootForLane(laneId) {
  const id = requireLaneId(laneId, "laneId")

  if (Object.hasOwn(ROOTLESS_LANES, id)) {
    return Object.freeze({
      known: true,
      root: null,
      reason: ROOTLESS_LANES[id],
    })
  }
  // A lane named for a root runs that root's work. No profile declares one
  // today - `visual` in particular stays hosted by design, per the contract's
  // snapshot guard - so this is the rule under which one would count, not an
  // invitation to add it.
  if (FULL_HOSTED_ROOTS.includes(id)) {
    return Object.freeze({ known: true, root: id, reason: null })
  }
  const prefixed = LANE_ROOT_PREFIXES.find((rule) => id.startsWith(rule.prefix))
  if (prefixed) {
    return Object.freeze({ known: true, root: prefixed.root, reason: null })
  }
  return Object.freeze({ known: false, root: null, reason: null })
}

/**
 * One entry of `computeRootCoverage`'s lane list, as `{ laneId, status }`.
 *
 * A bare string is a lane id with no recorded status, which is how a caller
 * describing a profile's declared lanes - rather than a finished run - names
 * them. An object carries the status the run recorded, so a lane that never
 * started can be told from one that ran.
 */
function normaliseLaneEntry(entry, index) {
  const path = `laneIds[${index}]`
  if (entry !== null && typeof entry === "object" && !Array.isArray(entry)) {
    const laneId = requireLaneId(entry.laneId ?? entry.id, `${path}.laneId`)
    const { status, executionStarted } = entry
    if (
      status !== null &&
      status !== undefined &&
      (typeof status !== "string" || status.trim() === "")
    ) {
      fail(
        "COVERAGE_SHAPE",
        `${path}.status must be a non-empty string or absent (received ${describeValue(status)})`
      )
    }
    if (
      executionStarted !== undefined &&
      typeof executionStarted !== "boolean"
    ) {
      fail(
        "COVERAGE_SHAPE",
        `${path}.executionStarted must be boolean or absent`
      )
    }
    return { laneId, status: status ?? null, executionStarted }
  }
  // Bare IDs describe configured coverage, not an executed run.
  return {
    laneId: requireLaneId(entry, path),
    status: null,
    executionStarted: true,
  }
}

/**
 * Which of `requiredRoots` the given lanes cover, and which they do not.
 *
 * `laneIds` are this plane's lanes, each either a lane id or
 * `{ laneId, status }`; `requiredRoots` defaults to the hosted plane's full
 * required set. Returns `{ requiredRoots, coveredRoots, uncoveredRoots,
 * laneRoots, unmappedLanes, notRunLanes, complete }`, where `laneRoots` has
 * exactly one entry per lane passed in, in order, `unmappedLanes` names every
 * lane that covers no required root together with why, and `notRunLanes`
 * names every lane whose status says it never executed.
 *
 * Only lanes that executed contribute to `coveredRoots`. A lane appears in
 * `laneRoots` under the root it would have run either way, because that
 * mapping is a property of the lane and not of one run's outcome.
 */
export function computeRootCoverage(
  laneIds,
  requiredRoots = FULL_HOSTED_ROOTS
) {
  if (!Array.isArray(laneIds)) {
    fail(
      "COVERAGE_SHAPE",
      `laneIds must be an array (received ${describeValue(laneIds)})`
    )
  }
  if (!Array.isArray(requiredRoots) || requiredRoots.length === 0) {
    fail(
      "COVERAGE_SHAPE",
      `requiredRoots must be a non-empty array (received ${describeValue(requiredRoots)}); a run with nothing required to cover would report complete coverage of nothing`
    )
  }
  const roots = requiredRoots.map((root, index) =>
    requireLaneId(root, `requiredRoots[${index}]`)
  )

  const laneRoots = []
  const executedLaneIds = new Set()
  const unmappedLanes = []
  const notRunLanes = []
  for (const [index, entry] of laneIds.entries()) {
    const {
      laneId: id,
      status,
      executionStarted,
    } = normaliseLaneEntry(entry, index)
    if (laneRoots.some((lane) => lane.laneId === id)) {
      fail("COVERAGE_SHAPE", `duplicate lane ${id} cannot establish coverage`)
    }
    const resolved = rootForLane(id)
    laneRoots.push(Object.freeze({ laneId: id, root: resolved.root }))

    if (laneExecuted(executionStarted)) {
      executedLaneIds.add(id)
    } else {
      // Named, never dropped: the run declared this lane and did not run it,
      // and hiding that would trade one overstatement for another.
      notRunLanes.push(
        Object.freeze({ laneId: id, root: resolved.root, status })
      )
    }

    if (!resolved.known) {
      unmappedLanes.push(
        Object.freeze({
          laneId: id,
          kind: "unknown",
          reason:
            "no rule in root-coverage.mjs accounts for this lane id, so it is published as covering nothing rather than assumed to cover a root",
        })
      )
      continue
    }
    if (resolved.root === null) {
      unmappedLanes.push(
        Object.freeze({
          laneId: id,
          kind: "local-only",
          reason: resolved.reason,
        })
      )
      continue
    }
    if (!roots.includes(resolved.root)) {
      unmappedLanes.push(
        Object.freeze({
          laneId: id,
          kind: "not-required",
          reason: `covers ${resolved.root}, which this run's required-root list does not name`,
        })
      )
    }
  }

  // The same invariant selectLanes asserts: the mapping is total, so a lane
  // that fell out of it is a defect to refuse, not a quieter coverage number.
  if (laneRoots.length !== laneIds.length) {
    fail(
      "LANE_COVERAGE_BROKEN",
      `coverage dropped ${laneIds.length - laneRoots.length} lane(s); every lane must resolve to a root or be reported as covering none`
    )
  }

  const coveredRoots = roots.filter((root) => {
    const members = laneRoots.filter((lane) => lane.root === root)
    return (
      members.length > 0 &&
      members.every((lane) => executedLaneIds.has(lane.laneId))
    )
  })
  const uncoveredRoots = roots.filter((root) => !coveredRoots.includes(root))

  return Object.freeze({
    requiredRoots: Object.freeze([...roots]),
    coveredRoots: Object.freeze(coveredRoots),
    uncoveredRoots: Object.freeze(uncoveredRoots),
    laneRoots: Object.freeze(laneRoots),
    unmappedLanes: Object.freeze(unmappedLanes),
    notRunLanes: Object.freeze(notRunLanes),
    complete: uncoveredRoots.length === 0,
  })
}
