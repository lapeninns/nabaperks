import assert from "node:assert/strict"
import { test } from "node:test"

import { waitingRewardTiming } from "@/lib/customer/experience/copy"

test("Given collection timing When waiting copy is built Then authoritative availability wins over the next window", () => {
  assert.equal(
    waitingRewardTiming("2026-10-27T05:30:00Z", "2026-10-28T06:00:00Z"),
    "It's yours from Tuesday 27 October at 05:30."
  )
})

test("Given only a next window When waiting copy is built Then its exact London instant is shown", () => {
  assert.equal(
    waitingRewardTiming(null, "2026-10-28T06:00:00Z"),
    "It's yours from Wednesday 28 October at 06:00."
  )
  assert.equal(
    waitingRewardTiming(null, null),
    "Check back shortly for the collection time."
  )
})
