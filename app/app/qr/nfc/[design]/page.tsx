import { A4NfcCard } from "@/components/merchant/qr-poster/nfc-card/a4-nfc-card"
import { PrintAssetError } from "@/components/merchant/qr-poster/print-asset-error"
import { getServerEnv } from "@/lib/env/server"
import {
  renderPrintAssetQr,
  resolvePrintAssetRequest,
} from "@/lib/merchant/print-asset-route"
import { appendQrShareChannel } from "@/lib/qr/nfc-card-share-url"
import { resolveNfcDestination } from "@/lib/qr/nfc-destination"
import { getNfcCardDesign } from "@/lib/qr/nfc-card-templates"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type QrNfcCardPageProps = {
  readonly params: Promise<{ readonly design: string }>
  readonly searchParams: Promise<{
    readonly qr?: string | readonly string[]
    readonly from?: string | readonly string[]
  }>
}

export default async function QrNfcCardPage({
  params,
  searchParams,
}: QrNfcCardPageProps) {
  const { design, qrCodeId, backHref, qrContext } =
    await resolvePrintAssetRequest({
      params,
      searchParams,
      paramKey: "design",
      getDesign: getNfcCardDesign,
    })

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
      <PrintAssetError kind="nfc" reason="review-link" backHref={backHref} />
    )
  }

  const rendered = await renderPrintAssetQr(destinationUrl)

  if (!rendered.ok) {
    return <PrintAssetError kind="nfc" reason="render" backHref={backHref} />
  }

  return (
    <A4NfcCard
      design={design.id}
      qrDataUrl={rendered.qrDataUrl}
      merchantName={qrContext.merchant.business_name}
      locality={qrContext.merchant.locals}
      stampsRequired={qrContext.activeCard.stamps_required}
      qrCodeId={qrCodeId}
      backHref={backHref}
    />
  )
}
