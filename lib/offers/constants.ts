/**
 * Shared constants for merchant offer campaigns and the customer discount pass.
 * Pure (no `server-only`, no Supabase) so route handlers, the merchant desk and
 * the unit tests can all import them. The database CHECK constraints are the
 * source of truth for the vocabularies and bounds; the values below mirror them
 * for application logic and must be changed in the same migration that changes
 * the constraint.
 */

/** metadata->>'source' written on offer bonus stamp_events rows. */
export const OFFER_STAMP_SOURCE = "offer_campaign"

/**
 * Campaign lifecycle (mirrors the offer_campaigns.status CHECK).
 *
 * Publishing a campaign whose start date has not arrived parks it in
 * 'scheduled' rather than pretending it is live, so the customer landing page
 * can say "this offer opens on <date>" instead of reporting it as expired.
 * Every merchant surface switches on all five.
 */
export const OFFER_CAMPAIGN_STATUSES = [
  "draft",
  "scheduled",
  "live",
  "paused",
  "ended",
] as const
export type OfferCampaignStatus = (typeof OFFER_CAMPAIGN_STATUSES)[number]

/**
 * What a campaign gives away. A campaign must carry at least one benefit, so
 * there is no "none" member: bonus stamps, a discount pass, or both.
 */
export const OFFER_BENEFIT_KINDS = ["bonus_stamps", "discount", "both"] as const
export type OfferBenefitKind = (typeof OFFER_BENEFIT_KINDS)[number]

/** Discount bounds (mirrors the discount_percent CHECK on every offer table). */
export const OFFER_DISCOUNT_PERCENT_MIN = 1
export const OFFER_DISCOUNT_PERCENT_MAX = 25

/**
 * Bonus stamp bounds. The upper bound mirrors the column CHECK; the effective
 * ceiling is always the card's own `stamps_required - 1`, re-validated at claim
 * time because a venue can change its card length after publishing.
 */
export const OFFER_BONUS_STAMP_MIN = 1
export const OFFER_BONUS_STAMP_MAX = 98

/**
 * Longest campaign window, counted inclusively. SQL expresses the same rule as
 * `ends_on <= starts_on + 365`, which spans 366 days including both ends.
 */
export const OFFER_CAMPAIGN_MAX_DURATION_DAYS = 366

/**
 * Lifetime of a single pass scan token. Must move together with the
 * `offer_pass_scan_tokens.expires_at` default of `now() + interval '10 minutes'`.
 */
export const OFFER_PASS_SCAN_TOKEN_TTL_MS = 10 * 60 * 1000

export function isOfferCampaignStatus(
  value: unknown
): value is OfferCampaignStatus {
  return (
    typeof value === "string" &&
    (OFFER_CAMPAIGN_STATUSES as readonly string[]).includes(value)
  )
}

/** A campaign in any of these states occupies the venue's single active slot. */
export function isNonTerminalOfferStatus(status: OfferCampaignStatus): boolean {
  return status !== "ended"
}

export function isOfferBenefitKind(value: unknown): value is OfferBenefitKind {
  return (
    typeof value === "string" &&
    (OFFER_BENEFIT_KINDS as readonly string[]).includes(value)
  )
}
