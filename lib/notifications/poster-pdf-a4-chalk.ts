import type { ChalkPosterContent } from "@/lib/qr/poster-kit-content-types"

import {
  bodyLeading,
  displayLeading,
  drawDashedLine,
  drawWrappedText,
  mm,
  POSTER_PDF_COLOR,
  standardFontText,
} from "./poster-pdf-style"
import { KIT_NIGHT_LEAF } from "./poster-pdf-kit-pieces"
import { drawKitVenueLine } from "./poster-pdf-kit-venue"
import { drawKitCapsule } from "./poster-pdf-kit-capsule"
import {
  drawChalkAgeRoundel,
  drawChalkFlourish,
  drawChalkPadlock,
  drawChalkPint,
  drawChalkScissors,
  drawChalkSmiley,
  drawChalkStroke,
} from "./poster-pdf-a4-chalk-doodles"
import { drawChalkQrBlock } from "./poster-pdf-a4-chalk-qr"
import { drawChalkStubRow } from "./poster-pdf-a4-chalk-stubs"
import type { PosterPdfBaseContext } from "./poster-pdf-types"

const ptToMm = (points: number): number => (points * 25.4) / 72

export function drawChalkA4(
  context: PosterPdfBaseContext,
  content: ChalkPosterContent
): void {
  const { page, fonts } = context
  const chalk = POSTER_PDF_COLOR.paper
  const sun = POSTER_PDF_COLOR.sun
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
  for (const line of [
    { x1: frame, y1: frame, x2: pageWidth - frame, y2: frame },
    {
      x1: frame,
      y1: pageHeight - frame,
      x2: pageWidth - frame,
      y2: pageHeight - frame,
    },
    { x1: frame, y1: frame, x2: frame, y2: pageHeight - frame },
    {
      x1: pageWidth - frame,
      y1: frame,
      x2: pageWidth - frame,
      y2: pageHeight - frame,
    },
  ]) {
    drawDashedLine(page, { ...line, color: chalk })
  }

  // Hand-chalked masthead: flourished eyebrow, sun-underlined edition.
  const eyebrow = standardFontText(
    content.eyebrow.toUpperCase(),
    fonts.monoBold
  )
  const eyebrowX = left + mm(5)
  page.drawText(eyebrow, {
    x: eyebrowX,
    y: mm(274),
    size: 10,
    font: fonts.monoBold,
    color: chalk,
  })
  const eyebrowWidth = fonts.monoBold.widthOfTextAtSize(eyebrow, 10)
  drawChalkFlourish(page, left + mm(1), mm(275.2), sun)
  drawChalkFlourish(page, eyebrowX + eyebrowWidth + mm(4), mm(275.2), sun)
  const edition = standardFontText(
    content.edition.toUpperCase(),
    fonts.monoBold
  )
  const editionWidth = fonts.monoBold.widthOfTextAtSize(edition, 8.5)
  page.drawText(edition, {
    x: left + width - editionWidth,
    y: mm(274),
    size: 8.5,
    font: fonts.monoBold,
    color: chalk,
  })
  drawChalkStroke(page, {
    centerX: left + width - editionWidth / 2,
    centerY: mm(271.3),
    lengthMm: ptToMm(editionWidth),
    angleDeg: -1.2,
    color: sun,
  })

  // Two-line headline: cream lead, sun accent with a vermillion underline.
  const hook = content.typeTiers.hookPt
  const leadY = mm(274) - mm(5) - hook * 0.96
  page.drawText(content.headline.lead, {
    x: left,
    y: leadY,
    size: hook,
    font: fonts.bold,
    color: chalk,
  })
  const accentY = leadY - displayLeading(hook)
  page.drawText(content.headline.accent, {
    x: left,
    y: accentY,
    size: hook,
    font: fonts.bold,
    color: sun,
  })
  const accentWidth = fonts.bold.widthOfTextAtSize(
    content.headline.accent,
    hook
  )
  drawChalkStroke(page, {
    centerX: left + accentWidth / 2,
    centerY: accentY - mm(4),
    lengthMm: ptToMm(accentWidth),
    angleDeg: -0.8,
    color: POSTER_PDF_COLOR.accent,
    thicknessMm: 1.4,
  })
  drawChalkStroke(page, {
    centerX: left + accentWidth * 0.4,
    centerY: accentY - mm(6.4),
    lengthMm: ptToMm(accentWidth) * 0.68,
    angleDeg: -0.8,
    color: POSTER_PDF_COLOR.accent,
    thicknessMm: 1,
  })
  // The smiley grins in the clear board right of the short accent word.
  drawChalkSmiley(page, left + accentWidth + mm(16), accentY + mm(9), 7)

  drawWrappedText(page, content.lede, {
    x: left,
    y: mm(200),
    maxWidth: width,
    font: fonts.bold,
    size: content.typeTiers.substantivePt,
    lineHeight: bodyLeading(content.typeTiers.substantivePt),
    color: chalk,
    maxLines: 2,
  })
  drawWrappedText(page, content.sealedLine, {
    x: left,
    y: mm(186),
    maxWidth: width,
    font: fonts.regular,
    size: 12,
    lineHeight: bodyLeading(12),
    color: chalk,
    maxLines: 2,
  })

  // QR in its chalk box, caption arrowed in below.
  drawChalkQrBlock(context, content, { left, boxBottomMm: 104 })

  // Starred friction, then the pint, venue and member capsule.
  const columnX = mm(88)
  const tones = [sun, KIT_NIGHT_LEAF, POSTER_PDF_COLOR.accent]
  content.friction.forEach((line, index) => {
    page.drawText("*", {
      x: columnX,
      y: mm(162 - index * 9) - 2,
      size: 15,
      font: fonts.bold,
      color: tones[index % tones.length],
    })
    page.drawText(standardFontText(line, fonts.bold), {
      x: columnX + mm(6),
      y: mm(162 - index * 9),
      size: 12.5,
      font: fonts.bold,
      color: chalk,
    })
  })
  drawDashedLine(page, {
    x1: columnX,
    y1: mm(136),
    x2: left + width,
    y2: mm(136),
    color: chalk,
  })
  drawChalkPint(page, mm(89), mm(112))
  drawKitVenueLine(page, context.merchantName, {
    x: mm(99),
    y: mm(116),
    maxWidth: left + width - mm(99),
    preferredSize: 20,
    font: fonts.bold,
    color: chalk,
  })
  drawKitCapsule(page, content.memberTag, {
    x: mm(99),
    y: mm(104),
    font: fonts.monoBold,
    size: 8.5,
    textColor: chalk,
    borderColor: chalk,
    borderOpacity: 0.6,
  })

  // Scissor cut line, then the numbered stamp-one tear-off stubs.
  drawDashedLine(page, {
    x1: left,
    y1: mm(90),
    x2: left + width,
    y2: mm(90),
    color: chalk,
  })
  drawChalkScissors(page, mm(22), mm(90))
  drawChalkStubRow(context, content, {
    left,
    width,
    topMm: 86,
    bottomMm: 48,
  })

  drawChalkAgeRoundel(page, mm(23), mm(29), fonts.monoBold)
  drawWrappedText(page, content.reassurance, {
    x: mm(33),
    y: mm(31.5),
    maxWidth: mm(142),
    font: fonts.monoBold,
    size: content.typeTiers.factsPt,
    lineHeight: bodyLeading(content.typeTiers.factsPt),
    color: chalk,
    maxLines: 2,
  })
  drawChalkPadlock(page, mm(186), mm(29))
}
