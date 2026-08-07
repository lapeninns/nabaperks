import { notFound } from "next/navigation"
import { headers } from "next/headers"

import { A4NfcSquare } from "@/components/merchant/qr-poster/nfc-square/a4-nfc-square"
import { renderPosterQrCodePng } from "@/lib/qr/assets"
import { appendQrShareChannel } from "@/lib/qr/nfc-card-share-url"
import { resolveNfcDestination } from "@/lib/qr/nfc-destination"
import { resolvePreviewShareOrigin } from "@/lib/qr/preview-share-origin"
import {
  getNfcSquareDesign,
  NFC_SQUARE_DESIGN_IDS,
  type NfcSquareDesignId,
} from "@/lib/qr/nfc-square-templates"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type NfcSquarePreviewPageProps = {
  readonly searchParams: Promise<{
    readonly design?: string | readonly string[]
    readonly locality?: string | readonly string[]
    readonly qr?: string | readonly string[]
    readonly review?: string | readonly string[]
    readonly venue?: string | readonly string[]
    readonly stamps?: string | readonly string[]
    readonly origin?: string | readonly string[]
  }>
}

const PREVIEW_DEFAULTS = {
  locality: "Girton",
  merchantName: "Old Crown Girton",
  stampsRequired: 3,
  sharePath: "old-crown-girton",
  googleReviewUrl:
    "https://search.google.com/local/writereview?placeid=ChIJr-Lmrdt22EcRpM90SQtZug4",
}

export default async function NfcSquarePreviewPage({
  searchParams,
}: NfcSquarePreviewPageProps) {
  if (process.env.NODE_ENV === "production") {
    notFound()
  }

  const query = await searchParams
  const designParam = firstSearchValue(query.design)
  const sharePath = firstSearchValue(query.qr) ?? PREVIEW_DEFAULTS.sharePath
  const merchantName =
    firstSearchValue(query.venue)?.trim().slice(0, 120) ||
    PREVIEW_DEFAULTS.merchantName
  const locality =
    firstSearchValue(query.locality)?.trim().slice(0, 120) ||
    PREVIEW_DEFAULTS.locality
  const stampsRequired = previewStamps(firstSearchValue(query.stamps))
  const requestHeaders = await headers()
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host")
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http"
  const origin = resolvePreviewShareOrigin({
    override: firstSearchValue(query.origin),
    host,
    protocol,
  })
  const shareUrl = appendQrShareChannel(`${origin}/q/${sharePath}`, "qr")
  const googleReviewUrl =
    firstSearchValue(query.review) ?? PREVIEW_DEFAULTS.googleReviewUrl

  async function renderSquare(design: NfcSquareDesignId) {
    const destinationUrl = resolveNfcDestination({
      designId: design,
      joinUrl: shareUrl,
      googleReviewUrl,
    })
    if (!destinationUrl) {
      throw new Error("Preview Google review URL is invalid")
    }
    const png = await renderPosterQrCodePng(destinationUrl, 900)
    const qrDataUrl = `data:image/png;base64,${png.toString("base64")}`
    return (
      <A4NfcSquare
        design={design}
        qrDataUrl={qrDataUrl}
        merchantName={merchantName}
        locality={locality}
        stampsRequired={stampsRequired}
      />
    )
  }

  if (designParam) {
    const design = getNfcSquareDesign(designParam)
    if (!design) {
      notFound()
    }
    return renderSquare(design.id)
  }

  const squares = await Promise.all(
    NFC_SQUARE_DESIGN_IDS.map(async (design) => ({
      design,
      square: await renderSquare(design),
    }))
  )

  return (
    <div className="grid gap-16 bg-[var(--w-paper)] py-10">
      {squares.map(({ design, square }) => (
        <section key={design} className="grid gap-3">
          <p className="text-center font-mono text-xs font-bold tracking-code text-[var(--w-ink-soft)] uppercase">
            {getNfcSquareDesign(design)?.name ?? design} square NFC
          </p>
          {square}
        </section>
      ))}
    </div>
  )
}

function firstSearchValue(value: string | readonly string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null
  }
  return value ?? null
}

function previewStamps(value: string | null): number {
  if (!value) return PREVIEW_DEFAULTS.stampsRequired
  const stamps = Number(value)
  return Number.isInteger(stamps) && stamps >= 1 && stamps <= 6
    ? stamps
    : PREVIEW_DEFAULTS.stampsRequired
}
