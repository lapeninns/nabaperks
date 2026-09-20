import { NextResponse } from "next/server"

import { getCustomerRewardState } from "@/lib/customer/reward"
import { createRewardScanToken } from "@/lib/customer/reward-scan-token"
import { getCustomerProfileCompletion } from "@/lib/customer/profile"
import { isCollectionSetupBlock } from "@/lib/customer/reward-collection-state"
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

  // A setup block (profile, verified email, in-person photo ID) is cleared on
  // the reward page or at the counter, so the code itself is still served; the
  // profile check below still refuses an incomplete profile.
  const setupBlocked =
    rewardState.collection.state === "blocked" &&
    isCollectionSetupBlock(rewardState.collection.reason)
  const availability = setupBlocked
    ? ({ status: "ready" } as const)
    : rewardQrAvailability({
        collectionState: rewardState.collection.state,
        collectionReason: rewardState.collection.reason,
        availableFrom: rewardState.collection.availableFrom,
      })

  if (availability.status !== "ready") {
    return NextResponse.json(
      {
        state: rewardState.collection.state,
        reason: rewardState.collection.reason,
        availableFrom: rewardState.collection.availableFrom,
      },
      { status: 409, headers: { "Cache-Control": "private, no-store" } }
    )
  }

  const profile = await getCustomerProfileCompletion()
  if (!profile?.complete) {
    return NextResponse.json(
      {
        state: "blocked",
        reason: "Complete your profile before collecting this reward.",
        availableFrom: rewardState.collection.availableFrom,
      },
      { status: 409, headers: { "Cache-Control": "private, no-store" } }
    )
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
