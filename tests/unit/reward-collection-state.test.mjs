import assert from "node:assert/strict"
import { test } from "node:test"

import { parseRewardCollectionState } from "@/lib/customer/reward-collection-state"

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

test("Given stale or malformed predicate facts When parsed Then they fail closed", () => {
  for (const value of [null, {}, { state: "surprise" }]) {
    assert.throws(
      () => parseRewardCollectionState(value),
      /malformed collection state/
    )
  }
})
