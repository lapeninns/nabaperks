import type { TallyPosterContent } from "@/lib/qr/poster-kit-content-types"

import { mm, POSTER_PDF_COLOR } from "./poster-pdf-style"
import { drawKitCenteredText } from "./poster-pdf-kit-venue"
import type { PosterPdfBaseContext } from "./poster-pdf-types"

/**
 * The tally card's stamp circles: today's dashed vermillion circle first,
 * the sealed sun disc last, dashed empties between. A one-stamp card
 * collapses to a single sealed circle carrying the today label.
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
  for (let index = 0; index < stamps; index += 1) {
    const centerX =
      stamps === 1
        ? options.inset + radius
        : options.inset +
          radius +
          (index * (options.innerWidth - radius * 2)) / (stamps - 1)
    const sealed = index === stamps - 1
    const today = index === 0
    if (sealed) {
      page.drawCircle({
        x: centerX,
        y: circleY,
        size: radius,
        color: POSTER_PDF_COLOR.sun,
        borderColor: POSTER_PDF_COLOR.ink,
        borderWidth: 1.7,
      })
      drawKitCenteredText(
        page,
        today ? content.todayLabel.toUpperCase() : "*",
        {
          centerX,
          y: circleY - 3,
          font: today ? fonts.monoBold : fonts.bold,
          size: today ? 8.5 : 14,
          color: POSTER_PDF_COLOR.ink,
        }
      )
    } else if (today) {
      page.drawCircle({
        x: centerX,
        y: circleY,
        size: radius,
        borderColor: POSTER_PDF_COLOR.accent,
        borderWidth: 2,
        borderDashArray: [4, 3],
      })
      drawKitCenteredText(page, content.todayLabel.toUpperCase(), {
        centerX,
        y: circleY - 3,
        font: fonts.monoBold,
        size: 8.5,
        color: POSTER_PDF_COLOR.accent,
      })
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
}
