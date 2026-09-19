/**
 * Pure wallet-display helpers for ISSUED rewards (birthday / merchant-sent).
 * Dependency-free (Intl only) so they unit-test without the app runtime.
 */

export type RewardSource = "stamp_cycle" | "birthday_month" | "merchant_direct"

// Matches lib/customer/format.ts `formatDate` so the expiry note sits visually
// beside the wallet's other "Ready from …" / "Redeemed …" notes.
const expiryDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Europe/London",
})

/**
 * Narrow an unknown source string from the ledger to a known {@link
 * RewardSource}, defaulting to `stamp_cycle` (the earned reward that predates
 * the column).
 */
export function narrowRewardSource(
  value: string | null | undefined
): RewardSource {
  return value === "birthday_month" || value === "merchant_direct"
    ? value
    : "stamp_cycle"
}

/**
 * A short origin badge for an ISSUED reward, or null for an earned
 * (`stamp_cycle`) reward — earned rewards need no source label.
 */
export function rewardSourceBadge(
  source: RewardSource | string,
  businessName: string
): string | null {
  switch (source) {
    case "birthday_month":
      return "Birthday treat"
    case "merchant_direct":
      return `Sent by ${businessName}`
    default:
      return null
  }
}

/** "Expires 15 Jul 2026" for a reward with an expiry instant, else null. */
export function rewardExpiryNote(expiresAt: string | null): string | null {
  if (!expiresAt) return null
  return `Expires ${expiryDateFormatter.format(new Date(expiresAt))}`
}
