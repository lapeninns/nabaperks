import assert from "node:assert/strict"
import { test } from "node:test"

import {
  blockReasonCopy,
  blockReasonTitle,
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
    "reward_daily_cap",
    "billing_required",
    "rate_limited",
    "pool_unavailable",
    "unauthenticated",
    "profile_incomplete",
    "location_required",
    "location_out_of_range",
    "location_blocked",
    "venue_code_rejected",
    "venue_code_refusal_missing",
    "venue_code_locked",
    "venue_code_format",
    "venue_code_rate_limited",
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

test("Given a same-day stamp block When copy is rendered Then it says so in guest words, without trading days or resets", () => {
  assert.equal(
    blockReasonCopy("already_stamped_today"),
    "You've already got today's stamp. Come back on your next visit."
  )
})

test("Given every customer block reason When copy and titles are rendered Then they avoid internal vocabulary, em dashes and exclamation marks", () => {
  const reasons = [
    "already_stamped_today",
    "reward_ready_first",
    "reward_daily_cap",
    "billing_required",
    "rate_limited",
    "pool_unavailable",
    "unauthenticated",
    "profile_incomplete",
    "location_required",
    "location_out_of_range",
    "location_blocked",
    "venue_code_rejected",
    "venue_code_refusal_missing",
    "venue_code_locked",
    "venue_code_format",
    "venue_code_rate_limited",
    "unavailable",
    "unknown",
    undefined,
  ]
  for (const reason of reasons) {
    const lines = [blockReasonTitle(reason, "The Old Crown")]
    if (reason) lines.push(blockReasonCopy(reason))
    for (const line of lines) {
      assert.doesNotMatch(
        line,
        /trading day|daily reset|verif|redeem|merchant scan|wallet|\u2014|!/i,
        `${reason}: ${line}`
      )
    }
  }
  assert.doesNotMatch(
    blockReasonCopy("unauthenticated"),
    /Verify your identity from the venue QR/
  )
})

test("Given a refusal When its title is rendered Then it names the situation at this venue", () => {
  assert.equal(
    blockReasonTitle("billing_required", "The Old Crown"),
    "Stamps are paused at The Old Crown"
  )
  assert.equal(
    blockReasonTitle("unavailable", "The Old Crown"),
    "Stamps are paused at The Old Crown"
  )
  assert.equal(
    blockReasonTitle("already_stamped_today"),
    "You've already got today's stamp"
  )
  assert.equal(
    blockReasonTitle("location_out_of_range"),
    "We couldn't confirm you're at the venue"
  )
  assert.equal(blockReasonTitle(undefined), "Stamp not added")
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
    ["NBS14", "venue_code_refusal_missing"],
    ["NBC01", "venue_code_locked"],
    ["NBC02", "venue_code_format"],
    ["NBR01", "reward_daily_cap"],
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
