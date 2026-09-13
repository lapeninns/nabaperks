import assert from "node:assert/strict"
import { test } from "node:test"

import {
  collectionProgressVisible,
  collectionSetup,
} from "@/lib/customer/experience/collection-stage"
import { getCustomerExperienceViewModel } from "@/lib/customer/experience/copy"
import { deriveCustomerExperience } from "@/lib/customer/experience/derive"

function profileGate(overrides = {}) {
  return {
    complete: true,
    dateOfBirthVerified: true,
    needsEmailVerification: false,
    fullName: "A Customer",
    dateOfBirth: "1990-01-01",
    email: "customer@example.com",
    emailLocked: true,
    ...overrides,
  }
}

const MISSING_DETAILS = profileGate({
  complete: false,
  dateOfBirthVerified: false,
  fullName: null,
  dateOfBirth: null,
  email: null,
  emailLocked: false,
})

const UNVERIFIED_EMAIL = profileGate({
  complete: false,
  dateOfBirthVerified: false,
  needsEmailVerification: true,
  emailLocked: false,
})

const ID_CHECK_PENDING = profileGate({ dateOfBirthVerified: false })

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
    profileGate: undefined,
    preparing: false,
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

test("each collection stage leads with the one step that customer must take", () => {
  const stages = [
    [MISSING_DETAILS, "details"],
    [UNVERIFIED_EMAIL, "email"],
    [ID_CHECK_PENDING, "id_check"],
    [profileGate(), "ready"],
  ]

  for (const [gate, stage] of stages) {
    assert.equal(collectionSetup(gate).stage, stage)
  }

  const headlineFor = (gate) =>
    getCustomerExperienceViewModel(
      deriveCustomerExperience({
        entry: "reward",
        context: rewardContext({ availableForReview: true, profileGate: gate }),
      })
    )

  // A customer who cannot produce a code is never told to present one.
  assert.equal(headlineFor(MISSING_DETAILS).headline, "Complete your details")
  assert.equal(headlineFor(UNVERIFIED_EMAIL).headline, "Verify your email")
  for (const gate of [MISSING_DETAILS, UNVERIFIED_EMAIL]) {
    const vm = headlineFor(gate)
    assert.equal(vm.supportLine, "Mystery round at The Test Arms")
    assert.doesNotMatch(`${vm.headline} ${vm.supportLine}`, /counter|code/i)
  }

  // Once nothing is outstanding the reward itself is the headline; the photo-ID
  // requirement is a venue check, not another thing to complete on the phone.
  for (const gate of [ID_CHECK_PENDING, profileGate()]) {
    const vm = headlineFor(gate)
    assert.equal(vm.headline, "Mystery round")
    assert.equal(vm.supportLine, "The Test Arms")
    assert.equal(collectionSetup(gate).outstanding, false)
  }
})

test("collection progress counts only the steps this customer still has", () => {
  // Nothing saved and no verified email: details, then the emailed code.
  const fresh = collectionSetup(MISSING_DETAILS)
  assert.deepEqual([fresh.step, fresh.total], [1, 2])
  assert.equal(collectionProgressVisible(fresh), true)

  // Details saved, code outstanding — the completed step is recognised.
  const awaitingCode = collectionSetup(UNVERIFIED_EMAIL)
  assert.deepEqual([awaitingCode.step, awaitingCode.total], [2, 2])
  assert.equal(collectionProgressVisible(awaitingCode), true)

  // An already-verified email is a step this customer is never asked for, so a
  // one-step setup shows no progress readout at all.
  const lockedEmail = collectionSetup(
    profileGate({ complete: false, fullName: null, dateOfBirth: null })
  )
  assert.deepEqual([lockedEmail.step, lockedEmail.total], [1, 1])
  assert.equal(collectionProgressVisible(lockedEmail), false)

  // Nothing outstanding is never dressed up as a step in progress.
  assert.equal(collectionProgressVisible(collectionSetup(profileGate())), false)
})

test("a waiting reward offers early preparation without becoming collectable", () => {
  const context = rewardContext({
    availableForReview: false,
    profileGate: MISSING_DETAILS,
    prepare: true,
  })
  const experience = deriveCustomerExperience({ entry: "reward", context })

  assert.equal(experience.kind, "reward_waiting")
  assert.equal(experience.preparing, true)
  assert.deepEqual(experience.profileGate, MISSING_DETAILS)
  assert.equal(experience.reward.redeemableFrom, "2026-07-01")

  // Preparing is a profile step only: the reward stays waiting, so no code and
  // no collection eligibility comes with it.
  assert.equal(
    getCustomerExperienceViewModel(experience).headline,
    "Complete your details"
  )

  // Without the flag the same facts stay the ordinary waiting screen.
  assert.equal(
    deriveCustomerExperience({
      entry: "reward",
      context: { ...context, prepare: false },
    }).preparing,
    false
  )
})
