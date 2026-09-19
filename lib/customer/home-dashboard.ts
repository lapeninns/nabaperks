import type { HomeCard, HomeSummary } from "@/lib/customer/home-types"
import { formatCollectionAvailability } from "@/lib/customer/reward-collection-state"

/** A card has something to collect now — an earned stamp reward or a ready gift. */
export function hasRedeemableReward(card: HomeCard): boolean {
  return Boolean(card.stampRewardId) || Boolean(card.gift?.redeemable)
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

/**
 * The one conditional sentence the wallet is allowed to make about a stamp.
 * Presence, opening hours and every other eligibility check stay server-side, so
 * this states what a stamp still needs rather than that anything has been earned.
 */
export const HOME_STAMP_SCAN_NOTE = "Scan the QR at the venue to collect."

/**
 * Labels for the wallet strip, each naming the value `buildHomeSummary` really
 * computes. Both reward and stamp counts are counts of *cards*, not of rewards or
 * stamps: a card with both an earned stamp reward and a ready gift counts once,
 * and a card that can still be stamped today has collected nothing yet. Saying
 * "cards" keeps the label true in both cases and keeps availability ("ready for a
 * stamp") unmistakably separate from activity already recorded.
 */
export function homeSummaryLabels(summary: HomeSummary): string[] {
  // A zero is not news. The card count always shows because it is the wallet's
  // own size; the other two appear only when there is something to act on, so
  // the strip stays one short line on a small phone.
  return [
    countLabel(summary.cardCount, "card", "cards"),
    ...(summary.redeemableCount > 0
      ? [
          countLabel(
            summary.redeemableCount,
            "card with a reward ready",
            "cards with a reward ready"
          ),
        ]
      : []),
    ...(summary.stampAvailableCount > 0
      ? [
          countLabel(
            summary.stampAvailableCount,
            "card ready for a stamp",
            "cards ready for a stamp"
          ),
        ]
      : []),
  ]
}

export function buildHomeSummary(cards: readonly HomeCard[]): HomeSummary {
  return {
    cardCount: cards.length,
    redeemableCount: cards.filter(hasRedeemableReward).length,
    stampAvailableCount: cards.filter(isStampAvailable).length,
  }
}

/** The tile chip that names what this card can do next, if anything. */
export function homeCardNextStep(
  card: HomeCard
): { tone: "leaf" | "sun" | "plain"; label: string } | null {
  if (card.stampRewardId) {
    return { tone: "leaf", label: "Reward ready" }
  }
  if (!card.available) return null
  if (card.unlockedRewards > 0) return { tone: "sun", label: "Reward soon" }
  if (isStampAvailable(card)) {
    return { tone: "plain", label: "Ready for a stamp" }
  }
  if (card.stampedToday) return { tone: "plain", label: "Stamped today" }

  return null
}

/**
 * The tile's one-line next step. The five states a customer can be in are kept
 * deliberately distinct in wording, not just in tone:
 *
 * - a reward can be collected now → the reward line (also the "Reward ready" tag);
 * - the card is unavailable → the server's own reason, unchanged;
 * - a reward is unlocked but still waiting → the opening-day line;
 * - today's stamp is already collected → the collected line;
 * - a stamp can still be collected → progress plus the scan it depends on.
 *
 * A ready *gift* (birthday / merchant issued) is the fifth state's sibling and is
 * rendered by the tile's own gift ticket, so the status line stays with the stamp
 * cycle instead of hiding a card's stamp next step behind a gift it already shows.
 */
export function homeCardStatusCopy(card: HomeCard): string {
  if (card.stampRewardId) {
    return "Reward ready to collect — show the QR at the counter"
  }
  if (!card.available) {
    return card.unavailableReason ?? "This card is unavailable right now."
  }
  if (card.unlockedRewards > 0) {
    const timing = formatCollectionAvailability(
      card.revealedRewardAvailableFrom ?? null
    )
    return timing
      ? `Reward unlocked — ${timing.toLocaleLowerCase("en-GB")}`
      : "Reward unlocked — check the reward for collection timing"
  }
  if (card.stampedToday) {
    return "Stamp collected today — your next stamp comes on a later visit"
  }
  if (card.stampsRequired !== null) {
    // Progress only. The venue-scan condition is stated once, on the summary
    // strip above the cards, rather than repeated under every tile.
    return `${card.currentStamps} of ${card.stampsRequired} stamps — ${card.stampsRemaining} more to unlock`
  }
  return "Open this card for the latest loyalty status"
}

function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`
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
