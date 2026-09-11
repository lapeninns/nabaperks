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

/**
 * How the issued visit was confirmed, when the service can say. `venue_code`
 * and `unverified` are the two the customer should be told about; a GPS
 * verified or pre-threshold stamp needs no caveat and carries nothing.
 */
export type StampVerification = "venue_code" | "unverified"

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
      verification?: StampVerification
    }

export const initialSelfStampState: SelfStampActionState = { status: "idle" }
