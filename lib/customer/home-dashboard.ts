import type { HomeCard, HomeSummary } from "@/lib/customer/home-types"

/** A card has something to collect now — an earned stamp reward or a ready gift. */
export function hasRedeemableReward(card: HomeCard): boolean {
  return readyRewardCount(card) > 0
}

export function sortHomeCards(cards: readonly HomeCard[]): HomeCard[] {
  return [...cards].sort((left, right) => {
    const leftRedeemable = hasRedeemableReward(left) ? 1 : 0
    const rightRedeemable = hasRedeemableReward(right) ? 1 : 0
    if (leftRedeemable !== rightRedeemable)
      return rightRedeemable - leftRedeemable

    const leftAvailable = isStampAvailable(left) ? 1 : 0
    const rightAvailable = isStampAvailable(right) ? 1 : 0
    if (leftAvailable !== rightAvailable) return rightAvailable - leftAvailable

    const leftProgress = progressRatio(left)
    const rightProgress = progressRatio(right)
    if (leftProgress !== rightProgress) return rightProgress - leftProgress

    return visitTime(right.lastVisitAt) - visitTime(left.lastVisitAt)
  })
}

export function buildHomeSummary(cards: readonly HomeCard[]): HomeSummary {
  return {
    cardCount: cards.length,
    redeemableCount: cards.reduce(
      (count, card) => count + readyRewardCount(card),
      0
    ),
    stampAvailableCount: cards.filter(isStampAvailable).length,
  }
}

function readyRewardCount(card: HomeCard): number {
  if (typeof card.redeemableRewards === "number") {
    return card.redeemableRewards
  }

  return (
    Number(Boolean(card.stampRewardId)) + Number(Boolean(card.gift?.redeemable))
  )
}

export function homeCardStatusCopy(card: HomeCard): string {
  if (card.stampRewardId) return "Reward ready — show QR at the counter"
  if (!card.available) {
    return card.unavailableReason ?? "This card is unavailable right now."
  }
  // A waiting reward (unlocked but not yet redeemable) outranks stamped-today and
  // progress copy so it is not hidden — `redeemable_from` may skip weekends, so
  // avoid promising "tomorrow".
  if (card.unlockedRewards > 0) {
    return "Reward almost ready — back on the next opening day"
  }
  if (card.stampedToday) return "Stamp secured for today"
  if (card.stampsRequired !== null) {
    return `${card.currentStamps} of ${card.stampsRequired} stamps — ${card.stampsRemaining} more to unlock`
  }
  return "Open this card for the latest loyalty status"
}

function isStampAvailable(card: HomeCard): boolean {
  return card.available && !card.stampedToday && card.stampsRemaining > 0
}

function progressRatio(card: HomeCard): number {
  if (card.stampsRequired === null || card.stampsRequired <= 0) return 0
  return card.currentStamps / card.stampsRequired
}

function visitTime(value: string | null): number {
  return value ? Date.parse(value) : 0
}
