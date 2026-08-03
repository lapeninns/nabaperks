import { isFeatureEnabled } from "@/lib/feature-flags"

/**
 * Access gate for merchant offer campaigns and campaign QR. Two independent
 * controls must both pass:
 *
 * 1. the default-disabled, owner-and-expiry-controlled global feature flag
 *    (`merchant_offer_campaigns`), and
 * 2. the per-merchant allowlist column (`merchants.offer_campaigns_enabled`)
 *    that an operator sets for the selected pilot venues.
 *
 * The feature-flag registry only models a global boolean, so merchant-scoped
 * targeting is layered on top here rather than in the flag system.
 */
export function isOfferCampaignsEnabled(merchantAllowlisted: boolean): boolean {
  return (
    isFeatureEnabled("merchant_offer_campaigns") && merchantAllowlisted === true
  )
}
