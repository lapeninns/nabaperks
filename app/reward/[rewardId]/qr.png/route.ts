import { NextResponse } from "next/server"

import { getCustomerRewardState } from "@/lib/customer/reward"
import { createRewardScanToken } from "@/lib/customer/reward-scan-token"
import { getCustomerProfileCompletion } from "@/lib/customer/profile"
import {
  isRewardExpired,
  rewardStampThresholdMet,
} from "@/lib/customer/issued-reward-display"
import { isRedeemableFrom } from "@/lib/customer/uk-date"
import { getCanonicalAppOrigin } from "@/lib/env/app-origin"
import { renderQrCodePng } from "@/lib/qr/assets"

export const runtime = "nodejs"

type RewardQrRouteContext = {
  params: Promise<{
    rewardId: string
  }>
}

export async function GET(_request: Request, context: RewardQrRouteContext) {
  const { rewardId } = await context.params
  const rewardState = await getCustomerRewardState(rewardId)

  if (rewardState.status !== "ready") {
    return new NextResponse("Reward QR not found", { status: 404 })
  }

  const redeemable =
    rewardState.reward.status === "unlocked" &&
    !isRewardExpired(rewardState.reward.expires_at) &&
    !rewardState.unavailableReason &&
    rewardStampThresholdMet(
      rewardState.reward.source,
      rewardState.membership.current_stamp_count,
      rewardState.loyaltyCard.stamps_required
    ) &&
    isRedeemableFrom(rewardState.reward.redeemable_from)

  if (!redeemable) {
    return new NextResponse("Reward QR not ready", { status: 404 })
  }

  const profile = await getCustomerProfileCompletion()
  if (!profile?.complete) {
    return new NextResponse("Reward QR not ready", { status: 404 })
  }

  const token = await createRewardScanToken({
    rewardId,
    customerId: rewardState.customerId,
  })
  const scanUrl = `${getCanonicalAppOrigin()}/r/${token.scanToken}`
  const png = await renderQrCodePng(scanUrl)

  return new NextResponse(toArrayBuffer(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, no-store",
    },
  })
}

function toArrayBuffer(bytes: Uint8Array) {
  const arrayBuffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(arrayBuffer).set(bytes)
  return arrayBuffer
}
