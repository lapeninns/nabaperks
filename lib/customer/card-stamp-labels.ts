export const REFERRAL_BONUS_STAMP_LABEL = "Bonus"

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
