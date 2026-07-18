import type { PDFPage } from "pdf-lib"

import type { TentContent, TentFaceContent } from "@/lib/qr/tent-content"
import type { BitMatrix } from "qrcode"

import {
  drawQrCode,
  drawWrappedText,
  fitSingleLineText,
  mm,
  POSTER_PDF_COLOR,
  standardFontText,
} from "./poster-pdf-style"
import type { PdfFonts } from "./poster-pdf-types"
import { drawStampStrip, tentFacePalette } from "./tent-pdf-pieces"

/**
 * Draw one tent face within the box at (originX, originY) sized w x h (points),
 * laid out top-down: header rail, badge, headline, body, stamps, QR + CTA, and
 * the footer rail. The caller places and (for the top face) rotates the box.
 */
export function drawTentFace(
  page: PDFPage,
  content: TentContent,
  face: TentFaceContent,
  options: {
    readonly originX: number
    readonly originY: number
    readonly width: number
    readonly height: number
    readonly venue: string
    readonly fonts: PdfFonts
    readonly qrModules: BitMatrix
  }
): void {
  const { originX, originY, width, height, fonts } = options
  const p = tentFacePalette(face)
  const top = originY + height
  page.drawRectangle({
    x: originX,
    y: originY,
    width,
    height,
    color: p.ground,
  })

  const railH = mm(11)
  page.drawRectangle({
    x: originX,
    y: top - railH,
    width,
    height: railH,
    color: p.ink,
  })
  page.drawText("* Nab a Perks", {
    x: originX + mm(6),
    y: top - railH / 2 - 3,
    size: 11,
    font: fonts.bold,
    color: p.ground,
  })
  // Truncate the kicker so a long venue can never run under the brand or off
  // the rail; the full name still prints inside the copy column.
  const kicker = fitSingleLineText(
    standardFontText(
      `${content.kicker} · ${options.venue}`.toUpperCase(),
      fonts.monoBold
    ),
    fonts.monoBold,
    7,
    width - mm(12) - fonts.bold.widthOfTextAtSize("* Nab a Perks", 11)
  )
  const kickerWidth = fonts.monoBold.widthOfTextAtSize(kicker, 7)
  page.drawText(kicker, {
    x: originX + width - mm(6) - kickerWidth,
    y: top - railH / 2 - 3,
    size: 7,
    font: fonts.monoBold,
    color: p.ground,
  })

  const left = originX + mm(6)
  const copyWidth = width * 0.6
  let cursor = top - railH - mm(9)
  if (face.badge) {
    page.drawText(standardFontText(face.badge.toUpperCase(), fonts.monoBold), {
      x: left,
      y: cursor,
      size: 9,
      font: fonts.monoBold,
      color: p.accent,
    })
    cursor -= mm(7)
  }
  face.headline.forEach((line) => {
    page.drawText(standardFontText(line.toUpperCase(), fonts.bold), {
      x: left,
      y: cursor,
      size: 26,
      font: fonts.bold,
      color: line === face.accent ? p.accent : p.ink,
    })
    cursor -= 24
  })
  cursor -= mm(3)
  const bodyBottom = drawWrappedText(page, face.body, {
    x: left,
    y: cursor,
    maxWidth: copyWidth - mm(6),
    font: fonts.bold,
    size: 10,
    lineHeight: 13,
    color: p.ink,
    maxLines: 4,
  })
  if (face.showStamps) {
    drawStampStrip(page, {
      x: left,
      y: bodyBottom - mm(10),
      count: content.stampsRequired,
      venue: options.venue,
      font: fonts.monoBold,
      ink: p.ink,
      soft: p.soft,
    })
  }

  const qrSize = mm(content.qr.outerMm)
  const qrX = originX + width - qrSize - mm(10)
  const qrY = originY + height / 2 - qrSize / 2 + mm(4)
  page.drawRectangle({
    x: qrX + 3,
    y: qrY - 3,
    width: qrSize,
    height: qrSize,
    color: p.qrBorder,
  })
  drawQrCode(page, options.qrModules, qrX, qrY, qrSize)
  page.drawRectangle({
    x: qrX,
    y: qrY,
    width: qrSize,
    height: qrSize,
    borderColor: p.qrBorder,
    borderWidth: 1.4,
  })
  const cta = standardFontText(face.cta.toUpperCase(), fonts.monoBold)
  const ctaWidth = fonts.monoBold.widthOfTextAtSize(cta, 7.5) + 12
  page.drawRectangle({
    x: qrX + qrSize / 2 - ctaWidth / 2,
    y: qrY - mm(9),
    width: ctaWidth,
    height: mm(6),
    color: POSTER_PDF_COLOR.accent,
    borderColor: POSTER_PDF_COLOR.ink,
    borderWidth: 1,
  })
  page.drawText(cta, {
    x: qrX + qrSize / 2 - ctaWidth / 2 + 6,
    y: qrY - mm(7),
    size: 7.5,
    font: fonts.monoBold,
    color: POSTER_PDF_COLOR.white,
  })

  const footerY = originY + mm(4)
  page.drawText(
    standardFontText(content.footer.left.toUpperCase(), fonts.monoBold),
    { x: left, y: footerY, size: 7, font: fonts.monoBold, color: p.soft }
  )
  const right = standardFontText(
    content.footer.right.toUpperCase(),
    fonts.monoBold
  )
  const rightWidth = fonts.monoBold.widthOfTextAtSize(right, 7)
  page.drawText(right, {
    x: originX + width - mm(6) - rightWidth,
    y: footerY,
    size: 7,
    font: fonts.monoBold,
    color: p.ink,
  })
}
