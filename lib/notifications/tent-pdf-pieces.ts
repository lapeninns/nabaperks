import type { PDFFont, PDFPage, RGB } from "pdf-lib"

import type { TentFaceContent } from "@/lib/qr/tent-content"

import { mm, POSTER_PDF_COLOR } from "./poster-pdf-style"

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

function drawVenueInitials(venue: string): string {
  const initials = venue
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("")
  return initials.length > 0 ? initials : "*"
}

export function drawStampStrip(
  page: PDFPage,
  options: {
    readonly x: number
    readonly y: number
    readonly count: number
    readonly venue: string
    readonly font: PDFFont
    readonly ink: RGB
    readonly soft: RGB
  }
): void {
  const radius = mm(5)
  const gap = mm(3)
  const initials = drawVenueInitials(options.venue)
  for (let index = 0; index < options.count; index += 1) {
    const centerX = options.x + radius + index * (radius * 2 + gap)
    const isVenue = index === 0
    const isSeal = index === options.count - 1
    if (isSeal) {
      page.drawCircle({
        x: centerX,
        y: options.y,
        size: radius,
        color: POSTER_PDF_COLOR.sun,
        borderColor: POSTER_PDF_COLOR.ink,
        borderWidth: 1,
      })
      page.drawText("?", {
        x: centerX - 2.5,
        y: options.y - 4,
        size: 11,
        font: options.font,
        color: POSTER_PDF_COLOR.ink,
      })
    } else if (isVenue) {
      page.drawCircle({
        x: centerX,
        y: options.y,
        size: radius,
        color: POSTER_PDF_COLOR.accent,
        borderColor: POSTER_PDF_COLOR.ink,
        borderWidth: 1,
      })
      page.drawText(initials, {
        x: centerX - initials.length * 2.4,
        y: options.y - 3,
        size: 7,
        font: options.font,
        color: POSTER_PDF_COLOR.white,
      })
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
}
