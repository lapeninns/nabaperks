import { isRedeemableFrom } from "@/lib/customer/uk-date"

export type UnlockedRewardPickRow = {
  id: string
  source?: string | null
  created_at?: string | null
  redeemable_from: string | null
}

/** Earned cycle rewards outrank issued gifts when both are unlocked. */
function sourceRank(source: string | null | undefined): number {
  if (source === "stamp_cycle") return 0
  if (source === "merchant_direct") return 1
  if (source === "birthday_month") return 2
  return 3
}

export function comparePrimaryUnlockedRewards(
  a: UnlockedRewardPickRow,
  b: UnlockedRewardPickRow
): number {
  const sourceDelta = sourceRank(a.source) - sourceRank(b.source)
  if (sourceDelta !== 0) return sourceDelta

  const aRedeemable = isRedeemableFrom(a.redeemable_from)
  const bRedeemable = isRedeemableFrom(b.redeemable_from)
  if (aRedeemable !== bRedeemable) return aRedeemable ? -1 : 1

  const aCreated = a.created_at ?? ""
  const bCreated = b.created_at ?? ""
  return bCreated.localeCompare(aCreated)
}

/** The reward the customer should see first when multiple are unlocked. */
export function pickPrimaryUnlockedReward<T extends UnlockedRewardPickRow>(
  rows: readonly T[]
): T | null {
  if (rows.length === 0) return null
  return [...rows].sort(comparePrimaryUnlockedRewards)[0] ?? null
}

/**
 * Only stamp-cycle rewards block new stamps and stamp-route QR collection.
 * Issued rewards (birthday, merchant direct) redeem on their own rail.
 */
export function pickStampBlockingUnlockedReward<T extends UnlockedRewardPickRow>(
  rows: readonly T[]
): T | null {
  return pickPrimaryUnlockedReward(
    rows.filter((row) => (row.source ?? "stamp_cycle") === "stamp_cycle")
  )
}

/**
 * The issued reward (birthday / merchant direct) to feature on a card as a
 * distinct gift — the complement of {@link pickStampBlockingUnlockedReward}.
 * Redeemable-first, then most recent. Kept separate from the stamp cycle so a
 * gift never makes an incomplete stamp card read as reward-ready.
 */
export function pickIssuedUnlockedReward<T extends UnlockedRewardPickRow>(
  rows: readonly T[]
): T | null {
  return pickPrimaryUnlockedReward(
    rows.filter((row) => (row.source ?? "stamp_cycle") !== "stamp_cycle")
  )
}
