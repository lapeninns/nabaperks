import assert from "node:assert/strict"
import { test } from "node:test"

import {
  CUSTOMER_REWARD_HISTORY_PAGE_SIZE,
  normalizeRewardHistoryPage,
  rewardHistoryRange,
} from "@/lib/customer/reward-history-pagination"

test("reward history pages normalize hostile and missing query values", () => {
  assert.equal(normalizeRewardHistoryPage(undefined), 1)
  assert.equal(normalizeRewardHistoryPage("0"), 1)
  assert.equal(normalizeRewardHistoryPage("-2"), 1)
  assert.equal(normalizeRewardHistoryPage("1.5"), 1)
  assert.equal(normalizeRewardHistoryPage("3junk"), 1)
  assert.equal(normalizeRewardHistoryPage("not-a-page"), 1)
  assert.equal(normalizeRewardHistoryPage("3"), 3)
})

test("reward history pages map to bounded non-overlapping database ranges", () => {
  assert.deepEqual(rewardHistoryRange(1), {
    from: 0,
    to: CUSTOMER_REWARD_HISTORY_PAGE_SIZE - 1,
  })
  assert.deepEqual(rewardHistoryRange(3), {
    from: CUSTOMER_REWARD_HISTORY_PAGE_SIZE * 2,
    to: CUSTOMER_REWARD_HISTORY_PAGE_SIZE * 3 - 1,
  })
})
