import assert from "node:assert/strict"
import { test } from "node:test"

import {
  isNumbersMetric,
  NUMBERS_METRICS,
  numbersRangeLabel,
  parseNumbersRange,
} from "@/lib/merchant/numbers-nav"

test("the [metric] union accepts exactly the four metrics", () => {
  assert.deepEqual([...NUMBERS_METRICS], ["members", "stamps", "rewards", "qr"])
  for (const metric of NUMBERS_METRICS)
    assert.equal(isNumbersMetric(metric), true)
  for (const value of ["revenue", "Members", "", null, undefined, 7, "qr/"]) {
    assert.equal(isNumbersMetric(value), false, String(value))
  }
})

test("the range clamps to a known value and defaults to 14", () => {
  assert.equal(parseNumbersRange("7"), 7)
  assert.equal(parseNumbersRange("14"), 14)
  assert.equal(parseNumbersRange("28"), 14)
  assert.equal(parseNumbersRange("abc"), 14)
  assert.equal(parseNumbersRange(undefined), 14)
  assert.equal(numbersRangeLabel(7), "Last 7 days")
})
