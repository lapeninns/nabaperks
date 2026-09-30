import assert from "node:assert/strict"
import { test } from "node:test"

import { cardRewardTicket } from "@/lib/customer/experience/card-reward"

test("Given a reward held only by setup When the card page reads it Then the ticket is unlocked, never ready", () => {
  assert.equal(
    cardRewardTicket({ reward: "ready", rewardNeedsSetup: true }),
    "waiting"
  )
})

test("Given each reward status When the card page reads it Then the ticket matches", () => {
  assert.equal(cardRewardTicket({ reward: "ready" }), "ready")
  assert.equal(
    cardRewardTicket({ reward: "ready", rewardNeedsSetup: false }),
    "ready"
  )
  assert.equal(cardRewardTicket({ reward: "waiting" }), "waiting")
  assert.equal(
    cardRewardTicket({ reward: "waiting", rewardNeedsSetup: true }),
    "waiting"
  )
  assert.equal(cardRewardTicket({ reward: "none" }), "sealed")
})
