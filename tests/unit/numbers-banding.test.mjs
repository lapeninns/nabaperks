import assert from "node:assert/strict"
import { test } from "node:test"

import {
  daysSinceFirstStamp,
  placeholderColumnCount,
  resolveNumbersBand,
  trendAvailableFrom,
} from "@/lib/merchant/numbers-banding"
import { buildNumbersOverviewModel } from "@/lib/merchant/numbers-overview-model"
import { buildMerchantDashboardTrends } from "@/lib/merchant/dashboard-trends"

const NOW = new Date("2026-09-21T12:00:00Z")
const DAYS = Array.from({ length: 14 }, (_, index) =>
  new Date(Date.UTC(2026, 8, 8 + index, 12)).toISOString().slice(0, 10)
)

test("bands follow days since the first stamp, not row count", () => {
  assert.equal(resolveNumbersBand(null), "too-early")
  assert.equal(resolveNumbersBand(0), "too-early")
  assert.equal(resolveNumbersBand(2), "too-early")
  assert.equal(resolveNumbersBand(3), "partial")
  assert.equal(resolveNumbersBand(13), "partial")
  assert.equal(resolveNumbersBand(14), "full")
  assert.equal(resolveNumbersBand(400), "full")
})

test("days since the first stamp are counted on London dates", () => {
  assert.equal(daysSinceFirstStamp(null, NOW), null)
  assert.equal(daysSinceFirstStamp("2026-09-21T08:00:00Z", NOW), 0)
  assert.equal(daysSinceFirstStamp("2026-09-18T23:30:00Z", NOW), 2) // 00:30 BST on the 19th
  assert.equal(daysSinceFirstStamp("2026-09-07T12:00:00Z", NOW), 14)
  assert.equal(daysSinceFirstStamp("garbage", NOW), null)
})

test("the come-back date is three days after the first stamp", () => {
  assert.equal(trendAvailableFrom("2026-09-20T18:00:00Z"), "2026-09-23")
  assert.equal(trendAvailableFrom(null), null)
})

test("columns before the first stamp are placeholders, never zeros", () => {
  assert.equal(placeholderColumnCount(DAYS, "2026-09-15T09:00:00Z"), 7)
  assert.equal(placeholderColumnCount(DAYS, "2026-09-01T09:00:00Z"), 0)
  assert.equal(placeholderColumnCount(DAYS, null), 14)
})

const TRENDS = buildMerchantDashboardTrends({
  newMembers: { current: 25, previous: 25 },
  stamps: { current: 51, previous: 59 },
  rewards: { current: 3, previous: 10 },
  qrDownloads: { current: 0, previous: 0 },
})
const SERIES = {
  days: DAYS,
  stamps: [9, 8, 7, 10, 8, 9, 8, 7, 8, 6, 9, 7, 8, 6],
  joins: [4, 3, 4, 3, 4, 4, 3, 3, 4, 4, 3, 4, 3, 4],
}
const TOTALS = {
  members: 81,
  stampsIssued: 412,
  rewardsRedeemed: 37,
  qrDownloads: 6,
}

test("a full-history venue gets both charts and enabled deltas at the chosen range", () => {
  const model = buildNumbersOverviewModel({
    range: 7,
    totals: TOTALS,
    trends: TRENDS,
    series: SERIES,
    firstStampAt: "2026-08-01T10:00:00Z",
    now: NOW,
  })
  assert.equal(model.band, "full")
  assert.equal(model.deltasEnabled, true)
  assert.equal(model.chart.days.length, 7)
  assert.deepEqual(model.chart.stamps, [7, 8, 6, 9, 7, 8, 6])
  assert.equal(model.chart.placeholderCount, 0)
  assert.equal(model.chart.labels[6], "Mon 21")
  assert.equal(model.chart.names[6], "Monday 21 September")
  assert.equal(model.joinedLast7, 25)
  assert.deepEqual(
    model.deltas.map((row) => row.trend.label),
    ["same as last week", "8 fewer than last week", "7 fewer than last week"]
  )
})

test("a partial venue draws only the elapsed days and suppresses deltas", () => {
  const model = buildNumbersOverviewModel({
    range: 14,
    totals: TOTALS,
    trends: TRENDS,
    series: SERIES,
    firstStampAt: "2026-09-15T09:00:00Z",
    now: NOW,
  })
  assert.equal(model.band, "partial")
  assert.equal(model.daysSinceFirstStamp, 6)
  assert.equal(model.deltasEnabled, false)
  assert.equal(model.chart.placeholderCount, 7)
})

test("a venue under three days gets no chart, only totals and a date", () => {
  const model = buildNumbersOverviewModel({
    range: 14,
    totals: TOTALS,
    trends: TRENDS,
    series: SERIES,
    firstStampAt: "2026-09-20T09:00:00Z",
    now: NOW,
  })
  assert.equal(model.band, "too-early")
  assert.equal(model.chart, null)
  assert.equal(model.trendFrom, "2026-09-23")
  assert.equal(model.totals.members, 81)
})

test("a failed series keeps the totals and deltas, and vice versa", () => {
  const noSeries = buildNumbersOverviewModel({
    range: 14,
    totals: TOTALS,
    trends: TRENDS,
    series: null,
    firstStampAt: "2026-08-01T10:00:00Z",
    now: NOW,
  })
  assert.equal(noSeries.chart, null)
  assert.equal(noSeries.deltas.length, 3)

  const noTotals = buildNumbersOverviewModel({
    range: 14,
    totals: null,
    trends: null,
    series: SERIES,
    firstStampAt: "2026-08-01T10:00:00Z",
    now: NOW,
  })
  assert.equal(noTotals.totals, null)
  assert.equal(noTotals.deltas, null)
  assert.equal(noTotals.chart.days.length, 14)
})
