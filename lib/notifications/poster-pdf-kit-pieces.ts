import type { BitMatrix } from "qrcode"
import { rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib"

import {
  drawDashedLine,
  drawQrCode,
  drawWrappedText,
  mm,
  standardFontText,
} from "./poster-pdf-style"
import type { PdfFonts } from "./poster-pdf-types"

/** Night-printing leaf (#3fae6e) — keeps green type AA-readable on ink. */
export const KIT_NIGHT_LEAF: RGB = rgb(63 / 255, 174 / 255, 110 / 255)

export function drawKitMasthead(
  page: PDFPage,
  options: {
    readonly x: number
    readonly y: number
    readonly width: number
    readonly lead: string
    readonly leadColor: RGB
    readonly edition: string
    readonly editionColor: RGB
    readonly fonts: PdfFonts
    readonly rule: "solid" | "dashed" | "none"
    readonly ruleColor: RGB
  }
): number {
  page.drawText(
    standardFontText(options.lead.toUpperCase(), options.fonts.monoBold),
    {
      x: options.x,
      y: options.y,
      size: 10,
      font: options.fonts.monoBold,
      color: options.leadColor,
    }
  )
  const edition = standardFontText(
    options.edition.toUpperCase(),
    options.fonts.monoBold
  )
  const editionWidth = options.fonts.monoBold.widthOfTextAtSize(edition, 8.5)
  page.drawText(edition, {
    x: options.x + options.width - editionWidth,
    y: options.y,
    size: 8.5,
    font: options.fonts.monoBold,
    color: options.editionColor,
  })
  const ruleY = options.y - mm(3)
  if (options.rule === "solid") {
    page.drawRectangle({
      x: options.x,
      y: ruleY,
      width: options.width,
      height: 2.2,
      color: options.ruleColor,
    })
  } else if (options.rule === "dashed") {
    drawDashedLine(page, {
      x1: options.x,
      y1: ruleY,
      x2: options.x + options.width,
      y2: ruleY,
      color: options.ruleColor,
    })
  }
  return ruleY
}

/** White QR light box with an optional coloured hard shadow; caption below. */
export function drawKitQrPanel(
  page: PDFPage,
  modules: BitMatrix,
  caption: string,
  options: {
    readonly x: number
    readonly y: number
    readonly size: number
    readonly font: PDFFont
    readonly captionColor: RGB
    readonly border: RGB
    readonly shadow?: RGB
  }
): void {
  if (options.shadow) {
    page.drawRectangle({
      x: options.x + 3.5,
      y: options.y - 3.5,
      width: options.size,
      height: options.size,
      color: options.shadow,
    })
  }
  drawQrCode(page, modules, options.x, options.y, options.size)
  page.drawRectangle({
    x: options.x,
    y: options.y,
    width: options.size,
    height: options.size,
    borderColor: options.border,
    borderWidth: 1.7,
  })
  drawWrappedText(page, caption.toUpperCase(), {
    x: options.x,
    y: options.y - 13,
    maxWidth: options.size,
    font: options.font,
    size: 9,
    lineHeight: 12,
    color: options.captionColor,
    maxLines: 2,
  })
}

/** The friction triple, optionally with alternating ✱-style star marks. */
export function drawKitFriction(
  page: PDFPage,
  lines: readonly string[],
  options: {
    readonly x: number
    readonly y: number
    readonly maxWidth: number
    readonly size: number
    readonly font: PDFFont
    readonly color: RGB
    readonly markColors?: readonly [RGB, RGB]
  }
): number {
  const lineHeight = options.size + 7
  lines.forEach((line, index) => {
    const y = options.y - index * lineHeight
    let textX = options.x
    if (options.markColors) {
      page.drawText("*", {
        x: options.x,
        y: y - 2,
        size: options.size + 2,
        font: options.font,
        color: options.markColors[index % 2],
      })
      textX = options.x + 12
    }
    page.drawText(standardFontText(line, options.font), {
      x: textX,
      y,
      size: options.size,
      font: options.font,
      color: options.color,
    })
  })
  return options.y - lines.length * lineHeight
}
