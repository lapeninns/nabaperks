import type { HomeCard, HomeSummary } from "@/lib/customer/home-types"
import { formatCollectionAvailability } from "@/lib/customer/reward-collection-state"

/**
 * A card has an unlocked reward the guest can act on: an earned stamp reward or
 * a gift, ready now or waiting only on a detail the guest adds. Sorting uses
 * this so either kind rises to the top.
 */
export function hasRedeemableReward(card: HomeCard): boolean {
  return Boolean(card.stampRewardId) || Boolean(card.gift?.redeemable)
}

/** The stamp reward can be collected now, with nothing left to set up. */
export function hasReadyStampReward(card: HomeCard): boolean {
  return Boolean(card.stampRewardId) && !card.stampRewardNeedsSetup
}

/**
 * The stamp reward is unlocked but held only by a setup step: never "ready"
 * and never a code to show. The one rule every home surface reads.
 */
export function stampRewardNeedsSetup(card: HomeCard): boolean {
  return Boolean(card.stampRewardId) && !hasReadyStampReward(card)
}

/** A reward on this card can be collected now (stamp reward or gift). */
function hasCollectableReward(card: HomeCard): boolean {
  return (
    hasReadyStampReward(card) ||
    Boolean(card.gift?.redeemable && !card.gift.needsSetup)
  )
}

/** Unlocked, but only a missing detail stands between the guest and it. */
function hasSetupReward(card: HomeCard): boolean {
  return hasRedeemableReward(card) && !hasCollectableReward(card)
}

/** Guest wording for a reward that needs a detail before it can be collected. */
export const REWARD_NEEDS_SETUP_LINE =
  "Reward unlocked. Finish setting up to collect."
export const REWARD_NEEDS_SETUP_ACTION = "Get it ready"

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
    ...((summary.setupRewardCount ?? 0) > 0
      ? [
          countLabel(
            summary.setupRewardCount ?? 0,
            "reward to get ready",
            "rewards to get ready"
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
    redeemableCount: cards.filter(hasCollectableReward).length,
    setupRewardCount: cards.filter(hasSetupReward).length,
    stampAvailableCount: cards.filter(isStampAvailable).length,
  }
}

/** The tile chip that names what this card can do next, if anything. */
export function homeCardNextStep(
  card: HomeCard
): { tone: "leaf" | "sun" | "plain"; label: string } | null {
  if (card.stampRewardId) {
    return card.stampRewardNeedsSetup
      ? { tone: "sun", label: "Reward unlocked" }
      : { tone: "leaf", label: "Reward ready" }
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
 * The tile's one-line next step. The states a customer can be in are kept
 * deliberately distinct in wording, not just in tone:
 *
 * - a reward can be collected now: the reward line (also the "Reward ready" tag);
 * - a reward is unlocked but needs a detail first: the setup line, never "ready";
 * - the card is unavailable: the server's own reason, unchanged;
 * - a reward is unlocked but still waiting: the server's concrete opening time;
 * - today's stamp is already collected: the collected line;
 * - a stamp can still be collected: progress to the reward.
 *
 * A ready *gift* (birthday / merchant issued) is rendered by the tile's own gift
 * ticket, so the status line stays with the stamp cycle instead of hiding a
 * card's stamp next step behind a gift it already shows.
 */
export function homeCardStatusCopy(card: HomeCard): string {
  if (card.stampRewardId) {
    return card.stampRewardNeedsSetup
      ? REWARD_NEEDS_SETUP_LINE
      : "Reward ready to collect. Show it at the counter."
  }
  if (!card.available) {
    return card.unavailableReason ?? "This card is unavailable right now."
  }
  if (card.unlockedRewards > 0) {
    const timing = formatCollectionAvailability(
      card.revealedRewardAvailableFrom ?? null
    )
    return timing
      ? `Reward unlocked. ${timing}.`
      : "Reward unlocked. Open the card to see when it's ready."
  }
  if (card.stampedToday) {
    return "Stamp collected today. Your next stamp comes on a later visit."
  }
  if (card.stampsRequired !== null) {
    // Progress only. The venue-scan condition is stated once, on the summary
    // strip above the cards, rather than repeated under every tile.
    return `${card.currentStamps} of ${card.stampsRequired} stamps. ${card.stampsRemaining} more to your reward.`
  }
  return "Open this card to see your stamps."
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
