import { notFound } from "next/navigation"

import { A4Poster } from "@/components/merchant/qr-poster/a4-poster"
import { renderQrCodePng } from "@/lib/qr/assets"
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
  }>
}

const PREVIEW_DEFAULTS = {
  merchantName: "Old Crown Girton",
  stampsRequired: 3,
  sharePath: "old-crown-girton",
} as const

export default async function PosterPreviewPage({
  searchParams,
}: PosterPreviewPageProps) {
  if (process.env.NODE_ENV === "production") {
    notFound()
  }

  const query = await searchParams
  const templateParam = firstSearchValue(query.template)
  const sharePath = firstSearchValue(query.qr) ?? PREVIEW_DEFAULTS.sharePath
  const shareUrl = `https://nabaperks.com/q/${sharePath}`
  const png = await renderQrCodePng(shareUrl, 900)
  const qrDataUrl = `data:image/png;base64,${png.toString("base64")}`

  const posterProps = {
    qrDataUrl,
    shareUrl,
    merchantName: PREVIEW_DEFAULTS.merchantName,
    stampsRequired: PREVIEW_DEFAULTS.stampsRequired,
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
          <p className="text-center font-mono text-xs font-bold tracking-[0.16em] uppercase text-[var(--w-ink-soft)]">
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
