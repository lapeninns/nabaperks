import type { PDFFont, PDFPage, RGB } from "pdf-lib"

import type { TentFaceContent } from "@/lib/qr/tent-content"

import { mm, POSTER_PDF_COLOR } from "./poster-pdf-style"
import { popKitRotation, pushKitRotation } from "./poster-pdf-kit-venue"

export type TentFacePalette = {
  readonly ground: RGB
  readonly ink: RGB
  readonly soft: RGB
  readonly accent: RGB
  readonly qrBorder: RGB
}

export function tentFacePalette(face: TentFaceContent): TentFacePalette {
  if (face.tone === "ink") {
    return {
      ground: POSTER_PDF_COLOR.ink,
      ink: POSTER_PDF_COLOR.paper,
      soft: POSTER_PDF_COLOR.paper,
      accent: POSTER_PDF_COLOR.sun,
      qrBorder: POSTER_PDF_COLOR.paper,
    }
  }
  return {
    ground: POSTER_PDF_COLOR.paper,
    ink: POSTER_PDF_COLOR.ink,
    soft: POSTER_PDF_COLOR.inkSoft,
    accent: POSTER_PDF_COLOR.accent,
    qrBorder: POSTER_PDF_COLOR.ink,
  }
}

/**
 * Stamp strip matching the customer card: N visit stamps, then a separate
 * sealed mystery reward (not the last visit circle).
 */
export function drawStampStrip(
  page: PDFPage,
  options: {
    readonly x: number
    readonly y: number
    readonly count: number
    readonly font: PDFFont
    readonly ink: RGB
    readonly soft: RGB
  }
): void {
  const radius = mm(5)
  const gap = mm(3)
  const step = radius * 2 + gap

  for (let index = 0; index < options.count; index += 1) {
    const centerX = options.x + radius + index * step
    if (index === 0) {
      pushKitRotation(page, -7, centerX, options.y)
      page.drawCircle({
        x: centerX,
        y: options.y,
        size: radius,
        color: POSTER_PDF_COLOR.accent,
        borderColor: POSTER_PDF_COLOR.ink,
        borderWidth: 1,
      })
      page.drawText(String(index + 1), {
        x: centerX - 2.5,
        y: options.y - 3,
        size: 7,
        font: options.font,
        color: POSTER_PDF_COLOR.white,
      })
      popKitRotation(page)
    } else {
      page.drawCircle({
        x: centerX,
        y: options.y,
        size: radius,
        borderColor: options.soft,
        borderWidth: 1,
        borderDashArray: [3, 2],
      })
      page.drawText(String(index + 1), {
        x: centerX - 2.5,
        y: options.y - 3,
        size: 7,
        font: options.font,
        color: options.soft,
      })
    }
  }

  const sealX = options.x + radius + options.count * step
  pushKitRotation(page, 7, sealX, options.y)
  page.drawCircle({
    x: sealX,
    y: options.y,
    size: radius,
    color: POSTER_PDF_COLOR.sun,
    borderColor: POSTER_PDF_COLOR.ink,
    borderWidth: 1,
  })
  page.drawText("?", {
    x: sealX - 2.5,
    y: options.y - 4,
    size: 11,
    font: options.font,
    color: POSTER_PDF_COLOR.ink,
  })
  popKitRotation(page)
}
