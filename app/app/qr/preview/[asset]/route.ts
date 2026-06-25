import { NextResponse } from "next/server"

import { getServerEnv } from "@/lib/env/server"
import { getOwnedQrAssetContext } from "@/lib/merchant/qr-code"
import { loadReadyQrAssetBytes } from "@/lib/qr/asset-store"
import {
  assetFilename,
  assetKindFromSlug,
  renderQrAssetPng,
  renderQrPosterPng,
  type QrAssetContext,
} from "@/lib/qr/assets"

export const runtime = "nodejs"

type QrPreviewRouteContext = {
  params: Promise<{
    asset: string
  }>
}

export async function GET(request: Request, context: QrPreviewRouteContext) {
  const { asset } = await context.params
  const assetKind = assetKindFromSlug(asset)
  const qrCodeId = new URL(request.url).searchParams.get("qr")

  if (!assetKind || !qrCodeId) {
    return new NextResponse("QR asset preview not found", { status: 404 })
  }

  const qrContext = await getOwnedQrAssetContext(qrCodeId)

  if (!qrContext) {
    return new NextResponse("QR code not found", { status: 404 })
  }

  const env = getServerEnv()
  const assetContext: QrAssetContext = {
    shareUrl: `${env.NEXT_PUBLIC_APP_URL}/q/${qrContext.qrCode.qr_id}`,
    qrPublicId: qrContext.qrCode.qr_id,
    merchantName: qrContext.merchant.business_name,
    locationName: qrContext.location.name,
    cardName: qrContext.activeCard.card_name,
    rewardName: qrContext.activeCard.reward_name,
    isActive: qrContext.qrCode.is_active,
  }

  // Till-card and sticker previews serve the stored PNG when ready; the poster
  // preview stays on the SVG renderer because the stored poster is a PDF.
  const storedBytes =
    assetKind === "poster_pdf"
      ? null
      : await loadReadyQrAssetBytes(qrContext.qrCode.id, assetKind)
  const body =
    storedBytes ??
    (assetKind === "poster_pdf"
      ? await renderQrPosterPng(assetContext)
      : await renderQrAssetPng(assetKind, assetContext))

  return new NextResponse(toArrayBuffer(body), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `inline; filename="preview-${assetFilename(
        assetKind,
        qrContext.qrCode.qr_id
      ).replace(/\.pdf$/, ".png")}"`,
      "Cache-Control": "private, no-store",
    },
  })
}

function toArrayBuffer(bytes: Uint8Array) {
  const arrayBuffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(arrayBuffer).set(bytes)
  return arrayBuffer
}
