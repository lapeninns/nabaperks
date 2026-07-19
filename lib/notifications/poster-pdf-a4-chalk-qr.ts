import type { ChalkPosterContent } from "@/lib/qr/poster-kit-content-types"

import {
  drawDashedLine,
  drawQrCode,
  drawWrappedText,
  mm,
  POSTER_PDF_COLOR,
} from "./poster-pdf-style"
import { drawChalkStroke } from "./poster-pdf-a4-chalk-doodles"
import type { PosterPdfBaseContext } from "./poster-pdf-types"

/** Curved vermillion arrow pointing from the QR box down to its caption. */
function drawChalkArrow(
  context: PosterPdfBaseContext,
  tipX: number,
  tipY: number
): void {
  const { page } = context
  const accent = POSTER_PDF_COLOR.accent
  const points = [
    { x: tipX + mm(1.6), y: tipY + mm(6.4) },
    { x: tipX + mm(0.2), y: tipY + mm(4.4) },
    { x: tipX - mm(0.6), y: tipY + mm(2.2) },
    { x: tipX, y: tipY },
  ]
  for (let index = 1; index < points.length; index += 1) {
    page.drawLine({
      start: points[index - 1],
      end: points[index],
      thickness: 2,
      color: accent,
    })
  }
  for (const head of [
    { x: tipX - mm(1.4), y: tipY + mm(1.6) },
    { x: tipX + mm(1.7), y: tipY + mm(1) },
  ]) {
    page.drawLine({
      start: { x: tipX, y: tipY },
      end: head,
      thickness: 2,
      color: accent,
    })
  }
}

/**
 * The QR chalked into its dashed box, vermillion corner rays, and the
 * arrowed caption below.
 */
export function drawChalkQrBlock(
  context: PosterPdfBaseContext,
  content: ChalkPosterContent,
  options: { readonly left: number; readonly boxBottomMm: number }
): void {
  const { page } = context
  const chalk = POSTER_PDF_COLOR.paper
  const qrSize = mm(content.qr.outerMm)
  const boxSize = qrSize + mm(10)
  const boxX = options.left
  const boxY = mm(options.boxBottomMm)
  for (const line of [
    { x1: boxX, y1: boxY, x2: boxX + boxSize, y2: boxY },
    { x1: boxX, y1: boxY + boxSize, x2: boxX + boxSize, y2: boxY + boxSize },
    { x1: boxX, y1: boxY, x2: boxX, y2: boxY + boxSize },
    { x1: boxX + boxSize, y1: boxY, x2: boxX + boxSize, y2: boxY + boxSize },
  ]) {
    drawDashedLine(page, { ...line, color: chalk })
  }
  drawQrCode(page, context.qrModules, boxX + mm(5), boxY + mm(5), qrSize)
  for (const side of [-1, 1]) {
    const rayX = side < 0 ? boxX - mm(2.5) : boxX + boxSize + mm(2.5)
    drawChalkStroke(page, {
      centerX: rayX,
      centerY: boxY + boxSize - mm(6),
      lengthMm: 3.4,
      angleDeg: side < 0 ? 58 : -58,
      color: POSTER_PDF_COLOR.accent,
    })
    drawChalkStroke(page, {
      centerX: rayX + side * mm(1),
      centerY: boxY + boxSize - mm(12),
      lengthMm: 3.4,
      angleDeg: side < 0 ? 24 : -24,
      color: POSTER_PDF_COLOR.accent,
    })
  }
  drawChalkArrow(context, boxX + mm(4.5), boxY - mm(8))
  drawWrappedText(page, content.qrCaption.toUpperCase(), {
    x: boxX + mm(9),
    y: boxY - mm(6),
    maxWidth: mm(75),
    font: context.fonts.monoBold,
    size: 9,
    lineHeight: 12,
    color: chalk,
    maxLines: 2,
  })
}
