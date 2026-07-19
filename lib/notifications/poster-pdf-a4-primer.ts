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
import type { PosterPdfBaseContext } from "./poster-pdf-types"

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
}
