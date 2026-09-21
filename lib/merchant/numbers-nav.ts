/**
 * The Numbers surface's fixed vocabularies. `[metric]` on the detail route
 * is validated against `NUMBERS_METRICS` and anything else 404s; the range
 * is read from `?range=` and clamped to a known value.
 *
 * 28 days is in the handoff but `dashboard-query.ts` builds a fixed 14-day
 * series and is sign-off gated (§16.6), so only 7 and 14 are offered until
 * that query takes a day count.
 */
export const NUMBERS_METRICS = ["members", "stamps", "rewards", "qr"] as const
export type NumbersMetric = (typeof NUMBERS_METRICS)[number]

export const NUMBERS_METRIC_LABELS: Record<NumbersMetric, string> = {
  members: "Members",
  stamps: "Stamps",
  rewards: "Rewards",
  qr: "QR",
}

const metricSet = new Set<string>(NUMBERS_METRICS)

export function isNumbersMetric(value: unknown): value is NumbersMetric {
  return typeof value === "string" && metricSet.has(value)
}

export const NUMBERS_RANGES = [7, 14] as const
export type NumbersRange = (typeof NUMBERS_RANGES)[number]
export const DEFAULT_NUMBERS_RANGE: NumbersRange = 14

export function parseNumbersRange(value: string | undefined): NumbersRange {
  const parsed = Number(value)
  return (
    NUMBERS_RANGES.find((range) => range === parsed) ?? DEFAULT_NUMBERS_RANGE
  )
}

export function numbersRangeLabel(range: NumbersRange): string {
  return `Last ${range} days`
}
