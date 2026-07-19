import type { PDFFont, PDFPage, RGB } from "pdf-lib"

import { mm, POSTER_PDF_COLOR } from "./poster-pdf-style"
import {
  drawKitCenteredText,
  popKitRotation,
  pushKitRotation,
} from "./poster-pdf-kit-venue"

/**
 * Hand-chalked doodles for the chalk board (Nº 15): accent strokes, the
 * smiley, pint glass, scissors, 18+ roundel and padlock. Shapes only —
 * Wet Ink tokens, no bitmap textures.
 */

/** One short chalk stroke, rotated about its own centre. */
export function drawChalkStroke(
  page: PDFPage,
  options: {
    readonly centerX: number
    readonly centerY: number
    readonly lengthMm: number
    readonly angleDeg: number
    readonly color: RGB
    readonly thicknessMm?: number
  }
): void {
  const thickness = mm(options.thicknessMm ?? 0.9)
  const length = mm(options.lengthMm)
  pushKitRotation(page, options.angleDeg, options.centerX, options.centerY)
  page.drawRectangle({
    x: options.centerX - length / 2,
    y: options.centerY - thickness / 2,
    width: length,
    height: thickness,
    color: options.color,
  })
  popKitRotation(page)
}

/** Two angled strokes either side of a point — the ⚡-style flourish. */
export function drawChalkFlourish(
  page: PDFPage,
  centerX: number,
  centerY: number,
  color: RGB
): void {
  drawChalkStroke(page, {
    centerX,
    centerY: centerY + mm(1.4),
    lengthMm: 2.6,
    angleDeg: 32,
    color,
  })
  drawChalkStroke(page, {
    centerX: centerX + mm(1.2),
    centerY: centerY - mm(1.6),
    lengthMm: 2.6,
    angleDeg: -28,
    color,
  })
}

/** Vermillion outline smiley beside the headline. */
export function drawChalkSmiley(
  page: PDFPage,
  centerX: number,
  centerY: number,
  radiusMm: number
): void {
  const radius = mm(radiusMm)
  page.drawCircle({
    x: centerX,
    y: centerY,
    size: radius,
    borderColor: POSTER_PDF_COLOR.accent,
    borderWidth: 2,
  })
  for (const side of [-1, 1]) {
    page.drawCircle({
      x: centerX + side * radius * 0.38,
      y: centerY + radius * 0.22,
      size: mm(0.9),
      color: POSTER_PDF_COLOR.accent,
    })
  }
  // The smile: short line segments along a lower arc.
  const smileRadius = radius * 0.55
  let previousX = centerX - smileRadius
  let previousY = centerY - radius * 0.1
  for (let step = 1; step <= 6; step += 1) {
    const angle = Math.PI + (step / 6) * Math.PI
    const x = centerX + smileRadius * Math.cos(angle)
    const y = centerY - radius * 0.1 + smileRadius * 0.55 * Math.sin(angle)
    page.drawLine({
      start: { x: previousX, y: previousY },
      end: { x, y },
      thickness: 2,
      color: POSTER_PDF_COLOR.accent,
    })
    previousX = x
    previousY = y
  }
}

/** Sun pint glass with a cream foam head, chalked beside the venue. */
export function drawChalkPint(page: PDFPage, x: number, y: number): void {
  const width = mm(6.5)
  const height = mm(10.5)
  page.drawRectangle({
    x: x + mm(0.9),
    y,
    width: width - mm(1.8),
    height: height - mm(3),
    color: POSTER_PDF_COLOR.sun,
  })
  page.drawRectangle({
    x,
    y: y - mm(0.6),
    width,
    height,
    borderColor: POSTER_PDF_COLOR.paper,
    borderWidth: 1.4,
  })
  // Foam blobs proud of the rim.
  for (const [dx, size] of [
    [1.4, 1.2],
    [3.2, 1.5],
    [5, 1.1],
  ]) {
    page.drawCircle({
      x: x + mm(dx),
      y: y + height - mm(0.4),
      size: mm(size),
      color: POSTER_PDF_COLOR.paper,
    })
  }
}

/** Crossed-blade scissors doodle riding the cut line. */
export function drawChalkScissors(
  page: PDFPage,
  centerX: number,
  centerY: number
): void {
  const chalk = POSTER_PDF_COLOR.paper
  for (const angle of [24, -24]) {
    drawChalkStroke(page, {
      centerX,
      centerY,
      lengthMm: 7,
      angleDeg: angle,
      color: chalk,
      thicknessMm: 0.8,
    })
  }
  for (const side of [-1, 1]) {
    page.drawCircle({
      x: centerX - mm(3.4),
      y: centerY + side * mm(2),
      size: mm(1.1),
      borderColor: chalk,
      borderWidth: 1.2,
    })
  }
}

/** Sun 18+ roundel for the footer. */
export function drawChalkAgeRoundel(
  page: PDFPage,
  centerX: number,
  centerY: number,
  font: PDFFont
): void {
  page.drawCircle({
    x: centerX,
    y: centerY,
    size: mm(5),
    borderColor: POSTER_PDF_COLOR.sun,
    borderWidth: 1.6,
  })
  drawKitCenteredText(page, "18+", {
    centerX,
    y: centerY - 3,
    font,
    size: 8.5,
    color: POSTER_PDF_COLOR.sun,
  })
}

/** Sun padlock doodle — shackle circle tucked behind the ink-filled body. */
export function drawChalkPadlock(
  page: PDFPage,
  centerX: number,
  centerY: number
): void {
  const sun = POSTER_PDF_COLOR.sun
  page.drawCircle({
    x: centerX,
    y: centerY + mm(1.6),
    size: mm(2.2),
    borderColor: sun,
    borderWidth: 1.4,
  })
  page.drawRectangle({
    x: centerX - mm(3.4),
    y: centerY - mm(4.6),
    width: mm(6.8),
    height: mm(5.4),
    color: POSTER_PDF_COLOR.ink,
    borderColor: sun,
    borderWidth: 1.4,
  })
  page.drawCircle({
    x: centerX,
    y: centerY - mm(2),
    size: mm(0.9),
    color: sun,
  })
  drawChalkFlourish(page, centerX + mm(5.6), centerY + mm(3), sun)
}
