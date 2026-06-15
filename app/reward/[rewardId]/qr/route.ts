import { NextResponse } from "next/server"

import { createRedemptionToken } from "@/lib/customer/redemption-token"
import { getServerEnv } from "@/lib/env/server"
import { renderQrCodePng } from "@/lib/qr/assets"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type RewardQrRouteContext = {
  params: Promise<{
    rewardId: string
  }>
}

export async function GET(_request: Request, context: RewardQrRouteContext) {
  const { rewardId } = await context.params
  const token = await createRedemptionToken(rewardId)
  const appUrl = getServerEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "")
  const png = await renderQrCodePng(`${appUrl}/r/${token.publicToken}`, 640)

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
