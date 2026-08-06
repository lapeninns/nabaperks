/**
 * Pure validation for the venue's reward-expiry setting. No `server-only` and no
 * Supabase, so the merchant form, the server action and the unit tests share one
 * implementation.
 *
 * WHAT THE SETTING MEANS
 * How long an earned reward stays claimable. When it lapses, 20260805100200
 * expires the reward AND releases the card, so the customer starts a fresh cycle
 * instead of being blocked for ever by a reward they never collected. Shortening
 * it makes cards recycle sooner; lengthening it gives customers more time.
 *
 * The DB CHECK on loyalty_cards.reward_expires_after_days permits 1..3660 and
 * save_loyalty_card raises NBS12 outside that. The UI offers a smaller, opinionated
 * set for the same reason the send-reward dialog does: a free integer box invites
 * a venue to type 1 and quietly break their own programme.
 */

/** Options the merchant may pick, in days. */
export const REWARD_EXPIRY_OPTIONS = [14, 30, 60, 90, 180] as const

/** Matches the loyalty_cards.reward_expires_after_days default. */
export const DEFAULT_REWARD_EXPIRY_DAYS = 30

/** Widest range the database will accept, mirroring the column CHECK. */
export const MIN_REWARD_EXPIRY_DAYS = 1
export const MAX_REWARD_EXPIRY_DAYS = 3660

export const REWARD_EXPIRY_ERROR = `Choose how long a reward stays claimable, between ${MIN_REWARD_EXPIRY_DAYS} and ${MAX_REWARD_EXPIRY_DAYS} days.`

/**
 * Parse a submitted value into whole days, or null when it is not a usable one.
 * An empty field is treated as "unchanged from the default" rather than an
 * error, so a form posted without the control still saves.
 */
export function parseRewardExpiryDays(
  input: string | null | undefined
): number | null {
  const raw = (input ?? "").trim()
  if (raw === "") return DEFAULT_REWARD_EXPIRY_DAYS
  if (!/^\d+$/.test(raw)) return null

  const days = Number.parseInt(raw, 10)
  if (days < MIN_REWARD_EXPIRY_DAYS || days > MAX_REWARD_EXPIRY_DAYS)
    return null

  return days
}

/** "30 days" / "1 day", for the option list and the readback. */
export function rewardExpiryLabel(days: number): string {
  return days === 1 ? "1 day" : `${days} days`
}
