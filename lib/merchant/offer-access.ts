import "server-only"

import { getCurrentMerchant } from "@/lib/auth/session"
import { isFeatureEnabled } from "@/lib/feature-flags"
import { isOfferCampaignsEnabled } from "@/lib/offers/access"
import { createSupabaseServerClient } from "@/lib/supabase/server"

/**
 * Whether the signed-in venue is inside the Offers pilot.
 *
 * One place answers this question for the whole console: the /app/offers routes
 * use it to decide whether they exist at all, and the merchant shell and the
 * dashboard use it to decide whether to offer an entry point. Before this
 * existed the entry points were unconditional, so every venue outside the pilot
 * — which, with the flag default-off, is every venue — was invited into a 404.
 *
 * The global flag is checked first and short-circuits, so while the pilot is
 * dark this costs no database work on any /app render. The allowlist is read
 * with the caller's own session, so it is subject to the same RLS as every other
 * merchant read.
 */
export async function isOfferCampaignsEnabledForCurrentVenue(): Promise<boolean> {
  if (!isFeatureEnabled("merchant_offer_campaigns")) return false

  const merchant = await getCurrentMerchant()
  if (!merchant) return false

  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from("merchants")
    .select("offer_campaigns_enabled")
    .eq("id", merchant.id)
    .maybeSingle()

  return isOfferCampaignsEnabled(data?.offer_campaigns_enabled === true)
}
