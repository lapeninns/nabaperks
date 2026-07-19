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
import type { PosterPdfBaseContext } from "./poster-pdf-types"

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
