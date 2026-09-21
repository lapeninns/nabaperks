import type { ActivityCategory } from "@/lib/merchant/activity-display"
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
import {
  NUMBERS_METRIC_LABELS,
  type NumbersMetric,
  type NumbersRange,
} from "@/lib/merchant/numbers-nav"
import {
  formatColumnLabel,
  formatDayName,
  type NumbersTotals,
} from "@/lib/merchant/numbers-overview-model"

export type NumbersDetailSeriesInput = {
  readonly days: readonly string[]
  readonly stamps: readonly number[]
  readonly joins: readonly number[]
  readonly rewards: readonly number[]
}

export type NumbersDetailDay = {
  readonly name: string
  readonly value: number
}

export type NumbersDetailModel = {
  readonly metric: NumbersMetric
  readonly label: string
  /** What the daily series counts — "Rewards unlocked" for rewards, since
   *  the series buckets unlock dates while the week comparison counts
   *  redemptions. */
  readonly chartLabel: string
  readonly comparisonLabel: string
  readonly noun: { singular: string; plural: string }
  readonly range: NumbersRange
  readonly band: NumbersBand
  readonly trendFrom: string | null
  /** The metric's count over the range (series metrics) or its running total (QR). */
  readonly headline: number | null
  readonly headlineCaption: string
  readonly chart: {
    readonly days: readonly string[]
    readonly labels: readonly string[]
    readonly names: readonly string[]
    readonly values: readonly number[]
    readonly placeholderCount: number
    readonly tone: "ink" | "cobalt"
  } | null
  readonly comparison: MetricWeekTrend | null
  readonly comparisonEnabled: boolean
  readonly bestDay: NumbersDetailDay | null
  readonly quietestDay: NumbersDetailDay | null
  /** The activity feed category that backs this metric. */
  readonly activityCategory: ActivityCategory
  readonly refreshedAt: string
}

const METRIC_NOUNS: Record<
  NumbersMetric,
  { singular: string; plural: string }
> = {
  members: { singular: "join", plural: "joins" },
  stamps: { singular: "stamp", plural: "stamps" },
  rewards: { singular: "reward", plural: "rewards" },
  qr: { singular: "download", plural: "downloads" },
}

const CHART_LABEL: Record<NumbersMetric, string> = {
  members: "Joins",
  stamps: "Stamps",
  rewards: "Rewards unlocked",
  qr: "QR downloads",
}

const COMPARISON_LABEL: Record<NumbersMetric, string> = {
  members: "New members",
  stamps: "Stamps",
  rewards: "Rewards redeemed",
  qr: "QR downloads",
}

const METRIC_CATEGORY: Record<NumbersMetric, ActivityCategory> = {
  members: "customer",
  stamps: "stamp",
  rewards: "reward",
  qr: "qr",
}

/**
 * One pure builder for a metric's detail screen (handoff §6.3.2). Every
 * number traces to an existing counter: the daily series for members
 * (joins), stamps and rewards; the week trend pair for the comparison; the
 * running QR download count for QR, which has no daily series and so no
 * chart. The contributing breakdowns the handoff lists (joins by channel,
 * stamps by hour, reward lifecycle, QR scans versus prints) have no query
 * behind them and are omitted rather than invented.
 */
export function buildNumbersDetailModel({
  metric,
  range,
  totals,
  trends,
  series,
  firstStampAt,
  now,
}: {
  readonly metric: NumbersMetric
  readonly range: NumbersRange
  readonly totals: NumbersTotals | null
  readonly trends: MerchantDashboardTrends | null
  readonly series: NumbersDetailSeriesInput | null
  readonly firstStampAt: string | null
  readonly now: Date
}): NumbersDetailModel {
  const days = daysSinceFirstStamp(firstStampAt, now)
  const band = resolveNumbersBand(days)
  const comparisonEnabled = band === "full"
  const noun = METRIC_NOUNS[metric]

  const values = series ? seriesFor(series, metric) : null
  const chart =
    values && band !== "too-early"
      ? (() => {
          const rangeDays = series!.days.slice(-range)
          const rangeValues = values.slice(-range)
          return {
            days: rangeDays,
            labels: rangeDays.map(formatColumnLabel),
            names: rangeDays.map(formatDayName),
            values: rangeValues,
            placeholderCount: placeholderColumnCount(rangeDays, firstStampAt),
            tone: metric === "members" ? ("cobalt" as const) : ("ink" as const),
          }
        })()
      : null

  const recorded = chart
    ? chart.values
        .map((value, index) => ({
          name: chart.names[index] ?? "",
          value,
          index,
        }))
        .slice(chart.placeholderCount)
    : []
  const best = recorded.length
    ? recorded.reduce((top, day) => (day.value > top.value ? day : top))
    : null
  const quietest = recorded.length
    ? recorded.reduce((low, day) => (day.value < low.value ? day : low))
    : null

  // The range total when the chart is drawn; the running total (all time)
  // when the band withholds the chart, so a new venue still sees a number.
  const runningTotal = totals ? runningTotalFor(totals, metric) : null
  const headline =
    metric === "qr" || !chart
      ? runningTotal
      : chart.values.reduce((sum, value) => sum + value, 0)

  return {
    metric,
    label: NUMBERS_METRIC_LABELS[metric],
    noun,
    range,
    band,
    trendFrom: trendAvailableFrom(firstStampAt),
    headline,
    headlineCaption:
      metric === "qr" || !chart
        ? `${chartLabelLower(metric)}, all time`
        : `${chartLabelLower(metric)} in the last ${range} days`,
    chartLabel: CHART_LABEL[metric],
    comparisonLabel: COMPARISON_LABEL[metric],
    chart,
    comparison: trends ? trendFor(trends, metric) : null,
    comparisonEnabled,
    bestDay: best ? { name: best.name, value: best.value } : null,
    quietestDay: quietest
      ? { name: quietest.name, value: quietest.value }
      : null,
    activityCategory: METRIC_CATEGORY[metric],
    refreshedAt: now.toISOString(),
  }
}

function seriesFor(
  series: NumbersDetailSeriesInput,
  metric: NumbersMetric
): readonly number[] | null {
  switch (metric) {
    case "members":
      return series.joins
    case "stamps":
      return series.stamps
    case "rewards":
      return series.rewards
    case "qr":
      return null
  }
}

function trendFor(
  trends: MerchantDashboardTrends,
  metric: NumbersMetric
): MetricWeekTrend {
  switch (metric) {
    case "members":
      return trends.newMembers
    case "stamps":
      return trends.stamps
    case "rewards":
      return trends.rewards
    case "qr":
      return trends.qrDownloads
  }
}

function runningTotalFor(totals: NumbersTotals, metric: NumbersMetric): number {
  switch (metric) {
    case "members":
      return totals.members
    case "stamps":
      return totals.stampsIssued
    case "rewards":
      return totals.rewardsRedeemed
    case "qr":
      return totals.qrDownloads
  }
}

function chartLabelLower(metric: NumbersMetric): string {
  return metric === "qr" ? "QR downloads" : CHART_LABEL[metric].toLowerCase()
}
