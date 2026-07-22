import "server-only"

import type { LoyaltyInviteCampaignStatus } from "@/lib/loyalty-invites/constants"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

/**
 * Service-role read of a merchant's active bulk-invitation campaign and its
 * recipient status breakdown, for the "Invite customers" page. Recipient rows
 * are RLS-protected (admin/service only), so the merchant only ever sees the
 * masked readback surfaced here — never raw addresses.
 */

export type LoyaltyInviteCampaignSummary = {
  id: string
  status: LoyaltyInviteCampaignStatus
  eligibleCount: number
  invalidCount: number
  duplicateCount: number
  notEligibleCount: number
  legalBasis: string | null
  createdAt: string
  linkExpiresAt: string | null
  sample: string[]
  statusCounts: Record<string, number>
}

export async function getActiveLoyaltyInviteCampaign(
  merchantId: string
): Promise<LoyaltyInviteCampaignSummary | null> {
  const supabase = createSupabaseServiceRoleClient()
  const { data: campaign } = await supabase
    .from("loyalty_invite_campaigns")
    .select(
      "id, status, eligible_count, invalid_count, duplicate_count, not_eligible_count, legal_basis, created_at, link_expires_at"
    )
    .eq("merchant_id", merchantId)
    .in("status", ["draft", "sending"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!campaign) return null

  const { data: recipients } = await supabase
    .from("loyalty_invite_recipients")
    .select("status, email_masked")
    .eq("campaign_id", campaign.id)

  const statusCounts: Record<string, number> = {}
  const sample: string[] = []
  for (const row of recipients ?? []) {
    statusCounts[row.status] = (statusCounts[row.status] ?? 0) + 1
    if (row.email_masked && sample.length < 8) sample.push(row.email_masked)
  }

  return {
    id: campaign.id,
    status: campaign.status as LoyaltyInviteCampaignStatus,
    eligibleCount: campaign.eligible_count,
    invalidCount: campaign.invalid_count,
    duplicateCount: campaign.duplicate_count,
    notEligibleCount: campaign.not_eligible_count,
    legalBasis: campaign.legal_basis,
    createdAt: campaign.created_at,
    linkExpiresAt: campaign.link_expires_at,
    sample,
    statusCounts,
  }
}
