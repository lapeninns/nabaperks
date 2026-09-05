import assert from "node:assert/strict"
import { test } from "node:test"

import { deriveCustomerExperience } from "@/lib/customer/experience/derive"

function rewardView(overrides = {}) {
  return {
    rewardId: "reward_1",
    membershipId: "membership_1",
    rewardName: "Mystery round",
    rewardTerms: "Ask at the bar.",
    redeemableFrom: "2026-07-01",
    ...overrides,
  }
}

function locationRequirement(overrides = {}) {
  return {
    requireGeofence: false,
    geofenceRadiusMeters: 75,
    ...overrides,
  }
}

function rewardContext(overrides = {}) {
  return {
    reward: rewardView(),
    merchantName: "The Test Arms",
    status: "unlocked",
    availableForReview: false,
    location: locationRequirement(),
    justRedeemed: false,
    ...overrides,
  }
}

test("reward ownership and absence are externally indistinguishable", () => {
  const experience = deriveCustomerExperience({
    entry: "reward",
    context: { access: "unauthorized" },
  })

  assert.deepEqual(experience, {
    kind: "unavailable",
    reason: "This could not be found.",
    recovery: undefined,
  })
})

test("unlocked rewards that are not yet redeemable render the waiting state", () => {
  const experience = deriveCustomerExperience({
    entry: "reward",
    context: rewardContext({
      availableForReview: false,
    }),
  })

  assert.deepEqual(experience, {
    kind: "reward_waiting",
    reward: rewardView(),
    merchantName: "The Test Arms",
    fromCard: true,
  })
})

test("redeemable rewards carry the profile gate into the ready state", () => {
  const profileGate = {
    complete: false,
    dateOfBirthVerified: false,
    needsEmailVerification: true,
    fullName: "A Customer",
    dateOfBirth: null,
    email: "customer@example.com",
    emailLocked: false,
  }
  const location = locationRequirement({ requireGeofence: true })
  const experience = deriveCustomerExperience({
    entry: "reward",
    context: rewardContext({
      availableForReview: true,
      location,
      profileGate,
    }),
  })

  assert.deepEqual(experience, {
    kind: "reward_ready",
    reward: rewardView(),
    merchantName: "The Test Arms",
    location,
    fromCard: true,
    profileGate,
  })
})

test("ready rewards default to a complete profile gate when no profile lookup is needed", () => {
  const experience = deriveCustomerExperience({
    entry: "reward",
    context: rewardContext({
      availableForReview: true,
    }),
  })

  assert.equal(experience.kind, "reward_ready")
  assert.deepEqual(experience.profileGate, {
    complete: true,
    dateOfBirthVerified: true,
    needsEmailVerification: false,
    fullName: null,
    dateOfBirth: null,
    email: null,
    emailLocked: false,
  })
})

test("redeemed rewards render proof before any ready or waiting state", () => {
  const experience = deriveCustomerExperience({
    entry: "reward",
    context: rewardContext({
      status: "redeemed",
      availableForReview: true,
      redeemedAt: "2026-07-01T12:00:00.000Z",
    }),
  })

  assert.equal(experience.kind, "redeemed_proof")
  assert.deepEqual(experience.reward, {
    ...rewardView(),
    redeemedAt: "2026-07-01T12:00:00.000Z",
  })
  assert.equal(experience.merchantName, "The Test Arms")
  assert.equal(experience.justRedeemed, false)
})

test("blocked or expired reward facts render unavailable copy instead of collection UI", () => {
  const experience = deriveCustomerExperience({
    entry: "reward",
    context: rewardContext({
      status: "expired",
      availableForReview: false,
      unavailableReason: "This reward has expired.",
    }),
  })

  assert.deepEqual(experience, {
    kind: "unavailable",
    reason: "This reward has expired.",
  })
})
