import type { PDFFont, PDFPage, RGB } from "pdf-lib"

import { POSTER_BRAND_WORDMARK_PDF } from "@/lib/qr/poster-brand"

import {
  drawDashedLine,
  mm,
  POSTER_PDF_COLOR,
  standardFontText,
} from "./poster-pdf-style"
import { drawKitCapsule, measureKitCapsule } from "./poster-pdf-kit-capsule"
import {
  drawKitCenteredText,
  drawKitVenueLine,
  popKitRotation,
  pushKitRotation,
} from "./poster-pdf-kit-venue"
import type { PdfFonts } from "./poster-pdf-types"

/**
 * Shared brand anatomy from counter-kit React pieces: PosterWordmark,
 * KitBrandMark roundel, and the duotone/lastcall venue strip.
 */

/** Wet Ink wordmark — accent on the middle *a* / *A*. */
export function drawKitWordmark(
  page: PDFPage,
  options: {
    readonly x: number
    readonly y: number
    readonly size: number
    readonly font: PDFFont
    readonly leadColor: RGB
    readonly accentColor: RGB
    readonly casing?: "title" | "upper"
  }
): number {
  const parts =
    options.casing === "upper"
      ? POSTER_BRAND_WORDMARK_PDF
      : { lead: "Nab ", accent: "a", tail: " Perks" }
  let cursor = options.x
  page.drawText(parts.lead, {
    x: cursor,
    y: options.y,
    size: options.size,
    font: options.font,
    color: options.leadColor,
  })
  cursor += options.font.widthOfTextAtSize(parts.lead, options.size)
  page.drawText(parts.accent, {
    x: cursor,
    y: options.y,
    size: options.size,
    font: options.font,
    color: options.accentColor,
  })
  cursor += options.font.widthOfTextAtSize(parts.accent, options.size)
  page.drawText(parts.tail, {
    x: cursor,
    y: options.y,
    size: options.size,
    font: options.font,
    color: options.leadColor,
  })
  return (
    cursor +
    options.font.widthOfTextAtSize(parts.tail, options.size) -
    options.x
  )
}

/** KitBrandMark roundel — vermillion disc with white star, default −7° tilt. */
export function drawKitBrandRoundel(
  page: PDFPage,
  options: {
    readonly centerX: number
    readonly centerY: number
    readonly font: PDFFont
    readonly sizeMm?: number
    readonly rotateDeg?: number
  }
): void {
  const radius = mm(options.sizeMm ?? 8) / 2
  const rotateDeg = options.rotateDeg ?? -7
  if (rotateDeg !== 0) {
    pushKitRotation(page, rotateDeg, options.centerX, options.centerY)
  }
  page.drawCircle({
    x: options.centerX,
    y: options.centerY,
    size: radius,
    color: POSTER_PDF_COLOR.accent,
  })
  drawKitCenteredText(page, "*", {
    centerX: options.centerX,
    y: options.centerY - radius * 0.45,
    font: options.font,
    size: radius * 1.55,
    color: POSTER_PDF_COLOR.white,
  })
  if (rotateDeg !== 0) popKitRotation(page)
}

/**
 * Venue strip: optional dashed top rule, brand mark, venue, trailing tag.
 * Mirrors KitBrandMark + KitVenueName + KitMemberTag on duotone/lastcall.
 */
export function drawKitVenueStrip(
  page: PDFPage,
  options: {
    readonly x: number
    readonly y: number
    readonly width: number
    readonly venue: string
    readonly memberTag: string
    readonly fonts: PdfFonts
    readonly ink: RGB
    readonly brand: "roundel" | "glyph" | "none"
    readonly tag: "outline" | "plain"
    readonly dashedRule?: boolean
    readonly ruleColor?: RGB
  }
): void {
  if (options.dashedRule) {
    drawDashedLine(page, {
      x1: options.x,
      y1: options.y + mm(6),
      x2: options.x + options.width,
      y2: options.y + mm(6),
      color: options.ruleColor ?? options.ink,
    })
  }

  let venueX = options.x
  if (options.brand === "roundel") {
    drawKitBrandRoundel(page, {
      centerX: options.x + mm(4),
      centerY: options.y + mm(2.5),
      font: options.fonts.bold,
    })
    venueX = options.x + mm(11)
  } else if (options.brand === "glyph") {
    page.drawText("*", {
      x: options.x,
      y: options.y,
      size: 15,
      font: options.fonts.bold,
      color: options.ink,
    })
    venueX = options.x + mm(8)
  }

  const tagWidth =
    options.tag === "outline"
      ? measureKitCapsule(options.memberTag, options.fonts.monoBold, 8.5).width
      : options.fonts.monoBold.widthOfTextAtSize(
          standardFontText(
            options.memberTag.toUpperCase(),
            options.fonts.monoBold
          ),
          8.5
        )

  drawKitVenueLine(page, options.venue, {
    x: venueX,
    y: options.y,
    maxWidth: options.width - (venueX - options.x) - tagWidth - mm(4),
    preferredSize: 15,
    font: options.fonts.bold,
    color: options.ink,
  })

  if (options.tag === "outline") {
    drawKitCapsule(page, options.memberTag, {
      x: options.x + options.width - tagWidth,
      y: options.y - mm(1.5),
      font: options.fonts.monoBold,
      size: 8.5,
      textColor: options.ink,
      borderColor: options.ink,
      borderOpacity: 0.5,
    })
  } else {
    page.drawText(
      standardFontText(options.memberTag.toUpperCase(), options.fonts.monoBold),
      {
        x: options.x + options.width - tagWidth,
        y: options.y + 1,
        size: 8.5,
        font: options.fonts.monoBold,
        color: options.ink,
      }
    )
  }
}
