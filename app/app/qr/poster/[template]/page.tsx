import { A4Poster } from "@/components/merchant/qr-poster/a4-poster"
import { PrintAssetError } from "@/components/merchant/qr-poster/print-asset-error"
import { getServerEnv } from "@/lib/env/server"
import {
  renderPrintAssetQr,
  resolvePrintAssetRequest,
} from "@/lib/merchant/print-asset-route"
import { getQrPosterTemplate } from "@/lib/qr/poster-templates"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type QrPosterPageProps = {
  readonly params: Promise<{
    readonly template: string
  }>
  readonly searchParams: Promise<{
    readonly qr?: string | readonly string[]
    readonly from?: string | readonly string[]
  }>
}

export default async function QrPosterPage({
  params,
  searchParams,
}: QrPosterPageProps) {
  const {
    design: template,
    qrCodeId,
    backHref,
    qrContext,
  } = await resolvePrintAssetRequest({
    params,
    searchParams,
    paramKey: "template",
    getDesign: getQrPosterTemplate,
  })

  const env = getServerEnv()
  const shareUrl = `${env.NEXT_PUBLIC_APP_URL}/q/${qrContext.qrCode.qr_id}`
  const rendered = await renderPrintAssetQr(shareUrl)

  if (!rendered.ok) {
    return <PrintAssetError kind="poster" reason="render" backHref={backHref} />
  }

  return (
    <A4Poster
      template={template.id}
      qrDataUrl={rendered.qrDataUrl}
      shareUrl={shareUrl}
      merchantName={qrContext.merchant.business_name}
      stampsRequired={qrContext.activeCard.stamps_required}
      qrCodeId={qrCodeId}
      backHref={backHref}
    />
  )
}
