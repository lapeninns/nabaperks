import { describe, expect, it } from "vitest"

import { loyaltyAvailability } from "@/lib/customer/availability"
import {
  blockReasonCopy,
  toStampBlockReason,
} from "@/lib/customer/experience/block-reasons"

describe("billing card required customer gate", () => {
  it("returns billing_required when a billing-required merchant has no billing row", () => {
    // Given: a live merchant/card pair that requires billing but has no card-on-file row.
    const availability = loyaltyAvailability({
      merchantStatus: "active",
      cardActive: true,
      billingStatus: null,
      requiresBilling: true,
    })

    // When: customer availability is evaluated.
    // Then: the customer is blocked with the card-required reason and safe copy.
    expect(availability).toEqual({
      available: false,
      reason: "billing_required",
      message: "This venue isn't taking stamps yet.",
    })
  })

  it("keeps grandfathered merchants with no billing row operational", () => {
    // Given: an otherwise live grandfathered merchant with no billing row.
    const availability = loyaltyAvailability({
      merchantStatus: "active",
      cardActive: true,
      billingStatus: null,
      requiresBilling: false,
    })

    // When: customer availability is evaluated.
    // Then: missing billing is allowed because the merchant does not require it.
    expect(availability).toEqual({
      available: true,
      reason: null,
      message: undefined,
    })
  })

  it("keeps past_due operational because a card is on file", () => {
    // Given: a merchant that requires billing and has a past_due billing row.
    const availability = loyaltyAvailability({
      merchantStatus: "active",
      cardActive: true,
      billingStatus: "past_due",
      requiresBilling: true,
    })

    // When: customer availability is evaluated.
    // Then: the programme remains available while payment retry is operational.
    expect(availability.available).toBe(true)
  })

  it("maps the SQL active-yet RPC message to billing-required customer copy", () => {
    // Given: the SQL RPC raises the card-required inactive-yet message.
    const reason = toStampBlockReason(
      "This merchant loyalty programme is not active yet"
    )

    // When: the customer block reason copy is resolved.
    // Then: customers see the same safe card-required wording as availability.
    expect(reason).toBe("billing_required")
    expect(blockReasonCopy(reason)).toBe("This venue isn't taking stamps yet.")
  })
})
