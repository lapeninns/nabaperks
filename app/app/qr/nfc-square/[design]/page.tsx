import Link from "next/link"
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons"
import { notFound } from "next/navigation"

import { Icon, PageTitle, ReceiptCard } from "@/components/brand"
import { StatusBanner } from "@/components/loyalty/status-banner"
import { A4NfcSquare } from "@/components/merchant/qr-poster/nfc-square/a4-nfc-square"
import { Button } from "@/components/ui/button"
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
    return <NfcSquareReviewSetupError backHref={backHref} />
  }

  let qrDataUrl: string
  try {
    const png = await renderPosterQrCodePng(destinationUrl, 900)
    qrDataUrl = `data:image/png;base64,${png.toString("base64")}`
  } catch {
    return <NfcSquareRenderError backHref={backHref} />
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

function NfcSquareReviewSetupError({
  backHref,
}: {
  readonly backHref: string
}) {
  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--w-paper)] p-6">
      <ReceiptCard className="grid w-full max-w-md gap-4" edge>
        <PageTitle
          eyebrow="Google Review plate"
          title="Add the venue review link first"
          description="This plate needs a valid Google review destination so its tap point and QR code never send guests to the wrong place."
          titleClassName="sm:text-2xl"
        />
        <StatusBanner tone="error" title="Google review link missing.">
          Add the venue&apos;s Google review link, then reopen this plate.
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

function NfcSquareRenderError({ backHref }: { readonly backHref: string }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--w-paper)] p-6">
      <ReceiptCard className="grid w-full max-w-md gap-4" edge>
        <PageTitle
          eyebrow="Square NFC"
          title="Card could not be generated"
          description="The QR image failed to render just now. This is usually momentary — head back and reopen the card."
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
