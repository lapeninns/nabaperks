import assert from "node:assert/strict"
import { test } from "node:test"

import {
  blockReasonCopy,
  toStampBlockReason,
} from "@/lib/customer/experience/block-reasons"

test("Given known RPC messages When they are mapped Then stable typed block reasons are returned", () => {
  const cases = [
    ["Stamp already issued for this UK business day", "already_stamped_today"],
    ["A reward is already ready to redeem", "reward_ready_first"],
    ["This merchant loyalty programme is not active yet", "billing_required"],
    ["Rate limit exceeded", "rate_limited"],
    [
      "At least 3 active reward pool items are required before unlocking a reward",
      "pool_unavailable",
    ],
    ["Authentication required", "unauthenticated"],
    ["Complete your profile before redeeming", "profile_incomplete"],
    ["Reward not found", "unavailable"],
  ]

  for (const [message, reason] of cases) {
    assert.equal(toStampBlockReason(message), reason)
  }
})

test("Given every customer block reason When copy is rendered Then raw technical details are not leaked", () => {
  const reasons = [
    "already_stamped_today",
    "reward_ready_first",
    "billing_required",
    "rate_limited",
    "pool_unavailable",
    "unauthenticated",
    "profile_incomplete",
    "unavailable",
    "unknown",
  ]

  for (const reason of reasons) {
    const copy = blockReasonCopy(reason)
    assert.equal(typeof copy, "string")
    assert.ok(copy.length > 12)
    assert.ok(!/rpc|sql|postgres|billing_required|rate_limit/i.test(copy))
  }
})

test("Given an unknown RPC message When it is mapped Then generic recovery copy is used", () => {
  const reason = toStampBlockReason("unexpected internal database message")

  assert.equal(reason, "unknown")
  assert.equal(
    blockReasonCopy(reason),
    "That didn't go through. Try again or ask the venue team."
  )
})
