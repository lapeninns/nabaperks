import type { DuotonePosterContent } from "@/lib/qr/poster-kit-content-types"

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
} from "./poster-pdf-kit-pieces"
import { drawKitVenueStrip } from "./poster-pdf-kit-brand"
import type { PosterPdfBaseContext } from "./poster-pdf-types"

/** Print-shop proof furniture: crop marks, registration targets and the
 * vermillion tint bar down the right margin. */
function drawProofMarks(context: PosterPdfBaseContext): void {
  const { page } = context
  const ink = POSTER_PDF_COLOR.ink
  for (const [x, y, flipX, flipY] of [
    [3, 291, 1, 1],
    [207, 291, -1, 1],
    [3, 6, 1, -1],
    [207, 6, -1, -1],
  ]) {
    page.drawRectangle({
      x: flipX > 0 ? mm(x) : mm(x) - mm(5),
      y: mm(y) - 0.5,
      width: mm(5),
      height: 1,
      color: ink,
      opacity: 0.55,
    })
    page.drawRectangle({
      x: mm(x) - 0.5,
      y: flipY > 0 ? mm(y) - mm(5) : mm(y),
      width: 1,
      height: mm(5),
      color: ink,
      opacity: 0.55,
    })
  }
  for (const targetX of [6, 204]) {
    page.drawCircle({
      x: mm(targetX),
      y: mm(200),
      size: mm(1.8),
      borderColor: ink,
      borderWidth: 0.9,
      borderOpacity: 0.55,
    })
    page.drawRectangle({
      x: mm(targetX - 3),
      y: mm(200) - 0.4,
      width: mm(6),
      height: 0.8,
      color: ink,
      opacity: 0.55,
    })
    page.drawRectangle({
      x: mm(targetX) - 0.4,
      y: mm(197),
      width: 0.8,
      height: mm(6),
      color: ink,
      opacity: 0.55,
    })
  }
  const tints = [1, 0.7, 0.4, 0.15]
  tints.forEach((tint, index) => {
    page.drawRectangle({
      x: mm(199),
      y: mm(178 - index * 5),
      width: mm(5),
      height: mm(5),
      color: POSTER_PDF_COLOR.accent,
      opacity: tint,
    })
  })
  page.drawRectangle({
    x: mm(199),
    y: mm(158),
    width: mm(5),
    height: mm(5),
    color: ink,
  })
}

export function drawDuotoneA4(
  context: PosterPdfBaseContext,
  content: DuotonePosterContent
): void {
  const { page, fonts } = context
  // Window is the kit's sole duotone — the vermillion street run.
  const spot = POSTER_PDF_COLOR.accent
  const paper = POSTER_PDF_COLOR.paper
  const left = mm(content.geometry.safeMarginMm)
  const pageWidth = mm(content.geometry.sheetWidthMm)
  const width = pageWidth - left * 2
  page.drawRectangle({
    x: 0,
    y: 0,
    width: pageWidth,
    height: mm(content.geometry.sheetHeightMm),
    color: paper,
  })

  drawKitMasthead(page, {
    x: left,
    y: mm(276),
    width,
    lead: content.eyebrow,
    leadColor: spot,
    edition: content.edition,
    editionColor: spot,
    fonts,
    rule: "none",
    ruleColor: spot,
  })
  const headlineBottom = drawWrappedText(page, content.headline, {
    x: left,
    y: mm(281) - content.typeTiers.hookPt * 0.96,
    maxWidth: width,
    font: fonts.bold,
    size: content.typeTiers.hookPt,
    lineHeight: displayLeading(content.typeTiers.hookPt),
    color: spot,
    maxLines: 3,
  })
  drawWrappedText(page, content.lede, {
    x: left,
    y: headlineBottom - mm(6),
    maxWidth: mm(165),
    font: fonts.bold,
    size: content.typeTiers.substantivePt,
    lineHeight: bodyLeading(content.typeTiers.substantivePt),
    color: spot,
    maxLines: 3,
  })

  // Perforated dot strip between the paper half and the ink panel.
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 45; column += 1) {
      page.drawCircle({
        x: left + mm(2) + column * mm(4),
        y: mm(156) + row * mm(4),
        size: mm(0.8),
        color: spot,
      })
    }
  }

  const panelTop = mm(152)
  page.drawRectangle({
    x: 0,
    y: 0,
    width: pageWidth,
    height: panelTop,
    color: spot,
  })
  const qrSize = mm(content.qr.outerMm)
  drawKitQrPanel(page, context.qrModules, content.qrCaption, {
    x: left,
    y: mm(68),
    size: qrSize,
    font: fonts.monoBold,
    captionColor: paper,
    border: spot,
  })
  const copyX = left + qrSize + mm(10)
  drawKitFriction(page, content.friction, {
    x: copyX,
    y: mm(112),
    maxWidth: width - qrSize - mm(10),
    size: POSTER_PDF_TYPE.frictionPt,
    font: fonts.bold,
    color: paper,
  })
  drawWrappedText(page, content.sealedLine, {
    x: copyX,
    y: mm(88),
    maxWidth: width - qrSize - mm(10),
    font: fonts.regular,
    size: POSTER_PDF_TYPE.bodyPt,
    lineHeight: bodyLeading(POSTER_PDF_TYPE.bodyPt),
    color: paper,
    maxLines: 4,
  })
  drawKitVenueStrip(page, {
    x: left,
    y: mm(42),
    width,
    venue: context.merchantName,
    memberTag: content.memberTag,
    fonts,
    ink: paper,
    brand: "glyph",
    tag: "plain",
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
  drawProofMarks(context)
}
