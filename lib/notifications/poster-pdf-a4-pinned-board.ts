import { rgb } from "pdf-lib"

import { mm, POSTER_PDF_COLOR } from "./poster-pdf-style"
import { popKitRotation, pushKitRotation } from "./poster-pdf-kit-venue"
import type { PosterPdfBaseContext } from "./poster-pdf-types"

const NOTE_CARD = rgb(251 / 255, 248 / 255, 241 / 255)

/**
 * Notice-board furniture behind and over the pinned note: a second note
 * peeking out underneath with its own sun pin, and masking-tape strips
 * stuck across the top corners.
 */

/** The earlier notice, mostly hidden behind the main card and poking
 * out of its right edge. Draw first. */
export function drawPinnedBoardNote(context: PosterPdfBaseContext): void {
  const { page } = context
  pushKitRotation(page, -4, mm(194), mm(110))
  page.drawRectangle({
    x: mm(181),
    y: mm(97),
    width: mm(26),
    height: mm(26),
    color: NOTE_CARD,
    borderColor: POSTER_PDF_COLOR.ink,
    borderWidth: 1.2,
  })
  popKitRotation(page)
  page.drawCircle({
    x: mm(200),
    y: mm(110),
    size: mm(2.6),
    color: POSTER_PDF_COLOR.sun,
    borderColor: POSTER_PDF_COLOR.ink,
    borderWidth: 1.2,
  })
}

/** Masking tape over the note's top corners. Draw after the card. */
export function drawPinnedTape(context: PosterPdfBaseContext): void {
  const { page } = context
  for (const [centerX, angle] of [
    [22, 42],
    [188, -42],
  ]) {
    pushKitRotation(page, angle, mm(centerX), mm(258))
    page.drawRectangle({
      x: mm(centerX - 12),
      y: mm(254.5),
      width: mm(24),
      height: mm(7),
      color: POSTER_PDF_COLOR.sun,
      opacity: 0.4,
    })
    popKitRotation(page)
  }
}
