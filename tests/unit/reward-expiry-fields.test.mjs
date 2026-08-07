import assert from "node:assert/strict"
import { test } from "node:test"

import {
  DEFAULT_REWARD_EXPIRY_DAYS,
  MAX_REWARD_EXPIRY_DAYS,
  MIN_REWARD_EXPIRY_DAYS,
  REWARD_EXPIRY_OPTIONS,
  parseRewardExpiryDays,
  rewardExpiryLabel,
} from "@/lib/merchant/reward-expiry-fields"

test("Given an empty expiry field When it is parsed Then the platform default is used", () => {
  // A form posted without the control must still save rather than erroring.
  assert.equal(parseRewardExpiryDays(""), DEFAULT_REWARD_EXPIRY_DAYS)
  assert.equal(parseRewardExpiryDays("   "), DEFAULT_REWARD_EXPIRY_DAYS)
  assert.equal(parseRewardExpiryDays(null), DEFAULT_REWARD_EXPIRY_DAYS)
  assert.equal(parseRewardExpiryDays(undefined), DEFAULT_REWARD_EXPIRY_DAYS)
})

test("Given every offered option When it is parsed Then it is accepted", () => {
  for (const days of REWARD_EXPIRY_OPTIONS) {
    assert.equal(parseRewardExpiryDays(String(days)), days)
  }
  assert.ok(
    REWARD_EXPIRY_OPTIONS.includes(DEFAULT_REWARD_EXPIRY_DAYS),
    "the default must be one of the options the merchant can pick"
  )
})

test("Given a value outside the database CHECK When it is parsed Then it is refused", () => {
  // loyalty_cards.reward_expires_after_days is CHECK (1..3660); save_loyalty_card
  // raises NBS12 beyond it. The form must not send something the DB will reject.
  assert.equal(parseRewardExpiryDays(String(MIN_REWARD_EXPIRY_DAYS - 1)), null)
  assert.equal(parseRewardExpiryDays(String(MAX_REWARD_EXPIRY_DAYS + 1)), null)
  assert.equal(
    parseRewardExpiryDays(String(MIN_REWARD_EXPIRY_DAYS)),
    MIN_REWARD_EXPIRY_DAYS
  )
  assert.equal(
    parseRewardExpiryDays(String(MAX_REWARD_EXPIRY_DAYS)),
    MAX_REWARD_EXPIRY_DAYS
  )
})

test("Given a non-integer expiry When it is parsed Then it is refused", () => {
  for (const bad of ["30.5", "-30", "thirty", "30d", "1e3", "0x1e"]) {
    assert.equal(parseRewardExpiryDays(bad), null, `${bad} must not parse`)
  }
})

test("Given a day count When it is labelled Then the singular is not mangled", () => {
  assert.equal(rewardExpiryLabel(1), "1 day")
  assert.equal(rewardExpiryLabel(30), "30 days")
})
