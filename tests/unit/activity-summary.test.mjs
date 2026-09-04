import assert from "node:assert/strict"
import { test } from "node:test"

import { applyActivityEventCount } from "@/lib/merchant/activity-summary"

function emptySummary() {
  return {
    total: 0,
    joins: 0,
    stamps: 0,
    rewards: 0,
    qrEvents: 0,
    accountEvents: 0,
  }
}

test("weekly activity counts each referral bonus as one stamp", () => {
  const summary = emptySummary()

  applyActivityEventCount(summary, "referral_bonus_awarded", 3)

  assert.deepEqual(summary, {
    total: 3,
    joins: 0,
    stamps: 3,
    rewards: 0,
    qrEvents: 0,
    accountEvents: 0,
  })
})
