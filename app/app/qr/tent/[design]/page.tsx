import Link from "next/link"
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons"
import { notFound } from "next/navigation"

import { Icon, PageTitle, ReceiptCard } from "@/components/brand"
import { StatusBanner } from "@/components/loyalty/status-banner"
import { A4Tent } from "@/components/merchant/qr-poster/table-tent/a4-tent"
import { Button } from "@/components/ui/button"
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
    return <TentRenderError backHref={backHref} />
  }

  return (
    <A4Tent
      design={design.id}
      qrDataUrl={qrDataUrl}
      merchantName={qrContext.merchant.business_name}
      stampsRequired={qrContext.activeCard.stamps_required}
      backHref={backHref}
    />
  )
}

function TentRenderError({ backHref }: { readonly backHref: string }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--w-paper)] p-6">
      <ReceiptCard className="grid w-full max-w-md gap-4" edge>
        <PageTitle
          eyebrow="Table tent"
          title="Tent could not be generated"
          description="The QR image failed to render just now. This is usually momentary — head back and reopen the tent."
          titleClassName="sm:text-2xl"
        />
        <StatusBanner tone="error" title="QR render failed.">
          If it keeps happening, check the venue QR is still live on the QR
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
