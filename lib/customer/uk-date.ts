import "server-only"

/**
 * Today's date in Europe/London as an ISO `YYYY-MM-DD` string.
 *
 * Reward `redeemable_from` values are stored as UK business dates, and the
 * customer card view compares them lexically against this string — we mirror
 * that here so the wallet and reward views agree on what is redeemable.
 */
export function ukTodayIso() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date())
  const year = parts.find((part) => part.type === "year")?.value
  const month = parts.find((part) => part.type === "month")?.value
  const day = parts.find((part) => part.type === "day")?.value

  return `${year}-${month}-${day}`
}

export function isRedeemableFrom(redeemableFrom: string | null) {
  return !redeemableFrom || redeemableFrom <= ukTodayIso()
}
