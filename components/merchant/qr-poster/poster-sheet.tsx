import type { QrPosterTemplateId } from "@/lib/qr/poster-templates"

import { PosterDesignSheet } from "./poster-renderer-registry"

export type PosterSheetProps = {
  readonly template: QrPosterTemplateId
  readonly qrDataUrl: string
  readonly merchantName: string
  readonly stampsRequired: number
}

export function PosterSheet(props: PosterSheetProps) {
  return <PosterDesignSheet {...props} />
}
