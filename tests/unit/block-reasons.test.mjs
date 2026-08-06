import assert from "node:assert/strict"
import { test } from "node:test"

import {
  blockReasonCopy,
  stampBlockReasonFromSqlState,
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
    "location_required",
    "location_out_of_range",
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

test("Given a same-day stamp block When copy is rendered Then the next UK business day is named exactly", () => {
  assert.equal(
    blockReasonCopy("already_stamped_today"),
    "You're already stamped today. Come back on the next UK business day."
  )
})

test("Given a stamp refusal SQLSTATE When it is mapped Then the code decides the reason", () => {
  const cases = [
    ["NBS01", "already_stamped_today"],
    ["NBS02", "reward_ready_first"],
    ["NBS03", "pool_unavailable"],
    ["NBS04", "unavailable"],
    ["NBS05", "billing_required"],
    ["NBS06", "unavailable"],
    ["NBS07", "unavailable"],
    ["NBS08", "unavailable"],
    ["NBS10", "location_out_of_range"],
    ["NBS11", "location_required"],
  ]

  for (const [code, reason] of cases) {
    assert.equal(stampBlockReasonFromSqlState(code), reason)
    // The code wins even when the message says something else entirely, which
    // is the whole point: copy edits in SQL can no longer reclassify a refusal.
    assert.equal(
      toStampBlockReason("wording changed since release", code),
      reason
    )
  }
})

test("Given the reward-ready refusal When it carries its code Then it is no longer misread as a billing fault", () => {
  // Before 20260805100100 this message fell into the generic `not active` arm
  // and was reported to the venue as a billing problem needing venue action.
  assert.equal(
    toStampBlockReason("A reward is already ready to redeem", "NBS02"),
    "reward_ready_first"
  )
  assert.notEqual(
    toStampBlockReason("A reward is already ready to redeem", "NBS02"),
    "billing_required"
  )
})

test("Given a SQLSTATE that is not ours When it is mapped Then the message table still decides", () => {
  assert.equal(stampBlockReasonFromSqlState("P0001"), null)
  assert.equal(stampBlockReasonFromSqlState(null), null)
  assert.equal(stampBlockReasonFromSqlState(undefined), null)
  assert.equal(
    toStampBlockReason("Rate limit exceeded", "P0001"),
    "rate_limited"
  )
})

test("Given the two location refusals When copy is rendered Then each names its own recovery", () => {
  // Out of range is evidence of absence; required is a device permission the
  // customer can fix on the spot. They must not share wording.
  const outOfRange = blockReasonCopy("location_out_of_range")
  const required = blockReasonCopy("location_required")

  assert.notEqual(outOfRange, required)
  assert.match(outOfRange, /at the venue/i)
  assert.match(required, /turn on location/i)
  for (const copy of [outOfRange, required]) {
    assert.ok(!/rpc|sql|postgres|geofence|radius|NBS/i.test(copy))
  }
})
