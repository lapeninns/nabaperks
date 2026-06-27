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
