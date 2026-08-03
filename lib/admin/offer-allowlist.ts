import "server-only"

import { createAdminServiceRoleClient } from "@/lib/admin/service-role"
import { isFeatureEnabled } from "@/lib/feature-flags"

/**
 * Readback for the Offers pilot allowlist (`merchants.offer_campaigns_enabled`).
 *
 * The allowlist is only half of the gate. `lib/offers/access.ts` requires the
 * `merchant_offer_campaigns` feature flag AND the per-venue column, so an
 * operator who flips one without the other sees nothing change in the venue's
 * console. Both halves are read here and rendered together, because a control
 * that reports only the half it owns is how "I turned it on and nothing
 * happened" happens.
 *
 * Writes never go through this module. They go through the
 * `admin_set_merchant_offer_campaigns` RPC in `app/admin/actions.ts`, which is
 * guarded by `is_internal_admin()` and writes its own audit row — a direct
 * service-role table update would bypass both.
 */

export type OfferPilotVenue = {
  readonly id: string
  readonly businessName: string
  readonly businessSlug: string
  readonly offersEnabled: boolean
}

export type OfferPilotAllowlist = {
  /** Environment-level kill switch; false means no venue sees Offers. */
  readonly featureFlagEnabled: boolean
  /** Mutable by construction: `DataTable` takes `rows: T[]`. */
  readonly venues: OfferPilotVenue[]
  readonly enabledCount: number
}

type MerchantAllowlistRow = {
  readonly id: string
  readonly business_name: string | null
  readonly business_slug: string | null
  readonly offer_campaigns_enabled: boolean | null
}

export async function getOfferPilotAllowlist(): Promise<OfferPilotAllowlist> {
  const supabase = await createAdminServiceRoleClient()
  const { data, error } = await supabase
    .from("merchants")
    .select("id, business_name, business_slug, offer_campaigns_enabled")
    // Venues already inside the pilot sort first: the operator's usual question
    // is "who is on?", and that answer must not need scrolling.
    .order("offer_campaigns_enabled", { ascending: false })
    .order("business_name", { ascending: true })
    .limit(100)

  if (error) {
    throw new Error(`Unable to load the Offers allowlist: ${error.message}`)
  }

  const venues = ((data ?? []) as MerchantAllowlistRow[]).map((row) => ({
    id: row.id,
    businessName: row.business_name ?? "Merchant",
    businessSlug: row.business_slug ?? "",
    offersEnabled: row.offer_campaigns_enabled === true,
  }))

  return {
    featureFlagEnabled: isFeatureEnabled("merchant_offer_campaigns"),
    venues,
    enabledCount: venues.filter((venue) => venue.offersEnabled).length,
  }
}
