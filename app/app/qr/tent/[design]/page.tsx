import { PrintAssetError } from "@/components/merchant/qr-poster/print-asset-error"
import { A4Tent } from "@/components/merchant/qr-poster/table-tent/a4-tent"
import { getServerEnv } from "@/lib/env/server"
import {
  renderPrintAssetQr,
  resolvePrintAssetRequest,
} from "@/lib/merchant/print-asset-route"
import { getTentDesign } from "@/lib/qr/tent-templates"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type QrTentPageProps = {
  readonly params: Promise<{ readonly design: string }>
  readonly searchParams: Promise<{
    readonly qr?: string | readonly string[]
    readonly from?: string | readonly string[]
  }>
}

export default async function QrTentPage({
  params,
  searchParams,
}: QrTentPageProps) {
  const { design, qrCodeId, backHref, qrContext } =
    await resolvePrintAssetRequest({
      params,
      searchParams,
      paramKey: "design",
      getDesign: getTentDesign,
    })

  const env = getServerEnv()
  const shareUrl = `${env.NEXT_PUBLIC_APP_URL}/q/${qrContext.qrCode.qr_id}`
  const rendered = await renderPrintAssetQr(shareUrl)

  if (!rendered.ok) {
    return <PrintAssetError kind="tent" reason="render" backHref={backHref} />
  }

  return (
    <A4Tent
      design={design.id}
      qrDataUrl={rendered.qrDataUrl}
      merchantName={qrContext.merchant.business_name}
      stampsRequired={qrContext.activeCard.stamps_required}
      qrCodeId={qrCodeId}
      backHref={backHref}
    />
  )
}
