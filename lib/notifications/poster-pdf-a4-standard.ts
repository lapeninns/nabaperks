import type { PDFPage, RGB } from "pdf-lib"

import type { CopyDrivenPosterContent } from "@/lib/qr/poster-content"

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

function fillPage(
  page: PDFPage,
  content: CopyDrivenPosterContent,
  color: RGB
): void {
  page.drawRectangle({
    x: 0,
    y: 0,
    width: mm(content.geometry.sheetWidthMm),
    height: mm(content.geometry.sheetHeightMm),
    color,
  })
}

function footer(
  context: PosterPdfBaseContext,
  content: CopyDrivenPosterContent,
  foreground: RGB,
  background?: RGB
): void {
  drawFactsRail(context.page, content.reassurance, {
    x: mm(content.geometry.safeMarginMm),
    y: mm(content.geometry.safeMarginMm),
    width:
      mm(content.geometry.sheetWidthMm) - mm(content.geometry.safeMarginMm * 2),
    height: mm(20),
    font: context.fonts.mono,
    color: foreground,
    background,
    size: content.typeTiers.factsPt,
  })
}

export function drawEditorialA4(
  context: PosterPdfBaseContext,
  content: CopyDrivenPosterContent
): void {
  const { page, fonts } = context
  const left = mm(content.geometry.safeMarginMm)
  const pageWidth = mm(content.geometry.sheetWidthMm)
  const pageHeight = mm(content.geometry.sheetHeightMm)
  const liveWidth = pageWidth - left * 2
  fillPage(page, content, POSTER_PDF_COLOR.paper)
  drawIdentityRail(page, {
    merchantName: context.merchantName,
    x: left,
    y: pageHeight - mm(35),
    width: liveWidth,
    height: mm(18),
    foreground: POSTER_PDF_COLOR.ink,
    accent: POSTER_PDF_COLOR.accent,
    fonts,
    size: content.typeTiers.factsPt,
  })
  const headlineBottom = drawAccentHeadline(page, content.headline, {
    x: left,
    y: pageHeight - mm(56),
    maxWidth: liveWidth,
    font: fonts.bold,
    size: content.typeTiers.hookPt,
    lineHeight: content.typeTiers.hookPt * 0.91,
    foreground: POSTER_PDF_COLOR.ink,
    accent: POSTER_PDF_COLOR.accent,
    maxLines: 4,
  })
  drawAccentRule(page, left, headlineBottom - 2, mm(54))
  drawWrappedText(page, `${content.support} ${content.rewardDetail}`, {
    x: left + mm(17),
    y: headlineBottom - mm(11),
    maxWidth: mm(116),
    font: fonts.bold,
    size: content.typeTiers.substantivePt,
    lineHeight: content.typeTiers.substantivePt + 4,
    color: POSTER_PDF_COLOR.ink,
    maxLines: 4,
  })
  page.drawText(content.frictionLine, {
    x: left,
    y: mm(98),
    size: 10,
    font: fonts.mono,
    color: POSTER_PDF_COLOR.inkSoft,
  })
  drawOfferedStampRow(page, context.stampsRequired, {
    x: left,
    y: mm(78),
    width: mm(103),
    foreground: POSTER_PDF_COLOR.ink,
    accent: POSTER_PDF_COLOR.accent,
    font: fonts.mono,
  })
  drawWrappedText(page, content.progress, {
    x: left,
    y: mm(67),
    maxWidth: mm(103),
    font: fonts.regular,
    size: 10,
    lineHeight: 13,
    color: POSTER_PDF_COLOR.inkSoft,
    maxLines: 3,
  })
  const qrSize = mm(content.qr.outerMm)
  drawQrAction(page, context.qrModules, content.qrCaption, {
    x: pageWidth - left - qrSize,
    y: mm(54),
    size: qrSize,
    font: fonts.bold,
    color: POSTER_PDF_COLOR.ink,
    border: POSTER_PDF_COLOR.ink,
    captionAbove: true,
  })
  footer(context, content, POSTER_PDF_COLOR.ink)
}

export function drawBoldA4(
  context: PosterPdfBaseContext,
  content: CopyDrivenPosterContent
): void {
  const { page, fonts } = context
  const left = mm(content.geometry.safeMarginMm)
  const pageWidth = mm(content.geometry.sheetWidthMm)
  const pageHeight = mm(content.geometry.sheetHeightMm)
  const liveWidth = pageWidth - left * 2
  fillPage(page, content, POSTER_PDF_COLOR.ink)
  drawIdentityRail(page, {
    merchantName: context.merchantName,
    x: left,
    y: pageHeight - mm(35),
    width: liveWidth,
    height: mm(18),
    foreground: POSTER_PDF_COLOR.paper,
    accent: POSTER_PDF_COLOR.sun,
    fonts,
    size: content.typeTiers.factsPt,
  })
  const bottom = drawAccentHeadline(page, content.headline, {
    x: left,
    y: pageHeight - mm(51),
    maxWidth: liveWidth,
    font: fonts.bold,
    size: content.typeTiers.hookPt,
    lineHeight: content.typeTiers.hookPt * 0.91,
    foreground: POSTER_PDF_COLOR.paper,
    accent: POSTER_PDF_COLOR.accent,
    maxLines: 5,
    uppercase: true,
  })
  drawHardBox(page, {
    x: left,
    y: bottom - mm(22),
    width: mm(132),
    height: mm(16),
    fill: POSTER_PDF_COLOR.accent,
    border: POSTER_PDF_COLOR.paper,
    shadow: POSTER_PDF_COLOR.qr,
  })
  drawWrappedText(page, content.rewardDetail, {
    x: left + 10,
    y: bottom - mm(11),
    maxWidth: mm(125),
    font: fonts.bold,
    size: content.typeTiers.substantivePt,
    lineHeight: content.typeTiers.substantivePt + 3,
    color: POSTER_PDF_COLOR.white,
    maxLines: 2,
  })
  drawWrappedText(page, content.support, {
    x: left,
    y: bottom - mm(34),
    maxWidth: mm(104),
    font: fonts.bold,
    size: content.typeTiers.substantivePt,
    lineHeight: content.typeTiers.substantivePt + 3,
    color: POSTER_PDF_COLOR.paper,
    maxLines: 3,
  })
  page.drawText(content.frictionLine.toUpperCase(), {
    x: left,
    y: mm(97),
    size: 11,
    font: fonts.mono,
    color: POSTER_PDF_COLOR.paper,
  })
  const qrSize = mm(content.qr.outerMm)
  drawQrAction(page, context.qrModules, content.qrCaption, {
    x: pageWidth - left - qrSize,
    y: mm(52),
    size: qrSize,
    font: fonts.bold,
    color: POSTER_PDF_COLOR.paper,
    border: POSTER_PDF_COLOR.paper,
    captionAbove: true,
  })
  drawOfferedStampRow(page, context.stampsRequired, {
    x: left,
    y: mm(74),
    width: mm(103),
    foreground: POSTER_PDF_COLOR.paper,
    accent: POSTER_PDF_COLOR.sun,
    font: fonts.mono,
  })
  drawWrappedText(page, content.progress, {
    x: left,
    y: mm(61),
    maxWidth: mm(103),
    font: fonts.regular,
    size: 10,
    lineHeight: 13,
    color: POSTER_PDF_COLOR.paper,
    maxLines: 3,
  })
  footer(context, content, POSTER_PDF_COLOR.paper)
}
