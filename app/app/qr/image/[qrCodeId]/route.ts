import { NextResponse } from "next/server"

import { getServerEnv } from "@/lib/env/server"
import { getOwnedQrImageContext } from "@/lib/merchant/qr-code"
import { renderQrCodePng } from "@/lib/qr/assets"

export const runtime = "nodejs"

const DEV_HARNESS_QR_CODE_ID = "qr_harness"
const DEV_HARNESS_QR_SHARE_URL = "https://nabaperks.com/q/old-crown-girton"

type QrImageRouteContext = {
  params: Promise<{
    qrCodeId: string
  }>
}

export async function GET(_request: Request, context: QrImageRouteContext) {
  const { qrCodeId } = await context.params

  if (
    process.env.NODE_ENV !== "production" &&
    qrCodeId === DEV_HARNESS_QR_CODE_ID
  ) {
    const png = await renderQrCodePng(DEV_HARNESS_QR_SHARE_URL)
    return qrPngResponse(png)
  }

  const qrContext = await getOwnedQrImageContext(qrCodeId)

  if (!qrContext) {
    return new NextResponse("QR code not found", { status: 404 })
  }

  const env = getServerEnv()
  const shareUrl = `${env.NEXT_PUBLIC_APP_URL}/q/${qrContext.qrCode.qr_id}`
  const png = await renderQrCodePng(shareUrl)

  return qrPngResponse(png)
}

function qrPngResponse(png: Uint8Array) {
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
