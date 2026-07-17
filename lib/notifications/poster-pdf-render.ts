import type { BitMatrix } from "qrcode"

import { resolvePosterContent } from "@/lib/qr/poster-content"
import type { QrPosterTemplateId } from "@/lib/qr/poster-templates"

import { drawConceptA4, drawCopyDrivenA4 } from "./poster-pdf-a4"
import { drawTableTentPdf } from "./poster-pdf-b5"
import {
  createPosterDocument,
  retainPosterFontPrograms,
  savePosterDocument,
} from "./poster-pdf-document"
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
    content.sheet === "b5"
      ? "B5 table tent — dual landscape faces"
      : "A4 counter poster"
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
  if (content.sheet === "b5") {
    drawTableTentPdf(context, content)
  } else if (
    content.id === "editorial" ||
    content.id === "bold" ||
    content.id === "ticket"
  ) {
    drawCopyDrivenA4(context, content)
  } else if (content.id === "northstar" || content.id === "thermal") {
    drawConceptA4(context, content)
  }
  return savePosterDocument(document)
}
