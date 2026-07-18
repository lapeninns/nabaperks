import type { ThermalPosterContent } from "@/lib/qr/poster-content"

import {
  drawHardBox,
  drawOfferedStampRow,
  drawWrappedText,
  mm,
  POSTER_PDF_COLOR,
} from "./poster-pdf-style"
import {
  drawFactsRail,
  drawIdentityRail,
  drawQrAction,
} from "./poster-pdf-layout"
import type { PosterPdfBaseContext } from "./poster-pdf-types"

export function drawThermalA4(
  context: PosterPdfBaseContext,
  content: ThermalPosterContent
): void {
  const { page, fonts } = context
  const pageWidth = mm(content.geometry.sheetWidthMm)
  const pageHeight = mm(content.geometry.sheetHeightMm)
  page.drawRectangle({
    x: 0,
    y: 0,
    width: pageWidth,
    height: pageHeight,
    color: POSTER_PDF_COLOR.paperDeep,
  })
  const receiptW = mm(160)
  const receiptX = (pageWidth - receiptW) / 2
  const receiptY = mm(content.geometry.safeMarginMm)
  const receiptH = pageHeight - receiptY * 2
  drawHardBox(page, {
    x: receiptX,
    y: receiptY,
    width: receiptW,
    height: receiptH,
    fill: POSTER_PDF_COLOR.paper,
    border: POSTER_PDF_COLOR.ink,
    shadow: POSTER_PDF_COLOR.ink,
    shadowOffset: 7,
  })
  drawIdentityRail(page, {
    merchantName: context.merchantName,
    x: receiptX + mm(8),
    y: receiptY + receiptH - mm(28),
    width: receiptW - mm(16),
    height: mm(18),
    foreground: POSTER_PDF_COLOR.ink,
    accent: POSTER_PDF_COLOR.accent,
    fonts,
    size: content.typeTiers.factsPt,
  })
  page.drawText(content.meta.toUpperCase(), {
    x: receiptX + mm(8),
    y: receiptY + receiptH - mm(35),
    size: content.typeTiers.factsPt,
    font: fonts.mono,
    color: POSTER_PDF_COLOR.inkSoft,
  })
  page.drawText(content.friction.toUpperCase(), {
    x: receiptX + mm(8),
    y: receiptY + receiptH - mm(42),
    size: 7.5,
    font: fonts.mono,
    color: POSTER_PDF_COLOR.inkSoft,
  })
  const headlineBottom = drawWrappedText(page, content.headline.toUpperCase(), {
    x: receiptX + mm(8),
    y: receiptY + receiptH - mm(54),
    maxWidth: receiptW - mm(16),
    font: fonts.bold,
    size: content.typeTiers.hookPt,
    lineHeight: content.typeTiers.hookPt * 0.9,
    color: POSTER_PDF_COLOR.ink,
    maxLines: 3,
  })
  let itemY = Math.min(receiptY + receiptH - mm(91), headlineBottom - mm(4))
  for (const item of content.items) {
    page.drawText(item.label.toUpperCase(), {
      x: receiptX + mm(8),
      y: itemY,
      size: content.typeTiers.substantivePt,
      font: fonts.mono,
      color: POSTER_PDF_COLOR.ink,
    })
    const value = item.value.toUpperCase()
    const valueWidth = fonts.mono.widthOfTextAtSize(
      value,
      content.typeTiers.substantivePt
    )
    page.drawText(value, {
      x: receiptX + receiptW - mm(8) - valueWidth,
      y: itemY,
      size: content.typeTiers.substantivePt,
      font: fonts.mono,
      color: item.accent ? POSTER_PDF_COLOR.accent : POSTER_PDF_COLOR.ink,
    })
    itemY -= mm(11)
  }
  page.drawRectangle({
    x: receiptX + mm(8),
    y: itemY + mm(5),
    width: receiptW - mm(16),
    height: 1.4,
    color: POSTER_PDF_COLOR.ink,
  })
  page.drawText(
    `${content.totalLabel.toUpperCase()} / ${content.totalValue.toUpperCase()}`,
    {
      x: receiptX + mm(8),
      y: itemY - mm(2),
      size: 14,
      font: fonts.bold,
      color: POSTER_PDF_COLOR.ink,
    }
  )
  drawOfferedStampRow(page, context.stampsRequired, {
    x: receiptX + mm(8),
    y: itemY - mm(17),
    width: receiptW - mm(16),
    foreground: POSTER_PDF_COLOR.ink,
    accent: POSTER_PDF_COLOR.accent,
    font: fonts.mono,
  })
  const qrSize = mm(content.qr.outerMm)
  drawQrAction(page, context.qrModules, content.qrCaption, {
    x: receiptX + (receiptW - qrSize) / 2,
    y: receiptY + mm(31),
    size: qrSize,
    font: fonts.bold,
    color: POSTER_PDF_COLOR.ink,
    border: POSTER_PDF_COLOR.ink,
    captionAbove: true,
  })
  drawFactsRail(page, content.reassurance, {
    x: receiptX + mm(6),
    y: receiptY + mm(3),
    width: receiptW - mm(12),
    height: mm(22),
    font: fonts.mono,
    color: POSTER_PDF_COLOR.inkSoft,
    size: content.typeTiers.factsPt,
  })
}
