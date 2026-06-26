import "server-only"

export type LoyaltyAvailabilityReason =
  | "merchant_inactive"
  | "card_inactive"
  | "billing_required"
  | "billing_blocked"

export type LoyaltyAvailability =
  | { available: true; reason: null; message: undefined }
  | {
      available: false
      reason: LoyaltyAvailabilityReason
      message: string
    }

export function loyaltyAvailability({
  merchantStatus,
  cardActive,
  billingStatus,
  requiresBilling,
}: {
  merchantStatus: string
  cardActive: boolean
  billingStatus: string | null
  requiresBilling: boolean
}): LoyaltyAvailability {
  if (!["trial", "active"].includes(merchantStatus)) {
    return {
      available: false,
      reason: "merchant_inactive",
      message: "This merchant loyalty programme is not currently active.",
    }
  }

  if (!cardActive) {
    return {
      available: false,
      reason: "card_inactive",
      message: "This loyalty card is not currently active.",
    }
  }

  if (requiresBilling && billingStatus === null) {
    return {
      available: false,
      reason: "billing_required",
      message: "This venue isn't taking stamps yet.",
    }
  }

  if (billingStatus === "suspended" || billingStatus === "cancelled") {
    return {
      available: false,
      reason: "billing_blocked",
      message: "This loyalty programme is unavailable at the moment.",
    }
  }

  return { available: true, reason: null, message: undefined }
}
