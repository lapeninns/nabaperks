import type { BitMatrix } from "qrcode"

import { resolveTentContent } from "@/lib/qr/tent-content"
import type { TableTentDesignId } from "@/lib/qr/tent-templates"

import {
  createPosterDocument,
  retainPosterFontPrograms,
  savePosterDocument,
} from "./poster-pdf-document"
import { drawTentA4 } from "./tent-pdf-sheet"
import { mm } from "./poster-pdf-style"

export async function renderTentPdf(
  design: TableTentDesignId,
  merchantName: string,
  stampsRequired: number,
  qrModules: BitMatrix
): Promise<string> {
  const content = resolveTentContent(design, stampsRequired)
  const { document, fonts } = await createPosterDocument(
    `Nabaperks ${design} table tent for ${merchantName}`,
    "A4 fold-to-peak table tent"
  )
  const page = document.addPage([
    mm(content.geometry.sheetWidthMm),
    mm(content.geometry.sheetHeightMm),
  ])
  retainPosterFontPrograms(page, fonts)
  drawTentA4(page, design, merchantName, stampsRequired, qrModules, fonts)
  return savePosterDocument(document)
}
