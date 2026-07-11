import Link from "next/link"
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons"
import { notFound } from "next/navigation"

import { Icon, PageTitle, ReceiptCard } from "@/components/brand"
import { StatusBanner } from "@/components/loyalty/status-banner"
import { A4Poster } from "@/components/merchant/qr-poster/a4-poster"
import { Button } from "@/components/ui/button"
import { getServerEnv } from "@/lib/env/server"
import { getOwnedQrImageContext } from "@/lib/merchant/qr-code"
import { resolveQrReturnBase } from "@/lib/merchant/qr-nav"
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
    readonly from?: string | readonly string[]
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
    const png = await renderQrCodePng(shareUrl, 900)
    qrDataUrl = `data:image/png;base64,${png.toString("base64")}`
  } catch {
    return <PosterRenderError backHref={backHref} />
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

/**
 * Wet Ink failure surface for a transient QR-PNG render error — the only
 * on-screen state besides a valid poster. The QR is generated server-side and
 * the upstream QrPanel already gates on a live QR, so this is a rare fallback
 * rather than an unstyled 500.
 */
function PosterRenderError({ backHref }: { readonly backHref: string }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--w-paper)] p-6">
      <ReceiptCard className="grid w-full max-w-md gap-4" edge>
        <PageTitle
          eyebrow="Counter poster"
          title="Poster could not be generated"
          description="The QR image failed to render just now. This is usually momentary — head back and reopen the poster."
          titleClassName="sm:text-2xl"
        />
        <StatusBanner tone="error" title="QR render failed.">
          If it keeps happening, check the venue QR is still live on the poster
          page.
        </StatusBanner>
        <Button asChild variant="outline" className="w-fit">
          <Link href={backHref}>
            <Icon icon={ArrowLeft01Icon} size={16} />
            Back to QR
          </Link>
        </Button>
      </ReceiptCard>
    </main>
  )
}

function firstSearchValue(value: string | readonly string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null
  }

  return value ?? null
}
