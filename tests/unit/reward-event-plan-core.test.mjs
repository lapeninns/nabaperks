import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { rewardUnlockedNotificationEvent } from "../../lib/notifications/reward-event-plan-core.ts"

function collection(state, reason = null) {
  return {
    state,
    reason,
    availableFrom: "2026-09-18T09:00:00.000Z",
    expiresAt: "2026-09-30T22:59:59.000Z",
  }
}

test("authoritative waiting state stays waiting even after available_from", () => {
  assert.equal(
    rewardUnlockedNotificationEvent(collection("waiting")),
    "reward_unlocked_waiting"
  )
})

test("NBR01 daily-cap block never becomes ready from a past date", () => {
  assert.equal(
    rewardUnlockedNotificationEvent(
      collection("blocked", "one_reward_per_day")
    ),
    null
  )
})

test("only authoritative ready state schedules reward_ready", () => {
  assert.equal(
    rewardUnlockedNotificationEvent(collection("ready")),
    "reward_ready"
  )
  for (const state of ["expired", "redeemed", "cancelled"]) {
    assert.equal(rewardUnlockedNotificationEvent(collection(state)), null)
  }
})

test("authoritative profile setup blocks keep their dedicated notification", () => {
  assert.equal(
    rewardUnlockedNotificationEvent(
      collection("blocked", "profile_incomplete")
    ),
    "profile_required_to_collect"
  )
})

test("confirmed-stamp integration reads the database collection predicate", () => {
  const source = readFileSync("lib/notifications/events.ts", "utf8")
  assert.match(source, /rpc\("get_reward_collection_state"/)
  assert.match(source, /rewardUnlockedNotificationEvent\(collection\)/)
  assert.doesNotMatch(source, /isRedeemableToday|redeemableFrom\s*<=/)
})

test("awaiting the venue's in-person photo ID sends no profile message", () => {
  assert.equal(
    rewardUnlockedNotificationEvent(
      collection(
        "blocked",
        "Customer must have verified photo ID and be 18 or over to redeem"
      )
    ),
    null
  )
})
