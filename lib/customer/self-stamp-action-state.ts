export type SelfStampActionState =
  | { status: "idle" }
  | { status: "unknown" }
  | { status: "error"; message: string }
  | {
      status: "issued"
      newStampCount: number
      rewardUnlocked: boolean
      geoFlagged: boolean
      bonusStampsApplied: number
    }

export const initialSelfStampState: SelfStampActionState = { status: "idle" }
