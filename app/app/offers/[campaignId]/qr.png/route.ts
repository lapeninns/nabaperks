import { NextResponse } from "next/server"

import { getCurrentMerchant } from "@/lib/auth/session"
import { getServerEnv } from "@/lib/env/server"
import { resolveOfferClaimLink } from "@/lib/merchant/offer-campaigns"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { renderQrCodePng } from "@/lib/qr/assets"

/**
 * The campaign QR as bytes, for the on-screen code and for the download button.
 *
 * The image encodes the confidential claim link, so it is treated as bearer
 * material: `private, no-store` keeps it out of every shared cache, and the row
 * is read through the merchant's own session so RLS proves ownership rather than
 * the campaign id in the path.
 *
 * The link is produced by `resolveOfferClaimLink`, which only ever returns a
 * candidate whose own hash matches the stored `claim_token_hash`. A campaign
 * whose link cannot be recovered — or one that has ended, where the token is
 * scrubbed — therefore renders no image at all rather than a code that leads
 * nowhere.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const QR_WIDTH_DEFAULT = 720
const QR_WIDTH_MIN = 128
const QR_WIDTH_MAX = 1024

type CampaignQrRouteContext = {
  params: Promise<{ campaignId: string }>
}

export async function GET(
  request: Request,
  context: CampaignQrRouteContext
): Promise<NextResponse> {
  const merchant = await getCurrentMerchant()
  if (!merchant) {
    return notAvailable()
  }

  const { campaignId } = await context.params
  const supabase = await createSupabaseServerClient()
  const { data: campaign } = await supabase
    .from("offer_campaigns")
    .select("id, token_generation, claim_token_hash, claim_token_ciphertext")
    .eq("id", campaignId)
    .eq("merchant_id", merchant.id)
    .maybeSingle()

  if (!campaign) {
    return notAvailable()
  }

  const claimToken = resolveOfferClaimLink({
    id: campaign.id,
    tokenGeneration: campaign.token_generation,
    claimTokenHash: campaign.claim_token_hash,
    claimTokenCiphertext: campaign.claim_token_ciphertext,
  })

  if (!claimToken) {
    return notAvailable()
  }

  const claimUrl = `${getServerEnv().NEXT_PUBLIC_APP_URL}/offer/${claimToken}`
  const url = new URL(request.url)
  const png = await renderQrCodePng(claimUrl, parseWidth(url))

  // Inline for the on-screen code; `?download=1` is the button, which asks the
  // browser to save rather than navigate away from the poster screen.
  const disposition =
    url.searchParams.get("download") === "1" ? "attachment" : "inline"

  return new NextResponse(toArrayBuffer(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, no-store",
      "Content-Disposition": `${disposition}; filename="offer-qr-${campaign.id}.png"`,
    },
  })
}

function notAvailable(): NextResponse {
  return new NextResponse("Campaign QR not found", { status: 404 })
}

function parseWidth(url: URL): number {
  const parsed = Number.parseInt(url.searchParams.get("w") ?? "", 10)
  if (!Number.isFinite(parsed)) return QR_WIDTH_DEFAULT
  return Math.min(QR_WIDTH_MAX, Math.max(QR_WIDTH_MIN, parsed))
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const arrayBuffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(arrayBuffer).set(bytes)
  return arrayBuffer
}
