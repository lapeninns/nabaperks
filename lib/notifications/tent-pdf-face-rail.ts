import type { PDFPage } from "pdf-lib"

import {
  fitSingleLineText,
  mm,
  POSTER_PDF_COLOR,
  standardFontText,
} from "./poster-pdf-style"
import type { PdfFonts } from "./poster-pdf-types"
import type { TentFacePalette } from "./tent-pdf-pieces"
import { TENT_TYPE } from "./tent-pdf-typography"

/** The ink header rail: brand mark + wordmark, kicker, venue chip. */
export function drawTentHeaderRail(
  page: PDFPage,
  options: {
    readonly originX: number
    readonly top: number
    readonly width: number
    readonly railH: number
    readonly inset: number
    readonly venue: string
    readonly kicker: string
    readonly fonts: PdfFonts
    readonly ground: TentFacePalette["ground"]
    readonly rail: TentFacePalette["ink"]
  }
): void {
  const { originX, top, width, railH, inset, fonts, ground, rail } = options
  page.drawRectangle({
    x: originX,
    y: top - railH,
    width,
    height: railH,
    color: rail,
  })

  const mark = mm(TENT_TYPE.brandMarkMm)
  const markX = originX + inset
  const markY = top - railH / 2 - mark / 2
  page.drawCircle({
    x: markX + mark / 2,
    y: markY + mark / 2,
    size: mark / 2,
    color: POSTER_PDF_COLOR.accent,
    borderColor: ground,
    borderWidth: 0.8,
  })
  page.drawText("*", {
    x: markX + mark / 2 - 2.2,
    y: markY + mark / 2 - 3.2,
    size: 8,
    font: fonts.bold,
    color: POSTER_PDF_COLOR.white,
  })

  const brandBaseline = top - railH / 2 - TENT_TYPE.railBaselineDropPt
  const nab = "Nab "
  const a = "a"
  const perks = " Perks"
  let brandX = markX + mark + mm(1.5)
  page.drawText(nab, {
    x: brandX,
    y: brandBaseline,
    size: TENT_TYPE.brandPt,
    font: fonts.bold,
    color: ground,
  })
  brandX += fonts.bold.widthOfTextAtSize(nab, TENT_TYPE.brandPt)
  page.drawText(a, {
    x: brandX,
    y: brandBaseline,
    size: TENT_TYPE.brandPt,
    font: fonts.bold,
    color: POSTER_PDF_COLOR.sun,
  })
  brandX += fonts.bold.widthOfTextAtSize(a, TENT_TYPE.brandPt)
  page.drawText(perks, {
    x: brandX,
    y: brandBaseline,
    size: TENT_TYPE.brandPt,
    font: fonts.bold,
    color: ground,
  })

  // Product edition pill: kicker label + venue chip (matches TentFace kicker).
  const venueChip = fitSingleLineText(
    standardFontText(options.venue.toUpperCase(), fonts.monoBold),
    fonts.monoBold,
    TENT_TYPE.kickerPt,
    width * 0.28
  )
  const chipPadX = 4
  const chipPadY = 2
  const chipTextW = fonts.monoBold.widthOfTextAtSize(
    venueChip,
    TENT_TYPE.kickerPt
  )
  const chipW = chipTextW + chipPadX * 2
  const chipH = TENT_TYPE.kickerPt + chipPadY * 2
  const chipX = originX + width - inset - chipW
  const chipY = top - railH / 2 - chipH / 2
  page.drawRectangle({
    x: chipX,
    y: chipY,
    width: chipW,
    height: chipH,
    color: POSTER_PDF_COLOR.accent,
  })
  page.drawText(venueChip, {
    x: chipX + chipPadX,
    y: chipY + chipPadY,
    size: TENT_TYPE.kickerPt,
    font: fonts.monoBold,
    color: POSTER_PDF_COLOR.white,
  })

  const kickerLabel = fitSingleLineText(
    standardFontText(options.kicker.toUpperCase(), fonts.monoBold),
    fonts.monoBold,
    TENT_TYPE.kickerPt,
    chipX - brandX - mm(8)
  )
  const kickerW = fonts.monoBold.widthOfTextAtSize(
    kickerLabel,
    TENT_TYPE.kickerPt
  )
  page.drawText(kickerLabel, {
    x: chipX - mm(2) - kickerW,
    y: brandBaseline,
    size: TENT_TYPE.kickerPt,
    font: fonts.monoBold,
    color: ground,
  })
}
