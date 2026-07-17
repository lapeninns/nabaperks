import type { CopyDrivenPosterContent } from "@/lib/qr/poster-content"

import {
  drawDashedLine,
  drawHardBox,
  drawOfferedStampRow,
  drawWrappedText,
  mm,
  POSTER_PDF_COLOR,
} from "./poster-pdf-style"
import {
  drawAccentHeadline,
  drawFactsRail,
  drawIdentityRail,
  drawQrAction,
} from "./poster-pdf-layout"
import type { PosterPdfBaseContext } from "./poster-pdf-types"

export function drawTicketA4(
  context: PosterPdfBaseContext,
  content: CopyDrivenPosterContent
): void {
  const { page, fonts } = context
  const pageWidth = mm(content.geometry.sheetWidthMm)
  const pageHeight = mm(content.geometry.sheetHeightMm)
  page.drawRectangle({
    x: 0,
    y: 0,
    width: pageWidth,
    height: pageHeight,
    color: POSTER_PDF_COLOR.paper,
  })
  const x = mm(content.geometry.safeMarginMm)
  const y = mm(37)
  const width = pageWidth - x * 2
  const height = pageHeight - mm(54)
  const split = x + width * 0.64
  drawHardBox(page, {
    x,
    y,
    width,
    height,
    fill: POSTER_PDF_COLOR.paperDeep,
    border: POSTER_PDF_COLOR.ink,
    shadow: POSTER_PDF_COLOR.ink,
    shadowOffset: 6,
  })
  page.drawRectangle({
    x: split,
    y,
    width: x + width - split,
    height,
    color: POSTER_PDF_COLOR.accent,
  })
  drawIdentityRail(page, {
    merchantName: context.merchantName,
    x,
    y: y + height - mm(18),
    width,
    height: mm(18),
    foreground: POSTER_PDF_COLOR.ink,
    accent: POSTER_PDF_COLOR.paper,
    fonts,
    size: content.typeTiers.factsPt,
  })
  drawAccentHeadline(page, content.headline, {
    x: x + mm(8),
    y: y + height - mm(42),
    maxWidth: split - x - mm(16),
    font: fonts.bold,
    size: content.typeTiers.hookPt,
    lineHeight: content.typeTiers.hookPt * 0.9,
    foreground: POSTER_PDF_COLOR.ink,
    accent: POSTER_PDF_COLOR.accent,
    maxLines: 4,
    uppercase: true,
  })
  drawWrappedText(page, content.support, {
    x: x + mm(8),
    y: y + mm(91),
    maxWidth: split - x - mm(16),
    font: fonts.bold,
    size: content.typeTiers.substantivePt,
    lineHeight: content.typeTiers.substantivePt + 4,
    color: POSTER_PDF_COLOR.ink,
    maxLines: 4,
  })
  drawWrappedText(page, content.rewardDetail, {
    x: x + mm(8),
    y: y + mm(78),
    maxWidth: split - x - mm(16),
    font: fonts.regular,
    size: 10,
    lineHeight: 13,
    color: POSTER_PDF_COLOR.inkSoft,
    maxLines: 3,
  })
  page.drawText(content.frictionLine, {
    x: x + mm(8),
    y: y + mm(65),
    size: 10,
    font: fonts.mono,
    color: POSTER_PDF_COLOR.inkSoft,
  })
  drawOfferedStampRow(page, context.stampsRequired, {
    x: x + mm(8),
    y: y + mm(48),
    width: split - x - mm(16),
    foreground: POSTER_PDF_COLOR.ink,
    accent: POSTER_PDF_COLOR.accent,
    font: fonts.mono,
  })
  drawWrappedText(page, content.progress, {
    x: x + mm(8),
    y: y + mm(37),
    maxWidth: split - x - mm(16),
    font: fonts.regular,
    size: 9,
    lineHeight: 12,
    color: POSTER_PDF_COLOR.inkSoft,
    maxLines: 3,
  })
  drawDashedLine(page, {
    x1: split,
    y1: y + mm(20),
    x2: split,
    y2: y + height - mm(20),
    color: POSTER_PDF_COLOR.ink,
  })
  const qrSize = mm(content.qr.outerMm)
  drawQrAction(page, context.qrModules, content.qrCaption, {
    x: split + (x + width - split - qrSize) / 2,
    y: y + mm(75),
    size: qrSize,
    font: fonts.bold,
    color: POSTER_PDF_COLOR.white,
    border: POSTER_PDF_COLOR.ink,
    captionAbove: true,
  })
  drawFactsRail(page, content.reassurance, {
    x: x + mm(5),
    y: y + mm(4),
    width: split - x - mm(10),
    height: mm(22),
    font: fonts.mono,
    color: POSTER_PDF_COLOR.ink,
    size: content.typeTiers.factsPt,
  })
}
