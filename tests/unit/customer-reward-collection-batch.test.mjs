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

test("the missing-RPC fallback derives legacy readiness from redeemable_from", async () => {
  const rows = [
    { id: "11111111-1111-4111-8111-111111111111", redeemable_from: "2000-01-01" },
    { id: "22222222-2222-4222-8222-222222222222", redeemable_from: "2999-12-31" },
    { id: "33333333-3333-4333-8333-333333333333", redeemable_from: null },
  ]
  const states = await loadCustomerRewardCollectionStates(
    rows.map((row) => row.id),
    async ({ p_reward_ids }) => ({
      data: legacyRewardCollectionBatch(
        p_reward_ids.map((id) => rows.find((row) => row.id === id))
      ),
      error: null,
    })
  )
  assert.equal(states.get(rows[0].id).state, "ready")
  assert.equal(states.get(rows[0].id).availableFrom, "2000-01-01")
  assert.equal(states.get(rows[1].id).state, "waiting")
  assert.equal(states.get(rows[1].id).availableFrom, "2999-12-31")
  assert.equal(states.get(rows[2].id).state, "ready")
  for (const row of rows) {
    assert.equal(states.get(row.id).reason, null)
    assert.equal(states.get(row.id).expiresAt, null)
  }
})
