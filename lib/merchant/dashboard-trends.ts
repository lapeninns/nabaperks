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
    label: formatMetricTrendLabel(delta, direction),
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

export function formatMetricTrendLabel(
  delta: number,
  direction: MetricTrendDirection
): string {
  if (direction === "flat") {
    return "Same as last week"
  }

  const sign = delta > 0 ? "+" : "−"
  return `${sign}${Math.abs(delta)} vs last week`
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
