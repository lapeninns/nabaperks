import type { PDFFont, PDFPage, RGB } from "pdf-lib"

import { mm, standardFontText } from "./poster-pdf-style"
import { popKitRotation, pushKitRotation } from "./poster-pdf-kit-venue"

/** Measure capsule width/height for layout before drawKitCapsule. */
export function measureKitCapsule(
  text: string,
  font: PDFFont,
  size: number
): { readonly width: number; readonly height: number } {
  const label = standardFontText(text.toUpperCase(), font)
  return { width: font.widthOfTextAtSize(label, size) + 16, height: size + 9 }
}

/** Mono capsule — optional rotate/shadow for badges and sealed pills. */
export function drawKitCapsule(
  page: PDFPage,
  text: string,
  options: {
    readonly x: number
    readonly y: number
    readonly font: PDFFont
    readonly size: number
    readonly textColor: RGB
    readonly fill?: RGB
    readonly borderColor?: RGB
    readonly borderOpacity?: number
    readonly rotateDeg?: number
    readonly shadow?: RGB
    readonly shadowOffsetMm?: number
  }
): number {
  const label = standardFontText(text.toUpperCase(), options.font)
  const { width, height } = measureKitCapsule(text, options.font, options.size)
  const radius = height / 2
  const centerX = options.x + width / 2
  const centerY = options.y + height / 2
  const shadowOffset = mm(options.shadowOffsetMm ?? 1)
  const rotateDeg = options.rotateDeg ?? 0
  const borderOn = (labelOn: boolean) =>
    labelOn && options.borderColor ? 1.2 : 0

  const paint = (
    x: number,
    y: number,
    fill: RGB | undefined,
    labelOn: boolean
  ) => {
    for (const plateX of [x + radius, x + width - radius]) {
      page.drawCircle({
        x: plateX,
        y: y + radius,
        size: radius,
        color: fill,
        borderColor: labelOn ? options.borderColor : undefined,
        borderWidth: borderOn(labelOn),
        borderOpacity: options.borderOpacity,
      })
    }
    page.drawRectangle({
      x: x + radius,
      y,
      width: width - height,
      height,
      color: fill,
      borderColor: !fill && labelOn ? options.borderColor : undefined,
      borderWidth: !fill ? borderOn(labelOn) : 0,
      borderOpacity: options.borderOpacity,
    })
    if (labelOn) {
      page.drawText(label, {
        x: x + 8,
        y: y + (height - options.size) / 2 + 1,
        size: options.size,
        font: options.font,
        color: options.textColor,
      })
    }
  }

  if (rotateDeg !== 0) pushKitRotation(page, rotateDeg, centerX, centerY)
  if (options.shadow) {
    paint(
      options.x + shadowOffset,
      options.y - shadowOffset,
      options.shadow,
      false
    )
  }
  paint(options.x, options.y, options.fill, true)
  if (rotateDeg !== 0) popKitRotation(page)
  return width
}
