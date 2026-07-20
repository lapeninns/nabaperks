import type { LastcallPosterContent } from "@/lib/qr/poster-kit-content-types"

import {
  bodyLeading,
  displayLeading,
  drawWrappedText,
  mm,
  POSTER_PDF_COLOR,
  POSTER_PDF_TYPE,
} from "./poster-pdf-style"
import { drawAccentHeadline } from "./poster-pdf-accent"
import {
  drawKitFriction,
  drawKitMasthead,
  drawKitQrPanel,
} from "./poster-pdf-kit-pieces"
import { drawKitCapsule } from "./poster-pdf-kit-capsule"
import { drawKitVenueStrip } from "./poster-pdf-kit-brand"
import { popKitRotation, pushKitRotation } from "./poster-pdf-kit-venue"
import type { PosterPdfBaseContext } from "./poster-pdf-types"

/** Last-orders sky: crescent moon, sparkles, and the clock a couple of
 * minutes shy of midnight. */
function drawLastOrdersSky(context: PosterPdfBaseContext): void {
  const { page } = context
  const paper = POSTER_PDF_COLOR.paper
  page.drawCircle({ x: mm(140), y: mm(76), size: mm(5), color: paper })
  page.drawCircle({
    x: mm(142.5),
    y: mm(77.5),
    size: mm(4.6),
    color: POSTER_PDF_COLOR.ink,
  })
  for (const [sparkX, sparkY] of [
    [152, 63],
    [185, 58],
    [163, 86],
  ]) {
    page.drawRectangle({
      x: mm(sparkX - 1.4),
      y: mm(sparkY) - 0.9,
      width: mm(2.8),
      height: 1.8,
      color: paper,
      opacity: 0.85,
    })
    page.drawRectangle({
      x: mm(sparkX) - 0.9,
      y: mm(sparkY - 1.4),
      width: 1.8,
      height: mm(2.8),
      color: paper,
      opacity: 0.85,
    })
  }
  const clockX = mm(174)
  const clockY = mm(72)
  page.drawCircle({
    x: clockX,
    y: clockY,
    size: mm(10),
    borderColor: paper,
    borderWidth: 1.8,
  })
  page.drawRectangle({
    x: clockX - 0.9,
    y: clockY,
    width: 1.8,
    height: mm(5.5),
    color: paper,
  })
  pushKitRotation(page, 12, clockX, clockY)
  page.drawRectangle({
    x: clockX - 0.9,
    y: clockY,
    width: 1.8,
    height: mm(7.5),
    color: POSTER_PDF_COLOR.sun,
  })
  popKitRotation(page)
  page.drawCircle({
    x: clockX,
    y: clockY,
    size: mm(1),
    color: POSTER_PDF_COLOR.sun,
  })
}

export function drawLastcallA4(
  context: PosterPdfBaseContext,
  content: LastcallPosterContent
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
  const ruleY = drawKitMasthead(page, {
    x: left,
    y: mm(278),
    width,
    lead: content.eyebrow,
    leadColor: POSTER_PDF_COLOR.sun,
    edition: content.edition,
    editionColor: paper,
    fonts,
    rule: "dashed",
    ruleColor: paper,
  })
  // First baseline hangs one display ascent plus a 3 mm gutter below the
  // masthead rule so the caps never strike it.
  const headlineBottom = drawAccentHeadline(
    page,
    {
      beforeAccent: `${content.headline.lead} `,
      accent: content.headline.accent,
      afterAccent: "",
    },
    {
      x: left,
      y: ruleY - mm(3) - content.typeTiers.hookPt * 0.96,
      maxWidth: mm(165),
      font: fonts.bold,
      size: content.typeTiers.hookPt,
      lineHeight: displayLeading(content.typeTiers.hookPt),
      foreground: paper,
      accent: POSTER_PDF_COLOR.sun,
      maxLines: 3,
    }
  )
  const ledeBottom = drawWrappedText(page, content.lede, {
    x: left,
    y: headlineBottom - mm(6),
    maxWidth: mm(165),
    font: fonts.bold,
    size: content.typeTiers.substantivePt,
    lineHeight: bodyLeading(content.typeTiers.substantivePt),
    color: paper,
    maxLines: 3,
  })
  // Valid-today badge with sun hard shadow (7° in CSS ⇒ -7 in PDF space).
  drawKitCapsule(page, content.badge, {
    x: mm(154),
    y: ledeBottom + mm(0.5),
    font: fonts.monoBold,
    size: 9.5,
    textColor: POSTER_PDF_COLOR.white,
    fill: POSTER_PDF_COLOR.accent,
    borderColor: paper,
    rotateDeg: -7,
    shadow: POSTER_PDF_COLOR.sun,
    shadowOffsetMm: 1,
  })

  // Framed night card carrying the QR action.
  const cardX = left
  const cardY = mm(78)
  const cardWidth = mm(64)
  const cardHeight = mm(76)
  page.drawRectangle({
    x: cardX + 4,
    y: cardY - 4,
    width: cardWidth,
    height: cardHeight,
    color: POSTER_PDF_COLOR.sun,
  })
  page.drawRectangle({
    x: cardX,
    y: cardY,
    width: cardWidth,
    height: cardHeight,
    color: POSTER_PDF_COLOR.ink,
    borderColor: paper,
    borderWidth: 1.7,
  })
  const qrSize = mm(content.qr.outerMm)
  drawKitQrPanel(page, context.qrModules, content.qrCaption, {
    x: cardX + mm(5),
    y: cardY + cardHeight - mm(5) - qrSize,
    size: qrSize,
    font: fonts.monoBold,
    captionColor: paper,
    border: paper,
  })
  const copyX = cardX + cardWidth + mm(9)
  drawKitFriction(page, content.friction, {
    x: copyX,
    y: mm(140),
    maxWidth: width - cardWidth - mm(9),
    size: POSTER_PDF_TYPE.frictionPt,
    font: fonts.bold,
    color: paper,
    markColors: [POSTER_PDF_COLOR.sun, POSTER_PDF_COLOR.sun],
  })
  drawWrappedText(page, content.sealedLine, {
    x: copyX,
    y: mm(112),
    maxWidth: width - cardWidth - mm(9),
    font: fonts.regular,
    size: POSTER_PDF_TYPE.bodyPt,
    lineHeight: bodyLeading(POSTER_PDF_TYPE.bodyPt),
    color: paper,
    maxLines: 4,
  })

  drawLastOrdersSky(context)
  drawKitVenueStrip(page, {
    x: left,
    y: mm(47),
    width,
    venue: context.merchantName,
    memberTag: content.memberTag,
    fonts,
    ink: paper,
    brand: "roundel",
    tag: "outline",
    dashedRule: true,
    ruleColor: paper,
  })
  drawWrappedText(page, content.reassurance, {
    x: left,
    y: mm(24),
    maxWidth: width,
    font: fonts.monoBold,
    size: content.typeTiers.factsPt,
    lineHeight: bodyLeading(content.typeTiers.factsPt),
    color: paper,
    maxLines: 2,
  })
}
