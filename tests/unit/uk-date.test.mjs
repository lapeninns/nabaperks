import assert from "node:assert/strict"
import { test } from "node:test"

import { addUkCalendarDays } from "@/lib/customer/uk-calendar"
import { isRedeemableFrom, ukTodayIso } from "@/lib/customer/uk-date"

test("Given a missing redeemable date When checked Then the reward is redeemable immediately", () => {
  assert.equal(isRedeemableFrom(null), true)
})

test("Given today's UK date When checked Then the reward is redeemable", () => {
  assert.equal(isRedeemableFrom(ukTodayIso()), true)
})

test("Given tomorrow's UK date When checked Then the reward is not redeemable yet", () => {
  assert.equal(isRedeemableFrom(addUkCalendarDays(ukTodayIso(), 1)), false)
})

test("Given yesterday's UK date When checked Then the reward remains redeemable", () => {
  assert.equal(isRedeemableFrom(addUkCalendarDays(ukTodayIso(), -1)), true)
})
