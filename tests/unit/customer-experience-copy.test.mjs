import assert from "node:assert/strict"
import { test } from "node:test"

import { waitingRewardTiming } from "@/lib/customer/experience/copy"

test("Given collection timing When waiting copy is built Then authoritative availability wins over the next window", () => {
  assert.equal(
    waitingRewardTiming("2026-10-27T05:30:00Z", "2026-10-28T06:00:00Z"),
    "Ready from Tue 27 Oct, 05:30."
  )
})

test("Given only a next window When waiting copy is built Then its exact London instant is shown", () => {
  assert.equal(
    waitingRewardTiming(null, "2026-10-28T06:00:00Z"),
    "Ready from Wed 28 Oct, 06:00."
  )
  assert.equal(
    waitingRewardTiming(null, null),
    "The collection time will show here once it's set."
  )
})
