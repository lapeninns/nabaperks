/**
 * One project, two lanes.
 *
 * The local plane runs each functional e2e project as two interleaved lanes,
 * `e2e-<project>-odd` and `e2e-<project>-even`, so a long project no longer
 * bounds the run on its own. Everything that compares the local plane with
 * the hosted one - the published coverage statement and the shadow
 * comparison - still speaks per project, because the hosted plane and the
 * qualification floors do. This module is the one place that translates.
 *
 * The rule is deliberately narrow: a pair is recognised only by the two
 * suffixes below, only for a project id the caller already expects, and only
 * when both halves are present. One half on its own is never read as the
 * project, since it ran half the shards.
 */

export const SPLIT_SUFFIXES = Object.freeze(["-odd", "-even"])

/** The project id a split lane belongs to, or null for any other lane. */
export function splitLaneBase(laneId) {
  const match = /^(.+)-(odd|even)$/.exec(String(laneId))
  return match ? match[1] : null
}

/** The two lane ids a project splits into. */
export function splitLaneIds(projectId) {
  return SPLIT_SUFFIXES.map((suffix) => `${projectId}${suffix}`)
}

/**
 * Which of `expectedIds` the given lane ids stand for, and what is missing.
 * Pure. `present` names each expected id that appears as itself or as both of
 * its halves. `missing` names what a reader has to be told is absent: the
 * whole id when neither it nor a half appears, or the absent half when only
 * one of a pair does.
 */
export function splitCoverage(laneIds, expectedIds) {
  const ids = new Set(laneIds)
  const present = []
  const missing = []
  for (const id of expectedIds) {
    if (ids.has(id)) {
      present.push(id)
      continue
    }
    const halves = splitLaneIds(id)
    const found = halves.filter((half) => ids.has(half))
    if (found.length === halves.length) present.push(id)
    else if (found.length > 0)
      missing.push(...halves.filter((half) => !ids.has(half)))
    else missing.push(id)
  }
  return Object.freeze({
    present: Object.freeze(present),
    missing: Object.freeze(missing),
  })
}
