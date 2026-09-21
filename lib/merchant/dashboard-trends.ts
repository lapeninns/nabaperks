export type WeekCountPair = {
  readonly current: number
  readonly previous: number
}

export type MetricTrendDirection = "up" | "down" | "flat"

export type MetricWeekTrend = WeekCountPair & {
  readonly delta: number
  readonly direction: MetricTrendDirection
  readonly label: string
}

export type MerchantDashboardTrends = {
  readonly newMembers: MetricWeekTrend
  readonly stamps: MetricWeekTrend
  readonly rewards: MetricWeekTrend
  readonly qrDownloads: MetricWeekTrend
}

export function buildMetricWeekTrend(pair: WeekCountPair): MetricWeekTrend {
  const delta = pair.current - pair.previous
  const direction =
    delta > 0 ? "up" : delta < 0 ? "down" : ("flat" as MetricTrendDirection)

  return {
    ...pair,
    delta,
    direction,
    label: formatMetricTrendLabel(delta, direction, pair),
  }
}

export function buildMerchantDashboardTrends(
  pairs: Record<keyof MerchantDashboardTrends, WeekCountPair>
): MerchantDashboardTrends {
  return {
    newMembers: buildMetricWeekTrend(pairs.newMembers),
    stamps: buildMetricWeekTrend(pairs.stamps),
    rewards: buildMetricWeekTrend(pairs.rewards),
    qrDownloads: buildMetricWeekTrend(pairs.qrDownloads),
  }
}

/**
 * Direction in words, never a sign alone: "25 more than last week", "8 fewer
 * than last week", "same as last week". Two silent weeks say so ("no
 * activity either week") rather than claiming sameness. Colour is redundant
 * on top of this (metricTrendClassName); the row must read in greyscale.
 */
export function formatMetricTrendLabel(
  delta: number,
  direction: MetricTrendDirection,
  pair?: WeekCountPair
): string {
  if (direction === "flat") {
    return pair && pair.current === 0 && pair.previous === 0
      ? "no activity either week"
      : "same as last week"
  }

  const magnitude = Math.abs(delta)
  return delta > 0
    ? `${magnitude} more than last week`
    : `${magnitude} fewer than last week`
}

/** The glyph that pairs with the words: ▲ ▼ = (aria-hidden at the call site). */
export function metricTrendGlyph(direction: MetricTrendDirection): string {
  switch (direction) {
    case "up":
      return "▲"
    case "down":
      return "▼"
    case "flat":
      return "="
  }
}

export function metricTrendClassName(direction: MetricTrendDirection): string {
  switch (direction) {
    case "up":
      return "text-reward"
    case "down":
      return "text-destructive"
    case "flat":
      return "text-muted-foreground"
  }
}
