import assert from "node:assert/strict"
import { test } from "node:test"

import {
  MAX_REWARD_EXAMPLES,
  rewardExampleForCycle,
  rewardExamplesFromPool,
} from "@/lib/customer/reward-examples"

const pool = [
  { reward_name: "Bar snack", is_active: true, display_order: 2 },
  { reward_name: "Free drink", is_active: true, display_order: 1 },
  { reward_name: "Retired", is_active: false, display_order: 0 },
  { reward_name: "  ", is_active: true, display_order: 3 },
  { reward_name: "Mystery treat", is_active: true, display_order: null },
  { reward_name: "Free drink", is_active: true, display_order: 9 },
]

test("examples are the active, named pool items in display order, deduplicated", () => {
  assert.deepEqual(rewardExamplesFromPool(pool), [
    "Free drink",
    "Bar snack",
    "Mystery treat",
  ])
})

test("an absent or empty pool yields no examples, and a long pool is capped", () => {
  assert.deepEqual(rewardExamplesFromPool(null), [])
  assert.deepEqual(rewardExamplesFromPool([]), [])
  const long = Array.from({ length: 12 }, (_, i) => ({
    reward_name: `Reward ${i}`,
    is_active: true,
    display_order: i,
  }))
  assert.equal(rewardExamplesFromPool(long).length, MAX_REWARD_EXAMPLES)
})

test("each loop cycle shows the next example and wraps; no pool means no example", () => {
  const examples = ["Free drink", "Bar snack", "Mystery treat"]
  assert.equal(rewardExampleForCycle(examples, 0), "Free drink")
  assert.equal(rewardExampleForCycle(examples, 1), "Bar snack")
  assert.equal(rewardExampleForCycle(examples, 2), "Mystery treat")
  assert.equal(rewardExampleForCycle(examples, 3), "Free drink")
  assert.equal(rewardExampleForCycle(examples, -1), "Free drink")
  assert.equal(rewardExampleForCycle([], 4), null)
  assert.equal(rewardExampleForCycle(undefined, 0), null)
})
