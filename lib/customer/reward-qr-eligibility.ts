import { rewardStampThresholdMet } from "@/lib/customer/issued-reward-display"
import { formatLondonIso } from "@/lib/customer/uk-calendar"

type RewardQrFacts = {
  status: string
  source: string | null
  redeemableFrom: string | null
  expiresAt: string | null
  currentStampCount: number
  stampsRequired: number
  unavailableReason?: string
}

export type RewardQrAvailability =
  { status: "ready" | "waiting" } | { status: "blocked"; reason: string }

/** Reward eligibility for review; profile completion is checked separately.
 * Verified DOB is deliberately a collection requirement, not a QR requirement.
 */
export function rewardQrAvailability(
  facts: RewardQrFacts,
  now: Date = new Date()
): RewardQrAvailability {
  if (
    facts.status === "expired" ||
    (facts.expiresAt && Date.parse(facts.expiresAt) <= now.getTime())
  ) {
    return { status: "blocked", reason: "This reward has expired." }
  }
  if (facts.status !== "unlocked") {
    return {
      status: "blocked",
      reason: "This reward is no longer available to collect.",
    }
  }
  if (facts.unavailableReason) {
    return { status: "blocked", reason: facts.unavailableReason }
  }
  if (
    !rewardStampThresholdMet(
      facts.source,
      facts.currentStampCount,
      facts.stampsRequired
    )
  ) {
    return {
      status: "blocked",
      reason: "Collect the remaining stamps before opening this reward.",
    }
  }
  if (facts.redeemableFrom && facts.redeemableFrom > formatLondonIso(now)) {
    return { status: "waiting" }
  }
  return { status: "ready" }
}
