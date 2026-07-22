import "server-only"

import { hashInviteToken } from "@/lib/loyalty-invites/tokens"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

/**
 * Service-role read of an invitation's claim context for the /invite/[token]
 * landing. Returns availability plus the venue's display name and slug; never
 * the recipient's address or any token material.
 */

export type InviteClaimStatus = "available" | "expired" | "unavailable"

export type InviteClaimContext = {
  status: InviteClaimStatus
  claimTokenHash: string
  businessName: string | null
  merchantSlug: string | null
}

export async function resolveInviteClaimContext(
  token: string
): Promise<InviteClaimContext> {
  const claimTokenHash = hashInviteToken(token)
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc(
    "get_loyalty_invite_claim_context",
    { p_claim_token_hash: claimTokenHash }
  )

  const unavailable: InviteClaimContext = {
    status: "unavailable",
    claimTokenHash,
    businessName: null,
    merchantSlug: null,
  }
  if (error || !data) return unavailable

  const row = Array.isArray(data) ? data[0] : data
  if (row?.claim_status === "available") {
    return {
      status: "available",
      claimTokenHash,
      businessName: row.business_name ?? null,
      merchantSlug: row.business_slug ?? null,
    }
  }
  if (row?.claim_status === "expired") {
    return { ...unavailable, status: "expired" }
  }
  return unavailable
}

export async function markInviteOpened(claimTokenHash: string): Promise<void> {
  const supabase = createSupabaseServiceRoleClient()
  await supabase.rpc("mark_loyalty_invite_opened", {
    p_claim_token_hash: claimTokenHash,
  })
}
