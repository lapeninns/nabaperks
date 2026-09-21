import assert from "node:assert/strict"
import { test } from "node:test"

import { buildMerchantDashboardTrends } from "@/lib/merchant/dashboard-trends"
import { buildNumbersDetailModel } from "@/lib/merchant/numbers-detail-model"

const NOW = new Date("2026-09-21T12:00:00Z")
const DAYS = Array.from({ length: 14 }, (_, index) =>
  new Date(Date.UTC(2026, 8, 8 + index, 12)).toISOString().slice(0, 10)
)
const SERIES = {
  days: DAYS,
  stamps: [9, 8, 7, 10, 8, 9, 8, 7, 8, 6, 9, 7, 8, 6],
  joins: [4, 3, 4, 3, 4, 4, 3, 3, 4, 4, 3, 4, 3, 4],
  rewards: [2, 1, 2, 1, 2, 1, 1, 0, 1, 0, 1, 0, 1, 0],
}
const TRENDS = buildMerchantDashboardTrends({
  newMembers: { current: 25, previous: 25 },
  stamps: { current: 51, previous: 59 },
  rewards: { current: 3, previous: 10 },
  qrDownloads: { current: 2, previous: 0 },
})
const TOTALS = {
  members: 81,
  stampsIssued: 412,
  rewardsRedeemed: 37,
  qrDownloads: 6,
}

const base = {
  totals: TOTALS,
  trends: TRENDS,
  series: SERIES,
  firstStampAt: "2026-08-01T10:00:00Z",
  now: NOW,
}

test("stamps detail sums the range, names best and quietest days, and compares in words", () => {
  const model = buildNumbersDetailModel({ ...base, metric: "stamps", range: 7 })
  assert.equal(model.headline, 51)
  assert.equal(model.headlineCaption, "stamps in the last 7 days")
  assert.equal(model.chart.values.length, 7)
  assert.equal(model.chart.tone, "ink")
  assert.deepEqual(model.bestDay, { name: "Friday 18 September", value: 9 })
  assert.deepEqual(model.quietestDay, {
    name: "Thursday 17 September",
    value: 6,
  })
  assert.equal(model.comparison.label, "8 fewer than last week")
  assert.equal(model.comparisonEnabled, true)
  assert.equal(model.activityCategory, "stamp")
})

test("members detail reads the joins series in cobalt", () => {
  const model = buildNumbersDetailModel({
    ...base,
    metric: "members",
    range: 14,
  })
  assert.equal(model.headline, 50)
  assert.equal(model.chart.tone, "cobalt")
  assert.equal(model.noun.plural, "joins")
  assert.equal(model.activityCategory, "customer")
})

test("QR has no daily series: running total, week comparison, no chart", () => {
  const model = buildNumbersDetailModel({ ...base, metric: "qr", range: 14 })
  assert.equal(model.headline, 6)
  assert.equal(model.headlineCaption, "QR downloads, all time")
  assert.equal(model.chartLabel, "QR downloads")
  assert.equal(model.chart, null)
  assert.equal(model.bestDay, null)
  assert.equal(model.comparison.label, "2 more than last week")
})

test("best and quietest days skip placeholder columns in the partial band", () => {
  const model = buildNumbersDetailModel({
    ...base,
    metric: "rewards",
    range: 14,
    firstStampAt: "2026-09-15T09:00:00Z",
  })
  assert.equal(model.band, "partial")
  assert.equal(model.chartLabel, "Rewards unlocked")
  assert.equal(model.comparisonLabel, "Rewards redeemed")
  assert.equal(model.chart.placeholderCount, 7)
  assert.equal(model.comparisonEnabled, false)
  assert.deepEqual(model.bestDay, { name: "Wednesday 16 September", value: 1 })
  assert.deepEqual(model.quietestDay, {
    name: "Tuesday 15 September",
    value: 0,
  })
})

test("too early: no chart and a come-back date; missing series keeps the comparison", () => {
  const early = buildNumbersDetailModel({
    ...base,
    metric: "stamps",
    range: 14,
    firstStampAt: "2026-09-20T09:00:00Z",
  })
  assert.equal(early.chart, null)
  assert.equal(early.headline, 412)
  assert.equal(early.headlineCaption, "stamps, all time")
  assert.equal(early.trendFrom, "2026-09-23")

  const noSeries = buildNumbersDetailModel({
    ...base,
    metric: "stamps",
    range: 14,
    series: null,
  })
  assert.equal(noSeries.chart, null)
  assert.equal(noSeries.comparison.current, 51)
})
