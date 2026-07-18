import { resolveStudioTentContent } from "@/lib/qr/poster-content"

import { BoldTentFace } from "./faces/bold-face"
import { EditorialTentFace } from "./faces/editorial-face"
import { TableTentSheet } from "./faces/shared"

/**
 * Table tent — Studio: Editorial (bottom) + Bold (top).
 */

type TableTentStudioPosterProps = {
  readonly qrDataUrl: string
  readonly businessName: string
  readonly stampsRequired: number
}

export function TableTentStudioPoster({
  qrDataUrl,
  businessName,
  stampsRequired,
}: TableTentStudioPosterProps) {
  const geometry = resolveStudioTentContent(stampsRequired).geometry
  const faceProps = { qrDataUrl, businessName, stampsRequired }

  return (
    <TableTentSheet
      top={<BoldTentFace {...faceProps} />}
      bottom={<EditorialTentFace {...faceProps} />}
      geometry={geometry}
    />
  )
}
