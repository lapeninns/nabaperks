import { describe, expect, it } from "vitest"

import {
  buildMerchantDashboardTrends,
  buildMetricWeekTrend,
  formatMetricTrendLabel,
  metricTrendClassName,
} from "@/lib/merchant/dashboard-trends"

describe("merchant dashboard weekly trends", () => {
  it("labels improvement, decline, and flat weeks in plain British copy", () => {
    expect(buildMetricWeekTrend({ current: 8, previous: 5 })).toMatchObject({
      delta: 3,
      direction: "up",
      label: "+3 vs last week",
    })
    expect(buildMetricWeekTrend({ current: 2, previous: 6 })).toMatchObject({
      delta: -4,
      direction: "down",
      label: "−4 vs last week",
    })
    expect(buildMetricWeekTrend({ current: 4, previous: 4 })).toMatchObject({
      delta: 0,
      direction: "flat",
      label: "Same as last week",
    })
  })

  it("maps trend direction to reward, destructive, and muted tones", () => {
    expect(metricTrendClassName("up")).toBe("text-reward")
    expect(metricTrendClassName("down")).toBe("text-destructive")
    expect(metricTrendClassName("flat")).toBe("text-muted-foreground")
  })

  it("builds all dashboard trend slots from paired week counts", () => {
    const trends = buildMerchantDashboardTrends({
      newMembers: { current: 6, previous: 4 },
      stamps: { current: 10, previous: 12 },
      rewards: { current: 1, previous: 1 },
      qrDownloads: { current: 0, previous: 2 },
    })

    expect(trends.newMembers.label).toBe("+2 vs last week")
    expect(trends.stamps.direction).toBe("down")
    expect(trends.rewards.label).toBe("Same as last week")
    expect(trends.qrDownloads.label).toBe("−2 vs last week")
    expect(formatMetricTrendLabel(-1, "down")).toBe("−1 vs last week")
  })
})
