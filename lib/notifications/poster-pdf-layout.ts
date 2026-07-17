import type { BitMatrix } from "qrcode"
import type { PDFFont, PDFPage, RGB } from "pdf-lib"

import { POSTER_BRAND_WORDMARK_PDF } from "@/lib/qr/poster-brand"

import {
  drawQrCode,
  drawWrappedText,
  POSTER_PDF_COLOR,
  standardFontText,
} from "./poster-pdf-style"
import { fitSingleLineSize } from "./poster-pdf-text"
import type { PdfFonts } from "./poster-pdf-types"

export { drawAccentHeadline } from "./poster-pdf-accent"

export function drawIdentityRail(
  page: PDFPage,
  options: {
    readonly merchantName: string
    readonly x: number
    readonly y: number
    readonly width: number
    readonly height: number
    readonly foreground: RGB
    readonly accent: RGB
    readonly fonts: PdfFonts
    readonly background?: RGB
    readonly size?: number
  }
): void {
  if (options.background) {
    page.drawRectangle({
      x: options.x,
      y: options.y,
      width: options.width,
      height: options.height,
      color: options.background,
    })
  }
  const preferredIdentitySize = options.size ?? 10
  const venue = standardFontText(
    options.merchantName.toUpperCase(),
    options.fonts.monoBold
  )
  // Match CSS identity rails: uppercase "Nab a Perks" → "NAB A PERKS",
  // with the middle A in accent.
  const {
    lead: brandLead,
    accent: brandAccent,
    tail: brandTail,
  } = POSTER_BRAND_WORDMARK_PDF
  const brandSize = 11
  const systemWidth =
    options.fonts.bold.widthOfTextAtSize(brandLead, brandSize) +
    options.fonts.bold.widthOfTextAtSize(brandAccent, brandSize) +
    options.fonts.bold.widthOfTextAtSize(brandTail, brandSize)
  const venueMaxWidth = options.width - systemWidth - 32
  const identitySize = fitSingleLineSize(
    venue,
    options.fonts.monoBold,
    preferredIdentitySize,
    6,
    venueMaxWidth
  )
  page.drawText(venue, {
    x: options.x + 10,
    y: options.y + options.height / 2 - 3,
    size: identitySize,
    font: options.fonts.monoBold,
    color: options.foreground,
  })
  const brandY = options.y + options.height / 2 - 3.5
  let brandX = options.x + options.width - systemWidth - 10
  page.drawText(brandLead, {
    x: brandX,
    y: brandY,
    size: brandSize,
    font: options.fonts.bold,
    color: options.foreground,
  })
  brandX += options.fonts.bold.widthOfTextAtSize(brandLead, brandSize)
  page.drawText(brandAccent, {
    x: brandX,
    y: brandY,
    size: brandSize,
    font: options.fonts.bold,
    color: options.accent,
  })
  brandX += options.fonts.bold.widthOfTextAtSize(brandAccent, brandSize)
  page.drawText(brandTail, {
    x: brandX,
    y: brandY,
    size: brandSize,
    font: options.fonts.bold,
    color: options.foreground,
  })
  page.drawRectangle({
    x: options.x,
    y: options.y,
    width: options.width,
    height: 1.2,
    color: options.foreground,
    opacity: 0.35,
  })
}

export function drawFactsRail(
  page: PDFPage,
  reassurance: string,
  options: {
    readonly x: number
    readonly y: number
    readonly width: number
    readonly height: number
    readonly font: PDFFont
    readonly color: RGB
    readonly background?: RGB
    readonly size?: number
  }
): void {
  if (options.background) {
    page.drawRectangle({
      x: options.x,
      y: options.y,
      width: options.width,
      height: options.height,
      color: options.background,
    })
  }
  drawWrappedText(page, reassurance, {
    x: options.x + 8,
    y: options.y + options.height - 14,
    maxWidth: options.width - 16,
    font: options.font,
    size: options.size ?? 8.5,
    lineHeight: (options.size ?? 8.5) + 3,
    color: options.color,
    maxLines: 3,
  })
}

export function drawQrAction(
  page: PDFPage,
  modules: BitMatrix,
  caption: string,
  options: {
    readonly x: number
    readonly y: number
    readonly size: number
    readonly font: PDFFont
    readonly color: RGB
    readonly border: RGB
    readonly captionAbove?: boolean
    readonly captionSize?: number
  }
): void {
  page.drawRectangle({
    x: options.x + 4,
    y: options.y - 4,
    width: options.size,
    height: options.size,
    color: options.border,
  })
  drawQrCode(page, modules, options.x, options.y, options.size)
  page.drawRectangle({
    x: options.x,
    y: options.y,
    width: options.size,
    height: options.size,
    borderColor: options.border,
    borderWidth: 1.5,
  })
  drawWrappedText(page, caption, {
    x: options.x,
    y: options.captionAbove ? options.y + options.size + 18 : options.y - 14,
    maxWidth: options.size,
    font: options.font,
    size: options.captionSize ?? 11,
    lineHeight: (options.captionSize ?? 11) + 2,
    color: options.color,
    maxLines: 2,
  })
}

export function drawAccentRule(
  page: PDFPage,
  x: number,
  y: number,
  width: number,
  color: RGB = POSTER_PDF_COLOR.accent
): void {
  page.drawRectangle({ x, y, width, height: 5, color })
}
