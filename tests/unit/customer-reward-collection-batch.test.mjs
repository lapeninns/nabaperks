import assert from "node:assert/strict"
import { test } from "node:test"

import {
  legacyRewardCollectionBatch,
  loadCustomerRewardCollectionStates,
} from "@/lib/customer/reward-collection-batch"

function rewardIds(count) {
  return Array.from(
    { length: count },
    (_, index) =>
      `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`
  )
}

function row(rewardId) {
  return {
    reward_id: rewardId,
    state: "ready",
    reason: null,
    available_from: "2026-09-19T05:00:00Z",
    expires_at: null,
    in_window: false,
    window_id: null,
    window_ends_at: null,
    upgrade_pool_item_id: null,
    upgrade_reward_name: null,
    upgrade_reward_terms: null,
    next_window_starts_at: null,
    next_window_ends_at: null,
    next_window_upgrade_name: null,
    requires_age_check: false,
  }
}

test("257 customer rewards use two sequential predicate batches", async () => {
  const ids = rewardIds(257)
  const observed = []
  let active = 0
  let maxActive = 0

  const states = await loadCustomerRewardCollectionStates(
    ids,
    async ({ p_reward_ids: chunk }) => {
      active += 1
      maxActive = Math.max(maxActive, active)
      observed.push(chunk.length)
      await Promise.resolve()
      active -= 1
      return { data: chunk.map(row), error: null }
    }
  )

  assert.deepEqual(observed, [256, 1])
  assert.equal(maxActive, 1)
  assert.equal(states.size, 257)
  assert.equal(states.get(ids[256])?.state, "ready")
})

test("missing, duplicate, foreign and malformed batch rows fail closed", async () => {
  const ids = rewardIds(2)
  const invalidRows = [
    [row(ids[0])],
    [row(ids[0]), row(ids[0])],
    [row(ids[0]), row("00000000-0000-4000-8000-999999999999")],
    [row(ids[0]), { ...row(ids[1]), state: "surprise" }],
  ]

  for (const data of invalidRows) {
    await assert.rejects(
      loadCustomerRewardCollectionStates(ids, async () => ({
        data,
        error: null,
      })),
      /malformed batch result|malformed collection state/
    )
  }
})

test("the missing-RPC placeholder blocks every reward without a collection promise", async () => {
  const ids = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"]
  const states = await loadCustomerRewardCollectionStates(ids, async ({ p_reward_ids }) => ({
    data: legacyRewardCollectionBatch(p_reward_ids),
    error: null,
  }))
  for (const id of ids) {
    assert.deepEqual(states.get(id), {
      state: "blocked",
      reason: "Reward collection status is updating",
      availableFrom: null,
      expiresAt: null,
    })
  }
})
