import { NextResponse } from "next/server"

import { capturePostHogEvent } from "@/lib/analytics/events"
import { getServerEnv } from "@/lib/env/server"
import { getOwnedQrAssetContext } from "@/lib/merchant/qr-code"
import {
  assetFilename,
  assetKindFromSlug,
  renderQrAssetPng,
  renderQrPosterPdf,
  type QrAssetContext,
} from "@/lib/qr/assets"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

type QrDownloadRouteContext = {
  params: Promise<{
    asset: string
  }>
}

export async function GET(request: Request, context: QrDownloadRouteContext) {
  const { asset } = await context.params
  const assetKind = assetKindFromSlug(asset)
  const qrCodeId = new URL(request.url).searchParams.get("qr")

  if (!assetKind || !qrCodeId) {
    return new NextResponse("QR asset not found", { status: 404 })
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
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc("record_qr_download", {
    p_merchant_id: qrContext.merchant.id,
    p_qr_code_id: qrContext.qrCode.id,
    p_asset_type: assetKind,
  })

  if (error) {
    return new NextResponse("QR download could not be recorded.", { status: 500 })
  }

  await capturePostHogEvent({
    eventName: "qr_downloaded",
    merchantId: qrContext.merchant.id,
    qrCodeId: qrContext.qrCode.id,
    actorType: "merchant",
    actorId: qrContext.merchant.id,
    metadata: { asset_type: assetKind },
  })

  const body =
    assetKind === "poster_pdf"
      ? await renderQrPosterPdf(assetContext)
      : await renderQrAssetPng(assetKind, assetContext)
  const contentType = assetKind === "poster_pdf" ? "application/pdf" : "image/png"

  return new NextResponse(toArrayBuffer(body), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${assetFilename(
        assetKind,
        qrContext.qrCode.qr_id
      )}"`,
      "Cache-Control": "private, no-store",
    },
  })
}

function toArrayBuffer(bytes: Uint8Array) {
  const arrayBuffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(arrayBuffer).set(bytes)
  return arrayBuffer
}
