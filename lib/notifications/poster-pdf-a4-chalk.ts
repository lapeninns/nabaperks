import type { ChalkPosterContent } from "@/lib/qr/poster-kit-content-types"

import {
  bodyLeading,
  displayLeading,
  drawDashedLine,
  drawWrappedText,
  mm,
  POSTER_PDF_COLOR,
  POSTER_PDF_TYPE,
} from "./poster-pdf-style"
import {
  drawKitMasthead,
  drawKitQrPanel,
  KIT_NIGHT_LEAF,
} from "./poster-pdf-kit-pieces"
import {
  drawKitVenueLine,
  popKitRotation,
  pushKitRotation,
} from "./poster-pdf-kit-venue"
import { drawKitCapsule } from "./poster-pdf-kit-capsule"
import { drawKitBrandRoundel, drawKitWordmark } from "./poster-pdf-kit-brand"
import { drawChalkCircleRow } from "./poster-pdf-a4-chalk-row"
import type { PosterPdfBaseContext } from "./poster-pdf-types"

export function drawChalkA4(
  context: PosterPdfBaseContext,
  content: ChalkPosterContent
): void {
  const { page, fonts } = context
  const chalk = POSTER_PDF_COLOR.paper
  const left = mm(content.geometry.safeMarginMm)
  const pageWidth = mm(content.geometry.sheetWidthMm)
  const pageHeight = mm(content.geometry.sheetHeightMm)
  const width = pageWidth - left * 2
  page.drawRectangle({
    x: 0,
    y: 0,
    width: pageWidth,
    height: pageHeight,
    color: POSTER_PDF_COLOR.ink,
  })
  // The dashed chalk frame around the board.
  const frame = mm(8)
  drawDashedLine(page, {
    x1: frame,
    y1: frame,
    x2: pageWidth - frame,
    y2: frame,
    color: chalk,
  })
  drawDashedLine(page, {
    x1: frame,
    y1: pageHeight - frame,
    x2: pageWidth - frame,
    y2: pageHeight - frame,
    color: chalk,
  })
  drawDashedLine(page, {
    x1: frame,
    y1: frame,
    x2: frame,
    y2: pageHeight - frame,
    color: chalk,
  })
  drawDashedLine(page, {
    x1: pageWidth - frame,
    y1: frame,
    x2: pageWidth - frame,
    y2: pageHeight - frame,
    color: chalk,
  })

  const ruleY = drawKitMasthead(page, {
    x: left,
    y: mm(274),
    width,
    lead: content.eyebrow,
    leadColor: chalk,
    edition: content.edition,
    editionColor: chalk,
    fonts,
    rule: "dashed",
    ruleColor: chalk,
  })
  const headlineBottom = drawWrappedText(page, content.headline, {
    x: left,
    y: ruleY - mm(3) - content.typeTiers.hookPt * 0.96,
    maxWidth: width,
    font: fonts.bold,
    size: content.typeTiers.hookPt,
    lineHeight: displayLeading(content.typeTiers.hookPt),
    color: chalk,
    maxLines: 2,
  })
  // Leaf chalk underline — two hand-set strokes under the headline.
  pushKitRotation(page, -0.6, left + mm(30), headlineBottom + mm(1))
  page.drawRectangle({
    x: left,
    y: headlineBottom + mm(2),
    width: mm(58),
    height: mm(1.6),
    color: KIT_NIGHT_LEAF,
  })
  page.drawRectangle({
    x: left + mm(3),
    y: headlineBottom - mm(0.6),
    width: mm(38),
    height: mm(1.1),
    color: KIT_NIGHT_LEAF,
    opacity: 0.7,
  })
  popKitRotation(page)

  drawWrappedText(page, content.rowNote, {
    x: left,
    y: headlineBottom - mm(6),
    maxWidth: width,
    font: fonts.bold,
    size: content.typeTiers.substantivePt,
    lineHeight: bodyLeading(content.typeTiers.substantivePt),
    color: chalk,
    maxLines: 3,
  })
  drawChalkCircleRow(context, content, {
    left,
    width,
    centerY: mm(153),
  })
  drawWrappedText(page, content.sealedLine, {
    x: left,
    y: mm(131),
    maxWidth: width,
    font: fonts.regular,
    size: POSTER_PDF_TYPE.bodyPt,
    lineHeight: bodyLeading(POSTER_PDF_TYPE.bodyPt),
    color: chalk,
    maxLines: 3,
  })

  // QR in its chalk box, venue chalked up beside it.
  const qrSize = mm(content.qr.outerMm)
  const boxX = left
  const boxY = mm(38)
  const boxWidth = qrSize + mm(10)
  const boxHeight = qrSize + mm(20)
  page.drawRectangle({
    x: boxX,
    y: boxY,
    width: boxWidth,
    height: boxHeight,
    borderColor: chalk,
    borderWidth: 1.6,
    borderDashArray: [6, 4],
  })
  drawKitQrPanel(page, context.qrModules, content.qrCaption, {
    x: boxX + mm(5),
    y: boxY + boxHeight - mm(5) - qrSize,
    size: qrSize,
    font: fonts.monoBold,
    captionColor: chalk,
    border: chalk,
  })
  const brandX = boxX + boxWidth + mm(9)
  drawKitBrandRoundel(page, {
    centerX: brandX + mm(4),
    centerY: mm(86),
    font: fonts.bold,
  })
  drawKitWordmark(page, {
    x: brandX + mm(11),
    y: mm(83.5),
    size: 12,
    font: fonts.bold,
    leadColor: chalk,
    accentColor: POSTER_PDF_COLOR.sun,
  })
  drawKitVenueLine(page, context.merchantName, {
    x: brandX,
    y: mm(70),
    maxWidth: width - boxWidth - mm(9),
    preferredSize: POSTER_PDF_TYPE.laneVenuePt,
    font: fonts.bold,
    color: chalk,
  })
  drawKitCapsule(page, content.memberTag, {
    x: brandX,
    y: mm(56),
    font: fonts.monoBold,
    size: 8.5,
    textColor: chalk,
    borderColor: chalk,
    borderOpacity: 0.5,
  })
  drawWrappedText(page, content.reassurance, {
    x: left,
    y: mm(22),
    maxWidth: width,
    font: fonts.monoBold,
    size: content.typeTiers.factsPt,
    lineHeight: bodyLeading(content.typeTiers.factsPt),
    color: chalk,
    maxLines: 2,
  })
}
