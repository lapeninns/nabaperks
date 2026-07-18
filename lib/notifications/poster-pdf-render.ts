import type { BitMatrix } from "qrcode"

import { resolvePosterContent } from "@/lib/qr/poster-content"
import type { QrPosterTemplateId } from "@/lib/qr/poster-templates"

import {
  createPosterDocument,
  retainPosterFontPrograms,
  savePosterDocument,
} from "./poster-pdf-document"
import { drawPosterPdf } from "./poster-pdf-registry"
import { mm } from "./poster-pdf-style"

export async function renderPosterPdf(
  template: QrPosterTemplateId,
  merchantName: string,
  stampsRequired: number,
  qrModules: BitMatrix
): Promise<string> {
  const content = resolvePosterContent(template, stampsRequired)
  const { document, fonts } = await createPosterDocument(
    `Nabaperks ${template} poster for ${merchantName}`,
    "A4 counter poster"
  )
  const page = document.addPage([
    mm(content.geometry.sheetWidthMm),
    mm(content.geometry.sheetHeightMm),
  ])
  retainPosterFontPrograms(page, fonts)
  const context = {
    document,
    page,
    fonts,
    qrModules,
    merchantName,
    stampsRequired,
  }
  drawPosterPdf(context, content)
  return savePosterDocument(document)
}
