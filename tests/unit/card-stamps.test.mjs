import assert from "node:assert/strict"
import { test } from "node:test"

import {
  reconcileCardStampCount,
  stampDisplayLabelsForCount,
} from "@/lib/customer/card-stamp-labels"

test("card progress reconciles to the server membership count and caps at the card size", () => {
  assert.equal(
    reconcileCardStampCount({
      membershipCount: 4,
      total: 5,
    }),
    4
  )
  assert.equal(
    reconcileCardStampCount({
      membershipCount: 9,
      total: 5,
    }),
    5
  )
  assert.equal(
    reconcileCardStampCount({
      membershipCount: -1,
      total: 5,
    }),
    0
  )
})

test("missing earned stamp labels are padded as referral bonuses", () => {
  assert.deepEqual(
    stampDisplayLabelsForCount({
      labels: ["30 Jun", "1 Jul"],
      count: 4,
    }),
    ["30 Jun", "1 Jul", "Bonus", "Bonus"]
  )
  assert.deepEqual(
    stampDisplayLabelsForCount({
      labels: ["30 Jun", "1 Jul"],
      count: 1,
    }),
    ["30 Jun"]
  )
})
