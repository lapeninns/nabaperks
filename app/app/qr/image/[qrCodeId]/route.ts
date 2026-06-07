import { NextResponse } from "next/server"

import { getServerEnv } from "@/lib/env/server"
import { getOwnedQrAssetContext } from "@/lib/merchant/qr-code"
import { renderQrCodePng } from "@/lib/qr/assets"

export const runtime = "nodejs"

type QrImageRouteContext = {
  params: Promise<{
    qrCodeId: string
  }>
}

export async function GET(_request: Request, context: QrImageRouteContext) {
  const { qrCodeId } = await context.params
  const qrContext = await getOwnedQrAssetContext(qrCodeId)

  if (!qrContext) {
    return new NextResponse("QR code not found", { status: 404 })
  }

  const env = getServerEnv()
  const shareUrl = `${env.NEXT_PUBLIC_APP_URL}/q/${qrContext.qrCode.qr_id}`
  const png = await renderQrCodePng(shareUrl)

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
