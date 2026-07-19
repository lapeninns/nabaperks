import type { ChalkPosterContent } from "@/lib/qr/poster-kit-content-types"

import { mm, POSTER_PDF_COLOR } from "./poster-pdf-style"
import {
  drawKitCenteredText,
  popKitRotation,
  pushKitRotation,
} from "./poster-pdf-kit-venue"
import type { PosterPdfBaseContext } from "./poster-pdf-types"

/**
 * The chalk stamp row matching the customer card: N dashed visit circles
 * with today's chalked in vermillion, then the separate sun-sealed mystery
 * reward — never the last circle itself.
 */
export function drawChalkCircleRow(
  context: PosterPdfBaseContext,
  content: ChalkPosterContent,
  options: {
    readonly left: number
    readonly width: number
    readonly centerY: number
  }
): void {
  const { page, fonts } = context
  const chalk = POSTER_PDF_COLOR.paper
  const radius = mm(10.5)
  const stamps = context.stampsRequired
  const slotCount = stamps + 1
  const centerAt = (index: number): number => {
    if (slotCount === 1) return options.left + radius
    return (
      options.left +
      radius +
      (index * (options.width - radius * 2)) / (slotCount - 1)
    )
  }

  for (let index = 0; index < stamps; index += 1) {
    const centerX = centerAt(index)
    if (index === 0) {
      // The vermillion "today" circle, labelled in chalk.
      page.drawCircle({
        x: centerX,
        y: options.centerY,
        size: radius,
        borderColor: POSTER_PDF_COLOR.accent,
        borderWidth: 2.2,
        borderDashArray: [5, 4],
      })
      pushKitRotation(page, -6, centerX, options.centerY)
      drawKitCenteredText(page, content.todayLabel.toUpperCase(), {
        centerX,
        y: options.centerY - 3,
        font: fonts.monoBold,
        size: 8.5,
        color: chalk,
      })
      popKitRotation(page)
    } else {
      page.drawCircle({
        x: centerX,
        y: options.centerY,
        size: radius,
        borderColor: chalk,
        borderWidth: 1.6,
        borderOpacity: 0.75,
        borderDashArray: [5, 4],
      })
    }
  }

  const sealX = centerAt(stamps)
  page.drawCircle({
    x: sealX,
    y: options.centerY,
    size: radius,
    color: POSTER_PDF_COLOR.sun,
    borderColor: chalk,
    borderWidth: 1.6,
  })
  pushKitRotation(page, -6, sealX, options.centerY)
  drawKitCenteredText(page, "?", {
    centerX: sealX,
    y: options.centerY - 3,
    font: fonts.bold,
    size: 14,
    color: POSTER_PDF_COLOR.ink,
  })
  popKitRotation(page)
}
