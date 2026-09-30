import assert from "node:assert/strict"
import { test } from "node:test"

import {
  cardRewardCollectable,
  rewardCollectability,
  collectionWindowCopy,
  formatCollectionAvailability,
  formatCollectionAvailableLabel,
  formatCollectionDeadline,
  isCollectionSetupBlock,
  parseRewardCollectionState,
  photoIdSetupApplies,
  resolveAgeCheckReason,
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
    "Ready from Tue 27 Oct, 05:30"
  )
  assert.equal(
    formatCollectionAvailableLabel("2026-10-27T05:30:00Z"),
    "Tue 27 Oct, 05:30"
  )
  assert.equal(formatCollectionAvailability(null), null)
  assert.equal(formatCollectionAvailableLabel(null), null)
  // Date-only legacy values open at London midnight in summer and winter.
  assert.equal(
    formatCollectionAvailability("2026-07-02"),
    "Ready from Thu 2 Jul, 00:00"
  )
  assert.equal(
    formatCollectionAvailability("2026-01-15"),
    "Ready from Thu 15 Jan, 00:00"
  )
})

test("an under-18 customer is told the age policy, not to show ID", () => {
  assert.equal(
    rewardCollectionBlockedCopy("Customer must be 18 or over to redeem"),
    "This reward can only be collected by customers aged 18 or over."
  )
  assert.equal(
    rewardCollectionBlockedCopy("age_verification_required"),
    "Staff will check photo ID when you collect this reward."
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
    "Collect before 15:00 and get Free starter"
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
  // Only a stated adult date of birth makes it a counter step; an under-age
  // customer is a policy block.
  assert.equal(photoIdSetupApplies(reason, true), true)
  assert.equal(photoIdSetupApplies(reason, false), false)
  assert.equal(photoIdSetupApplies("venue_paused", true), false)
  assert.equal(
    rewardCollectionBlockedCopy(reason),
    "Staff will check photo ID when you collect this reward."
  )
})

test("Given predicate facts When classified Then setup-only blocks never read as ready to collect", () => {
  assert.equal(rewardCollectability("ready", null), "ready")
  assert.equal(
    rewardCollectability("blocked", "Complete your profile before redeeming"),
    "needs_setup"
  )
  assert.equal(
    rewardCollectability("blocked", "profile_incomplete"),
    "needs_setup"
  )
  assert.equal(
    rewardCollectability(
      "blocked",
      "Verified email required for reward collection"
    ),
    "needs_setup"
  )
  // Photo ID is checked at the counter once every other requirement is met, so
  // the code is shown and the reward is ready.
  assert.equal(
    rewardCollectability(
      "blocked",
      "Customer must have verified photo ID and be 18 or over to redeem"
    ),
    "ready"
  )
  assert.equal(rewardCollectability("waiting", null), "waiting")
  assert.equal(rewardCollectability("blocked", "venue_paused"), "unavailable")
  assert.equal(
    rewardCollectability("blocked", "one_reward_per_day"),
    "unavailable"
  )
  assert.equal(rewardCollectability("expired", "expired"), "unavailable")
  assert.equal(rewardCollectability("redeemed", null), "unavailable")
})

test("reward timing and block copy never lower-case dates or name a trading day", () => {
  const ready = formatCollectionAvailability("2026-10-01T11:00:00Z")
  assert.equal(ready, "Ready from Thu 1 Oct, 12:00")
  for (const reason of [
    "one_reward_per_day",
    "One reward per visit day already collected",
    "Complete your profile before redeeming",
    "venue_paused",
  ]) {
    const copy = rewardCollectionBlockedCopy(reason)
    assert.doesNotMatch(copy, /trading day|daily reset|—|!/)
  }
  assert.equal(
    rewardCollectionBlockedCopy("one_reward_per_day"),
    "You've already collected a reward here today. You can collect this one on a later visit."
  )
})

test("the photo-ID reason is resolved by the stated date of birth before classification", () => {
  const photoId =
    "Customer must have verified photo ID and be 18 or over to redeem"

  const adult = resolveAgeCheckReason(photoId, true)
  assert.equal(adult, photoId)
  assert.equal(rewardCollectability("blocked", adult), "ready")
  assert.equal(cardRewardCollectable("blocked", adult), true)

  const minor = resolveAgeCheckReason(photoId, false)
  assert.equal(minor, "Customer must be 18 or over to redeem")
  assert.equal(rewardCollectability("blocked", minor), "unavailable")
  assert.equal(cardRewardCollectable("blocked", minor), false)
  assert.equal(
    rewardCollectionBlockedCopy(minor),
    "This reward can only be collected by customers aged 18 or over."
  )

  // Other reasons pass through untouched.
  assert.equal(resolveAgeCheckReason("venue_paused", false), "venue_paused")
  assert.equal(resolveAgeCheckReason(null, false), null)
})
