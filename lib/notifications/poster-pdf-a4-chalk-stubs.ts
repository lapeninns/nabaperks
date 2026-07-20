import type { RGB } from "pdf-lib"

import type { ChalkPosterContent } from "@/lib/qr/poster-kit-content-types"

import { drawDashedLine, mm, POSTER_PDF_COLOR } from "./poster-pdf-style"
import { drawKitCenteredText } from "./poster-pdf-kit-venue"
import { KIT_NIGHT_LEAF } from "./poster-pdf-kit-pieces"
import {
  drawChalkFlourish,
  drawChalkStroke,
} from "./poster-pdf-a4-chalk-doodles"
import type { PosterPdfBaseContext } from "./poster-pdf-types"

/** Coloured chalk cycle for stub numbers — readable accents on ink. */
export const CHALK_STUB_TONES: readonly RGB[] = [
  POSTER_PDF_COLOR.accent,
  POSTER_PDF_COLOR.sun,
  KIT_NIGHT_LEAF,
]

/**
 * Numbered stamp-one tear-off stubs along the board foot: one dashed cell
 * per required visit, each with a circled chalk number and the stamp-one
 * reminder in that stub's chalk tone.
 */
export function drawChalkStubRow(
  context: PosterPdfBaseContext,
  content: ChalkPosterContent,
  options: {
    readonly left: number
    readonly width: number
    readonly topMm: number
    readonly bottomMm: number
  }
): void {
  const { page, fonts } = context
  const chalk = POSTER_PDF_COLOR.paper
  const top = mm(options.topMm)
  const bottom = mm(options.bottomMm)
  const stubs = context.stampsRequired

  drawDashedLine(page, {
    x1: options.left,
    y1: top,
    x2: options.left + options.width,
    y2: top,
    color: chalk,
  })
  drawDashedLine(page, {
    x1: options.left,
    y1: bottom,
    x2: options.left + options.width,
    y2: bottom,
    color: chalk,
  })
  drawDashedLine(page, {
    x1: options.left,
    y1: bottom,
    x2: options.left,
    y2: top,
    color: chalk,
  })
  drawDashedLine(page, {
    x1: options.left + options.width,
    y1: bottom,
    x2: options.left + options.width,
    y2: top,
    color: chalk,
  })

  const stubWidth = options.width / stubs
  for (let stub = 0; stub < stubs; stub += 1) {
    const tone = CHALK_STUB_TONES[stub % CHALK_STUB_TONES.length]
    const centerX = options.left + stubWidth * stub + stubWidth / 2
    const circleY = mm(options.topMm - 12)
    page.drawCircle({
      x: centerX,
      y: circleY,
      size: mm(5.2),
      borderColor: tone,
      borderWidth: 1.8,
    })
    drawKitCenteredText(page, String(stub + 1), {
      centerX,
      y: circleY - 4.5,
      font: fonts.bold,
      size: 13,
      color: tone,
    })
    drawChalkFlourish(page, centerX - mm(8.6), circleY, tone)
    drawChalkFlourish(page, centerX + mm(7.4), circleY, tone)
    drawKitCenteredText(page, content.stubTop.toUpperCase(), {
      centerX,
      y: mm(options.topMm - 25),
      font: fonts.monoBold,
      size: 9.5,
      color: tone,
    })
    drawKitCenteredText(page, content.stubBottom.toUpperCase(), {
      centerX,
      y: mm(options.topMm - 30),
      font: fonts.monoBold,
      size: 9.5,
      color: tone,
    })
    drawChalkStroke(page, {
      centerX,
      centerY: mm(options.topMm - 33.5),
      lengthMm: 13,
      angleDeg: -1.2,
      color: tone,
      thicknessMm: 0.8,
    })
    if (stub > 0) {
      drawDashedLine(page, {
        x1: options.left + stubWidth * stub,
        y1: bottom,
        x2: options.left + stubWidth * stub,
        y2: top,
        color: chalk,
      })
    }
  }
}
