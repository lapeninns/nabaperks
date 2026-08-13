import { notFound } from "next/navigation"

import { A4Poster } from "@/components/merchant/qr-poster/a4-poster"
import { PrintAssetError } from "@/components/merchant/qr-poster/print-asset-error"
import { getServerEnv } from "@/lib/env/server"
import { getOwnedQrImageContext } from "@/lib/merchant/qr-code"
import { firstSearchValue } from "@/lib/merchant/print-asset-route"
import { resolveQrReturnBase } from "@/lib/merchant/qr-nav"
import { renderPosterQrCodePng } from "@/lib/qr/assets"
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

/**
 * The poster print route.
 *
 * It does NOT go through `resolvePrintAssetRequest` / `renderPrintAssetQr` the
 * way the tent and the two NFC routes do, even though that helper takes
 * `paramKey: "template"` precisely for this caller.
 * `tests/contracts/qr-a4-poster-templates.test.mjs:67-68` asserts the literals
 * `getOwnedQrImageContext` and `renderPosterQrCodePng` inside THIS file, and
 * moving either call behind the helper deletes the literal while preserving the
 * behaviour. Rewording those assertions is a contract change to ask for, not to
 * take (03#37). The two halves that no assertion reaches — the duplicated
 * search-param reader and a seventh copy of the print-asset error surface —
 * are shared here.
 */
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
  // `from` is user-controllable, so it is only ever resolved through the
  // allowlist — the raw value never reaches a redirect or href. Defaults to the
  // canonical /app/qr poster home.
  const backHref = resolveQrReturnBase(firstSearchValue(query.from))

  if (!template || !qrCodeId) {
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
    return <PrintAssetError kind="poster" reason="render" backHref={backHref} />
  }

  return (
    <A4Poster
      template={template.id}
      qrDataUrl={qrDataUrl}
      shareUrl={shareUrl}
      merchantName={qrContext.merchant.business_name}
      stampsRequired={qrContext.activeCard.stamps_required}
      qrCodeId={qrCodeId}
      backHref={backHref}
    />
  )
}
