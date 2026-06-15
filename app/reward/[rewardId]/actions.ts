"use server"

import { getRedemptionTokenStatus } from "@/lib/customer/redemption-token"

export type RedemptionStatusActionResult = {
  status: "pending" | "consumed" | "expired" | "none"
  consumedAt: string | null
  rewardName: string | null
}

export async function redemptionStatusAction(
  rewardId: string
): Promise<RedemptionStatusActionResult> {
  return getRedemptionTokenStatus(rewardId)
}
