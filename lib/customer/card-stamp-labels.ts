export const REFERRAL_BONUS_STAMP_LABEL = "Bonus"

/**
 * A full card whose reward the server has not issued (no reward row behind the
 * final stamp). One calm line shared by the card/stamp recovery state and the
 * in-place stamp confirmation, so neither ever reads as an unlock.
 */
export const FULL_CARD_REWARD_PENDING_COPY =
  "We're sorting your reward. Check back shortly, or ask a team member."

export function reconcileCardStampCount({
  membershipCount,
  total,
}: {
  readonly membershipCount: number
  readonly total: number
}) {
  return Math.min(Math.max(membershipCount, 0), Math.max(total, 0))
}

export function stampDisplayLabelsForCount({
  labels,
  count,
  fallbackLabel = REFERRAL_BONUS_STAMP_LABEL,
}: {
  labels: readonly string[]
  count: number
  fallbackLabel?: string
}): string[] {
  const safeCount = Math.max(count, 0)
  if (safeCount <= labels.length) return labels.slice(0, safeCount)

  return [
    ...labels,
    ...Array.from({ length: safeCount - labels.length }, () => fallbackLabel),
  ]
}
