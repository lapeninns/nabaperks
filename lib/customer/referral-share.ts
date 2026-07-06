"use server"

import { recordProductEvent } from "@/lib/analytics/events"
import { getCurrentCustomer } from "@/lib/customer/identity"
import { logger } from "@/lib/observability/logger"

/**
 * Record that a member invoked share on their "Bring a Regular" link (RB-11,
 * share half). Best-effort analytics: it never throws into the share UI.
 */
export async function recordReferralShare(membershipId: string): Promise<void> {
  try {
    const customer = await getCurrentCustomer()
    await recordProductEvent({
      eventName: "referral_link_shared",
      membershipId,
      customerId: customer?.id ?? null,
      actorType: "customer",
      actorId: customer?.id ?? null,
    })
  } catch (error) {
    logger.warn("referral_share_event_failed", { membershipId, error })
  }
}
