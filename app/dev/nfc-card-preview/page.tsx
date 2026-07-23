import { notFound } from "next/navigation"
import { headers } from "next/headers"

import { A4NfcCard } from "@/components/merchant/qr-poster/nfc-card/a4-nfc-card"
import { renderPosterQrCodePng } from "@/lib/qr/assets"
import { appendQrShareChannel } from "@/lib/qr/nfc-card-share-url"
import {
  getNfcCardDesign,
  NFC_CARD_DESIGN_IDS,
} from "@/lib/qr/nfc-card-templates"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type NfcCardPreviewPageProps = {
  readonly searchParams: Promise<{
    readonly design?: string | readonly string[]
    readonly qr?: string | readonly string[]
    readonly venue?: string | readonly string[]
    readonly stamps?: string | readonly string[]
  }>
}

const PREVIEW_DEFAULTS = {
  merchantName: "Old Crown Girton",
  stampsRequired: 3,
  sharePath: "old-crown-girton",
}

export default async function NfcCardPreviewPage({
  searchParams,
}: NfcCardPreviewPageProps) {
  if (process.env.NODE_ENV === "production") {
    notFound()
  }

  const query = await searchParams
  const designParam = firstSearchValue(query.design)
  const sharePath = firstSearchValue(query.qr) ?? PREVIEW_DEFAULTS.sharePath
  const merchantName =
    firstSearchValue(query.venue)?.trim().slice(0, 120) ||
    PREVIEW_DEFAULTS.merchantName
  const stampsRequired = previewStamps(firstSearchValue(query.stamps))
  const requestHeaders = await headers()
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host")
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http"
  const origin = host ? `${protocol}://${host}` : "http://127.0.0.1:3146"
  const shareUrl = appendQrShareChannel(`${origin}/q/${sharePath}`, "qr")
  const png = await renderPosterQrCodePng(shareUrl, 900)
  const qrDataUrl = `data:image/png;base64,${png.toString("base64")}`

  const cardProps = { qrDataUrl, merchantName, stampsRequired }

  if (designParam) {
    const design = getNfcCardDesign(designParam)
    if (!design) {
      notFound()
    }
    return <A4NfcCard design={design.id} {...cardProps} />
  }

  return (
    <div className="grid gap-16 bg-[var(--w-paper)] py-10">
      {NFC_CARD_DESIGN_IDS.map((design) => (
        <section key={design} className="grid gap-3">
          <p className="text-center font-mono text-xs font-bold tracking-[0.16em] text-[var(--w-ink-soft)] uppercase">
            {getNfcCardDesign(design)?.name ?? design} NFC card
          </p>
          <A4NfcCard design={design} {...cardProps} />
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
