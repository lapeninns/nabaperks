import assert from "node:assert/strict"
import { test } from "node:test"

import {
  isTerminalRewardStatusResponse,
  REWARD_COLLECTION_POLL_BACKOFF_AFTER_MS,
  REWARD_COLLECTION_POLL_BACKOFF_INTERVAL_MS,
  REWARD_COLLECTION_POLL_INTERVAL_MS,
  REWARD_COLLECTION_POLL_MAX_MS,
  rewardCollectionPollDelay,
} from "@/lib/customer/reward-collection-poll"

test("the poll starts at the brisk counter cadence", () => {
  assert.equal(REWARD_COLLECTION_POLL_INTERVAL_MS, 1500)
  assert.equal(rewardCollectionPollDelay(0), REWARD_COLLECTION_POLL_INTERVAL_MS)
  assert.equal(
    rewardCollectionPollDelay(REWARD_COLLECTION_POLL_BACKOFF_AFTER_MS - 1),
    REWARD_COLLECTION_POLL_INTERVAL_MS
  )
})

test("the poll backs off once the code has been open a while", () => {
  assert.ok(
    REWARD_COLLECTION_POLL_BACKOFF_INTERVAL_MS >
      REWARD_COLLECTION_POLL_INTERVAL_MS
  )
  assert.equal(
    rewardCollectionPollDelay(REWARD_COLLECTION_POLL_BACKOFF_AFTER_MS),
    REWARD_COLLECTION_POLL_BACKOFF_INTERVAL_MS
  )
  assert.equal(
    rewardCollectionPollDelay(REWARD_COLLECTION_POLL_MAX_MS - 1),
    REWARD_COLLECTION_POLL_BACKOFF_INTERVAL_MS
  )
})

test("the poll stops at the ceiling until the guest returns", () => {
  assert.ok(
    REWARD_COLLECTION_POLL_MAX_MS > REWARD_COLLECTION_POLL_BACKOFF_AFTER_MS
  )
  assert.equal(rewardCollectionPollDelay(REWARD_COLLECTION_POLL_MAX_MS), null)
  assert.equal(
    rewardCollectionPollDelay(REWARD_COLLECTION_POLL_MAX_MS * 3),
    null
  )
})

test("only signed-out and not-found responses end the poll for good", () => {
  assert.equal(isTerminalRewardStatusResponse(401), true)
  assert.equal(isTerminalRewardStatusResponse(404), true)
  for (const transient of [200, 429, 500, 502, 503]) {
    assert.equal(isTerminalRewardStatusResponse(transient), false)
  }
})
