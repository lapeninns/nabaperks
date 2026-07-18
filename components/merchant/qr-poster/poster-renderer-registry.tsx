import type { ComponentType } from "react"

import type { QrPosterTemplateId } from "@/lib/qr/poster-templates"

import { DuotonePoster } from "./counter-kit/duotone-poster"
import { LastcallPoster } from "./counter-kit/lastcall-poster"
import { PinnedPoster } from "./counter-kit/pinned-poster"
import { PrimerPoster } from "./counter-kit/primer-poster"
import { RoundPoster } from "./counter-kit/round-poster"
import { SealPoster } from "./counter-kit/seal-poster"
import { TallyPoster } from "./counter-kit/tally-poster"

export type PosterRendererProps = {
  readonly qrDataUrl: string
  readonly merchantName: string
  readonly stampsRequired: number
}

function PrimerSheet({ merchantName, ...props }: PosterRendererProps) {
  return <PrimerPoster {...props} businessName={merchantName} />
}

function GardenSheet({ merchantName, ...props }: PosterRendererProps) {
  return (
    <DuotonePoster template="garden" {...props} businessName={merchantName} />
  )
}

function WindowSheet({ merchantName, ...props }: PosterRendererProps) {
  return (
    <DuotonePoster template="window" {...props} businessName={merchantName} />
  )
}

function PinnedSheet({ merchantName, ...props }: PosterRendererProps) {
  return <PinnedPoster {...props} businessName={merchantName} />
}

function SealSheet({ merchantName, ...props }: PosterRendererProps) {
  return <SealPoster {...props} businessName={merchantName} />
}

function TallySheet({ merchantName, ...props }: PosterRendererProps) {
  return <TallyPoster {...props} businessName={merchantName} />
}

function RoundSheet({ merchantName, ...props }: PosterRendererProps) {
  return <RoundPoster {...props} businessName={merchantName} />
}

function LastcallSheet({ merchantName, ...props }: PosterRendererProps) {
  return <LastcallPoster {...props} businessName={merchantName} />
}

const POSTER_BROWSER_RENDERERS = {
  primer: PrimerSheet,
  garden: GardenSheet,
  window: WindowSheet,
  pinned: PinnedSheet,
  seal: SealSheet,
  tally: TallySheet,
  round: RoundSheet,
  lastcall: LastcallSheet,
} satisfies Record<QrPosterTemplateId, ComponentType<PosterRendererProps>>

export function PosterDesignSheet({
  template,
  ...props
}: PosterRendererProps & { readonly template: QrPosterTemplateId }) {
  const Renderer = POSTER_BROWSER_RENDERERS[template]
  return <Renderer {...props} />
}
