import assert from "node:assert/strict"
import { test } from "node:test"

import {
  defaultLoyaltyCardName,
  defaultLoyaltyCardRewardTerms,
  GENERIC_LOYALTY_CARD_NAME,
  isDefaultLoyaltyCardRewardTerms,
  resolveLoyaltyCardRewardTerms,
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
  assert.equal(
    defaultLoyaltyCardName("A".repeat(75)),
    GENERIC_LOYALTY_CARD_NAME
  )
})

test("keeps a composed name that sits exactly on the 80-char limit", () => {
  // 67 + " Mystery Card" (13) = 80
  const name = "B".repeat(67)
  assert.equal(defaultLoyaltyCardName(name), `${name} Mystery Card`)
})

test("generated reward terms use the configured threshold and next venue trading day", () => {
  assert.equal(
    defaultLoyaltyCardRewardTerms(5),
    "Collect 5 visit stamps to unlock a surprise reward. Redeem from the next venue trading day."
  )
})

test("pre-activation generated terms remain recognised as defaults", () => {
  assert.equal(
    isDefaultLoyaltyCardRewardTerms(
      "Complete 3 visits to reveal a surprise reward. Redeem from the next UK business day."
    ),
    true
  )
  assert.equal(
    isDefaultLoyaltyCardRewardTerms(
      "Collect 4 visit stamps to unlock a surprise reward. Redeem from the next UK business day."
    ),
    true
  )
  assert.equal(
    resolveLoyaltyCardRewardTerms(
      5,
      "Collect 4 visit stamps to unlock a surprise reward. Redeem from the next UK business day."
    ),
    "Collect 5 visit stamps to unlock a surprise reward. Redeem from the next venue trading day."
  )
})

test("custom reward terms remain unchanged", () => {
  assert.equal(
    resolveLoyaltyCardRewardTerms(5, "Sunday lunch only. Ask the team."),
    "Sunday lunch only. Ask the team."
  )
})
