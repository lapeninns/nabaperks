import assert from "node:assert/strict"
import { test } from "node:test"

import { legacyRewardBlocksStamps } from "@/lib/customer/legacy-reward-stamp-block"
import { rewardQrAvailability } from "@/lib/customer/reward-qr-eligibility"

test("an open reward blocks a legacy full card but permits every fresh-cycle collection state", () => {
  for (const [collectionState, currentStampCount, blocked] of [
    ["ready", 3, true],
    ["ready", 0, false],
    ["waiting", 0, false],
  ]) {
    const reward = { status: "unlocked", collection_state: collectionState }
    assert.equal(
      legacyRewardBlocksStamps({
        reward,
        currentStampCount,
        stampsRequired: 3,
      }),
      blocked,
      `${collectionState} at ${currentStampCount}/3`
    )
    assert.equal(
      rewardQrAvailability({
        collectionState: reward.collection_state,
        collectionReason: null,
        availableFrom: null,
      }).status,
      collectionState === "ready" ? "ready" : "waiting"
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
