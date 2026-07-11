import assert from "node:assert/strict"
import { test } from "node:test"

import { loyaltyAvailability } from "@/lib/customer/availability"

const BASE = {
  merchantStatus: "active",
  cardActive: true,
  requiresBilling: true,
}

test("customer loyalty is available only for active or trialing billing", () => {
  for (const billingStatus of ["active", "trialing"]) {
    assert.deepEqual(loyaltyAvailability({ ...BASE, billingStatus }), {
      available: true,
      reason: null,
      message: undefined,
    })
  }

  for (const billingStatus of [
    "past_due",
    "cancelled",
    "suspended",
    "incomplete",
  ]) {
    assert.deepEqual(loyaltyAvailability({ ...BASE, billingStatus }), {
      available: false,
      reason: "billing_blocked",
      message: "This loyalty programme is unavailable at the moment.",
    })
  }
})

test("a billing-required merchant without a billing row stays unavailable", () => {
  assert.deepEqual(loyaltyAvailability({ ...BASE, billingStatus: null }), {
    available: false,
    reason: "billing_required",
    message: "This venue isn't taking stamps yet.",
  })
})
