import { rgb } from "pdf-lib"

import type { PinnedPosterContent } from "@/lib/qr/poster-kit-content-types"

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
  drawKitFriction,
  drawKitMasthead,
  drawKitQrPanel,
} from "./poster-pdf-kit-pieces"
import {
  drawKitCenteredText,
  drawKitVenueLine,
  popKitRotation,
  pushKitRotation,
} from "./poster-pdf-kit-venue"
import { drawKitCapsule } from "./poster-pdf-kit-capsule"
import {
  drawPinnedBoardNote,
  drawPinnedTape,
} from "./poster-pdf-a4-pinned-board"
import type { PosterPdfBaseContext } from "./poster-pdf-types"

const NOTE_CARD = rgb(251 / 255, 248 / 255, 241 / 255)

export function drawPinnedA4(
  context: PosterPdfBaseContext,
  content: PinnedPosterContent
): void {
  const { page, fonts } = context
  const left = mm(content.geometry.safeMarginMm)
  const pageWidth = mm(content.geometry.sheetWidthMm)
  const width = pageWidth - left * 2
  page.drawRectangle({
    x: 0,
    y: 0,
    width: pageWidth,
    height: mm(content.geometry.sheetHeightMm),
    color: POSTER_PDF_COLOR.paperDeep,
  })
  drawPinnedBoardNote(context)

  const cardBottom = mm(40)
  const cardTop = mm(262)
  // Only the note slab tilts (-1.2° in CSS ⇒ +1.2 in PDF space): rotated
  // text defeats extraction-based print QA, and straight type on a tilted
  // slab reads as the overprint family's misregistration anyway.
  pushKitRotation(page, 1.2, pageWidth / 2, (cardTop + cardBottom) / 2)
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
    color: NOTE_CARD,
    borderColor: POSTER_PDF_COLOR.ink,
    borderWidth: 1.7,
  })
  page.drawCircle({
    x: pageWidth / 2 + 2,
    y: cardTop - 2,
    size: mm(5),
    color: POSTER_PDF_COLOR.ink,
  })
  page.drawCircle({
    x: pageWidth / 2,
    y: cardTop,
    size: mm(5),
    color: POSTER_PDF_COLOR.cobalt,
    borderColor: POSTER_PDF_COLOR.ink,
    borderWidth: 1.7,
  })
  popKitRotation(page)
  drawPinnedTape(context)

  const inset = left + mm(12)
  const innerWidth = width - mm(24)
  drawKitMasthead(page, {
    x: inset,
    y: mm(246),
    width: innerWidth,
    lead: content.eyebrow,
    leadColor: POSTER_PDF_COLOR.cobalt,
    edition: content.edition,
    editionColor: POSTER_PDF_COLOR.inkSoft,
    fonts,
    rule: "none",
    ruleColor: POSTER_PDF_COLOR.ink,
  })
  // Misregistered overprint: cobalt echo under the vermillion pass. The
  // baseline clears the masthead so display caps never paint over it.
  drawWrappedText(page, content.headline, {
    x: inset + 3.4,
    y: mm(226) - 4,
    maxWidth: innerWidth,
    font: fonts.bold,
    size: content.typeTiers.hookPt,
    lineHeight: displayLeading(content.typeTiers.hookPt),
    color: POSTER_PDF_COLOR.cobalt,
    maxLines: 2,
  })
  const headlineBottom = drawWrappedText(page, content.headline, {
    x: inset,
    y: mm(226),
    maxWidth: innerWidth,
    font: fonts.bold,
    size: content.typeTiers.hookPt,
    lineHeight: displayLeading(content.typeTiers.hookPt),
    color: POSTER_PDF_COLOR.accent,
    maxLines: 2,
  })
  drawWrappedText(page, content.lede, {
    x: inset,
    y: headlineBottom - mm(6),
    maxWidth: mm(158),
    font: fonts.regular,
    size: content.typeTiers.substantivePt,
    lineHeight: bodyLeading(content.typeTiers.substantivePt),
    color: POSTER_PDF_COLOR.ink,
    maxLines: 3,
  })

  const qrSize = mm(content.qr.outerMm)
  drawKitQrPanel(page, context.qrModules, content.qrCaption, {
    x: inset,
    y: mm(96),
    size: qrSize,
    font: fonts.monoBold,
    captionColor: POSTER_PDF_COLOR.ink,
    border: POSTER_PDF_COLOR.ink,
    shadow: POSTER_PDF_COLOR.accent,
  })
  const copyX = inset + qrSize + mm(9)
  drawKitFriction(page, content.friction, {
    x: copyX,
    y: mm(142),
    maxWidth: innerWidth - qrSize - mm(9),
    size: POSTER_PDF_TYPE.frictionPt,
    font: fonts.bold,
    color: POSTER_PDF_COLOR.ink,
    markColors: [POSTER_PDF_COLOR.accent, POSTER_PDF_COLOR.cobalt],
  })
  drawDashedLine(page, {
    x1: copyX,
    y1: mm(114),
    x2: inset + innerWidth,
    y2: mm(114),
    color: POSTER_PDF_COLOR.inkSoft,
  })
  drawKitVenueLine(page, context.merchantName, {
    x: copyX,
    y: mm(104),
    maxWidth: innerWidth - qrSize - mm(9),
    preferredSize: POSTER_PDF_TYPE.laneVenuePt,
    font: fonts.bold,
    color: POSTER_PDF_COLOR.ink,
  })
  drawKitCapsule(page, content.memberTag, {
    x: copyX,
    y: mm(93),
    font: fonts.monoBold,
    size: 8.5,
    textColor: POSTER_PDF_COLOR.inkSoft,
    fill: POSTER_PDF_COLOR.paperDeep,
  })

  // Perforated stamp-one tear-off stubs along the card foot.
  const stubTop = mm(54)
  drawDashedLine(page, {
    x1: left,
    y1: stubTop,
    x2: left + width,
    y2: stubTop,
    color: POSTER_PDF_COLOR.inkSoft,
  })
  const stubWidth = width / 6
  for (let stub = 0; stub < 6; stub += 1) {
    const centerX = left + stubWidth * stub + stubWidth / 2
    const color =
      stub % 2 === 0 ? POSTER_PDF_COLOR.accent : POSTER_PDF_COLOR.cobalt
    drawKitCenteredText(page, content.stubTop.toUpperCase(), {
      centerX,
      y: mm(48.5),
      font: fonts.monoBold,
      size: 8,
      color,
    })
    drawKitCenteredText(page, content.stubBottom.toUpperCase(), {
      centerX,
      y: mm(44.5),
      font: fonts.monoBold,
      size: 8,
      color,
    })
    if (stub < 5) {
      drawDashedLine(page, {
        x1: left + stubWidth * (stub + 1),
        y1: cardBottom,
        x2: left + stubWidth * (stub + 1),
        y2: stubTop,
        color: POSTER_PDF_COLOR.inkSoft,
      })
    }
  }

  drawWrappedText(page, content.reassurance, {
    x: left,
    y: mm(24),
    maxWidth: width,
    font: fonts.monoBold,
    size: content.typeTiers.factsPt,
    lineHeight: bodyLeading(content.typeTiers.factsPt),
    color: POSTER_PDF_COLOR.inkSoft,
    maxLines: 2,
  })
}
