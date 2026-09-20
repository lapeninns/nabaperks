import assert from "node:assert/strict"
import { test } from "node:test"

import {
  loadMerchantRewardCollectionStates,
  preferredUnlockedReward,
} from "@/lib/merchant/customer-collection-states"

function rewards(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    membership_id: `membership-${index + 1}`,
  }))
}

function batchRpc(counter) {
  return async ({ p_reward_ids: rewardIds }) => {
    counter.calls += 1
    return {
      data: rewardIds.map((rewardId, index) => ({
        reward_id: rewardId,
        state: index % 2 === 0 ? "ready" : "waiting",
        in_window: false,
      })),
      error: null,
    }
  }
}

test("one and one hundred merchant customers each need one predicate network call", async () => {
  for (const count of [1, 100]) {
    const counter = { calls: 0 }
    const result = await loadMerchantRewardCollectionStates(
      rewards(count),
      batchRpc(counter)
    )

    assert.equal(counter.calls, 1, `${count} authorised reward ids`)
    assert.equal(result.length, count)
    assert.equal(result[0]?.collection_state, "ready")
    if (count > 1) assert.equal(result[1]?.collection_state, "waiting")
  }
})

test("an empty page makes no predicate network call", async () => {
  const counter = { calls: 0 }
  const result = await loadMerchantRewardCollectionStates([], batchRpc(counter))

  assert.deepEqual(result, [])
  assert.equal(counter.calls, 0)
})

test("large legitimate lists are split into sequential bounded batches", async () => {
  for (const [count, expectedCalls] of [
    [257, 2],
    [1_000, 4],
  ]) {
    const counter = { calls: 0, active: 0, maxActive: 0 }
    const result = await loadMerchantRewardCollectionStates(
      rewards(count),
      async ({ p_reward_ids: rewardIds }) => {
        counter.calls += 1
        counter.active += 1
        counter.maxActive = Math.max(counter.maxActive, counter.active)
        await Promise.resolve()
        counter.active -= 1
        return {
          data: rewardIds.map((rewardId) => ({
            reward_id: rewardId,
            state: "ready",
            in_window: false,
          })),
          error: null,
        }
      }
    )

    assert.equal(result.length, count)
    assert.equal(counter.calls, expectedCalls, `${count} reward ids`)
    assert.equal(counter.maxActive, 1, `${count} reward ids`)
  }
})

test("missing, duplicate, foreign and malformed rows fail closed", async () => {
  const requested = rewards(2)
  const cases = [
    [],
    [
      { reward_id: requested[0].id, state: "ready", in_window: false },
      { reward_id: requested[0].id, state: "waiting", in_window: false },
    ],
    [
      { reward_id: requested[0].id, state: "ready", in_window: false },
      {
        reward_id: "00000000-0000-4000-8000-999999999999",
        state: "waiting",
        in_window: false,
      },
    ],
    [
      { reward_id: requested[0].id, state: "not-a-state", in_window: false },
      { reward_id: requested[1].id, state: "waiting", in_window: false },
    ],
  ]

  for (const data of cases) {
    await assert.rejects(
      loadMerchantRewardCollectionStates(requested, async () => ({
        data,
        error: null,
      })),
      /malformed/
    )
  }
})

test("a ready reward is preferred over an older lapsed or waiting row for the same membership", () => {
  const expired = { id: "old", collection_state: "expired" }
  const ready = { id: "new", collection_state: "ready" }
  const waiting = { id: "later", collection_state: "waiting" }
  const blocked = { id: "held", collection_state: "blocked" }

  assert.equal(preferredUnlockedReward(undefined, expired), expired)
  assert.equal(preferredUnlockedReward(expired, ready), ready)
  assert.equal(preferredUnlockedReward(ready, expired), ready)
  assert.equal(preferredUnlockedReward(waiting, ready), ready)
  assert.equal(preferredUnlockedReward(blocked, waiting), waiting)
  // Equal states keep the first row the caller supplied.
  assert.equal(preferredUnlockedReward(ready, { ...ready, id: "second" }), ready)
})
