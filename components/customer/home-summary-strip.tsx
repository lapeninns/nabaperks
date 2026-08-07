import type { HomeSummary } from "@/lib/customer/home"

function countLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`
}

/**
 * The dashboard's three counts as one line.
 *
 * This used to be a bordered band of its own — `rounded-[var(--radius)]
 * border-2 border-dashed border-ink/25 … tracking-[0.08em]`, three off-contract
 * values, ~40px plus a 24px gap, restating facts the tiles below already carry
 * (CUS 02#9). The counts are worth keeping as an at-a-glance line; the band
 * around them was not. The home header now prints this string as its eyebrow.
 */
export function homeSummaryLine(summary: HomeSummary): string {
  return [
    countLabel(summary.cardCount, "card"),
    countLabel(summary.redeemableCount, "reward ready", "rewards ready"),
    countLabel(summary.stampAvailableCount, "stamp today", "stamps today"),
  ].join(" · ")
}
