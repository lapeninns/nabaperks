import type { CardRewardStatus } from "./types"

/** The card page's reward ticket: sealed, unlocked but not collectable, or ready. */
export type CardRewardTicket = "sealed" | "waiting" | "ready"

/**
 * How the reward reads on the card page. A reward held only by a setup step
 * is unlocked but not ready: it never shows the ready ticket, the "Ready"
 * stub or a ready label, the same split home, the Rewards list and the banner
 * make.
 */
export function cardRewardTicket(card: {
  readonly reward: CardRewardStatus
  readonly rewardNeedsSetup?: boolean
}): CardRewardTicket {
  if (card.reward === "ready") {
    return card.rewardNeedsSetup ? "waiting" : "ready"
  }
  return card.reward === "waiting" ? "waiting" : "sealed"
}
