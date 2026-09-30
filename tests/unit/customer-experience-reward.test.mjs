import assert from "node:assert/strict"
import { test } from "node:test"

import {
  collectionDoneChecklist,
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
    availableFrom: "2026-07-01T05:00:00Z",
    expiresAt: "2026-08-26T15:00:00Z",
    requiresAgeCheck: true,
    earningTerms: "One stamp per visit.",
    inWindow: false,
    windowEndsAt: null,
    upgradeRewardName: null,
    nextWindowStartsAt: null,
    nextWindowEndsAt: null,
    nextWindowUpgradeName: null,
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

test("a waiting reward renders its authoritative London instant through the real view model", () => {
  const experience = deriveCustomerExperience({
    entry: "reward",
    context: rewardContext({
      reward: rewardView({ availableFrom: "2026-10-27T05:30:00Z" }),
      availableForReview: false,
    }),
  })

  assert.equal(experience.kind, "reward_waiting")
  // Capitalised as formatted ("Tue 27 Oct"), never lower-cased mid-sentence.
  assert.deepEqual(getCustomerExperienceViewModel(experience), {
    eyebrow: "Your reward",
    headline: "Mystery round",
    supportLine: "Ready from Tue 27 Oct, 05:30.",
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
  assert.equal(
    headlineFor(MISSING_DETAILS).headline,
    "Add your name and date of birth"
  )
  assert.equal(headlineFor(UNVERIFIED_EMAIL).headline, "Confirm your email")
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

  // An already-confirmed email is a step this customer is never asked for, so
  // a one-step setup shows no progress readout at all (never "Step 1 of 1").
  const lockedEmail = collectionSetup(
    profileGate({ complete: false, fullName: null, dateOfBirth: null })
  )
  assert.deepEqual([lockedEmail.step, lockedEmail.total], [1, 1])
  assert.equal(collectionProgressVisible(lockedEmail), false)

  // Nothing outstanding is never dressed up as a step in progress.
  assert.equal(collectionProgressVisible(collectionSetup(profileGate())), false)
})

test("an unflagged reward does not request photo ID from an unverified adult", () => {
  assert.deepEqual(collectionSetup(ID_CHECK_PENDING, false), {
    stage: "ready",
    outstanding: false,
    step: 1,
    total: 1,
  })
})

test("missing profile details precede an unverified email", () => {
  for (const missing of [
    { fullName: null },
    { fullName: "   " },
    { dateOfBirth: null },
  ]) {
    const gate = { ...UNVERIFIED_EMAIL, ...missing }
    assert.deepEqual(collectionSetup(gate), {
      stage: "details",
      outstanding: true,
      step: 1,
      total: 2,
    })
    // Once these fields are saved the same unconfirmed email is the final step.
    assert.equal(collectionSetup(UNVERIFIED_EMAIL).stage, "email")
    const verifiedEmail = {
      ...gate,
      emailLocked: true,
      needsEmailVerification: false,
    }
    assert.deepEqual(collectionSetup(verifiedEmail), {
      stage: "details",
      outstanding: true,
      step: 1,
      total: 1,
    })
  }
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
    "Add your name and date of birth"
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

test("collection setup counts the mobile number from the first step and never shrinks", () => {
  // Joined by phone: details, then email. The phone is never a step.
  const phoneFirst = { ...MISSING_DETAILS, needsPhoneVerification: false }
  assert.deepEqual(collectionSetup(phoneFirst), {
    stage: "details",
    outstanding: true,
    step: 1,
    total: 2,
  })
  assert.deepEqual(
    collectionSetup({
      ...phoneFirst,
      fullName: "A Customer",
      dateOfBirth: "1990-01-01",
      email: "customer@example.com",
      needsEmailVerification: true,
    }),
    { stage: "email", outstanding: true, step: 2, total: 2 }
  )

  // Joined by email: details, then the mobile number (2 steps throughout).
  const emailFirst = {
    ...MISSING_DETAILS,
    email: "customer@example.com",
    emailLocked: true,
    needsPhoneVerification: true,
  }
  assert.deepEqual(collectionSetup(emailFirst), {
    stage: "details",
    outstanding: true,
    step: 1,
    total: 2,
  })
  const emailFirstPhone = collectionSetup({
    ...emailFirst,
    fullName: "A Customer",
    dateOfBirth: "1990-01-01",
  })
  assert.deepEqual(emailFirstPhone, {
    stage: "phone",
    outstanding: true,
    step: 2,
    total: 2,
  })
  assert.equal(collectionProgressVisible(emailFirstPhone), true)

  // Nothing confirmed yet: details, email, mobile number, counted 1-2-3 of 3
  // from the start.
  const nothing = { ...MISSING_DETAILS, needsPhoneVerification: true }
  const steps = [
    collectionSetup(nothing),
    collectionSetup({
      ...nothing,
      fullName: "A Customer",
      dateOfBirth: "1990-01-01",
    }),
    collectionSetup({
      ...nothing,
      fullName: "A Customer",
      dateOfBirth: "1990-01-01",
      email: "customer@example.com",
      needsEmailVerification: true,
    }),
  ]
  assert.deepEqual(
    steps.map((setup) => [setup.stage, setup.step, setup.total]),
    [
      ["details", 1, 3],
      // An address is still missing: the email step begins with it.
      ["email", 2, 3],
      ["email", 2, 3],
    ]
  )
})

test("a setup of one step shows no progress, so never Step 1 of 1", () => {
  const onlyPhone = collectionSetup(
    profileGate({ complete: false, needsPhoneVerification: true })
  )
  // Details were saved earlier and count as step one, already done.
  assert.deepEqual(
    [onlyPhone.stage, onlyPhone.step, onlyPhone.total],
    ["phone", 2, 2]
  )

  const onlyDetails = collectionSetup(
    profileGate({
      complete: false,
      fullName: null,
      needsPhoneVerification: false,
    })
  )
  assert.equal(onlyDetails.total, 1)
  assert.equal(collectionProgressVisible(onlyDetails), false)
})

test("completed requirements are listed as done, never asked again", () => {
  assert.deepEqual(
    collectionDoneChecklist(
      profileGate({ complete: false, needsPhoneVerification: true })
    ),
    ["Name and date of birth saved", "Email confirmed"]
  )
  assert.deepEqual(
    collectionDoneChecklist({
      ...MISSING_DETAILS,
      needsPhoneVerification: false,
    }),
    ["Mobile number confirmed"]
  )
  assert.deepEqual(collectionDoneChecklist(profileGate()), [])
})

test("reward view models speak in guest words", () => {
  const collected = getCustomerExperienceViewModel(
    deriveCustomerExperience({
      entry: "reward",
      context: rewardContext({
        status: "redeemed",
        availableForReview: true,
        redeemedAt: "2026-07-01T12:00:00.000Z",
      }),
    })
  )
  assert.equal(collected.headline, "Collected. Enjoy.")
  assert.equal(collected.primaryAction?.label, "Back to my card")

  const expired = getCustomerExperienceViewModel({
    kind: "unavailable",
    reason: "This reward has expired.",
    subject: "reward",
  })
  assert.equal(expired.headline, "This reward isn't available")
  assert.equal(expired.supportLine, "This reward has expired.")
  assert.notEqual(expired.headline, "Card unavailable")
  assert.equal(expired.primaryAction?.href, "/home")

  const signedOut = getCustomerExperienceViewModel({
    kind: "unavailable",
    reason: "Sign in with your number to open this card.",
    recovery: { loginHref: "/home/login?next=%2Freward%2Fr1" },
    subject: "reward",
  })
  assert.equal(signedOut.headline, "Sign in to see this reward")
  assert.equal(signedOut.primaryAction?.href, "/home/login?next=%2Freward%2Fr1")

  const phoneStep = getCustomerExperienceViewModel(
    deriveCustomerExperience({
      entry: "reward",
      context: rewardContext({
        availableForReview: true,
        profileGate: profileGate({
          complete: false,
          needsPhoneVerification: true,
        }),
      }),
    })
  )
  assert.equal(phoneStep.headline, "Confirm your mobile number")
  // The reward stays named while the phone step is pending.
  assert.equal(phoneStep.supportLine, "Mystery round at The Test Arms")

  for (const vm of [collected, expired, signedOut, phoneStep]) {
    assert.doesNotMatch(
      `${vm.eyebrow} ${vm.headline} ${vm.supportLine ?? ""}`,
      /wallet|verified|locked|trading day|—|!/i
    )
  }
})
