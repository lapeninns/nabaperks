import "server-only"

import {
  firstRpcRecord,
  rpcNumberField,
  rpcStringField,
} from "@/lib/offers/rpc-rows"
import { hashOfferToken } from "@/lib/offers/tokens"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

/**
 * Service-role read of an offer campaign's claim context for the /offer/[token]
 * landing. Returns availability plus the venue's display name, slug, the
 * campaign's own name and description, and the benefit the customer is being
 * promised — never the token, never a customer, never anything about who else
 * has claimed.
 *
 * `not_started` is deliberately distinct from `expired`: a campaign published
 * ahead of its start date must tell the customer when it opens, not that they
 * have missed it.
 *
 * The campaign name and description are merchant-authored free text. The RPC
 * releases them only for a claimable campaign, and the landing renders them as
 * text — never as markup.
 */

export type OfferClaimStatus =
  "available" | "not_started" | "paused" | "expired" | "unavailable"

export type OfferClaimContext = {
  status: OfferClaimStatus
  claimTokenHash: string
  businessName: string | null
  merchantSlug: string | null
  campaignName: string | null
  customerDescription: string | null
  bonusStampCount: number | null
  discountPercent: number | null
  requiresIdCheck: boolean
  extraTerms: string | null
  startsOn: string | null
  endsOn: string | null
}

const CLAIM_STATUSES: readonly OfferClaimStatus[] = [
  "available",
  "not_started",
  "paused",
  "expired",
  "unavailable",
]

export async function resolveOfferClaimContext(
  token: string
): Promise<OfferClaimContext> {
  const claimTokenHash = hashOfferToken(token)
  const unavailable: OfferClaimContext = {
    status: "unavailable",
    claimTokenHash,
    businessName: null,
    merchantSlug: null,
    campaignName: null,
    customerDescription: null,
    bonusStampCount: null,
    discountPercent: null,
    requiresIdCheck: false,
    extraTerms: null,
    startsOn: null,
    endsOn: null,
  }

  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc("get_offer_claim_context", {
    p_claim_token_hash: claimTokenHash,
  })

  if (error) {
    // Postgres detail stays in the server log; the landing renders the calm
    // "not available" state rather than a database hint.
    console.error("get_offer_claim_context failed", error)
    return unavailable
  }

  const row = firstRpcRecord(data)
  if (!row) return unavailable

  const status = row.claim_status
  if (
    typeof status !== "string" ||
    !(CLAIM_STATUSES as readonly string[]).includes(status)
  ) {
    return unavailable
  }

  return {
    ...unavailable,
    status: status as OfferClaimStatus,
    businessName: rpcStringField(row, "business_name"),
    merchantSlug: rpcStringField(row, "business_slug"),
    campaignName: rpcStringField(row, "campaign_name"),
    customerDescription: rpcStringField(row, "customer_description"),
    bonusStampCount: rpcNumberField(row, "bonus_stamp_count"),
    discountPercent: rpcNumberField(row, "discount_percent"),
    requiresIdCheck: row.requires_id_check === true,
    extraTerms: rpcStringField(row, "extra_terms"),
    startsOn: rpcStringField(row, "starts_on"),
    endsOn: rpcStringField(row, "ends_on"),
  }
}

/**
 * Records one load of the landing page against the campaign behind this hash.
 *
 * "Opened" means the page was loaded while the offer was genuinely claimable —
 * the RPC decides that for itself, so a paused, unopened, finished, ended or
 * rotated link records nothing. It counts page loads, not people and not scans:
 * a refresh, a link preview and a crawler each add one, and nothing here can
 * tell them apart without identifying the visitor, which this feature will not
 * do. `record_offer_campaign_open` and the merchant tile both say so.
 *
 * Call this from `after()` only. It is a metric, so a failure is logged and
 * swallowed: nothing about counting an open may change what the customer sees.
 */
export async function recordOfferCampaignOpen(
  claimTokenHash: string
): Promise<void> {
  try {
    const supabase = createSupabaseServiceRoleClient()
    const { error } = await supabase.rpc("record_offer_campaign_open", {
      p_claim_token_hash: claimTokenHash,
    })
    if (error) console.error("record_offer_campaign_open failed", error)
  } catch (error) {
    console.error("record_offer_campaign_open threw", error)
  }
}
