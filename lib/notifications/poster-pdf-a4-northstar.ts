import type { NorthstarPosterContent } from "@/lib/qr/poster-content"

import {
  drawHardBox,
  drawOfferedStampRow,
  drawWrappedText,
  mm,
  POSTER_PDF_COLOR,
} from "./poster-pdf-style"
import {
  drawAccentHeadline,
  drawAccentRule,
  drawFactsRail,
  drawIdentityRail,
  drawQrAction,
} from "./poster-pdf-layout"
import type { PosterPdfBaseContext } from "./poster-pdf-types"

export function drawNorthstarA4(
  context: PosterPdfBaseContext,
  content: NorthstarPosterContent
): void {
  const { page, fonts } = context
  const pageWidth = mm(content.geometry.sheetWidthMm)
  const pageHeight = mm(content.geometry.sheetHeightMm)
  page.drawRectangle({
    x: 0,
    y: 0,
    width: pageWidth,
    height: pageHeight,
    color: POSTER_PDF_COLOR.ink,
  })
  const left = mm(content.geometry.safeMarginMm)
  const width = pageWidth - left * 2
  drawIdentityRail(page, {
    merchantName: context.merchantName,
    x: left,
    y: pageHeight - mm(35),
    width,
    height: mm(18),
    foreground: POSTER_PDF_COLOR.paper,
    accent: POSTER_PDF_COLOR.sun,
    fonts,
    size: content.typeTiers.factsPt,
  })
  const cardY = mm(46)
  const cardH = pageHeight - mm(91)
  drawHardBox(page, {
    x: left,
    y: cardY,
    width,
    height: cardH,
    fill: POSTER_PDF_COLOR.card,
    border: POSTER_PDF_COLOR.ink,
    shadow: POSTER_PDF_COLOR.qr,
    shadowOffset: 7,
  })
  drawHardBox(page, {
    x: left + width - mm(60),
    y: cardY + cardH - mm(18),
    width: mm(52),
    height: mm(10),
    fill: POSTER_PDF_COLOR.sun,
    border: POSTER_PDF_COLOR.ink,
    shadow: POSTER_PDF_COLOR.ink,
  })
  drawWrappedText(page, content.chip, {
    x: left + width - mm(57),
    y: cardY + cardH - mm(12),
    maxWidth: mm(46),
    font: fonts.mono,
    size: 9,
    lineHeight: 11,
    color: POSTER_PDF_COLOR.ink,
    maxLines: 2,
  })
  const accentIndex = content.headline.indexOf(content.headlineAccent)
  const qrSize = mm(content.qr.outerMm)
  const qrX = left + width - qrSize - mm(10)
  const contentX = left + mm(10)
  const contentWidth = qrX - contentX - mm(8)
  const headlineBottom = drawAccentHeadline(
    page,
    {
      beforeAccent: content.headline.slice(0, accentIndex),
      accent: content.headlineAccent,
      afterAccent: content.headline.slice(
        accentIndex + content.headlineAccent.length
      ),
    },
    {
      x: contentX,
      y: cardY + cardH - mm(37),
      maxWidth: width - mm(20),
      font: fonts.bold,
      size: content.typeTiers.hookPt,
      lineHeight: content.typeTiers.hookPt * 0.91,
      foreground: POSTER_PDF_COLOR.ink,
      accent: POSTER_PDF_COLOR.accent,
      maxLines: 4,
      uppercase: true,
    }
  )
  drawAccentRule(page, contentX, headlineBottom - 2, mm(60))
  drawOfferedStampRow(page, context.stampsRequired, {
    x: contentX,
    y: headlineBottom - mm(18),
    width: contentWidth,
    foreground: POSTER_PDF_COLOR.ink,
    accent: POSTER_PDF_COLOR.accent,
    font: fonts.mono,
  })
  drawWrappedText(page, `${content.promise} ${content.ease}`, {
    x: contentX,
    y: headlineBottom - mm(31),
    maxWidth: contentWidth,
    font: fonts.regular,
    size: content.typeTiers.substantivePt,
    lineHeight: content.typeTiers.substantivePt + 4,
    color: POSTER_PDF_COLOR.inkSoft,
    maxLines: 5,
  })
  drawQrAction(page, context.qrModules, content.qrCaption, {
    x: qrX,
    y: cardY + mm(31),
    size: qrSize,
    font: fonts.bold,
    color: POSTER_PDF_COLOR.ink,
    border: POSTER_PDF_COLOR.ink,
    captionAbove: true,
  })
  drawFactsRail(page, content.reassurance, {
    x: left,
    y: mm(content.geometry.safeMarginMm),
    width,
    height: mm(22),
    font: fonts.mono,
    color: POSTER_PDF_COLOR.paper,
    size: content.typeTiers.factsPt,
  })
}
