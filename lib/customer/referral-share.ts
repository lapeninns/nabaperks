"use server"

import { recordProductEvent } from "@/lib/analytics/events"
import { getCurrentCustomer } from "@/lib/customer/identity"
import { logger } from "@/lib/observability/logger"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

/**
 * Record that a member invoked share on their "Bring a Regular" link (RB-11,
 * share half). Best-effort analytics: it never throws into the share UI. The
 * caller-supplied membership id is recorded only after it resolves to a
 * membership owned by the current customer — anonymous or foreign ids are
 * dropped so the event stream cannot be polluted with arbitrary UUIDs.
 */
export async function recordReferralShare(membershipId: string): Promise<void> {
  try {
    const customer = await getCurrentCustomer()
    if (!customer) return

    const supabase = createSupabaseServiceRoleClient()
    const { data: membership, error } = await supabase
      .from("customer_memberships")
      .select("id, merchant_id")
      .eq("id", membershipId)
      .eq("customer_id", customer.id)
      .maybeSingle()

    if (error) {
      throw new Error(`Unable to load membership: ${error.message}`)
    }
    if (!membership) return

    await recordProductEvent({
      eventName: "referral_link_shared",
      merchantId: membership.merchant_id,
      membershipId: membership.id,
      customerId: customer.id,
      actorType: "customer",
      actorId: customer.id,
    })
  } catch (error) {
    logger.warn("referral_share_event_failed", { membershipId, error })
  }
}
