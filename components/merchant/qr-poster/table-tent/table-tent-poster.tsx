import { resolveBaseTentContent } from "@/lib/qr/poster-content"

import { MysteryTentFace } from "./faces/mystery-face"
import { TableTentSheet } from "./faces/shared"
import { TicketTentFace } from "./faces/ticket-face"

type TableTentPosterProps = {
  readonly qrDataUrl: string
  readonly businessName: string
  readonly stampsRequired: number
}

export function TableTentPoster({
  qrDataUrl,
  businessName,
  stampsRequired,
}: TableTentPosterProps) {
  const geometry = resolveBaseTentContent(stampsRequired).geometry
  const faceProps = { qrDataUrl, businessName, stampsRequired }

  return (
    <TableTentSheet
      top={<TicketTentFace {...faceProps} />}
      bottom={<MysteryTentFace {...faceProps} />}
      geometry={geometry}
    />
  )
}
