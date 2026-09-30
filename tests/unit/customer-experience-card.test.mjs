import assert from "node:assert/strict"
import { test } from "node:test"

import { emailPromptOpening } from "@/lib/customer/email-prompt-opening"
import { getCustomerExperienceViewModel } from "@/lib/customer/experience/copy"
import { deriveCustomerExperience } from "@/lib/customer/experience/derive"

function cardContext(overrides = {}) {
  return {
    membershipId: "membership_1",
    merchantName: "The Test Arms",
    cardName: "Regulars Card",
    current: 2,
    total: 5,
    reward: null,
    rewardTerms: "Mystery pint on us.",
    stampDates: ["30 Jun"],
    justStamped: false,
    justJoined: false,
    firstStampRecovery: null,
    geoFlagged: false,
    justRedeemed: false,
    ...overrides,
  }
}

function rewardContext(overrides = {}) {
  return {
    reward: {
      rewardId: "reward_1",
      membershipId: "membership_1",
      rewardName: "Mystery round",
      rewardTerms: "Ask at the bar.",
      redeemableFrom: null,
    },
    merchantName: "The Test Arms",
    status: "redeemed",
    redeemable: false,
    redeemedAt: "2026-07-03T12:30:00.000Z",
    justRedeemed: false,
    location: {
      requireGeofence: false,
      geofenceRadiusMeters: 0,
    },
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
    availableFrom: "2026-07-01T00:00:00.000Z",
    expiresAt: null,
    requiresAgeCheck: false,
    earningTerms: null,
    inWindow: false,
    windowEndsAt: null,
    upgradeRewardName: null,
    nextWindowStartsAt: null,
    nextWindowEndsAt: null,
    nextWindowUpgradeName: null,
    ...overrides,
  }
}

test("card ownership and absence are externally indistinguishable", () => {
  const experience = deriveCustomerExperience({
    entry: "card",
    context: { access: "unauthorized" },
  })

  assert.deepEqual(experience, {
    kind: "unavailable",
    reason: "This could not be found.",
    recovery: undefined,
  })
})

test("card availability failures render the centralized block reason", () => {
  const experience = deriveCustomerExperience({
    entry: "card",
    context: cardContext({
      unavailableReason: "This loyalty programme is paused.",
    }),
  })

  assert.deepEqual(experience, {
    kind: "unavailable",
    reason: "This loyalty programme is paused.",
  })
})

test("expired or absent active rewards do not make the card look reward-ready", () => {
  const experience = deriveCustomerExperience({
    entry: "card",
    context: cardContext({
      current: 3,
      total: 5,
      reward: null,
      rewardTerms: "Chef's choice.",
    }),
  })

  assert.equal(experience.kind, "card_collecting")
  assert.equal(experience.reward, "none")
  assert.equal(experience.rewardId, undefined)
  assert.equal(experience.rewardTerms, "Chef's choice.")
})

test("redeemable active rewards drive the card-ready footer without changing the card state", () => {
  const experience = deriveCustomerExperience({
    entry: "card",
    context: cardContext({
      current: 5,
      total: 5,
      reward: {
        view: rewardView(),
        redeemable: true,
      },
    }),
  })

  assert.equal(experience.kind, "card_collecting")
  assert.equal(experience.reward, "ready")
  assert.equal(experience.rewardId, "reward_1")
  assert.equal(experience.rewardName, "Mystery round")
  assert.equal(experience.rewardTerms, "Ask at the bar.")
  assert.equal(experience.rewardRedeemableFrom, "2026-07-01")
})

test("an incomplete card with only an issued reward never reads as reward-ready", () => {
  const experience = deriveCustomerExperience({
    entry: "card",
    context: cardContext({
      current: 2,
      total: 5,
      reward: null, // no stamp-cycle completion reward
      giftReward: {
        id: "gift_1",
        name: "Birthday fizz",
        source: "birthday_month",
        availableFrom: "2020-01-01T00:00:00.000Z",
        redeemable: true,
      },
    }),
  })

  assert.equal(experience.kind, "card_collecting")
  // The stamp card itself is not reward-ready — the issued reward rides its own rail.
  assert.equal(experience.reward, "none")
  assert.equal(experience.rewardId, undefined)
  // ...and surfaces as a distinct, still-collectible gift.
  assert.equal(experience.gift?.rewardId, "gift_1")
  assert.equal(experience.gift?.rewardName, "Birthday fizz")
  assert.equal(experience.gift?.source, "birthday_month")
  assert.equal(experience.gift?.redeemable, true)
})

