import { resolveNightTentContent } from "@/lib/qr/poster-content"

import { NightTentFace } from "./faces/night-face"
import { ReceiptTentFace } from "./faces/receipt-face"
import { TableTentSheet } from "./faces/shared"

/**
 * Table tent — Night: Night card (bottom) + Receipt (top).
 */

type TableTentNightPosterProps = {
  readonly qrDataUrl: string
  readonly businessName: string
  readonly stampsRequired: number
}

export function TableTentNightPoster({
  qrDataUrl,
  businessName,
  stampsRequired,
}: TableTentNightPosterProps) {
  const geometry = resolveNightTentContent(stampsRequired).geometry
  const faceProps = { qrDataUrl, businessName, stampsRequired }

  return (
    <TableTentSheet
      top={<ReceiptTentFace {...faceProps} />}
      bottom={<NightTentFace {...faceProps} />}
      geometry={geometry}
    />
  )
}
