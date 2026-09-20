import assert from "node:assert/strict"
import { test } from "node:test"

import {
  cardRewardCollectable,
  collectionWindowCopy,
  formatCollectionAvailability,
  formatCollectionAvailableLabel,
  formatCollectionDeadline,
  isCollectionSetupBlock,
  parseRewardCollectionState,
  rewardCollectionBlockedCopy,
} from "@/lib/customer/reward-collection-state"

test("Given a complete predicate row When parsed Then server collection facts are preserved", () => {
  assert.deepEqual(
    parseRewardCollectionState({
      state: "ready",
      reason: null,
      available_from: "2026-10-27T05:00:00Z",
      expires_at: "2026-12-22T15:00:00Z",
      in_window: true,
      window_id: "window-1",
      window_ends_at: "2026-10-27T15:00:00Z",
      upgrade_pool_item_id: "item-2",
      upgrade_reward_name: "Free starter",
      upgrade_reward_terms: "Choose one starter.",
      next_window_starts_at: null,
      next_window_ends_at: null,
      next_window_upgrade_name: null,
      requires_age_check: false,
    }),
    {
      state: "ready",
      reason: null,
      availableFrom: "2026-10-27T05:00:00Z",
      expiresAt: "2026-12-22T15:00:00Z",
      inWindow: true,
      windowId: "window-1",
      windowEndsAt: "2026-10-27T15:00:00Z",
      upgradePoolItemId: "item-2",
      upgradeRewardName: "Free starter",
      upgradeRewardTerms: "Choose one starter.",
      nextWindowStartsAt: null,
      nextWindowEndsAt: null,
      nextWindowUpgradeName: null,
      requiresAgeCheck: false,
    }
  )
})

test("Given an authoritative collection instant When formatted Then the London date and time are shown", () => {
  assert.equal(
    formatCollectionAvailability("2026-10-27T05:30:00Z"),
    "Ready Tue 27 Oct at 05:30"
  )
  assert.equal(
    formatCollectionAvailableLabel("2026-10-27T05:30:00Z"),
    "Tue 27 Oct at 05:30"
  )
  assert.equal(formatCollectionAvailability(null), null)
  assert.equal(formatCollectionAvailableLabel(null), null)
  // Date-only legacy values open at London midnight in summer and winter.
  assert.equal(
    formatCollectionAvailability("2026-07-02"),
    "Ready Thu 2 Jul at 00:00"
  )
  assert.equal(
    formatCollectionAvailability("2026-01-15"),
    "Ready Thu 15 Jan at 00:00"
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
  for (const value of [
    null,
    {},
    { state: "surprise" },
    { state: "ready", in_window: "yes" },
  ]) {
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

test("a programme-level block is not described as a deliberate pause", () => {
  assert.equal(
    rewardCollectionBlockedCopy(
      "This loyalty programme is unavailable right now"
    ),
    "This loyalty programme is unavailable at the moment."
  )
  assert.equal(
    rewardCollectionBlockedCopy("venue_paused"),
    "This venue has paused reward collection."
  )
})

test("Given the predicate has no effective age flag When parsed Then the UI does not claim ID is needed", () => {
  const collection = parseRewardCollectionState({
    state: "ready",
    reason: null,
    in_window: false,
  })

  assert.equal(collection.requiresAgeCheck, false)
})

test("Given current and upcoming upgrade windows When formatted Then copy names the server window", () => {
  assert.equal(
    collectionWindowCopy({
      inWindow: true,
      windowEndsAt: "2026-10-27T15:00:00Z",
      upgradeRewardName: "Free starter",
      nextWindowStartsAt: null,
      nextWindowEndsAt: null,
      nextWindowUpgradeName: null,
    }),
    "Collect now and get Free starter — until 15:00"
  )
  assert.equal(
    collectionWindowCopy({
      inWindow: false,
      windowEndsAt: null,
      upgradeRewardName: null,
      nextWindowStartsAt: "2026-10-28T12:00:00Z",
      nextWindowEndsAt: "2026-10-28T15:00:00Z",
      nextWindowUpgradeName: "Free starter",
    }),
    "Collect on Wed 12:00–15:00 and get Free starter instead"
  )
})

test("Given an expiry instant When formatted Then the customer sees the London deadline", () => {
  assert.equal(
    formatCollectionDeadline("2026-10-27T15:00:00Z"),
    "Expires Tue 27 Oct at 15:00"
  )
  assert.equal(formatCollectionDeadline(null), null)
})

test("an age-checked reward awaiting in-person photo ID stays a setup step, not a dead end", () => {
  const reason =
    "Customer must have verified photo ID and be 18 or over to redeem"
  assert.equal(isCollectionSetupBlock(reason), true)
  assert.equal(cardRewardCollectable("blocked", reason), true)
  assert.equal(
    rewardCollectionBlockedCopy(reason),
    "Photo ID is needed to collect this reward."
  )
})
