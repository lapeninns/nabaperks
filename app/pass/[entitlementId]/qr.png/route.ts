import { NextResponse } from "next/server"

import { loadCustomerOfferPass } from "@/lib/customer/offer-pass"
import { getServerEnv } from "@/lib/env/server"
import { mintOfferPassScanToken } from "@/lib/offers/pass-tokens"
import { offerPassScanUrl } from "@/lib/offers/pass-qr"
import { renderQrCodePng } from "@/lib/qr/assets"

/**
 * The discount-pass QR as bytes.
 *
 * Gate BEFORE mint: the requester's ownership of the entitlement, the pass's
 * own state and the venue's availability are all settled by
 * `loadCustomerOfferPass` before a single scan token is created. Minting first
 * and checking afterwards would leave live bearer rows behind every probe of
 * this path.
 *
 * The token encoded here is bearer material with a ten-minute life, so the
 * bytes are `private, no-store` and the client refetches this route every half
 * TTL. Every fetch re-runs the gate, which is what stops a pass that has just
 * been withdrawn from continuing to render a working code.
 *
 * Mirrors `app/reward/[rewardId]/qr.png/route.ts`.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type OfferPassQrRouteContext = {
  params: Promise<{ entitlementId: string }>
}

export async function GET(
  _request: Request,
  context: OfferPassQrRouteContext
): Promise<NextResponse> {
  const { entitlementId } = await context.params
  const result = await loadCustomerOfferPass(entitlementId)

  if (result.status !== "ready" || !result.pass.presentable) {
    return notAvailable()
  }

  const token = await mintOfferPassScanToken(entitlementId, result.customerId)
  if (!token) {
    return notAvailable()
  }

  const scanUrl = offerPassScanUrl(
    getServerEnv().NEXT_PUBLIC_APP_URL,
    token.scanToken
  )
  const png = await renderQrCodePng(scanUrl)

  return new NextResponse(toArrayBuffer(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, no-store",
    },
  })
}

function notAvailable(): NextResponse {
  return new NextResponse("Pass QR not available", { status: 404 })
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const arrayBuffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(arrayBuffer).set(bytes)
  return arrayBuffer
}
