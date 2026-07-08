import assert from "node:assert/strict"
import { test } from "node:test"

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
    firstStampPending: false,
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

test("card ownership failures render a non-leaking unavailable state", () => {
  const experience = deriveCustomerExperience({
    entry: "card",
    context: { access: "unauthorized" },
  })

  assert.deepEqual(experience, {
    kind: "unavailable",
    reason: "This belongs to another customer.",
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
        id: "reward_1",
        name: "Mystery round",
        terms: "Ask at the bar.",
        redeemableFrom: "2026-07-01",
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
        redeemableFrom: "2020-01-01",
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
        id: "reward_1",
        name: "Mystery round",
        terms: "Ask at the bar.",
        redeemableFrom: "2020-01-01",
        redeemable: true,
      },
      giftReward: {
        id: "gift_2",
        name: "Manager's thank-you",
        source: "merchant_direct",
        redeemableFrom: "2020-01-01",
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
