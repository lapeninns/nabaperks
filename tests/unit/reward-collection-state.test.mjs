import assert from "node:assert/strict"
import { test } from "node:test"

import {
  formatCollectionAvailability,
  formatCollectionAvailableLabel,
  parseRewardCollectionState,
} from "@/lib/customer/reward-collection-state"

test("Given an authoritative predicate row When parsed Then readiness and timestamps are preserved", () => {
  assert.deepEqual(
    parseRewardCollectionState({
      state: "ready",
      reason: null,
      available_from: "2026-10-27T05:00:00Z",
      expires_at: "2026-12-22T15:00:00Z",
    }),
    {
      state: "ready",
      reason: null,
      availableFrom: "2026-10-27T05:00:00Z",
      expiresAt: "2026-12-22T15:00:00Z",
    }
  )
})

test("Given an authoritative collection instant When formatted Then the London date and time are shown", () => {
  assert.equal(
    formatCollectionAvailability("2026-10-27T05:30:00Z"),
    "Ready Tuesday 27 October at 05:30"
  )
  assert.equal(
    formatCollectionAvailableLabel("2026-10-27T05:30:00Z"),
    "Tuesday 27 October at 05:30"
  )
  assert.equal(formatCollectionAvailability(null), null)
  assert.equal(formatCollectionAvailableLabel(null), null)
})

test("Given stale or malformed predicate facts When parsed Then they fail closed", () => {
  for (const value of [null, {}, { state: "surprise" }]) {
    assert.throws(
      () => parseRewardCollectionState(value),
      /malformed collection state/
    )
  }
})
