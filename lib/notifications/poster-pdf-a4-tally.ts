import { rgb } from "pdf-lib"

import type { TallyPosterContent } from "@/lib/qr/poster-kit-content-types"

import {
  bodyLeading,
  displayLeading,
  drawDashedLine,
  drawWrappedText,
  mm,
  POSTER_PDF_COLOR,
  POSTER_PDF_TYPE,
  standardFontText,
} from "./poster-pdf-style"
import {
  drawKitFriction,
  drawKitMasthead,
  drawKitQrPanel,
} from "./poster-pdf-kit-pieces"
import { drawTallyCircleRow } from "./poster-pdf-a4-tally-circles"
import {
  drawKitVenueLine,
  popKitRotation,
  pushKitRotation,
} from "./poster-pdf-kit-venue"
import { drawKitCapsule } from "./poster-pdf-kit-capsule"
import type { PosterPdfBaseContext } from "./poster-pdf-types"

const CARD_GROUND = rgb(251 / 255, 248 / 255, 241 / 255)

export function drawTallyA4(
  context: PosterPdfBaseContext,
  content: TallyPosterContent
): void {
  const { page, fonts } = context
  const left = mm(content.geometry.safeMarginMm)
  const pageWidth = mm(content.geometry.sheetWidthMm)
  const width = pageWidth - left * 2
  // The pub tabletop: deep paper with a coffee-ring stain half-hidden
  // behind the card object.
  page.drawRectangle({
    x: 0,
    y: 0,
    width: pageWidth,
    height: mm(content.geometry.sheetHeightMm),
    color: POSTER_PDF_COLOR.paperDeep,
  })
  page.drawCircle({
    x: mm(180),
    y: mm(214),
    size: mm(13),
    borderColor: POSTER_PDF_COLOR.inkSoft,
    borderWidth: 2.4,
    borderOpacity: 0.14,
  })
  page.drawCircle({
    x: mm(180),
    y: mm(214),
    size: mm(11.6),
    borderColor: POSTER_PDF_COLOR.inkSoft,
    borderWidth: 1.2,
    borderOpacity: 0.1,
  })
  const ruleY = drawKitMasthead(page, {
    x: left,
    y: mm(278),
    width,
    lead: content.eyebrow,
    leadColor: POSTER_PDF_COLOR.cobalt,
    edition: content.edition,
    editionColor: POSTER_PDF_COLOR.inkSoft,
    fonts,
    rule: "dashed",
    ruleColor: POSTER_PDF_COLOR.inkSoft,
  })
  // Misregistered overprint headline: cobalt echo, vermillion front. The
  // first baseline hangs one display ascent plus a 3 mm gutter below the
  // masthead rule so the caps never strike it.
  const headlineY = ruleY - mm(3) - content.typeTiers.hookPt * 0.96
  drawWrappedText(page, content.headline, {
    x: left + 3.4,
    y: headlineY - 4,
    maxWidth: width,
    font: fonts.bold,
    size: content.typeTiers.hookPt,
    lineHeight: displayLeading(content.typeTiers.hookPt),
    color: POSTER_PDF_COLOR.cobalt,
    maxLines: 2,
  })
  drawWrappedText(page, content.headline, {
    x: left,
    y: headlineY,
    maxWidth: width,
    font: fonts.bold,
    size: content.typeTiers.hookPt,
    lineHeight: displayLeading(content.typeTiers.hookPt),
    color: POSTER_PDF_COLOR.accent,
    maxLines: 2,
  })

  // Only the card slab tilts (0.8° in CSS ⇒ -0.8 in PDF space): rotated
  // text defeats extraction-based print QA, and straight type on a tilted
  // slab reads as the overprint family's misregistration anyway.
  const cardBottom = mm(128)
  const cardTop = mm(206)
  pushKitRotation(page, -0.8, pageWidth / 2, (cardTop + cardBottom) / 2)
  page.drawRectangle({
    x: left + 4,
    y: cardBottom - 4,
    width,
    height: cardTop - cardBottom,
    color: POSTER_PDF_COLOR.cobalt,
  })
  page.drawRectangle({
    x: left,
    y: cardBottom,
    width,
    height: cardTop - cardBottom,
    color: CARD_GROUND,
    borderColor: POSTER_PDF_COLOR.ink,
    borderWidth: 1.7,
  })
  popKitRotation(page)
  const inset = left + mm(8)
  const innerWidth = width - mm(16)
  page.drawText(
    standardFontText(content.cardLabel.toUpperCase(), fonts.monoBold),
    {
      x: inset,
      y: mm(198),
      size: 9,
      font: fonts.monoBold,
      color: POSTER_PDF_COLOR.inkSoft,
    }
  )
  const count = standardFontText(
    content.cardCount.toUpperCase(),
    fonts.monoBold
  )
  page.drawText(count, {
    x: inset + innerWidth - fonts.monoBold.widthOfTextAtSize(count, 9),
    y: mm(198),
    size: 9,
    font: fonts.monoBold,
    color: POSTER_PDF_COLOR.inkSoft,
  })
  drawTallyCircleRow(context, content, { inset, innerWidth })
  drawWrappedText(page, content.explainer, {
    x: inset,
    y: mm(160),
    maxWidth: innerWidth,
    font: fonts.regular,
    size: POSTER_PDF_TYPE.bodyPt,
    lineHeight: bodyLeading(POSTER_PDF_TYPE.bodyPt),
    color: POSTER_PDF_COLOR.inkSoft,
    maxLines: 4,
  })

  const qrSize = mm(content.qr.outerMm)
  drawKitQrPanel(page, context.qrModules, content.qrCaption, {
    x: left,
    y: mm(38),
    size: qrSize,
    font: fonts.monoBold,
    captionColor: POSTER_PDF_COLOR.ink,
    border: POSTER_PDF_COLOR.ink,
    shadow: POSTER_PDF_COLOR.accent,
  })
  const copyX = left + qrSize + mm(9)
  const frictionBottom = drawKitFriction(page, content.friction, {
    x: copyX,
    y: mm(86),
    maxWidth: width - qrSize - mm(9),
    size: POSTER_PDF_TYPE.frictionPt,
    font: fonts.bold,
    color: POSTER_PDF_COLOR.ink,
    markColors: [POSTER_PDF_COLOR.cobalt, POSTER_PDF_COLOR.accent],
  })
  page.drawText(
    standardFontText(content.dateRule.toUpperCase(), fonts.monoBold),
    {
      x: copyX,
      y: frictionBottom - 4,
      size: POSTER_PDF_TYPE.metaPt,
      font: fonts.monoBold,
      color: POSTER_PDF_COLOR.inkSoft,
    }
  )
  drawDashedLine(page, {
    x1: copyX,
    y1: mm(56),
    x2: left + width,
    y2: mm(56),
    color: POSTER_PDF_COLOR.inkSoft,
  })
  drawKitVenueLine(page, context.merchantName, {
    x: copyX,
    y: mm(47),
    maxWidth: width - qrSize - mm(9),
    preferredSize: POSTER_PDF_TYPE.laneVenuePt,
    font: fonts.bold,
    color: POSTER_PDF_COLOR.ink,
  })
  drawKitCapsule(page, content.memberTag, {
    x: copyX,
    y: mm(36),
    font: fonts.monoBold,
    size: 8.5,
    textColor: POSTER_PDF_COLOR.inkSoft,
    fill: POSTER_PDF_COLOR.paperDeep,
  })
  drawWrappedText(page, content.reassurance, {
    x: left,
    y: mm(20),
    maxWidth: width,
    font: fonts.monoBold,
    size: content.typeTiers.factsPt,
    lineHeight: bodyLeading(content.typeTiers.factsPt),
    color: POSTER_PDF_COLOR.inkSoft,
    maxLines: 2,
  })
}
