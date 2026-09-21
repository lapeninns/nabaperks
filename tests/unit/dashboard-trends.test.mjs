import assert from "node:assert/strict"
import { test } from "node:test"

import {
  buildMetricWeekTrend,
  formatMetricTrendLabel,
  metricTrendClassName,
  metricTrendGlyph,
} from "@/lib/merchant/dashboard-trends"

test("trend labels carry direction in words, never a bare sign", () => {
  assert.equal(formatMetricTrendLabel(25, "up"), "25 more than last week")
  assert.equal(formatMetricTrendLabel(-8, "down"), "8 fewer than last week")
  assert.equal(formatMetricTrendLabel(0, "flat"), "same as last week")
  assert.equal(
    formatMetricTrendLabel(0, "flat", { current: 0, previous: 0 }),
    "no activity either week"
  )
  assert.equal(
    formatMetricTrendLabel(0, "flat", { current: 4, previous: 4 }),
    "same as last week"
  )
})

test("buildMetricWeekTrend threads the pair so two silent weeks are named", () => {
  assert.equal(
    buildMetricWeekTrend({ current: 0, previous: 0 }).label,
    "no activity either week"
  )
  const down = buildMetricWeekTrend({ current: 51, previous: 59 })
  assert.equal(down.direction, "down")
  assert.equal(down.delta, -8)
  assert.equal(down.label, "8 fewer than last week")
})

test("glyph and colour are redundant with the words", () => {
  assert.equal(metricTrendGlyph("up"), "▲")
  assert.equal(metricTrendGlyph("down"), "▼")
  assert.equal(metricTrendGlyph("flat"), "=")
  assert.equal(metricTrendClassName("up"), "text-reward")
  assert.equal(metricTrendClassName("down"), "text-destructive")
})
