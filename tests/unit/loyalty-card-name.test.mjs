import assert from "node:assert/strict"
import { test } from "node:test"

import {
  defaultLoyaltyCardName,
  GENERIC_LOYALTY_CARD_NAME,
} from "@/lib/merchant/loyalty-card-copy"

test("personalises a new card name with the business name", () => {
  assert.equal(
    defaultLoyaltyCardName("The Old Crown"),
    "The Old Crown Mystery Card"
  )
})

test("trims surrounding whitespace before composing", () => {
  assert.equal(
    defaultLoyaltyCardName("  Bishops Arms  "),
    "Bishops Arms Mystery Card"
  )
})

test("falls back to the generic name when the business name is blank", () => {
  for (const value of ["", "   ", null, undefined]) {
    assert.equal(defaultLoyaltyCardName(value), GENERIC_LOYALTY_CARD_NAME)
  }
})

test("falls back to the generic name when the composed name exceeds 80 chars", () => {
  // 75 + " Mystery Card" (13) = 88 > 80
  assert.equal(defaultLoyaltyCardName("A".repeat(75)), GENERIC_LOYALTY_CARD_NAME)
})

test("keeps a composed name that sits exactly on the 80-char limit", () => {
  // 67 + " Mystery Card" (13) = 80
  const name = "B".repeat(67)
  assert.equal(defaultLoyaltyCardName(name), `${name} Mystery Card`)
})
