import type { ComponentType, ReactNode } from "react"

import type { QrPosterTemplateId } from "@/lib/qr/poster-templates"

import styles from "./a4-poster.module.css"
import { NorthStarPoster } from "./northstar/northstar-poster"
import {
  a4PosterStyle,
  type CopyPosterTemplateId,
  getPosterCopy,
} from "./poster-copy"
import { BoldPoster, EditorialPoster, TicketPoster } from "./poster-variants"
import { ThermalPoster } from "./thermal/thermal-poster"

export type PosterRendererProps = {
  readonly qrDataUrl: string
  readonly merchantName: string
  readonly stampsRequired: number
}

type CopyDrivenSheetProps = PosterRendererProps & {
  readonly template: CopyPosterTemplateId
}

const TEMPLATE_CLASS_NAMES: Record<CopyPosterTemplateId, string> = {
  editorial: styles.editorial,
  bold: `${styles.bold} dark`,
  ticket: styles.ticket,
}

function CopyDrivenSheet({
  template,
  qrDataUrl,
  merchantName,
  stampsRequired,
}: CopyDrivenSheetProps) {
  const copy = getPosterCopy(
    { businessName: merchantName, stampsRequired },
    template
  )
  const posterByTemplate = {
    editorial: <EditorialPoster copy={copy} qrDataUrl={qrDataUrl} />,
    bold: <BoldPoster copy={copy} qrDataUrl={qrDataUrl} />,
    ticket: <TicketPoster copy={copy} qrDataUrl={qrDataUrl} />,
  } satisfies Record<CopyPosterTemplateId, ReactNode>

  return (
    <article
      className={`${styles.sheet} ${TEMPLATE_CLASS_NAMES[template]}`}
      style={{
        ...a4PosterStyle(copy),
        width: `${copy.geometry.sheetWidthMm}mm`,
        height: `${copy.geometry.sheetHeightMm}mm`,
        minHeight: `${copy.geometry.sheetHeightMm}mm`,
        maxHeight: `${copy.geometry.sheetHeightMm}mm`,
      }}
    >
      {posterByTemplate[template]}
    </article>
  )
}

function EditorialSheet(props: PosterRendererProps) {
  return <CopyDrivenSheet {...props} template="editorial" />
}

function BoldSheet(props: PosterRendererProps) {
  return <CopyDrivenSheet {...props} template="bold" />
}

function TicketSheet(props: PosterRendererProps) {
  return <CopyDrivenSheet {...props} template="ticket" />
}

function NightCardSheet({ merchantName, ...props }: PosterRendererProps) {
  return <NorthStarPoster {...props} businessName={merchantName} />
}

function ReceiptSheet({ merchantName, ...props }: PosterRendererProps) {
  return <ThermalPoster {...props} businessName={merchantName} />
}

const POSTER_BROWSER_RENDERERS = {
  editorial: EditorialSheet,
  bold: BoldSheet,
  ticket: TicketSheet,
  northstar: NightCardSheet,
  thermal: ReceiptSheet,
} satisfies Record<QrPosterTemplateId, ComponentType<PosterRendererProps>>

export function PosterDesignSheet({
  template,
  ...props
}: PosterRendererProps & { readonly template: QrPosterTemplateId }) {
  const Renderer = POSTER_BROWSER_RENDERERS[template]
  return <Renderer {...props} />
}
