import "server-only"

import { customerEmailHmac } from "@/lib/customer/email-pii-core"
import { logger } from "@/lib/observability/logger"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export type AttachedInvite = {
  attached_reward_event_id: string
  merchant_id: string
  membership_id: string
  reward_name: string
}

/**
 * Best-effort: attach any pending reward invites matching this customer's
 * verified phone/email (and an optional claim token). The RPC already enqueues
 * the "reward received" push per attached invite. Never throws into the host
 * flow — a failure just waits for the next matching event.
 */
export async function attachRewardInvitesForCustomer(
  customerId: string,
  extra: { claimTokenHash?: string | null } = {}
): Promise<AttachedInvite[]> {
  try {
    const supabase = createSupabaseServiceRoleClient()
    const { data: customer } = await supabase
      .from("customers")
      .select("phone_hmac, email, email_verified_at")
      .eq("id", customerId)
      .maybeSingle()
    if (!customer) return []

    let emailHmac: string | null = null
    if (customer.email && customer.email_verified_at) {
      try {
        emailHmac = customerEmailHmac(customer.email)
      } catch {
        emailHmac = null
      }
    }

    const { data, error } = await supabase.rpc("attach_matched_reward_invites", {
      p_customer_id: customerId,
      p_phone_hmac: customer.phone_hmac ?? null,
      p_email_hmac: emailHmac,
      p_claim_token_hash: extra.claimTokenHash ?? null,
    })
    if (error) {
      logger.warn("reward_invite_attach_failed", {
        customerId,
        reason: error.message,
      })
      return []
    }
    return (data ?? []) as AttachedInvite[]
  } catch (error) {
    logger.warn("reward_invite_attach_failed", {
      customerId,
      reason: error instanceof Error ? error.message : "unknown",
    })
    return []
  }
}
