import assert from "node:assert/strict"
import { test } from "node:test"

import {
  loyaltyEarningTermsFromRewardSnapshot,
  loyaltyEarningTermsText,
} from "@/lib/loyalty/earning-terms"

test("Given configured terms-only rules When rendered Then the wording is explicit", () => {
  assert.equal(
    loyaltyEarningTermsText({
      minimumSpendPence: 500,
      oneTransactionPerStamp: true,
    }),
    "One stamp per visit, one transaction per stamp. Minimum spend £5.00."
  )
})

test("Given an immutable reward snapshot When rendered Then its earning rules are used", () => {
  assert.equal(
    loyaltyEarningTermsFromRewardSnapshot({
      minimum_spend_pence: 725,
      one_transaction_per_stamp: true,
    }),
    "One stamp per visit, one transaction per stamp. Minimum spend £7.25."
  )
  assert.equal(loyaltyEarningTermsFromRewardSnapshot({}), null)
})

test("Given no minimum spend When rendered Then no spend rule is invented", () => {
  assert.equal(
    loyaltyEarningTermsText({
      minimumSpendPence: null,
      oneTransactionPerStamp: false,
    }),
    "One stamp per visit."
  )
})
