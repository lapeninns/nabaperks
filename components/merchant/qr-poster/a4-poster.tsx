import type { ReactNode } from "react"

import type { QrPosterTemplateId } from "@/lib/qr/poster-templates"

import styles from "./a4-poster.module.css"
import { getPosterCopy } from "./poster-copy"
import { PrintToolbar } from "./print-toolbar"
import { BoldPoster, EditorialPoster, TicketPoster } from "./poster-variants"

type A4PosterProps = {
  readonly template: QrPosterTemplateId
  readonly qrDataUrl: string
  readonly shareUrl: string
  readonly merchantName: string
  readonly locationName: string
  readonly cardName: string
  readonly stampsRequired: number
}

const TEMPLATE_CLASS_NAMES: Record<QrPosterTemplateId, string> = {
  editorial: styles.editorial,
  bold: styles.bold,
  ticket: styles.ticket,
}

export function A4Poster({
  template,
  qrDataUrl,
  stampsRequired,
}: A4PosterProps) {
  const copy = getPosterCopy(stampsRequired)
  const posterByTemplate: Record<QrPosterTemplateId, ReactNode> = {
    editorial: <EditorialPoster copy={copy} qrDataUrl={qrDataUrl} />,
    bold: <BoldPoster copy={copy} qrDataUrl={qrDataUrl} />,
    ticket: <TicketPoster copy={copy} qrDataUrl={qrDataUrl} />,
  }

  return (
    <main className={`${styles.page} qr-poster-print-root`}>
      <PrintToolbar backHref="/app/launch?tab=qr" />
      <article className={`${styles.sheet} ${TEMPLATE_CLASS_NAMES[template]}`}>
        {posterByTemplate[template]}
      </article>
    </main>
  )
}