test("a completed stamp card and an issued gift surface side by side", () => {
  const experience = deriveCustomerExperience({
    entry: "card",
    context: cardContext({
      current: 5,
      total: 5,
      reward: {
        view: rewardView({
          redeemableFrom: "2020-01-01",
          availableFrom: "2020-01-01T00:00:00.000Z",
        }),
        redeemable: true,
      },
      giftReward: {
        id: "gift_2",
        name: "Manager's thank-you",
        source: "merchant_direct",
        availableFrom: "2020-01-01T00:00:00.000Z",
        redeemable: true,
      },
    }),
  })

  assert.equal(experience.reward, "ready")
  assert.equal(experience.rewardId, "reward_1")
  assert.equal(experience.gift?.rewardId, "gift_2")
  assert.equal(experience.gift?.source, "merchant_direct")
})

test("a card with no issued reward carries no gift", () => {
  const experience = deriveCustomerExperience({
    entry: "card",
    context: cardContext({ reward: null }),
  })

  assert.equal(experience.kind, "card_collecting")
  assert.equal(experience.gift, null)
})

test("a collecting card carries the referral bonus bank into the card UI model", () => {
  const referralBonusBank = { banked: 3, awardedToday: 2 }
  const experience = deriveCustomerExperience({
    entry: "card",
    context: cardContext({ referralBonusBank }),
  })

  assert.equal(experience.kind, "card_collecting")
  assert.deepEqual(experience.referralBonusBank, referralBonusBank)
})

test("Given durable first-stamp recovery When a card is derived Then the typed recovery survives unchanged", () => {
  const firstStampRecovery = {
    resolution: "retry",
    retryUntil: "2026-07-10T22:00:00.000Z",
  }
  const experience = deriveCustomerExperience({
    entry: "card",
    context: cardContext({ firstStampRecovery }),
  })

  assert.equal(experience.kind, "card_collecting")
  assert.deepEqual(experience.firstStampRecovery, firstStampRecovery)
})

test("full cards without an unlocked reward show recovery instead of inviting another stamp", () => {
  const experience = deriveCustomerExperience({
    entry: "card",
    context: cardContext({
      current: 5,
      total: 5,
      fullWithoutReward: true,
    }),
  })

  assert.deepEqual(experience, {
    kind: "unavailable",
    reason:
      "We're sorting your reward. Check back shortly, or ask a team member.",
  })
})

test("redeemed reward proof carries collection time and one-shot celebration flag", () => {
  const experience = deriveCustomerExperience({
    entry: "reward",
    context: rewardContext({ justRedeemed: true }),
  })

  assert.equal(experience.kind, "redeemed_proof")
  assert.equal(experience.reward.redeemedAt, "2026-07-03T12:30:00.000Z")
  assert.equal(experience.justRedeemed, true)
})

test("a foreign card and a missing card are byte-identical to the customer", () => {
  // The whole point: if these two differ in ANY observable way, the page is an
  // existence oracle for another customer's membership UUID.
  const foreign = deriveCustomerExperience({
    entry: "card",
    context: { access: "unauthorized" },
  })
  const missing = deriveCustomerExperience({
    entry: "card",
    context: { access: "not_found" },
  })

  assert.deepEqual(foreign, missing)

  // Sign-in recovery must stay distinguishable — it does not depend on the
  // object, and the login CTA rides on it.
  const anonymous = deriveCustomerExperience({
    entry: "card",
    context: { access: "unauthenticated" },
  })
  assert.notDeepEqual(anonymous, missing)
})

test("Given a stamp just landed When a card is derived Then it carries when the next stamp opens and no contact prompt", () => {
  const nextStampFrom = "2026-10-01T05:00:00.000Z"

  const stamped = deriveCustomerExperience({
    entry: "card",
    context: cardContext({ justStamped: true, nextStampFrom }),
  })
  assert.equal(stamped.nextStampFrom, nextStampFrom)
  // The stamp result stands alone: nothing asks for an email or phone here.
  assert.equal("emailPrompt" in stamped, false)

  const revisited = deriveCustomerExperience({
    entry: "card",
    context: cardContext({ justStamped: false, nextStampFrom }),
  })
  assert.equal(revisited.nextStampFrom, null)
})

