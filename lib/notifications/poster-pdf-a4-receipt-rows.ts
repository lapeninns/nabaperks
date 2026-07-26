import { liveArea } from "@/lib/print/geometry"
import { RHYTHM_BASE_MM } from "@/lib/print/rhythm"

import {
  drawDashedLine,
  mm,
  POSTER_PDF_COLOR,
  standardFontText,
} from "./poster-pdf-style"
import { drawKitCenteredText } from "./poster-pdf-kit-venue"
import type { PosterPdfBaseContext } from "./poster-pdf-types"

/**
 * Docket strip geometry, anchored to the print system rather than to six
 * hand-picked numbers. The strip is inset two rhythm steps from each edge of
 * the A4 live area, and its own copy inset is one rhythm step — so every value
 * here is derived, and the symmetry is checkable instead of coincidental.
 *
 * Was: left 35, width 140, innerLeft 43, innerWidth 124 — an 8 mm inset off
 * the scale, which is why nobody could tell whether it was deliberate.
 */
const STRIP_INSET_MM = RHYTHM_BASE_MM * 3
const STRIP_COPY_INSET_MM = RHYTHM_BASE_MM

const A4_LIVE = liveArea("a4Poster")
const stripLeft = A4_LIVE.xMm + STRIP_INSET_MM
const stripWidth = A4_LIVE.widthMm - STRIP_INSET_MM * 2

export const RECEIPT_STRIP = {
  left: stripLeft,
  width: stripWidth,
  bottom: 6,
  top: 291,
  innerLeft: stripLeft + STRIP_COPY_INSET_MM,
  innerWidth: stripWidth - STRIP_COPY_INSET_MM * 2,
}

/** Punched perforation dots across the strip head or foot. */
export function drawReceiptPerforation(
  context: PosterPdfBaseContext,
  yMm: number
): void {
  const { left, width } = RECEIPT_STRIP
  for (let x = left + 5; x <= left + width - 5; x += 3.2) {
    context.page.drawCircle({
      x: mm(x),
      y: mm(yMm),
      size: mm(0.7),
      color: POSTER_PDF_COLOR.paperDeep,
    })
  }
}

/** One mono line item: label, dotted leader, right-aligned value. The
 * baseline arrives in PDF points — the docket flows a running cursor. */
export function drawReceiptItemRow(
  context: PosterPdfBaseContext,
  baselineY: number,
  label: string,
  value: string
): void {
  const { page, fonts } = context
  const { innerLeft, innerWidth } = RECEIPT_STRIP
  const size = 11
  const left = standardFontText(label.toUpperCase(), fonts.monoBold)
  const right = standardFontText(value.toUpperCase(), fonts.monoBold)
  page.drawText(left, {
    x: mm(innerLeft),
    y: baselineY,
    size,
    font: fonts.monoBold,
    color: POSTER_PDF_COLOR.ink,
  })
  const rightWidth = fonts.monoBold.widthOfTextAtSize(right, size)
  page.drawText(right, {
    x: mm(innerLeft + innerWidth) - rightWidth,
    y: baselineY,
    size,
    font: fonts.monoBold,
    color: POSTER_PDF_COLOR.ink,
  })
  const leaderStart =
    mm(innerLeft) + fonts.monoBold.widthOfTextAtSize(left, size) + mm(3)
  const leaderEnd = mm(innerLeft + innerWidth) - rightWidth - mm(3)
  if (leaderEnd > leaderStart + mm(4)) {
    drawDashedLine(page, {
      x1: leaderStart,
      y1: baselineY + mm(1),
      x2: leaderEnd,
      y2: baselineY + mm(1),
      color: POSTER_PDF_COLOR.inkSoft,
    })
  }
}

/** The sun "?" seal stamped just left of the reward row's value. */
export function drawReceiptSealMark(
  context: PosterPdfBaseContext,
  value: string,
  baselineY: number
): void {
  const { page, fonts } = context
  const valueWidth = fonts.monoBold.widthOfTextAtSize(
    standardFontText(value.toUpperCase(), fonts.monoBold),
    11
  )
  const sealX =
    mm(RECEIPT_STRIP.innerLeft + RECEIPT_STRIP.innerWidth) -
    valueWidth -
    mm(5.2)
  page.drawCircle({
    x: sealX,
    y: baselineY + 4,
    size: mm(3),
    color: POSTER_PDF_COLOR.sun,
    borderColor: POSTER_PDF_COLOR.ink,
    borderWidth: 1.1,
  })
  drawKitCenteredText(page, "?", {
    centerX: sealX,
    y: baselineY + 0.8,
    font: fonts.bold,
    size: 8.5,
    color: POSTER_PDF_COLOR.ink,
  })
}
