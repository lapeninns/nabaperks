import type { SealPosterContent } from "@/lib/qr/poster-kit-content-types"

import {
  drawDashedLine,
  drawWrappedText,
  mm,
  POSTER_PDF_COLOR,
  standardFontText,
} from "./poster-pdf-style"
import { drawLedgerFoot, drawLedgerTop } from "./poster-pdf-a4-ledger"
import { drawKitCapsule } from "./poster-pdf-kit-venue"
import type { PosterPdfBaseContext } from "./poster-pdf-types"

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
      drawKitCapsule(page, content.sealedTag, {
        x: frame.left + frame.width - mm(28),
        y: y - 4,
        font: fonts.monoBold,
        size: 8.5,
        textColor: POSTER_PDF_COLOR.ink,
        fill: POSTER_PDF_COLOR.sun,
        borderColor: POSTER_PDF_COLOR.ink,
      })
    } else {
      drawWrappedText(page, row.value.toUpperCase(), {
        x: valueX,
        y,
        maxWidth: frame.width - mm(48),
        font: fonts.monoBold,
        size: content.typeTiers.substantivePt,
        lineHeight: content.typeTiers.substantivePt + 4,
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
    size: 12.5,
    lineHeight: 18,
    color: POSTER_PDF_COLOR.inkSoft,
    maxLines: 3,
  })
  drawLedgerFoot(context, content, content.issuerLabel, content.signature)
}
