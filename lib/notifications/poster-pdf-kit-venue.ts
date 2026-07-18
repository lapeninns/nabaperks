import type { PDFFont, PDFPage, RGB } from "pdf-lib"
import {
  concatTransformationMatrix,
  popGraphicsState,
  pushGraphicsState,
} from "pdf-lib"

import {
  drawDashedLine,
  fitSingleLineText,
  mm,
  standardFontText,
} from "./poster-pdf-style"
import { fitSingleLineSize } from "./poster-pdf-text"
import type { PdfFonts } from "./poster-pdf-types"

/**
 * Full venue name on one line, stepping the size down instead of truncating.
 * Names near the 120-character profile limit can outgrow a lane even at the
 * floor size; only then does the label truncate so it never crosses the
 * print-safe frame.
 */
export function drawKitVenueLine(
  page: PDFPage,
  venue: string,
  options: {
    readonly x: number
    readonly y: number
    readonly maxWidth: number
    readonly preferredSize: number
    readonly font: PDFFont
    readonly color: RGB
  }
): number {
  const printable = standardFontText(venue, options.font)
  const size = fitSingleLineSize(
    printable,
    options.font,
    options.preferredSize,
    7,
    options.maxWidth
  )
  const text = fitSingleLineText(
    printable,
    options.font,
    size,
    options.maxWidth
  )
  page.drawText(text, {
    x: options.x,
    y: options.y,
    size,
    font: options.font,
    color: options.color,
  })
  return size
}

/** Mono capsule tag — pill silhouette from a bar plus two end discs. */
export function drawKitCapsule(
  page: PDFPage,
  text: string,
  options: {
    readonly x: number
    readonly y: number
    readonly font: PDFFont
    readonly size: number
    readonly textColor: RGB
    readonly fill?: RGB
    readonly borderColor?: RGB
    readonly borderOpacity?: number
  }
): number {
  const label = standardFontText(text.toUpperCase(), options.font)
  const textWidth = options.font.widthOfTextAtSize(label, options.size)
  const height = options.size + 9
  const radius = height / 2
  const width = textWidth + 16
  for (const centerX of [options.x + radius, options.x + width - radius]) {
    page.drawCircle({
      x: centerX,
      y: options.y + radius,
      size: radius,
      color: options.fill,
      borderColor: options.borderColor,
      borderWidth: options.borderColor ? 1.2 : 0,
      borderOpacity: options.borderOpacity,
    })
  }
  page.drawRectangle({
    x: options.x + radius,
    y: options.y,
    width: width - height,
    height,
    color: options.fill,
  })
  page.drawText(label, {
    x: options.x + 8,
    y: options.y + (height - options.size) / 2 + 1,
    size: options.size,
    font: options.font,
    color: options.textColor,
  })
  return width
}

/** Primer/seal issued-by block: label rail, venue name, ink signature. */
export function drawKitLedgerVenue(
  page: PDFPage,
  options: {
    readonly x: number
    readonly y: number
    readonly width: number
    readonly issuerLabel: string
    readonly memberTag: string
    readonly venue: string
    readonly signature: string
    readonly fonts: PdfFonts
    readonly ink: RGB
    readonly soft: RGB
  }
): void {
  const railSize = 9
  page.drawText(
    standardFontText(options.issuerLabel.toUpperCase(), options.fonts.monoBold),
    {
      x: options.x,
      y: options.y,
      size: railSize,
      font: options.fonts.monoBold,
      color: options.soft,
    }
  )
  const tag = standardFontText(
    options.memberTag.toUpperCase(),
    options.fonts.monoBold
  )
  const tagWidth = options.fonts.monoBold.widthOfTextAtSize(tag, railSize)
  page.drawText(tag, {
    x: options.x + options.width - tagWidth,
    y: options.y,
    size: railSize,
    font: options.fonts.monoBold,
    color: options.soft,
  })
  drawDashedLine(page, {
    x1: options.x,
    y1: options.y - mm(2),
    x2: options.x + options.width,
    y2: options.y - mm(2),
    color: options.soft,
  })
  drawKitVenueLine(page, options.venue, {
    x: options.x,
    y: options.y - mm(10),
    maxWidth: options.width,
    preferredSize: 19,
    font: options.fonts.bold,
    color: options.ink,
  })
  page.drawText(
    standardFontText(
      `${options.signature} *`.toUpperCase(),
      options.fonts.monoBold
    ),
    {
      x: options.x,
      y: options.y - mm(17),
      size: railSize,
      font: options.fonts.monoBold,
      color: options.soft,
    }
  )
}

/** Centre a single text line on a given x centre. */
export function drawKitCenteredText(
  page: PDFPage,
  text: string,
  options: {
    readonly centerX: number
    readonly y: number
    readonly font: PDFFont
    readonly size: number
    readonly color: RGB
  }
): void {
  const printable = standardFontText(text, options.font)
  const width = options.font.widthOfTextAtSize(printable, options.size)
  page.drawText(printable, {
    x: options.centerX - width / 2,
    y: options.y,
    size: options.size,
    font: options.font,
    color: options.color,
  })
}

/** Rotate all subsequent drawing about a point; pair with popKitRotation. */
export function pushKitRotation(
  page: PDFPage,
  angleDegrees: number,
  centerX: number,
  centerY: number
): void {
  const theta = (angleDegrees * Math.PI) / 180
  const cos = Math.cos(theta)
  const sin = Math.sin(theta)
  const tx = centerX - (centerX * cos - centerY * sin)
  const ty = centerY - (centerX * sin + centerY * cos)
  page.pushOperators(
    pushGraphicsState(),
    concatTransformationMatrix(cos, sin, -sin, cos, tx, ty)
  )
}

export function popKitRotation(page: PDFPage): void {
  page.pushOperators(popGraphicsState())
}
