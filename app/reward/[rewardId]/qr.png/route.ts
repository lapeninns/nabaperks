import { NextResponse } from "next/server"

import { getCustomerRewardState } from "@/lib/customer/reward"
import { createRewardScanToken } from "@/lib/customer/reward-scan-token"
import { getCustomerProfileCompletion } from "@/lib/customer/profile"
import { rewardQrAvailability } from "@/lib/customer/reward-qr-eligibility"
import { getServerEnv } from "@/lib/env/server"
import { renderQrCodePng } from "@/lib/qr/assets"

export const runtime = "nodejs"

type RewardQrRouteContext = {
  params: Promise<{
    rewardId: string
  }>
}

export async function GET(_request: Request, context: RewardQrRouteContext) {
  const serverEnv = getServerEnv()
  const { rewardId } = await context.params
  const rewardState = await getCustomerRewardState(rewardId)

  if (rewardState.status !== "ready") {
    return new NextResponse("Reward QR not found", { status: 404 })
  }

  const availability = rewardQrAvailability({
    status: rewardState.reward.status,
    source: rewardState.reward.source,
    redeemableFrom: rewardState.reward.redeemable_from,
    expiresAt: rewardState.reward.expires_at,
    currentStampCount: rewardState.membership.current_stamp_count,
    stampsRequired: rewardState.loyaltyCard.stamps_required,
    unavailableReason: rewardState.unavailableReason,
  })

  if (availability.status !== "ready") {
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
  const scanUrl = `${serverEnv.NEXT_PUBLIC_APP_URL}/r/${token.scanToken}`
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
