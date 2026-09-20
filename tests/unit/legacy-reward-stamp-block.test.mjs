import assert from "node:assert/strict"
import { test } from "node:test"

import { legacyRewardBlocksStamps } from "@/lib/customer/legacy-reward-stamp-block"
import { rewardQrAvailability } from "@/lib/customer/reward-qr-eligibility"

test("the same ready reward blocks legacy full-card stamps but permits a fresh cycle", () => {
  for (const [currentStampCount, activeCycleNumber, blocked] of [
    [3, 1, true],
    [0, 2, false],
  ]) {
    const reward = { status: "unlocked", collection_state: "ready" }
    assert.equal(
      legacyRewardBlocksStamps({
        reward,
        currentStampCount,
        stampsRequired: 3,
      }),
      blocked,
      `cycle ${activeCycleNumber}`
    )
    assert.equal(
      rewardQrAvailability({
        collectionState: reward.collection_state,
        collectionReason: null,
        availableFrom: null,
      }).status,
      "ready"
    )
  }
})

test("a missing or terminal reward never creates a legacy stamp block", () => {
  for (const reward of [
    null,
    { status: "redeemed" },
    { status: "cancelled" },
  ]) {
    assert.equal(
      legacyRewardBlocksStamps({
        reward,
        currentStampCount: 3,
        stampsRequired: 3,
      }),
      false
    )
  }
})
