import assert from "node:assert/strict"
import { test } from "node:test"

import { buildHomeSummary } from "@/lib/customer/home-dashboard"

function card(overrides = {}) {
  return {
    membershipId: "membership_1",
    businessName: "The Test Arms",
    businessSlug: "the-test-arms",
    cardName: "Regulars",
    rewardName: "Mystery reward",
    currentStamps: 3,
    stampsRequired: 3,
    stampDates: [],
    stampedToday: true,
    lastVisitAt: null,
    stampsRemaining: 0,
    unlockedRewards: 1,
    available: true,
    ...overrides,
  }
}

test("home summary counts ready rewards rather than cards containing rewards", () => {
  const summary = buildHomeSummary([
    card({
      stampRewardId: "stamp_reward",
      gift: {
        rewardId: "gift_reward",
        rewardName: "Birthday treat",
        source: "birthday_month",
        redeemable: true,
        redeemableFrom: "2020-01-01",
      },
      redeemableRewards: 2,
    }),
  ])

  assert.equal(summary.cardCount, 1)
  assert.equal(summary.redeemableCount, 2)
})
