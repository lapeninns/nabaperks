import { notFound } from "next/navigation"
import { headers } from "next/headers"

import { A4Poster } from "@/components/merchant/qr-poster/a4-poster"
import { renderPosterQrCodePng } from "@/lib/qr/assets"
import { resolvePreviewShareOrigin } from "@/lib/qr/preview-share-origin"
import {
  getQrPosterTemplate,
  QR_POSTER_TEMPLATE_IDS,
} from "@/lib/qr/poster-templates"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type PosterPreviewPageProps = {
  readonly searchParams: Promise<{
    readonly template?: string | readonly string[]
    readonly qr?: string | readonly string[]
    readonly venue?: string | readonly string[]
    readonly stamps?: string | readonly string[]
    readonly origin?: string | readonly string[]
  }>
}

const PREVIEW_DEFAULTS = {
  merchantName: "Old Crown Girton",
  stampsRequired: 3,
  sharePath: "old-crown-girton",
}

export default async function PosterPreviewPage({
  searchParams,
}: PosterPreviewPageProps) {
  if (process.env.NODE_ENV === "production") {
    notFound()
  }

  const query = await searchParams
  const templateParam = firstSearchValue(query.template)
  const sharePath = firstSearchValue(query.qr) ?? PREVIEW_DEFAULTS.sharePath
  const merchantName =
    firstSearchValue(query.venue)?.trim().slice(0, 120) ||
    PREVIEW_DEFAULTS.merchantName
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
  const shareUrl = `${origin}/q/${sharePath}`
  const png = await renderPosterQrCodePng(shareUrl, 900)
  const qrDataUrl = `data:image/png;base64,${png.toString("base64")}`

  const posterProps = {
    qrDataUrl,
    shareUrl,
    merchantName,
    stampsRequired,
  }

  if (templateParam) {
    const template = getQrPosterTemplate(templateParam)

    if (!template) {
      notFound()
    }

    return (
      <A4Poster
        template={template.id}
        showSidebarTrigger={false}
        {...posterProps}
      />
    )
  }

  return (
    <div className="grid gap-16 bg-[var(--w-paper)] py-10">
      {QR_POSTER_TEMPLATE_IDS.map((template) => (
        <section key={template} className="grid gap-3">
          {/* Eyebrows use the customer-facing display name (Night card,
              Receipt, …), matching the poster picker — internal template ids
              stay out of rendered copy. */}
          <p className="text-center font-mono text-xs font-bold tracking-[0.16em] text-[var(--w-ink-soft)] uppercase">
            {getQrPosterTemplate(template)?.name ?? template} template
          </p>
          <A4Poster
            template={template}
            showSidebarTrigger={false}
            {...posterProps}
          />
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
