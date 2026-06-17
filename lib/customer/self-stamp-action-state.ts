export type SelfStampActionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | {
      status: "issued"
      newStampCount: number
      rewardUnlocked: boolean
      geoFlagged: boolean
    }

export const initialSelfStampState: SelfStampActionState = { status: "idle" }
