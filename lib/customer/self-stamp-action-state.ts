import type { CustomerBlockReason } from "@/lib/customer/experience/block-reasons"

/**
 * Why a stamp was refused, beyond the customer-facing message. The stamp
 * screen reads `reason` to decide whether to offer the venue-code fallback,
 * and the two counters let it word a wrong-code retry honestly.
 */
export type SelfStampBlockedDetail = {
  reason?: CustomerBlockReason
  attemptsRemaining?: number
  lockedUntil?: string
}

export type SelfStampActionState =
  | { status: "idle" }
  | { status: "unknown" }
  | ({ status: "error"; message: string } & SelfStampBlockedDetail)
  | {
      status: "issued"
      newStampCount: number
      rewardUnlocked: boolean
      geoFlagged: boolean
      bonusStampsApplied: number
    }

export const initialSelfStampState: SelfStampActionState = { status: "idle" }
