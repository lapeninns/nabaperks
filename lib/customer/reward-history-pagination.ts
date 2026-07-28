export const CUSTOMER_REWARD_HISTORY_PAGE_SIZE = 20

export function normalizeRewardHistoryPage(value: unknown): number {
  const page =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN

  return Number.isSafeInteger(page) && page > 0 ? page : 1
}

export function rewardHistoryRange(page: number): {
  from: number
  to: number
} {
  const normalizedPage = normalizeRewardHistoryPage(page)
  const from = (normalizedPage - 1) * CUSTOMER_REWARD_HISTORY_PAGE_SIZE

  return {
    from,
    to: from + CUSTOMER_REWARD_HISTORY_PAGE_SIZE - 1,
  }
}
