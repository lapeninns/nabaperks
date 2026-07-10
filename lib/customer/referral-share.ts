"use server"

import { revalidatePath } from "next/cache"

import { recordProductEvent } from "@/lib/analytics/events"
import { getCurrentCustomer } from "@/lib/customer/identity"
import { logger } from "@/lib/observability/logger"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

/**
 * Verify the caller-supplied membership belongs to the current customer. Returns
 * the membership id when owned, else null — so a foreign/anonymous id is dropped
 * before any mutation (the RPC is owner-guarded too, this is defence-in-depth).
 */
async function ownedMembershipId(membershipId: string): Promise<string | null> {
  const customer = await getCurrentCustomer()
  if (!customer) return null
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("customer_memberships")
    .select("id")
    .eq("id", membershipId)
    .eq("customer_id", customer.id)
    .maybeSingle()
  if (error || !data) return null
  return String(data.id)
}

/**
 * Reset (rotate) a member's "Bring a Regular" link (MS-referral-code-controls,
 * CC-3/CC-8). The old code stops attributing; a fresh code takes over. Owner-only.
 */
export async function rotateReferralCode(
  membershipId: string
): Promise<{ ok: boolean }> {
  const owned = await ownedMembershipId(membershipId)
  if (!owned) return { ok: false }
  const supabase = createSupabaseServiceRoleClient()
  const { error } = await supabase.rpc("rotate_membership_referral_code", {
    p_membership_id: owned,
  })
  if (error) {
    logger.warn("referral_code_rotate_failed", { membershipId, error })
    return { ok: false }
  }
  revalidatePath(`/card/${owned}`)
  revalidatePath("/home")
  return { ok: true }
}

/**
 * Pause / resume a member's invite link (MS-referral-code-controls, CC-4/CC-8).
 * A paused link enrols friends but records no referral. Owner-only.
 */
export async function setReferralCodeActive(
  membershipId: string,
  active: boolean
): Promise<{ ok: boolean }> {
  const owned = await ownedMembershipId(membershipId)
  if (!owned) return { ok: false }
  const supabase = createSupabaseServiceRoleClient()
  const { error } = await supabase.rpc("set_membership_referral_code_active", {
    p_membership_id: owned,
    p_active: active,
  })
  if (error) {
    logger.warn("referral_code_set_active_failed", { membershipId, active, error })
    return { ok: false }
  }
  revalidatePath(`/card/${owned}`)
  revalidatePath("/home")
  return { ok: true }
}

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
