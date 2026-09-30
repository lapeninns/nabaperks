import assert from "node:assert/strict"
import { test } from "node:test"

import { getCustomerExperienceViewModel } from "@/lib/customer/experience/copy"
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

test("missing QR proof keeps the member's card on screen and names the fix", () => {
  const experience = deriveCustomerExperience({
    entry: "stamp",
    context: stampContext(),
  })

  assert.deepEqual(experience, {
    kind: "stamp_unmatched",
    problem: "missing",
    membershipId: "membership_1",
    merchantName: "The Test Arms",
    cardName: "Regulars Card",
    current: 2,
    total: 5,
    stampDates: ["30 Jun"],
  })
})

test("invalid QR proof withholds the stamp form but never the card", () => {
  const experience = deriveCustomerExperience({
    entry: "stamp",
    context: stampContext({
      qrMissing: false,
      qrId: "bad-qr",
    }),
  })

  assert.deepEqual(experience, {
    kind: "stamp_unmatched",
    problem: "unmatched",
    membershipId: "membership_1",
    merchantName: "The Test Arms",
    cardName: "Regulars Card",
    current: 2,
    total: 5,
    stampDates: ["30 Jun"],
  })
})

test("a QR failure without loaded progress still renders an empty, safe card", () => {
  const experience = deriveCustomerExperience({
    entry: "stamp",
    context: stampContext({
      cardName: undefined,
      current: undefined,
      total: undefined,
      stampDates: undefined,
      todayLabel: undefined,
    }),
  })

  assert.equal(experience.kind, "stamp_unmatched")
  assert.equal(experience.cardName, "")
  assert.equal(experience.current, 0)
  assert.equal(experience.total, 0)
  assert.deepEqual(experience.stampDates, [])
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
    nextStampFrom: null,
  })
})

test("the next stamp time rides from the loader onto both stamp-screen states", () => {
  const nextStampFrom = "2026-10-01T05:00:00.000Z"
  for (const context of [
    stampContext({ qrValid: true, qrMissing: false, qrId: "qr_1" }),
    stampContext({ alreadyStampedToday: true, qrMissing: false, qrId: "qr_1" }),
  ]) {
    const experience = deriveCustomerExperience({
      entry: "stamp",
      context: { ...context, nextStampFrom },
    })
    assert.equal(experience.nextStampFrom, nextStampFrom, experience.kind)
  }
})

test("S1: the ready screen is today's stamp at this venue", () => {
  const vm = getCustomerExperienceViewModel(
    deriveCustomerExperience({
      entry: "stamp",
      context: stampContext({ qrValid: true, qrMissing: false, qrId: "qr_1" }),
    })
  )
  assert.equal(vm.headline, "Today's stamp")
  assert.equal(vm.supportLine, "The Test Arms")
  assert.equal(vm.primaryAction, undefined, "the stamp press is the primary")
})

test("S5: already stamped names the next stamp as a date and time, or the next visit", () => {
  const stamped = (nextStampFrom) =>
    getCustomerExperienceViewModel(
      deriveCustomerExperience({
        entry: "stamp",
        context: stampContext({
          alreadyStampedToday: true,
          qrMissing: false,
          qrId: "qr_1",
          nextStampFrom,
        }),
      })
    )

  const known = stamped("2026-10-01T05:00:00.000Z")
  assert.equal(known.headline, "You've already got today's stamp")
  assert.equal(known.supportLine, "Next stamp from Thu 1 Oct, 06:00.")
  assert.deepEqual(known.primaryAction, {
    label: "View my card",
    href: "/card/membership_1",
  })

  const unknown = stamped(null)
  assert.equal(unknown.supportLine, "Come back on your next visit.")

  for (const vm of [known, unknown]) {
    assert.doesNotMatch(
      `${vm.headline} ${vm.supportLine}`,
      /tomorrow|trading day|daily reset|!|\u2014/i
    )
  }
})

test("S3 after a reload: a held full card leads with the unlocked reward", () => {
  const vm = getCustomerExperienceViewModel(
    deriveCustomerExperience({
      entry: "stamp",
      context: stampContext({
        unlockedReward: rewardView(),
        qrMissing: false,
        qrId: "qr_1",
      }),
    })
  )
  assert.equal(vm.headline, "Your card is full.")
  assert.equal(vm.supportLine, "Your reward is unlocked.")
  assert.deepEqual(vm.primaryAction, {
    label: "See my reward",
    href: "/reward/reward_1",
  })
})

test("S6: a missing or foreign QR says what to scan and that stamps are safe", () => {
  const missing = getCustomerExperienceViewModel(
    deriveCustomerExperience({ entry: "stamp", context: stampContext() })
  )
  assert.equal(missing.headline, "Scan the QR at The Test Arms")
  assert.equal(missing.supportLine, "Your stamps are safe.")

  const unmatched = getCustomerExperienceViewModel(
    deriveCustomerExperience({
      entry: "stamp",
      context: stampContext({ qrMissing: false, qrId: "bad-qr" }),
    })
  )
  assert.equal(unmatched.headline, "This QR doesn't match your card")
  assert.equal(unmatched.supportLine, "Your stamps are safe.")
  for (const vm of [missing, unmatched]) {
    assert.doesNotMatch(`${vm.headline} ${vm.supportLine}`, /\u2014/)
  }
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
