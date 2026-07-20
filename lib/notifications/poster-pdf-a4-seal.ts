import type { SealPosterContent } from "@/lib/qr/poster-kit-content-types"

import {
  bodyLeading,
  drawDashedLine,
  drawWrappedText,
  mm,
  POSTER_PDF_COLOR,
  POSTER_PDF_TYPE,
  standardFontText,
} from "./poster-pdf-style"
import { drawLedgerFoot, drawLedgerTop } from "./poster-pdf-a4-ledger"
import { drawKitCapsule } from "./poster-pdf-kit-capsule"
import type { PosterPdfBaseContext } from "./poster-pdf-types"

/** Dossier furniture: manila folder tab up top, paperclip on the corner. */
function drawSealDossier(context: PosterPdfBaseContext): void {
  const { page } = context
  page.drawRectangle({
    x: mm(15),
    y: mm(284),
    width: mm(64),
    height: mm(10),
    color: POSTER_PDF_COLOR.paperDeep,
    borderColor: POSTER_PDF_COLOR.inkSoft,
    borderWidth: 1,
    borderOpacity: 0.45,
  })
  const clipX = mm(184)
  const clipTop = mm(288)
  for (const [radius, drop] of [
    [2.4, 8.5],
    [1.5, 6],
  ]) {
    page.drawCircle({
      x: clipX,
      y: clipTop,
      size: mm(radius),
      borderColor: POSTER_PDF_COLOR.inkSoft,
      borderWidth: 1.3,
      borderOpacity: 0.75,
    })
    for (const side of [-1, 1]) {
      page.drawRectangle({
        x: clipX + side * mm(radius) - 0.65,
        y: clipTop - mm(drop),
        width: 1.3,
        height: mm(drop),
        color: POSTER_PDF_COLOR.inkSoft,
        opacity: 0.75,
      })
    }
  }
  // Mask the arcs' lower halves so the loops read as a clip, not rings.
  page.drawRectangle({
    x: clipX - mm(3.2),
    y: clipTop - mm(3.2),
    width: mm(6.4),
    height: mm(3.2),
    color: POSTER_PDF_COLOR.paper,
  })
}

/** The wax blob the sealed tag presses into. */
function drawSealWax(
  context: PosterPdfBaseContext,
  centerX: number,
  centerY: number
): void {
  const { page } = context
  for (const [dx, dy, radius] of [
    [-6.5, 2.2, 3],
    [6.8, -1.8, 2.6],
    [1.5, -5.8, 2.4],
    [-3, 5.6, 2.2],
  ]) {
    page.drawCircle({
      x: centerX + mm(dx),
      y: centerY + mm(dy),
      size: mm(radius),
      color: POSTER_PDF_COLOR.accent,
    })
  }
  page.drawCircle({
    x: centerX,
    y: centerY,
    size: mm(8),
    color: POSTER_PDF_COLOR.accent,
    borderColor: POSTER_PDF_COLOR.ink,
    borderWidth: 1.2,
  })
  page.drawCircle({
    x: centerX,
    y: centerY,
    size: mm(5.6),
    borderColor: POSTER_PDF_COLOR.ink,
    borderWidth: 1,
    borderOpacity: 0.4,
  })
  page.drawCircle({
    x: centerX + mm(4),
    y: centerY - mm(9.6),
    size: mm(1.4),
    color: POSTER_PDF_COLOR.accent,
  })
}

export function drawSealA4(
  context: PosterPdfBaseContext,
  content: SealPosterContent
): void {
  const { page, fonts } = context
  const frame = drawLedgerTop(
    context,
    content,
    content.manifestLabel,
    content.edition,
    POSTER_PDF_COLOR.paper
  )
  drawSealDossier(context)
  const rowTop = frame.headlineBottom - mm(4)
  const rowHeight = (rowTop - mm(118)) / content.rows.length
  content.rows.forEach((row, index) => {
    const y = rowTop - index * rowHeight - 14
    page.drawText(standardFontText(row.label.toUpperCase(), fonts.monoBold), {
      x: frame.left,
      y,
      size: content.typeTiers.substantivePt,
      font: fonts.monoBold,
      color: POSTER_PDF_COLOR.inkSoft,
    })
    const valueX = frame.left + mm(48)
    if (row.redacted) {
      page.drawRectangle({
        x: valueX,
        y: y - 3,
        width: frame.width - mm(48) - mm(32),
        height: mm(5.5),
        color: POSTER_PDF_COLOR.ink,
      })
      drawSealWax(context, frame.left + frame.width - mm(20), y + 4)
      drawKitCapsule(page, content.sealedTag, {
        x: frame.left + frame.width - mm(28),
        y: y - 4,
        font: fonts.monoBold,
        size: 8.5,
        textColor: POSTER_PDF_COLOR.ink,
        fill: POSTER_PDF_COLOR.sun,
        borderColor: POSTER_PDF_COLOR.ink,
        rotateDeg: -5,
      })
    } else {
      drawWrappedText(page, row.value.toUpperCase(), {
        x: valueX,
        y,
        maxWidth: frame.width - mm(48),
        font: fonts.monoBold,
        size: content.typeTiers.substantivePt,
        lineHeight: bodyLeading(content.typeTiers.substantivePt),
        color: row.accent ? POSTER_PDF_COLOR.accent : POSTER_PDF_COLOR.ink,
        maxLines: 2,
      })
    }
    const ruleY = rowTop - (index + 1) * rowHeight + mm(2)
    if (index < content.rows.length - 1) {
      drawDashedLine(page, {
        x1: frame.left,
        y1: ruleY,
        x2: frame.left + frame.width,
        y2: ruleY,
        color: POSTER_PDF_COLOR.inkSoft,
      })
    } else {
      page.drawRectangle({
        x: frame.left,
        y: ruleY,
        width: frame.width,
        height: 2.2,
        color: POSTER_PDF_COLOR.ink,
      })
    }
  })
  drawWrappedText(page, content.frictionLine, {
    x: frame.left,
    y: mm(108),
    maxWidth: mm(165),
    font: fonts.regular,
    size: POSTER_PDF_TYPE.bodyPt,
    lineHeight: bodyLeading(POSTER_PDF_TYPE.bodyPt),
    color: POSTER_PDF_COLOR.inkSoft,
    maxLines: 3,
  })
  drawLedgerFoot(context, content, content.issuerLabel, content.signature)
}
