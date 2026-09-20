import assert from "node:assert/strict"
import { test } from "node:test"

import { parseRewardCollectionState } from "@/lib/customer/reward-collection-state"
import { rewardQrAvailability } from "@/lib/customer/reward-qr-eligibility"
import { loadMerchantRewardCollectionStates } from "@/lib/merchant/customer-collection-states"
import { deriveMerchantCustomerRewardBadge } from "@/lib/merchant/customer-readback"
import { rewardUnlockedNotificationEvent } from "@/lib/notifications/reward-event-plan-core"

test("Inherited readers preserve activated 0/2 readiness across the trading availability boundary", async () => {
  for (const state of ["waiting", "ready"]) {
    const row = {
      reward_id: "reward-cycle-1",
      state,
      reason: state === "waiting" ? "Reward is not redeemable yet" : null,
      available_from: "2026-10-27T05:00:00Z",
      expires_at: null,
      in_window: false,
    }
    const membership = { currentStampCount: 0, activeCycleNumber: 2 }
    const collection = parseRewardCollectionState(row)
    const [merchantReward] = await loadMerchantRewardCollectionStates(
      [{ id: row.reward_id, membership_id: "membership" }],
      async () => ({ data: [row], error: null })
    )
    const badge = deriveMerchantCustomerRewardBadge(
      {
        ...membership,
        createdAt: "2026-10-01T00:00:00Z",
        lastVisitAt: null,
        lastRedeemedAt: null,
        activeReward: {
          id: merchantReward.id,
          collectionState: merchantReward.collection_state,
        },
      },
      new Date("2026-10-27T12:00:00Z")
    )
    assert.equal(badge.redeemable, state === "ready")
    assert.equal(
      badge.label,
      state === "ready" ? "Reward ready" : "Reward waiting"
    )
    assert.equal(
      rewardUnlockedNotificationEvent(collection),
      state === "ready" ? "reward_ready" : "reward_unlocked_waiting"
    )
    assert.equal(
      rewardQrAvailability({
        collectionState: collection.state,
        collectionReason: collection.reason,
        availableFrom: collection.availableFrom,
      }).status,
      state
    )
  }
})
