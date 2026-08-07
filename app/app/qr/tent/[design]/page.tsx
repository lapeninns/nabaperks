import { notFound } from "next/navigation"

import { PrintAssetError } from "@/components/merchant/qr-poster/print-asset-error"
import { A4Tent } from "@/components/merchant/qr-poster/table-tent/a4-tent"
import { getServerEnv } from "@/lib/env/server"
import { getOwnedQrImageContext } from "@/lib/merchant/qr-code"
import { resolveQrReturnBase } from "@/lib/merchant/qr-nav"
import { renderPosterQrCodePng } from "@/lib/qr/assets"
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
  const [{ design: designId }, query] = await Promise.all([
    params,
    searchParams,
  ])
  const design = getTentDesign(designId)
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
  const shareUrl = `${env.NEXT_PUBLIC_APP_URL}/q/${qrContext.qrCode.qr_id}`

  let qrDataUrl: string
  try {
    const png = await renderPosterQrCodePng(shareUrl, 900)
    qrDataUrl = `data:image/png;base64,${png.toString("base64")}`
  } catch {
    return <PrintAssetError kind="tent" reason="render" backHref={backHref} />
  }

  return (
    <A4Tent
      design={design.id}
      qrDataUrl={qrDataUrl}
      merchantName={qrContext.merchant.business_name}
      stampsRequired={qrContext.activeCard.stamps_required}
      qrCodeId={qrCodeId}
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
