import type { ReceiptPosterContent } from "@/lib/qr/poster-kit-content-types"

import {
  bodyLeading,
  displayLeading,
  drawDashedLine,
  drawWrappedText,
  mm,
  POSTER_PDF_COLOR,
  standardFontText,
} from "./poster-pdf-style"
import { drawKitMasthead, drawKitQrPanel } from "./poster-pdf-kit-pieces"
import { drawKitCapsule } from "./poster-pdf-kit-capsule"
import { drawKitCenteredText, drawKitVenueLine } from "./poster-pdf-kit-venue"
import {
  drawReceiptItemRow,
  drawReceiptPerforation,
  drawReceiptSealMark,
  RECEIPT_STRIP,
} from "./poster-pdf-a4-receipt-rows"
import type { PosterPdfBaseContext } from "./poster-pdf-types"

export function drawReceiptA4(
  context: PosterPdfBaseContext,
  content: ReceiptPosterContent
): void {
  const { page, fonts } = context
  const { left, width, bottom, top, innerLeft, innerWidth } = RECEIPT_STRIP
  page.drawRectangle({
    x: 0,
    y: 0,
    width: mm(content.geometry.sheetWidthMm),
    height: mm(content.geometry.sheetHeightMm),
    color: POSTER_PDF_COLOR.paperDeep,
  })
  // The docket: white strip with a soft ink drop and punched perforations.
  page.drawRectangle({
    x: mm(left + 1.6),
    y: mm(bottom - 1.6),
    width: mm(width),
    height: mm(top - bottom),
    color: POSTER_PDF_COLOR.ink,
    opacity: 0.16,
  })
  page.drawRectangle({
    x: mm(left),
    y: mm(bottom),
    width: mm(width),
    height: mm(top - bottom),
    color: POSTER_PDF_COLOR.white,
  })
  drawReceiptPerforation(context, top - 3.5)
  drawReceiptPerforation(context, bottom + 3.5)

  const ruleY = drawKitMasthead(page, {
    x: mm(innerLeft),
    y: mm(278),
    width: mm(innerWidth),
    lead: content.orderLabel,
    leadColor: POSTER_PDF_COLOR.ink,
    edition: content.edition,
    editionColor: POSTER_PDF_COLOR.inkSoft,
    fonts,
    rule: "dashed",
    ruleColor: POSTER_PDF_COLOR.inkSoft,
  })
  const hookBottom = drawWrappedText(page, content.hook, {
    x: mm(innerLeft),
    y: ruleY - mm(3) - content.typeTiers.hookPt * 0.96,
    maxWidth: mm(innerWidth),
    font: fonts.bold,
    size: content.typeTiers.hookPt,
    lineHeight: displayLeading(content.typeTiers.hookPt),
    color: POSTER_PDF_COLOR.ink,
    maxLines: 2,
  })

  // Venue as the docket's merchant block.
  const merchantY = hookBottom + mm(2)
  page.drawText(
    standardFontText(content.merchantLabel.toUpperCase(), fonts.monoBold),
    {
      x: mm(innerLeft),
      y: merchantY,
      size: 9,
      font: fonts.monoBold,
      color: POSTER_PDF_COLOR.inkSoft,
    }
  )
  drawKitVenueLine(page, context.merchantName, {
    x: mm(innerLeft),
    y: merchantY - mm(8),
    maxWidth: mm(innerWidth),
    preferredSize: 16,
    font: fonts.bold,
    color: POSTER_PDF_COLOR.ink,
  })
  drawKitCapsule(page, content.memberTag, {
    x: mm(innerLeft),
    y: merchantY - mm(16),
    font: fonts.monoBold,
    size: 8.5,
    textColor: POSTER_PDF_COLOR.inkSoft,
    fill: POSTER_PDF_COLOR.paperDeep,
  })
  const cardLineY = merchantY - mm(23)
  drawDashedLine(page, {
    x1: mm(innerLeft),
    y1: cardLineY + mm(4.5),
    x2: mm(innerLeft + innerWidth),
    y2: cardLineY + mm(4.5),
    color: POSTER_PDF_COLOR.inkSoft,
  })
  page.drawText(
    standardFontText(content.cardLine.toUpperCase(), fonts.monoBold),
    {
      x: mm(innerLeft),
      y: cardLineY,
      size: 9.5,
      font: fonts.monoBold,
      color: POSTER_PDF_COLOR.inkSoft,
    }
  )

  // Line items: today's visit, blank leaders for the open visit slots,
  // then the sealed mystery reward with its sun stamp. The cursor runs in
  // PDF points from here down.
  let rowY = cardLineY - mm(9)
  drawReceiptItemRow(context, rowY, content.todayItem, content.todayValue)
  for (let slot = 1; slot < context.stampsRequired; slot += 1) {
    rowY -= mm(6.5)
    drawDashedLine(page, {
      x1: mm(innerLeft),
      y1: rowY + mm(1),
      x2: mm(innerLeft + innerWidth),
      y2: rowY + mm(1),
      color: POSTER_PDF_COLOR.inkSoft,
    })
  }
  rowY -= mm(8)
  drawReceiptItemRow(context, rowY, content.rewardItem, content.rewardValue)
  drawReceiptSealMark(context, content.rewardValue, rowY)
  rowY -= mm(6)
  const noteBottom = drawWrappedText(page, content.rewardNote, {
    x: mm(innerLeft),
    y: rowY,
    maxWidth: mm(innerWidth),
    font: fonts.mono,
    size: 9,
    lineHeight: bodyLeading(9),
    color: POSTER_PDF_COLOR.inkSoft,
    maxLines: 2,
  })

  // Vermillion total row — the pay/stamp moment.
  const totalY = noteBottom - mm(4)
  drawDashedLine(page, {
    x1: mm(innerLeft),
    y1: totalY + mm(5),
    x2: mm(innerLeft + innerWidth),
    y2: totalY + mm(5),
    color: POSTER_PDF_COLOR.accent,
  })
  page.drawText("*", {
    x: mm(innerLeft),
    y: totalY - 2,
    size: 15,
    font: fonts.bold,
    color: POSTER_PDF_COLOR.accent,
  })
  page.drawText(
    standardFontText(content.totalLabel.toUpperCase(), fonts.monoBold),
    {
      x: mm(innerLeft + 5),
      y: totalY,
      size: 12,
      font: fonts.monoBold,
      color: POSTER_PDF_COLOR.accent,
    }
  )
  const totalValue = standardFontText(
    content.totalValue.toUpperCase(),
    fonts.monoBold
  )
  page.drawText(totalValue, {
    x:
      mm(innerLeft + innerWidth) -
      fonts.monoBold.widthOfTextAtSize(totalValue, 12),
    y: totalY,
    size: 12,
    font: fonts.monoBold,
    color: POSTER_PDF_COLOR.accent,
  })

  // Friction as numbered foot notes.
  content.footnotes.forEach((line, index) => {
    drawWrappedText(page, `${index + 1}. ${line}`, {
      x: mm(innerLeft),
      y: totalY - mm(8 + index * 5),
      maxWidth: mm(innerWidth),
      font: fonts.mono,
      size: 8.5,
      lineHeight: bodyLeading(8.5),
      color: POSTER_PDF_COLOR.inkSoft,
      maxLines: 1,
    })
  })

  // The QR prints where the barcode would: centred at the docket foot.
  const qrSize = mm(content.qr.outerMm)
  drawKitQrPanel(page, context.qrModules, content.qrCaption, {
    x: mm(105) - qrSize / 2,
    y: mm(40),
    size: qrSize,
    font: fonts.monoBold,
    captionColor: POSTER_PDF_COLOR.ink,
    border: POSTER_PDF_COLOR.ink,
  })
  drawKitCenteredText(page, content.footLine.toUpperCase(), {
    centerX: mm(105),
    y: mm(27),
    font: fonts.monoBold,
    size: 8,
    color: POSTER_PDF_COLOR.inkSoft,
  })
  drawWrappedText(page, content.reassurance, {
    x: mm(innerLeft),
    y: mm(21),
    maxWidth: mm(innerWidth),
    font: fonts.monoBold,
    size: content.typeTiers.factsPt,
    lineHeight: bodyLeading(content.typeTiers.factsPt),
    color: POSTER_PDF_COLOR.inkSoft,
    maxLines: 2,
  })
}
