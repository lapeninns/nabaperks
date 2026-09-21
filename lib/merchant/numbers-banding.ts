import {
  daysBetweenUkDates,
  ukDateKey,
} from "@/lib/merchant/activity-display-helpers"

/**
 * Low-data honesty (handoff §6.3.3). The band is chosen by days since the
 * venue's first stamp, never by row count:
 *
 * - `too-early` (< 3 days, or no stamp yet): no chart, a receipt note with
 *   the raw totals and the date to come back on.
 * - `partial` (3–13 days): the chart draws only the elapsed days; days
 *   before the first stamp are dashed "not yet recorded" placeholders, and
 *   week-on-week deltas are suppressed because the previous week is
 *   incomplete.
 * - `full` (>= 14 days): everything.
 */
export type NumbersBand = "too-early" | "partial" | "full"

export const NUMBERS_TREND_MIN_DAYS = 3
export const NUMBERS_FULL_MIN_DAYS = 14

export function daysSinceFirstStamp(
  firstStampAt: string | null,
  now: Date
): number | null {
  if (!firstStampAt) return null
  const first = new Date(firstStampAt)
  if (Number.isNaN(first.getTime())) return null
  const days = daysBetweenUkDates(
    ukDateKey(first.toISOString()),
    ukDateKey(now.toISOString())
  )
  return Math.max(0, days)
}

export function resolveNumbersBand(days: number | null): NumbersBand {
  if (days === null || days < NUMBERS_TREND_MIN_DAYS) return "too-early"
  if (days < NUMBERS_FULL_MIN_DAYS) return "partial"
  return "full"
}

/** The London date on which the venue crosses into the `partial` band. */
export function trendAvailableFrom(firstStampAt: string | null): string | null {
  if (!firstStampAt) return null
  const first = new Date(firstStampAt)
  if (Number.isNaN(first.getTime())) return null
  const key = ukDateKey(first.toISOString())
  const [year, month, day] = key.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day + NUMBERS_TREND_MIN_DAYS, 12))
    .toISOString()
    .slice(0, 10)
}

/**
 * How many leading columns of a day-keyed series precede the first stamp
 * and therefore render as placeholders rather than zeros.
 */
export function placeholderColumnCount(
  dayKeys: readonly string[],
  firstStampAt: string | null
): number {
  if (!firstStampAt) return dayKeys.length
  const first = new Date(firstStampAt)
  if (Number.isNaN(first.getTime())) return 0
  const firstKey = ukDateKey(first.toISOString())
  return dayKeys.filter((key) => key < firstKey).length
}
