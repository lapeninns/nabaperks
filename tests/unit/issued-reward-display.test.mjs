import assert from "node:assert/strict"
import { test } from "node:test"

import {
  narrowRewardSource,
  rewardExpiryNote,
  rewardSourceBadge,
  rewardStampThresholdMet,
} from "@/lib/customer/issued-reward-display"

/**
 * MS-rewards-issued-source-rails R-9 — the pure wallet display helpers. Kept
 * dependency-free so they unit-test without the app runtime.
 */

test("rewardSourceBadge labels each issued source and stays quiet for earned rewards", () => {
  assert.equal(rewardSourceBadge("birthday_month", "Old Crown"), "Birthday treat")
  assert.equal(rewardSourceBadge("merchant_direct", "Old Crown"), "Sent by Old Crown")
  assert.equal(rewardSourceBadge("stamp_cycle", "Old Crown"), null)
})

test("rewardSourceBadge is defensive about an unknown source", () => {
  assert.equal(rewardSourceBadge("mystery", "Old Crown"), null)
})

test("narrowRewardSource keeps known sources and defaults everything else to stamp_cycle", () => {
  assert.equal(narrowRewardSource("birthday_month"), "birthday_month")
  assert.equal(narrowRewardSource("merchant_direct"), "merchant_direct")
  assert.equal(narrowRewardSource("stamp_cycle"), "stamp_cycle")
  assert.equal(narrowRewardSource(null), "stamp_cycle")
  assert.equal(narrowRewardSource("legacy_unknown"), "stamp_cycle")
})

test("rewardExpiryNote formats a London date (matching the wallet style) and passes through null", () => {
  assert.equal(rewardExpiryNote(null), null)
  assert.equal(
    rewardExpiryNote("2026-07-15T12:00:00.000Z"),
    "Expires 15 Jul 2026"
  )
})

test("rewardStampThresholdMet requires a full card for earned rewards only", () => {
  assert.equal(rewardStampThresholdMet("stamp_cycle", 2, 3), false)
  assert.equal(rewardStampThresholdMet("stamp_cycle", 3, 3), true)
  assert.equal(rewardStampThresholdMet("merchant_direct", 1, 3), true)
  assert.equal(rewardStampThresholdMet("birthday_month", 0, 3), true)
})
