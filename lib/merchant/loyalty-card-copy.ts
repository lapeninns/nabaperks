import {
  DEFAULT_STAMPS_REQUIRED,
  MAX_STAMPS_REQUIRED,
  MIN_STAMPS_REQUIRED,
} from "@/lib/merchant/customer-readback"

const LEGACY_DEFAULT_REWARD_TERMS =
  "Complete 3 visits to reveal a surprise reward. Redeem from the next UK business day."

export function clampStampsRequired(value: number) {
  return Math.min(
    MAX_STAMPS_REQUIRED,
    Math.max(MIN_STAMPS_REQUIRED, value)
  )
}

export function defaultLoyaltyCardRewardTerms(stampsRequired: number) {
  const count = clampStampsRequired(stampsRequired)

  return `Collect ${count} visit stamps to unlock a surprise reward. Redeem from the next UK business day.`
}

/** Generic card name used before a venue is known, and the length ceiling that
 * mirrors the card-name field's `maxLength`. */
export const GENERIC_LOYALTY_CARD_NAME = "Mystery Visit Card"
const LOYALTY_CARD_NAME_MAX_LENGTH = 80

/**
 * Suggested name for a NEW loyalty card, personalised with the venue's business
 * name (e.g. "The Old Crown Mystery Card"). Prefill only: the merchant can
 * overwrite it and nothing is persisted until they submit the card form. Falls
 * back to {@link GENERIC_LOYALTY_CARD_NAME} when the business name is missing or
 * the composed name would exceed the card-name field limit. Mirrors
 * {@link defaultLoyaltyCardRewardTerms} — a suggestion, not a saved value.
 */
export function defaultLoyaltyCardName(businessName: string | null | undefined) {
  const trimmed = businessName?.trim()

  if (!trimmed) return GENERIC_LOYALTY_CARD_NAME

  const composed = `${trimmed} Mystery Card`

  return composed.length <= LOYALTY_CARD_NAME_MAX_LENGTH
    ? composed
    : GENERIC_LOYALTY_CARD_NAME
}

/** True when the merchant has not customised the suggested reward terms copy. */
export function isDefaultLoyaltyCardRewardTerms(terms: string) {
  const trimmed = terms.trim()

  if (!trimmed) return true
  if (trimmed === LEGACY_DEFAULT_REWARD_TERMS) return true

  for (
    let count = MIN_STAMPS_REQUIRED;
    count <= MAX_STAMPS_REQUIRED;
    count += 1
  ) {
    if (trimmed === defaultLoyaltyCardRewardTerms(count)) return true
  }

  return false
}

export function resolveLoyaltyCardRewardTerms(
  stampsRequired: number,
  rewardTerms: string | null | undefined
) {
  const trimmed = rewardTerms?.trim()

  if (trimmed && !isDefaultLoyaltyCardRewardTerms(trimmed)) {
    return trimmed
  }

  return defaultLoyaltyCardRewardTerms(stampsRequired)
}

export { DEFAULT_STAMPS_REQUIRED, MAX_STAMPS_REQUIRED, MIN_STAMPS_REQUIRED }
