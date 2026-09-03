import assert from "node:assert/strict"
import { test } from "node:test"

import { deriveCustomerExperience } from "@/lib/customer/experience/derive"

function locationRequirement(overrides = {}) {
  return {
    requireGeofence: false,
    geofenceRadiusMeters: 75,
    ...overrides,
  }
}

function rewardView(overrides = {}) {
  return {
    rewardId: "reward_1",
    membershipId: "membership_1",
    rewardName: "Mystery round",
    rewardTerms: "Ask at the bar.",
    redeemableFrom: "2026-07-01",
    redeemable: false,
    ...overrides,
  }
}

function stampContext(overrides = {}) {
  return {
    membershipId: "membership_1",
    merchantName: "The Test Arms",
    unlockedReward: null,
    alreadyStampedToday: false,
    qrValid: false,
    qrMissing: true,
    location: locationRequirement(),
    cardName: "Regulars Card",
    current: 2,
    total: 5,
    stampDates: ["30 Jun"],
    todayLabel: "30 Jun",
    ...overrides,
  }
}

test("missing QR proof tells the customer to open from the printed venue QR", () => {
  const experience = deriveCustomerExperience({
    entry: "stamp",
    context: stampContext(),
  })

  assert.deepEqual(experience, {
    kind: "unavailable",
    reason:
      "Open this screen from the printed venue QR so the stamp is tied to the right business.",
  })
})

test("invalid QR proof asks for another scan instead of showing the stamp form", () => {
  const experience = deriveCustomerExperience({
    entry: "stamp",
    context: stampContext({
      qrMissing: false,
      qrId: "bad-qr",
    }),
  })

  assert.deepEqual(experience, {
    kind: "unavailable",
    reason: "Scan the venue code again to add your stamp.",
  })
})

test("valid QR proof renders the stamp confirmation with live card progress", () => {
  const location = locationRequirement({ requireGeofence: true })
  const experience = deriveCustomerExperience({
    entry: "stamp",
    context: stampContext({
      qrValid: true,
      qrMissing: false,
      qrId: "qr_1",
      location,
    }),
  })

  assert.deepEqual(experience, {
    kind: "stamp_confirm",
    membershipId: "membership_1",
    merchantName: "The Test Arms",
    qrId: "qr_1",
    location,
    cardName: "Regulars Card",
    current: 2,
    total: 5,
    stampDates: ["30 Jun"],
    todayLabel: "30 Jun",
  })
})

test("already stamped memberships render today's stamped card instead of another stamp form", () => {
  const experience = deriveCustomerExperience({
    entry: "stamp",
    context: stampContext({
      alreadyStampedToday: true,
      qrMissing: false,
      qrId: "qr_1",
    }),
  })

  assert.equal(experience.kind, "card_stamped_today")
  assert.equal(experience.qrId, "qr_1")
  assert.equal(experience.current, 2)
})

test("a waiting unlocked reward holds the completed card with a reward pointer", () => {
  const experience = deriveCustomerExperience({
    entry: "stamp",
    context: stampContext({
      unlockedReward: rewardView({ redeemable: false }),
      alreadyStampedToday: true,
      qrMissing: false,
      qrId: "qr_1",
      current: 5,
      total: 5,
    }),
  })

  assert.equal(experience.kind, "card_stamped_today")
  assert.deepEqual(experience.reward, {
    rewardId: "reward_1",
    rewardName: "Mystery round",
    redeemableFrom: "2026-07-01",
  })
})

test("a ready reward wins over the stamp form and carries the profile gate", () => {
  const profileGate = {
    complete: false,
    dateOfBirthVerified: false,
    needsEmailVerification: false,
    fullName: null,
    dateOfBirth: null,
    email: null,
    emailLocked: false,
  }
  const location = locationRequirement({ requireGeofence: true })
  const experience = deriveCustomerExperience({
    entry: "stamp",
    context: stampContext({
      unlockedReward: rewardView({ redeemable: true }),
      qrValid: true,
      qrMissing: false,
      qrId: "qr_1",
      location,
      profileGate,
    }),
  })

  assert.equal(experience.kind, "reward_ready")
  assert.equal(experience.fromCard, false)
  assert.deepEqual(experience.location, location)
  assert.deepEqual(experience.profileGate, profileGate)
})

test("full cards without an unlocked reward block stamping with recovery copy", () => {
  const experience = deriveCustomerExperience({
    entry: "stamp",
    context: stampContext({
      fullWithoutReward: true,
      current: 5,
      total: 5,
    }),
  })

  assert.deepEqual(experience, {
    kind: "unavailable",
    reason:
      "We're sorting your reward. Check back shortly, or ask a team member.",
  })
})
