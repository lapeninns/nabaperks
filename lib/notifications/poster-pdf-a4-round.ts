import type { RoundPosterContent } from "@/lib/qr/poster-kit-content-types"

import {
  bodyLeading,
  displayLeading,
  drawWrappedText,
  mm,
  POSTER_PDF_COLOR,
  POSTER_PDF_TYPE,
} from "./poster-pdf-style"
import {
  drawKitFriction,
  drawKitMasthead,
  drawKitQrPanel,
  KIT_NIGHT_LEAF,
} from "./poster-pdf-kit-pieces"
import {
  drawKitCapsule,
  drawKitCenteredText,
  drawKitVenueLine,
} from "./poster-pdf-kit-venue"
import type { PosterPdfBaseContext } from "./poster-pdf-types"

export function drawRoundA4(
  context: PosterPdfBaseContext,
  content: RoundPosterContent
): void {
  const { page, fonts } = context
  const paper = POSTER_PDF_COLOR.paper
  const left = mm(content.geometry.safeMarginMm)
  const pageWidth = mm(content.geometry.sheetWidthMm)
  const width = pageWidth - left * 2
  page.drawRectangle({
    x: 0,
    y: 0,
    width: pageWidth,
    height: mm(content.geometry.sheetHeightMm),
    color: POSTER_PDF_COLOR.ink,
  })
  drawKitMasthead(page, {
    x: left,
    y: mm(278),
    width,
    lead: content.eyebrow,
    leadColor: KIT_NIGHT_LEAF,
    edition: content.edition,
    editionColor: paper,
    fonts,
    rule: "dashed",
    ruleColor: paper,
  })

  // "Same" in paper, "again?" in night leaf — stacked like the print.
  const hook = content.typeTiers.hookPt
  page.drawText(content.headline.lead, {
    x: left,
    y: mm(248),
    size: hook,
    font: fonts.bold,
    color: paper,
  })
  page.drawText(content.headline.accent, {
    x: left,
    y: mm(248) - displayLeading(hook),
    size: hook,
    font: fonts.bold,
    color: KIT_NIGHT_LEAF,
  })

  const copyWidth = mm(95)
  drawWrappedText(page, content.lede, {
    x: left,
    y: mm(202),
    maxWidth: copyWidth,
    font: fonts.bold,
    size: content.typeTiers.substantivePt,
    lineHeight: bodyLeading(content.typeTiers.substantivePt),
    color: paper,
    maxLines: 5,
  })
  drawWrappedText(page, content.sealedLine, {
    x: left,
    y: mm(163),
    maxWidth: copyWidth,
    font: fonts.regular,
    size: POSTER_PDF_TYPE.bodyPt,
    lineHeight: bodyLeading(POSTER_PDF_TYPE.bodyPt),
    color: paper,
    maxLines: 4,
  })
  drawKitFriction(page, content.friction, {
    x: left,
    y: mm(133),
    maxWidth: copyWidth,
    size: POSTER_PDF_TYPE.frictionPt,
    font: fonts.bold,
    color: paper,
    markColors: [KIT_NIGHT_LEAF, KIT_NIGHT_LEAF],
  })

  // The beermat: sun-shadowed circle carrying the per-date rule.
  const matCenterX = mm(158)
  const matCenterY = mm(178)
  const matRadius = mm(37)
  page.drawCircle({
    x: matCenterX + 4.5,
    y: matCenterY - 4.5,
    size: matRadius,
    color: POSTER_PDF_COLOR.sun,
  })
  page.drawCircle({
    x: matCenterX,
    y: matCenterY,
    size: matRadius,
    color: POSTER_PDF_COLOR.ink,
    borderColor: paper,
    borderWidth: 1.7,
  })
  page.drawCircle({
    x: matCenterX,
    y: matCenterY,
    size: matRadius - mm(4.5),
    borderColor: paper,
    borderWidth: 1.4,
    borderOpacity: 0.45,
    borderDashArray: [4, 4],
  })
  drawKitCenteredText(page, "*", {
    centerX: matCenterX,
    y: matCenterY + mm(8),
    font: fonts.bold,
    size: 22,
    color: KIT_NIGHT_LEAF,
  })
  content.matLines.forEach((line, index) => {
    drawKitCenteredText(page, line.toUpperCase(), {
      centerX: matCenterX,
      y: matCenterY - mm(index * 5),
      font: fonts.monoBold,
      size: 10,
      color: paper,
    })
  })

  const qrSize = mm(content.qr.outerMm)
  drawKitQrPanel(page, context.qrModules, content.qrCaption, {
    x: left,
    y: mm(36),
    size: qrSize,
    font: fonts.monoBold,
    captionColor: paper,
    border: paper,
    shadow: POSTER_PDF_COLOR.sun,
  })
  const brandX = left + qrSize + mm(9)
  page.drawCircle({
    x: brandX + mm(4),
    y: mm(80),
    size: mm(4),
    color: POSTER_PDF_COLOR.accent,
  })
  drawKitCenteredText(page, "*", {
    centerX: brandX + mm(4),
    y: mm(77.5),
    font: fonts.bold,
    size: 12.5,
    color: POSTER_PDF_COLOR.white,
  })
  page.drawText("Nab a Perks", {
    x: brandX + mm(11),
    y: mm(77.5),
    size: 12,
    font: fonts.bold,
    color: paper,
  })
  drawKitVenueLine(page, context.merchantName, {
    x: brandX,
    y: mm(64),
    maxWidth: width - qrSize - mm(9),
    preferredSize: POSTER_PDF_TYPE.laneVenuePt,
    font: fonts.bold,
    color: paper,
  })
  drawKitCapsule(page, content.memberTag, {
    x: brandX,
    y: mm(50),
    font: fonts.monoBold,
    size: 8.5,
    textColor: paper,
    borderColor: paper,
    borderOpacity: 0.5,
  })
  drawWrappedText(page, content.reassurance, {
    x: left,
    y: mm(20),
    maxWidth: width,
    font: fonts.monoBold,
    size: content.typeTiers.factsPt,
    lineHeight: bodyLeading(content.typeTiers.factsPt),
    color: paper,
    maxLines: 2,
  })
}
