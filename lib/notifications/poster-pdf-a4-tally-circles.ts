import type { TallyPosterContent } from "@/lib/qr/poster-kit-content-types"

import { mm, POSTER_PDF_COLOR } from "./poster-pdf-style"
import {
  drawKitCenteredText,
  popKitRotation,
  pushKitRotation,
} from "./poster-pdf-kit-venue"
import type { PosterPdfBaseContext } from "./poster-pdf-types"

/**
 * Tally stamp row matching the customer card: N visit circles, then a
 * separate sealed mystery reward. Today labels the first visit circle;
 * empties fill the rest; the sun "?" sits after the row.
 */
export function drawTallyCircleRow(
  context: PosterPdfBaseContext,
  content: TallyPosterContent,
  options: {
    readonly inset: number
    readonly innerWidth: number
  }
): void {
  const { page, fonts } = context
  const radius = mm(10.5)
  const circleY = mm(180)
  const stamps = context.stampsRequired
  const slotCount = stamps + 1

  const centerAt = (index: number): number => {
    if (slotCount === 1) return options.inset + radius
    return (
      options.inset +
      radius +
      (index * (options.innerWidth - radius * 2)) / (slotCount - 1)
    )
  }

  for (let index = 0; index < stamps; index += 1) {
    const centerX = centerAt(index)
    const today = index === 0
    if (today) {
      page.drawCircle({
        x: centerX,
        y: circleY,
        size: radius,
        borderColor: POSTER_PDF_COLOR.accent,
        borderWidth: 2,
        borderDashArray: [4, 3],
      })
      pushKitRotation(page, -6, centerX, circleY)
      drawKitCenteredText(page, content.todayLabel.toUpperCase(), {
        centerX,
        y: circleY - 3,
        font: fonts.monoBold,
        size: 8.5,
        color: POSTER_PDF_COLOR.accent,
      })
      popKitRotation(page)
    } else {
      page.drawCircle({
        x: centerX,
        y: circleY,
        size: radius,
        borderColor: POSTER_PDF_COLOR.ink,
        borderWidth: 1.7,
        borderOpacity: 0.4,
        borderDashArray: [4, 3],
      })
    }
  }

  const sealX = centerAt(stamps)
  page.drawCircle({
    x: sealX,
    y: circleY,
    size: radius,
    color: POSTER_PDF_COLOR.sun,
    borderColor: POSTER_PDF_COLOR.ink,
    borderWidth: 1.7,
  })
  pushKitRotation(page, -6, sealX, circleY)
  drawKitCenteredText(page, "?", {
    centerX: sealX,
    y: circleY - 3,
    font: fonts.bold,
    size: 14,
    color: POSTER_PDF_COLOR.ink,
  })
  popKitRotation(page)
}
