import assert from "node:assert/strict"
import { test } from "node:test"

import * as buckets from "@/lib/merchant/dashboard-buckets"

/**
 * MS-db-merchant-analytics-rpcs — pure mapping tier.
 *
 * mapSeriesRowsToBuckets turns the aggregation RPC's sparse per-day rows
 * into the dense, bucket-ordered series arrays the dashboard renders. Days
 * with no RPC row stay 0; counts arrive as numbers or PostgREST bigint
 * strings.
 */

const DAY_BUCKETS = [
  { key: "2026-07-05", iso: "2026-07-04T23:00:00.000Z" },
  { key: "2026-07-06", iso: "2026-07-05T23:00:00.000Z" },
  { key: "2026-07-07", iso: "2026-07-06T23:00:00.000Z" },
]

test("mapSeriesRowsToBuckets is exported from dashboard-buckets", () => {
  assert.equal(
    typeof buckets.mapSeriesRowsToBuckets,
    "function",
    "mapSeriesRowsToBuckets must be exported (RED until implemented)"
  )
})

test("maps sparse RPC rows onto dense zero-filled bucket arrays", () => {
  const series = buckets.mapSeriesRowsToBuckets(
    [
      { day: "2026-07-05", joins: 2, stamps: 5, rewards: 1 },
      { day: "2026-07-07", joins: 1, stamps: 0, rewards: 3 },
    ],
    DAY_BUCKETS
  )

  assert.deepEqual(series.joins, [2, 0, 1])
  assert.deepEqual(series.stamps, [5, 0, 0])
  assert.deepEqual(series.rewards, [1, 0, 3])
})

test("coerces PostgREST bigint strings and ignores unknown days", () => {
  const series = buckets.mapSeriesRowsToBuckets(
    [
      { day: "2026-07-06", joins: "1200", stamps: "3", rewards: "0" },
      { day: "1999-01-01", joins: 9, stamps: 9, rewards: 9 },
    ],
    DAY_BUCKETS
  )

  assert.deepEqual(series.joins, [0, 1200, 0])
  assert.deepEqual(series.stamps, [0, 3, 0])
  assert.deepEqual(series.rewards, [0, 0, 0])
})

test("handles null/empty input as an all-zero series", () => {
  for (const input of [null, undefined, []]) {
    const series = buckets.mapSeriesRowsToBuckets(input, DAY_BUCKETS)
    assert.deepEqual(series.joins, [0, 0, 0])
    assert.deepEqual(series.stamps, [0, 0, 0])
    assert.deepEqual(series.rewards, [0, 0, 0])
  }
})

test("drops malformed rows instead of throwing", () => {
  const series = buckets.mapSeriesRowsToBuckets(
    [
      { day: null, joins: 1, stamps: 1, rewards: 1 },
      { joins: 1, stamps: 1, rewards: 1 },
      { day: "2026-07-07", joins: "not-a-number", stamps: 2, rewards: -1 },
    ],
    DAY_BUCKETS
  )

  assert.deepEqual(series.joins, [0, 0, 0], "unparseable count reads as 0")
  assert.deepEqual(series.stamps, [0, 0, 2])
  assert.deepEqual(series.rewards, [0, 0, 0], "negative counts clamp to 0")
})
