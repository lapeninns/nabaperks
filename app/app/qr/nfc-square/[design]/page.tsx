import { notFound } from "next/navigation"

import { A4NfcSquare } from "@/components/merchant/qr-poster/nfc-square/a4-nfc-square"
import { PrintAssetError } from "@/components/merchant/qr-poster/print-asset-error"
import { getServerEnv } from "@/lib/env/server"
import { getOwnedQrImageContext } from "@/lib/merchant/qr-code"
import { resolveQrReturnBase } from "@/lib/merchant/qr-nav"
import { renderPosterQrCodePng } from "@/lib/qr/assets"
import { appendQrShareChannel } from "@/lib/qr/nfc-card-share-url"
import { resolveNfcDestination } from "@/lib/qr/nfc-destination"
import { getNfcSquareDesign } from "@/lib/qr/nfc-square-templates"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type QrNfcSquarePageProps = {
  readonly params: Promise<{ readonly design: string }>
  readonly searchParams: Promise<{
    readonly qr?: string | readonly string[]
    readonly from?: string | readonly string[]
  }>
}

export default async function QrNfcSquarePage({
  params,
  searchParams,
}: QrNfcSquarePageProps) {
  const [{ design: designId }, query] = await Promise.all([
    params,
    searchParams,
  ])
  const design = getNfcSquareDesign(designId)
  const qrCodeId = firstSearchValue(query.qr)
  const backHref = resolveQrReturnBase(firstSearchValue(query.from))

  if (!design || !qrCodeId) {
    notFound()
  }

  const qrContext = await getOwnedQrImageContext(qrCodeId)

  if (!qrContext) {
    notFound()
  }

  const env = getServerEnv()
  const joinUrl = appendQrShareChannel(
    `${env.NEXT_PUBLIC_APP_URL}/q/${qrContext.qrCode.qr_id}`,
    "qr"
  )
  const destinationUrl = resolveNfcDestination({
    designId: design.id,
    joinUrl,
    googleReviewUrl: qrContext.merchant.pub_google_review,
  })

  if (!destinationUrl) {
    return (
      <PrintAssetError
        kind="nfc-square"
        reason="review-link"
        backHref={backHref}
      />
    )
  }

  let qrDataUrl: string
  try {
    const png = await renderPosterQrCodePng(destinationUrl, 900)
    qrDataUrl = `data:image/png;base64,${png.toString("base64")}`
  } catch {
    return (
      <PrintAssetError kind="nfc-square" reason="render" backHref={backHref} />
    )
  }

  return (
    <A4NfcSquare
      design={design.id}
      qrDataUrl={qrDataUrl}
      merchantName={qrContext.merchant.business_name}
      locality={qrContext.merchant.locals}
      stampsRequired={qrContext.activeCard.stamps_required}
      backHref={backHref}
    />
  )
}

function firstSearchValue(value: string | readonly string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null
  }
  return value ?? null
}
