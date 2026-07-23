import type { BitMatrix } from "qrcode"

import { resolveNfcCardContent } from "@/lib/qr/nfc-card-content"
import type { NfcCardDesignId } from "@/lib/qr/nfc-card-templates"

import {
  createPosterDocument,
  retainPosterFontPrograms,
  savePosterDocument,
} from "./poster-pdf-document"
import { drawNfcCardCr80Pages } from "./nfc-card-pdf-sheet"

export async function renderNfcCardPdf(
  design: NfcCardDesignId,
  merchantName: string,
  stampsRequired: number,
  qrModules: BitMatrix
): Promise<string> {
  resolveNfcCardContent(design, stampsRequired)
  const { document, fonts } = await createPosterDocument(
    `Nabaperks ${design} NFC card for ${merchantName}`,
    "CR80 NFC card — front and back at 85.5 × 54 mm"
  )
  drawNfcCardCr80Pages(
    document,
    design,
    merchantName,
    stampsRequired,
    qrModules,
    fonts,
    (page) => retainPosterFontPrograms(page, fonts)
  )
  return savePosterDocument(document)
}