test("Given a card When its view model is built Then it says where the guest is on it, and welcomes a new guest without asking for anything", () => {
  const collecting = getCustomerExperienceViewModel(
    deriveCustomerExperience({ entry: "card", context: cardContext() })
  )
  assert.equal(collecting.headline, "Regulars Card")
  assert.equal(collecting.supportLine, "3 more to your reward.")
  assert.equal(collecting.primaryAction, undefined)

  const joined = getCustomerExperienceViewModel(
    deriveCustomerExperience({
      entry: "card",
      context: cardContext({ justJoined: true, justStamped: true, current: 1 }),
    })
  )
  assert.equal(joined.headline, "Welcome to The Test Arms")
  assert.equal(joined.supportLine, "4 more to your reward.")
  assert.doesNotMatch(
    `${joined.headline} ${joined.supportLine}`,
    /email|phone|birthday|profile|set ?up/i
  )

  const unlocked = getCustomerExperienceViewModel(
    deriveCustomerExperience({
      entry: "card",
      context: cardContext({
        current: 5,
        reward: {
          view: {
            rewardId: "reward_1",
            membershipId: "membership_1",
            rewardName: "Mystery round",
            rewardTerms: "Ask at the bar.",
            redeemableFrom: null,
            availableFrom: null,
          },
          redeemable: true,
        },
      }),
    })
  )
  assert.equal(unlocked.supportLine, "Your reward is unlocked.")
})

test("Given a pending email code When the email prompt's opening is chosen Then it opens at the code step only for this customer's saved address", () => {
  const customer = { id: "customer_1", email: " Alex@Example.test " }
  const pending = { customerId: "customer_1", email: "alex@example.test" }

  assert.deepEqual(emailPromptOpening(customer, pending), {
    initialEmail: "Alex@Example.test",
    codePending: true,
  })
  // No code on its way: prefill the saved address at the email step.
  assert.deepEqual(emailPromptOpening(customer, null), {
    initialEmail: "Alex@Example.test",
    codePending: false,
  })
  // A code issued to another customer, or to an address no longer saved.
  assert.equal(
    emailPromptOpening(customer, { ...pending, customerId: "customer_2" })
      .codePending,
    false
  )
  assert.equal(
    emailPromptOpening(customer, { ...pending, email: "old@example.test" })
      .codePending,
    false
  )
  // Nothing saved: nothing to prefill and no code step.
  assert.deepEqual(
    emailPromptOpening({ id: "customer_1", email: " " }, pending),
    {
      initialEmail: null,
      codePending: false,
    }
  )
})

test("a reward held only by setup is flagged so the card never reads it as a code to show", () => {
  const setup = deriveCustomerExperience({
    entry: "card",
    context: cardContext({
      current: 5,
      total: 5,
      reward: {
        view: rewardView({ redeemableFrom: null }),
        redeemable: true,
        needsSetup: true,
      },
      giftReward: {
        id: "gift_3",
        name: "Birthday fizz",
        source: "birthday_month",
        availableFrom: null,
        redeemable: true,
        needsSetup: true,
      },
    }),
  })

  assert.equal(setup.kind, "card_collecting")
  // Still points at the reward page, which walks the guest through setup.
  assert.equal(setup.reward, "ready")
  assert.equal(setup.rewardNeedsSetup, true)
  assert.equal(setup.gift?.needsSetup, true)

  const ready = deriveCustomerExperience({
    entry: "card",
    context: cardContext({
      current: 5,
      total: 5,
      reward: { view: rewardView({ redeemableFrom: null }), redeemable: true },
    }),
  })
  assert.equal(ready.rewardNeedsSetup, false)

  // A waiting reward never claims setup, whatever the loader passed.
  const waiting = deriveCustomerExperience({
    entry: "card",
    context: cardContext({
      current: 5,
      total: 5,
      reward: { view: rewardView(), redeemable: false, needsSetup: true },
      giftReward: {
        id: "gift_4",
        name: "Birthday fizz",
        source: "birthday_month",
        availableFrom: "2099-01-01T00:00:00.000Z",
        redeemable: false,
        needsSetup: true,
      },
    }),
  })
  assert.equal(waiting.reward, "waiting")
  assert.equal(waiting.rewardNeedsSetup, false)
  assert.equal(waiting.gift?.needsSetup, false)
})
