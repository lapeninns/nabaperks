import type {
  MerchantDashboardTrends,
  MetricWeekTrend,
} from "@/lib/merchant/dashboard-trends"
import {
  daysSinceFirstStamp,
  placeholderColumnCount,
  resolveNumbersBand,
  trendAvailableFrom,
  type NumbersBand,
} from "@/lib/merchant/numbers-banding"
import type { NumbersRange } from "@/lib/merchant/numbers-nav"

export type NumbersTotals = {
  readonly members: number
  readonly stampsIssued: number
  readonly rewardsRedeemed: number
  readonly qrDownloads: number
}

export type NumbersSeriesInput = {
  readonly days: readonly string[]
  readonly stamps: readonly number[]
  readonly joins: readonly number[]
}

export type NumbersDeltaRow = {
  readonly key: "newMembers" | "stamps" | "rewards"
  readonly label: string
  readonly trend: MetricWeekTrend
}

export type NumbersChartModel = {
  /** YYYY-MM-DD London day keys, oldest first. */
  readonly days: readonly string[]
  /** "Wed 16" column captions. */
  readonly labels: readonly string[]
  /** "Wednesday 16 September" readout names. */
  readonly names: readonly string[]
  readonly stamps: readonly number[]
  readonly joins: readonly number[]
  /** Leading columns that precede the first stamp. */
  readonly placeholderCount: number
}

export type NumbersOverviewModel = {
  readonly range: NumbersRange
  readonly band: NumbersBand
  readonly daysSinceFirstStamp: number | null
  /** ISO date the chart becomes available, for the too-early note. */
  readonly trendFrom: string | null
  readonly totals: NumbersTotals | null
  readonly joinedLast7: number | null
  readonly chart: NumbersChartModel | null
  readonly deltas: readonly NumbersDeltaRow[] | null
  readonly deltasEnabled: boolean
  readonly refreshedAt: string
}

/**
 * One pure builder for the Numbers overview so the page, the harness and the
 * unit tests share a shape. `totals`/`trends` and `series` arrive separately
 * because they load separately: either may be null when its read failed, and
 * the screen renders the other half with an inline note.
 */
export function buildNumbersOverviewModel({
  range,
  totals,
  trends,
  series,
  firstStampAt,
  now,
}: {
  readonly range: NumbersRange
  readonly totals: NumbersTotals | null
  readonly trends: MerchantDashboardTrends | null
  readonly series: NumbersSeriesInput | null
  readonly firstStampAt: string | null
  readonly now: Date
}): NumbersOverviewModel {
  const days = daysSinceFirstStamp(firstStampAt, now)
  const band = resolveNumbersBand(days)
  const deltasEnabled = band === "full"

  const chart =
    series && band !== "too-early"
      ? sliceSeries(series, range, firstStampAt)
      : null

  const deltas: readonly NumbersDeltaRow[] | null = trends
    ? [
        { key: "newMembers", label: "New members", trend: trends.newMembers },
        { key: "stamps", label: "Stamps", trend: trends.stamps },
        { key: "rewards", label: "Rewards redeemed", trend: trends.rewards },
      ]
    : null

  return {
    range,
    band,
    daysSinceFirstStamp: days,
    trendFrom: trendAvailableFrom(firstStampAt),
    totals,
    joinedLast7: trends?.newMembers.current ?? null,
    chart,
    deltas,
    deltasEnabled,
    refreshedAt: now.toISOString(),
  }
}

function sliceSeries(
  series: NumbersSeriesInput,
  range: NumbersRange,
  firstStampAt: string | null
): NumbersChartModel {
  const days = series.days.slice(-range)
  const stamps = series.stamps.slice(-range)
  const joins = series.joins.slice(-range)
  return {
    days,
    labels: days.map(formatColumnLabel),
    names: days.map(formatDayName),
    stamps,
    joins,
    placeholderCount: placeholderColumnCount(days, firstStampAt),
  }
}

const COLUMN_LABEL = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  weekday: "short",
  day: "numeric",
})
const DAY_NAME = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  weekday: "long",
  day: "numeric",
  month: "long",
})

/** Day keys are London dates; formatting them at UTC noon keeps the date. */
function dayKeyToDate(key: string): Date {
  return new Date(`${key}T12:00:00Z`)
}

export function formatColumnLabel(key: string): string {
  return COLUMN_LABEL.format(dayKeyToDate(key))
}

export function formatDayName(key: string): string {
  return DAY_NAME.format(dayKeyToDate(key))
}

/** "Thu 24 Sep" for the come-back note. */
export function formatComeBackDate(isoDate: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  })
    .format(dayKeyToDate(isoDate))
    .replace("Sept", "Sep")
}

/** "Wed 16 September, 9 stamps" — the column button's accessible name. */
export function describeColumn(
  name: string,
  value: number,
  noun: { singular: string; plural: string }
): string {
  return `${name}, ${value} ${value === 1 ? noun.singular : noun.plural}`
}
