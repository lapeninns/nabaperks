import type { BitMatrix } from "qrcode"
import type { PDFDocument, PDFFont, PDFPage } from "pdf-lib"

import type { PosterContent } from "@/lib/qr/poster-content"

export type PosterPdfInput = {
  readonly merchantName: string
  readonly shareUrl: string
  readonly stampsRequired: number
}

export type PdfFonts = {
  readonly regular: PDFFont
  readonly bold: PDFFont
  readonly mono: PDFFont
  readonly monoBold: PDFFont
}

export type PosterPdfBaseContext = {
  readonly document: PDFDocument
  readonly page: PDFPage
  readonly fonts: PdfFonts
  readonly qrModules: BitMatrix
  readonly merchantName: string
  readonly stampsRequired: number
}

export type PosterPdfRenderContext = PosterPdfBaseContext & {
  readonly content: PosterContent
}
