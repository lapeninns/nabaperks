/**
 * Shared constants for the Bulk Two-Stamp Loyalty Invitations feature. Pure (no
 * `server-only`, no Supabase) so both the delivery worker and the unit tests can
 * import them. The database CHECK constraints are the source of truth for the
 * status vocabularies; the TypeScript unions below mirror them for app logic.
 */

/** metadata->>'source' written on the two welcome stamp_events rows. */
export const LOYALTY_INVITE_STAMP_SOURCE = "loyalty_invite"

/** Exactly two welcome stamps — not the normal first stamp plus two. */
export const LOYALTY_INVITE_WELCOME_STAMP_COUNT = 2

/**
 * A campaign's active card must require at least this many stamps, so awarding
 * the two welcome stamps can never immediately complete a legacy one- or
 * two-stamp card.
 */
export const LOYALTY_INVITE_MIN_CARD_STAMPS = 3

/** Import / send caps. */
export const LOYALTY_INVITE_MAX_RECIPIENTS = 2000
export const LOYALTY_INVITE_DAILY_SEND_CAP = 2000
export const LOYALTY_INVITE_MAX_ACTIVE_CAMPAIGNS = 1

/** Delivery pacing: a five-minute cron drains up to 800 at <=4 Resend req/s. */
export const LOYALTY_INVITE_DRAIN_MAX_PER_RUN = 800
export const LOYALTY_INVITE_RESEND_MAX_RPS = 4

/** Lifecycle windows. */
export const LOYALTY_INVITE_LINK_TTL_DAYS = 30
export const LOYALTY_INVITE_DRAFT_TTL_HOURS = 24
export const LOYALTY_INVITE_TERMINAL_RETENTION_DAYS = 365

/**
 * Retry only transient failures (network / 429 / 5xx): three total attempts,
 * with a 15-minute then two-hour backoff. Index by (attemptNumber - 1).
 */
export const LOYALTY_INVITE_SEND_MAX_ATTEMPTS = 3
export const LOYALTY_INVITE_RETRY_BACKOFFS_MS = [
  15 * 60 * 1000,
  2 * 60 * 60 * 1000,
] as const

/** The single audited legal basis a merchant attests for the whole campaign. */
export const LOYALTY_INVITE_LEGAL_BASES = [
  "venue_email_consent",
  "existing_customer_soft_opt_in",
] as const
export type LoyaltyInviteLegalBasis =
  (typeof LOYALTY_INVITE_LEGAL_BASES)[number]

/** Campaign lifecycle (mirrors the loyalty_invite_campaigns.status CHECK). */
export const LOYALTY_INVITE_CAMPAIGN_STATUSES = [
  "draft",
  "sending",
  "completed",
  "cancelled",
] as const
export type LoyaltyInviteCampaignStatus =
  (typeof LOYALTY_INVITE_CAMPAIGN_STATUSES)[number]

/** Recipient lifecycle (mirrors the loyalty_invite_recipients.status CHECK). */
export const LOYALTY_INVITE_RECIPIENT_STATUSES = [
  "queued",
  "sending",
  "sent",
  "delivered",
  "opened",
  "joined",
  "failed",
  "unsubscribed",
  "expired",
  "cancelled",
] as const
export type LoyaltyInviteRecipientStatus =
  (typeof LOYALTY_INVITE_RECIPIENT_STATUSES)[number]

/** Suppression reasons (mirrors loyalty_invite_email_suppressions.reason). */
export const LOYALTY_INVITE_SUPPRESSION_REASONS = [
  "unsubscribed",
  "bounced",
  "complained",
] as const
export type LoyaltyInviteSuppressionReason =
  (typeof LOYALTY_INVITE_SUPPRESSION_REASONS)[number]

export function isLoyaltyInviteLegalBasis(
  value: unknown
): value is LoyaltyInviteLegalBasis {
  return (
    typeof value === "string" &&
    (LOYALTY_INVITE_LEGAL_BASES as readonly string[]).includes(value)
  )
}
