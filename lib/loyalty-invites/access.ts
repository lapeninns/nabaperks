import { isFeatureEnabled } from "@/lib/feature-flags"

/**
 * Access gate for the bulk two-stamp loyalty invitations feature. Two
 * independent controls must both pass:
 *
 * 1. the default-disabled, owner-and-expiry-controlled global feature flag
 *    (`bulk_loyalty_invitations`), and
 * 2. the per-merchant allowlist column (`merchants.loyalty_invites_enabled`)
 *    that an operator sets for the selected pilot venues.
 *
 * The feature-flag registry only models a global boolean, so merchant-scoped
 * targeting is layered on top here rather than in the flag system.
 */
export function isLoyaltyInvitesEnabled(merchantAllowlisted: boolean): boolean {
  return (
    isFeatureEnabled("bulk_loyalty_invitations") && merchantAllowlisted === true
  )
}
