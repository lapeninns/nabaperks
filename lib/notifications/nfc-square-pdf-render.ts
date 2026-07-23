import type { BitMatrix } from "qrcode"

import { resolveNfcSquareContent } from "@/lib/qr/nfc-square-content"
import type { NfcSquareDesignId } from "@/lib/qr/nfc-square-templates"

import {
  createPosterDocument,
  retainPosterFontPrograms,
  savePosterDocument,
} from "./poster-pdf-document"
import { drawNfcSquarePage } from "./nfc-square-pdf-sheet"

export async function renderNfcSquarePdf(
  design: NfcSquareDesignId,
  merchantName: string,
  stampsRequired: number,
  qrModules: BitMatrix
): Promise<string> {
  resolveNfcSquareContent(design, stampsRequired)
  const { document, fonts } = await createPosterDocument(
    `Nabaperks ${design} square NFC plate for ${merchantName}`,
    "100×100 mm one-sided wall NFC plate"
  )
  drawNfcSquarePage(
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
