import "server-only"

import { getCurrentCustomer } from "@/lib/customer/identity"
import {
  offerClaimNoticeFromParams,
  type OfferClaimNotice,
} from "@/lib/customer/offer-pass-view"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

/** A redirect requests a notice; only the customer's saved claim proves it. */
export async function loadOfferClaimNotice(
  membershipId: string,
  params: { offer?: string; membership?: string }
): Promise<OfferClaimNotice | null> {
  const notice = offerClaimNoticeFromParams(params)
  if (!notice || notice === "already_member") return notice
  const customer = await getCurrentCustomer()
  if (!customer) return null

  const { data, error } = await createSupabaseServiceRoleClient()
    .from("offer_campaign_claims")
    .select("id")
    .eq("customer_id", customer.id)
    .eq("membership_id", membershipId)
    .limit(1)
    .maybeSingle()

  return !error && data ? notice : null
}
