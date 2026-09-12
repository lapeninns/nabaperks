import "server-only"

import { readInviteCookie } from "@/lib/loyalty-invites/invite-cookie"
import { claimHandoffOrder } from "@/lib/offers/claim-handoff"
import { readOfferCookie } from "@/lib/offers/offer-cookie"
import {
  firstRpcRecord,
  rpcNumberField,
  rpcStringField,
} from "@/lib/offers/rpc-rows"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export type PendingJoinOffer = {
  campaignName: string | null
  bonusStampCount: number | null
  discountPercent: number | null
}

/** Read-only reminder. The existing join action remains the sole claim authority.
 * Respect the same venue binding and invitation precedence as that action.
 */
export async function loadPendingJoinOffer(
  merchantSlug: string
): Promise<PendingJoinOffer | null> {
  const [offer, invite] = await Promise.all([
    readOfferCookie(),
    readInviteCookie(),
  ])
  if (!offer || offer.merchantSlug !== merchantSlug) return null
  const inviteExpiry =
    invite?.merchantSlug === merchantSlug ? invite.expiresAt : null
  if (
    inviteExpiry !== null &&
    claimHandoffOrder({ invite: inviteExpiry, offer: offer.expiresAt })[0] !==
      "offer"
  )
    return null

  const { data, error } = await createSupabaseServiceRoleClient().rpc(
    "get_offer_claim_context",
    {
      p_claim_token_hash: offer.claimTokenHash,
    }
  )
  const row = firstRpcRecord(data)
  if (
    error ||
    !row ||
    row.claim_status !== "available" ||
    row.business_slug !== merchantSlug
  )
    return null

  return {
    campaignName: rpcStringField(row, "campaign_name"),
    bonusStampCount: rpcNumberField(row, "bonus_stamp_count"),
    discountPercent: rpcNumberField(row, "discount_percent"),
  }
}
