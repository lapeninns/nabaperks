import type { PrimerPosterContent } from "@/lib/qr/poster-kit-content-types"

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
import { popKitRotation, pushKitRotation } from "./poster-pdf-kit-venue"
import type { PosterPdfBaseContext } from "./poster-pdf-types"

/** Exercise-book furniture: cobalt feints, red margin rule, punch holes. */
function drawPrimerRuledPage(
  context: PosterPdfBaseContext,
  topMm: number
): void {
  const { page } = context
  for (let y = topMm; y >= 30; y -= 8) {
    page.drawRectangle({
      x: mm(11),
      y: mm(y),
      width: mm(188),
      height: 0.5,
      color: POSTER_PDF_COLOR.cobalt,
      opacity: 0.14,
    })
  }
  page.drawRectangle({
    x: mm(26.5),
    y: mm(30),
    width: 0.7,
    height: mm(topMm - 28),
    color: POSTER_PDF_COLOR.accent,
    opacity: 0.35,
  })
  for (const holeY of [99, 198]) {
    page.drawCircle({
      x: mm(7),
      y: mm(holeY),
      size: mm(2.8),
      color: POSTER_PDF_COLOR.ink,
      opacity: 0.06,
      borderColor: POSTER_PDF_COLOR.inkSoft,
      borderWidth: 1,
      borderOpacity: 0.3,
    })
  }
}

export function drawPrimerA4(
  context: PosterPdfBaseContext,
  content: PrimerPosterContent
): void {
  const { page, fonts } = context
  const frame = drawLedgerTop(
    context,
    content,
    content.ledgerLabel,
    content.edition,
    POSTER_PDF_COLOR.paperDeep
  )
  drawPrimerRuledPage(context, (frame.headlineBottom * 25.4) / 72 - 2)
  const rowTop = frame.headlineBottom - mm(6)
  const rowHeight = (rowTop - mm(95)) / content.clauses.length
  const titleDrop = content.typeTiers.substantivePt
  const detailDrop = titleDrop + bodyLeading(POSTER_PDF_TYPE.bodyPt)
  content.clauses.forEach((clause, index) => {
    const y = rowTop - index * rowHeight
    const color = clause.sealed ? POSTER_PDF_COLOR.leaf : POSTER_PDF_COLOR.ink
    page.drawText(clause.number, {
      x: frame.left,
      y: y - titleDrop,
      size: content.typeTiers.substantivePt,
      font: fonts.monoBold,
      color,
    })
    page.drawText(
      standardFontText(clause.title.toUpperCase(), fonts.monoBold),
      {
        x: frame.left + mm(14),
        y: y - titleDrop,
        size: content.typeTiers.substantivePt,
        font: fonts.monoBold,
        color,
      }
    )
    drawWrappedText(page, clause.detail, {
      x: frame.left + mm(14),
      y: y - detailDrop,
      maxWidth: frame.width - mm(14),
      font: fonts.regular,
      size: POSTER_PDF_TYPE.bodyPt,
      lineHeight: bodyLeading(POSTER_PDF_TYPE.bodyPt),
      color: POSTER_PDF_COLOR.inkSoft,
      maxLines: 2,
    })
    const ruleY = y - rowHeight + mm(3)
    if (index < content.clauses.length - 1) {
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
  drawLedgerFoot(context, content, content.issuerLabel, content.signature)
  // Rubber-stamp frame around the ink signature the foot just set. Kept short
  // and low so its top edge sits under the venue name (baseline mm(64)) rather
  // than slicing through it.
  pushKitRotation(page, -2.5, mm(107), mm(57.5))
  page.drawRectangle({
    x: mm(76),
    y: mm(54),
    width: mm(62),
    height: mm(7),
    borderColor: POSTER_PDF_COLOR.accent,
    borderWidth: 1.6,
    borderOpacity: 0.85,
  })
  popKitRotation(page)
}
