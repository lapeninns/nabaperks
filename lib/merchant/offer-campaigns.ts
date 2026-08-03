import "server-only"

import { ukTodayIso } from "@/lib/customer/uk-calendar"
import {
  isNonTerminalOfferStatus,
  isOfferCampaignStatus,
  type OfferCampaignStatus,
} from "@/lib/offers/constants"
import {
  decryptOfferClaimToken,
  hashOfferToken,
  offerClaimToken,
} from "@/lib/offers/tokens"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

/**
 * Service-role read of a venue's single non-terminal offer campaign and the
 * counts the merchant desk reports back, for /app/offers.
 *
 * The desk must show the link that actually works, and the only proof of that
 * is `claim_token_hash` — the value the customer landing page looks a scan up
 * by. So a candidate link is only ever displayed once its own hash matches the
 * stored one. The stored ciphertext is tried first because it survives a
 * rotation of CUSTOMER_SESSION_SECRET, which re-derivation does not: after such
 * a rotation the derived token hashes to something new while every printed
 * poster still carries the old one. Re-derivation is the fallback for campaigns
 * created before the ciphertext existed. If neither matches, the desk reports
 * no link rather than a broken one.
 *
 * Every count here reads a ledger this feature writes; none is estimated. The
 * softest of them is `linkOpens`, and its softness is a property of the thing
 * being measured rather than of the reading: `offer_campaign_open_counts`
 * (20260803101000) records page loads of /offer/[token] made while the offer
 * was claimable, so repeat visits, link previews and crawlers are all in it and
 * cannot be separated without identifying the visitor. The merchant-facing copy
 * says exactly that rather than letting the tile imply attendance.
 */

export type OfferCampaignMetrics = {
  /**
   * Loads of the claim landing page while the offer was claimable. Page loads,
   * not people and not scans — see the note above and the tile's helper text.
   */
  linkOpens: number
  /** Customers who completed the join and received the benefit. */
  claims: number
  /** Bonus stamps actually granted across those claims. */
  bonusStampsIssued: number
  /** Passes still inside their window today. */
  activePasses: number
  /** Times staff have honoured a pass for this campaign. */
  passRedemptions: number
}

export type MerchantOfferCampaign = {
  id: string
  status: OfferCampaignStatus
  /** Merchant-authored; null only for campaigns created before 20260803100600. */
  name: string | null
  /** The line the customer reads on the claim landing. */
  customerDescription: string | null
  bonusStampCount: number | null
  discountPercent: number | null
  startsOn: string
  endsOn: string
  requiresIdCheck: boolean
  extraTerms: string | null
  tokenGeneration: number
  /** Null until the link has been installed, and after the campaign ends. */
  claimToken: string | null
  createdAt: string
  publishedAt: string | null
  pausedAt: string | null
  metrics: OfferCampaignMetrics
}

const CAMPAIGN_COLUMNS =
  "id, status, name, customer_description, bonus_stamp_count, discount_percent, starts_on, ends_on, requires_id_check, extra_terms, claim_token_hash, claim_token_ciphertext, token_generation, created_at, published_at, paused_at"

/**
 * The claim link for a campaign, or null when no candidate hashes to the stored
 * value. Never returns a link the landing page would reject.
 */
export function resolveOfferClaimLink(campaign: {
  id: string
  tokenGeneration: number
  claimTokenHash: string | null
  claimTokenCiphertext: string | null
}): string | null {
  const { claimTokenHash } = campaign
  if (!claimTokenHash) return null

  const decrypted = campaign.claimTokenCiphertext
    ? decryptOfferClaimToken(campaign.claimTokenCiphertext)
    : null
  if (decrypted && hashOfferToken(decrypted) === claimTokenHash) {
    return decrypted
  }

  const derived = offerClaimToken(campaign.id, campaign.tokenGeneration)
  return hashOfferToken(derived) === claimTokenHash ? derived : null
}

export async function getActiveOfferCampaign(
  merchantId: string
): Promise<MerchantOfferCampaign | null> {
  const supabase = createSupabaseServiceRoleClient()
  const { data: campaign } = await supabase
    .from("offer_campaigns")
    .select(CAMPAIGN_COLUMNS)
    .eq("merchant_id", merchantId)
    .in("status", ["draft", "scheduled", "live", "paused"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!campaign) return null

  const status = isOfferCampaignStatus(campaign.status)
    ? campaign.status
    : "draft"
  if (!isNonTerminalOfferStatus(status)) return null

  return {
    id: campaign.id,
    status,
    name: campaign.name,
    customerDescription: campaign.customer_description,
    bonusStampCount: campaign.bonus_stamp_count,
    discountPercent: campaign.discount_percent,
    startsOn: campaign.starts_on,
    endsOn: campaign.ends_on,
    requiresIdCheck: campaign.requires_id_check === true,
    extraTerms: campaign.extra_terms,
    tokenGeneration: campaign.token_generation,
    claimToken: resolveOfferClaimLink({
      id: campaign.id,
      tokenGeneration: campaign.token_generation,
      claimTokenHash: campaign.claim_token_hash,
      claimTokenCiphertext: campaign.claim_token_ciphertext,
    }),
    createdAt: campaign.created_at,
    publishedAt: campaign.published_at,
    pausedAt: campaign.paused_at,
    metrics: await loadOfferCampaignMetrics(campaign.id),
  }
}

export async function loadOfferCampaignMetrics(
  campaignId: string
): Promise<OfferCampaignMetrics> {
  const supabase = createSupabaseServiceRoleClient()
  const today = ukTodayIso()

  const [opens, claims, passes, redemptions] = await Promise.all([
    // One row per day, and a campaign window is capped at 366 days, so the
    // whole rollup is read and summed here rather than through an aggregate.
    supabase
      .from("offer_campaign_open_counts")
      .select("open_count")
      .eq("campaign_id", campaignId),
    supabase
      .from("offer_campaign_claims")
      .select("bonus_stamps_awarded")
      .eq("campaign_id", campaignId),
    supabase
      .from("offer_discount_entitlements")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .eq("status", "active")
      .gte("valid_to", today),
    supabase
      .from("offer_redemptions")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId),
  ])

  const claimRows: ReadonlyArray<{ bonus_stamps_awarded: number | null }> =
    claims.data ?? []
  const openRows: ReadonlyArray<{ open_count: number | null }> =
    opens.data ?? []

  return {
    linkOpens: openRows.reduce(
      (total, row) => total + (row.open_count ?? 0),
      0
    ),
    claims: claimRows.length,
    bonusStampsIssued: claimRows.reduce(
      (total, row) => total + (row.bonus_stamps_awarded ?? 0),
      0
    ),
    activePasses: passes.count ?? 0,
    passRedemptions: redemptions.count ?? 0,
  }
}
