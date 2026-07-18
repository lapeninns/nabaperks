import type { RGB } from "pdf-lib"

import type { DuotonePosterContent } from "@/lib/qr/poster-kit-content-types"

import { drawWrappedText, mm, POSTER_PDF_COLOR } from "./poster-pdf-style"
import {
  drawKitFriction,
  drawKitMasthead,
  drawKitQrPanel,
} from "./poster-pdf-kit-pieces"
import { drawKitVenueLine } from "./poster-pdf-kit-venue"
import type { PosterPdfBaseContext } from "./poster-pdf-types"

function duotoneSpot(content: DuotonePosterContent): RGB {
  return content.spot === "leaf"
    ? POSTER_PDF_COLOR.leaf
    : POSTER_PDF_COLOR.accent
}

export function drawDuotoneA4(
  context: PosterPdfBaseContext,
  content: DuotonePosterContent
): void {
  const { page, fonts } = context
  const spot = duotoneSpot(content)
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
    lineHeight: content.typeTiers.hookPt * 0.94,
    color: spot,
    maxLines: 2,
  })
  drawWrappedText(page, content.lede, {
    x: left,
    y: headlineBottom - mm(6),
    maxWidth: mm(165),
    font: fonts.bold,
    size: content.typeTiers.substantivePt,
    lineHeight: content.typeTiers.substantivePt + 6,
    color: spot,
    maxLines: 3,
  })

  // Perforated dot strip between the paper half and the ink panel.
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 45; column += 1) {
      page.drawCircle({
        x: left + mm(2) + column * mm(4),
        y: mm(162) + row * mm(4),
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
    size: 13.5,
    font: fonts.bold,
    color: paper,
  })
  drawWrappedText(page, content.sealedLine, {
    x: copyX,
    y: mm(88),
    maxWidth: width - qrSize - mm(10),
    font: fonts.regular,
    size: 12,
    lineHeight: 17,
    color: paper,
    maxLines: 4,
  })
  page.drawText("*", {
    x: left,
    y: mm(42),
    size: 15,
    font: fonts.bold,
    color: paper,
  })
  drawKitVenueLine(page, context.merchantName, {
    x: left + mm(8),
    y: mm(42),
    maxWidth: width - mm(64),
    preferredSize: 15,
    font: fonts.bold,
    color: paper,
  })
  page.drawText(content.memberTag.toUpperCase(), {
    x: left + width - mm(48),
    y: mm(43),
    size: 8.5,
    font: fonts.monoBold,
    color: paper,
  })
  drawWrappedText(page, content.reassurance, {
    x: left,
    y: mm(24),
    maxWidth: width,
    font: fonts.monoBold,
    size: content.typeTiers.factsPt,
    lineHeight: content.typeTiers.factsPt + 3,
    color: paper,
    maxLines: 2,
  })
}
