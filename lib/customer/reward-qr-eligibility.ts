import {
  rewardCollectionBlockedCopy,
  type RewardCollectionState,
} from "@/lib/customer/reward-collection-state"

type RewardQrFacts = {
  readonly collectionState: RewardCollectionState
  readonly collectionReason: string | null
  readonly availableFrom: string | null
}

export type RewardQrAvailability =
  { status: "ready" | "waiting" } | { status: "blocked"; reason: string }

/** Reward eligibility for review; profile completion is checked separately.
 * Verified DOB is deliberately a collection requirement, not a QR requirement.
 */
export function rewardQrAvailability(
  facts: RewardQrFacts
): RewardQrAvailability {
  switch (facts.collectionState) {
    case "ready":
      return { status: "ready" }
    case "waiting":
      return { status: "waiting" }
    case "expired":
      return { status: "blocked", reason: "This reward has expired." }
    case "redeemed":
    case "cancelled":
      return {
        status: "blocked",
        reason: "This reward is no longer available to collect.",
      }
    case "blocked":
      return {
        status: "blocked",
        reason: rewardCollectionBlockedCopy(facts.collectionReason),
      }
  }
}
