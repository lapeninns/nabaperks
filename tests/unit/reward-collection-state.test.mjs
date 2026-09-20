import assert from "node:assert/strict"
import { test } from "node:test"

import {
  cardRewardCollectable,
  formatCollectionAvailability,
  formatCollectionAvailableLabel,
  parseRewardCollectionState,
  rewardCollectionBlockedCopy,
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
  // Date-only legacy values open at London midnight in summer and winter.
  assert.equal(
    formatCollectionAvailability("2026-07-02"),
    "Ready Thursday 2 July at 00:00"
  )
  assert.equal(
    formatCollectionAvailability("2026-01-15"),
    "Ready Thursday 15 January at 00:00"
  )
})

test("an under-18 customer is told the age policy, not to show ID", () => {
  assert.equal(
    rewardCollectionBlockedCopy("Customer must be 18 or over to redeem"),
    "This reward can only be collected by customers aged 18 or over."
  )
  assert.equal(
    rewardCollectionBlockedCopy("age_verification_required"),
    "Photo ID is needed to collect this reward."
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

test("the card links to the reward page for ready and setup-blocked rewards only", () => {
  assert.equal(cardRewardCollectable("ready", null), true)
  assert.equal(
    cardRewardCollectable("blocked", "Complete your profile before redeeming"),
    true
  )
  assert.equal(
    cardRewardCollectable(
      "blocked",
      "Verified email required for reward collection"
    ),
    true
  )
  assert.equal(cardRewardCollectable("blocked", "venue_paused"), false)
  assert.equal(cardRewardCollectable("blocked", null), false)
  assert.equal(cardRewardCollectable("waiting", null), false)
  assert.equal(cardRewardCollectable("expired", "expired"), false)
})
