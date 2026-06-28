import { notFound } from "next/navigation"

import { A4Poster } from "@/components/merchant/qr-poster/a4-poster"
import { getServerEnv } from "@/lib/env/server"
import { getOwnedQrImageContext } from "@/lib/merchant/qr-code"
import { renderQrCodePng } from "@/lib/qr/assets"
import { getQrPosterTemplate } from "@/lib/qr/poster-templates"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type QrPosterPageProps = {
  readonly params: Promise<{
    readonly template: string
  }>
  readonly searchParams: Promise<{
    readonly qr?: string | readonly string[]
  }>
}

export default async function QrPosterPage({
  params,
  searchParams,
}: QrPosterPageProps) {
  const [{ template: templateId }, query] = await Promise.all([
    params,
    searchParams,
  ])
  const template = getQrPosterTemplate(templateId)
  const qrCodeId = firstSearchValue(query.qr)

  if (!template || !qrCodeId) {
    notFound()
  }

  const qrContext = await getOwnedQrImageContext(qrCodeId)

  if (!qrContext) {
    notFound()
  }

  const env = getServerEnv()
  const shareUrl = `${env.NEXT_PUBLIC_APP_URL}/q/${qrContext.qrCode.qr_id}`
  const png = await renderQrCodePng(shareUrl, 900)
  const qrDataUrl = `data:image/png;base64,${png.toString("base64")}`

  return (
    <A4Poster
      template={template.id}
      qrDataUrl={qrDataUrl}
      shareUrl={shareUrl}
      merchantName={qrContext.merchant.business_name}
      locationName={qrContext.location.name}
      cardName={qrContext.activeCard.card_name}
      stampsRequired={qrContext.activeCard.stamps_required}
    />
  )
}

function firstSearchValue(value: string | readonly string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null
  }

  return value ?? null
}
