import type { HomeCard, HomeSummary } from "@/lib/customer/home-types"

export function sortHomeCards(cards: readonly HomeCard[]): HomeCard[] {
  return [...cards].sort((left, right) => {
    const leftRedeemable = left.primaryRewardId ? 1 : 0
    const rightRedeemable = right.primaryRewardId ? 1 : 0
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
    redeemableCount: cards.filter((card) => card.primaryRewardId).length,
    stampAvailableCount: cards.filter(isStampAvailable).length,
  }
}

export function homeCardStatusCopy(card: HomeCard): string {
  if (card.primaryRewardId) return "Reward ready - tap to redeem"
  if (!card.available) {
    return card.unavailableReason ?? "This card is unavailable right now."
  }
  if (card.stampedToday) return "Stamp secured for today"
  if (card.stampsRequired !== null) {
    return `${card.currentStamps} of ${card.stampsRequired} stamps - ${card.stampsRemaining} more to unlock`
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
