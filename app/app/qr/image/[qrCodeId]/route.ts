import { NextResponse } from "next/server"

import { getCanonicalAppOrigin } from "@/lib/env/app-origin"
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

export async function GET(request: Request, context: QrImageRouteContext) {
  const { qrCodeId } = await context.params

  if (
    process.env.NODE_ENV !== "production" &&
    qrCodeId === DEV_HARNESS_QR_CODE_ID
  ) {
    const png = await renderQrCodePng(
      DEV_HARNESS_QR_SHARE_URL,
      parseQrImageWidth(new URL(request.url).searchParams.get("w"))
    )
    return qrPngResponse(png)
  }

  const qrContext = await getOwnedQrImageContext(qrCodeId)

  if (!qrContext) {
    return new NextResponse("QR code not found", { status: 404 })
  }

  const shareUrl = `${getCanonicalAppOrigin()}/q/${qrContext.qrCode.qr_id}`
  const png = await renderQrCodePng(
    shareUrl,
    parseQrImageWidth(new URL(request.url).searchParams.get("w"))
  )

  return qrPngResponse(png)
}

function parseQrImageWidth(value: string | null) {
  const parsed = Number.parseInt(value ?? "", 10)
  if (!Number.isFinite(parsed)) {
    return 720
  }

  return Math.min(1024, Math.max(128, parsed))
}

function qrPngResponse(png: Uint8Array) {
  return new NextResponse(toArrayBuffer(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, max-age=86400, immutable",
    },
  })
}

function toArrayBuffer(bytes: Uint8Array) {
  const arrayBuffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(arrayBuffer).set(bytes)
  return arrayBuffer
}
