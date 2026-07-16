import { type BitMatrix } from "qrcode"
import { rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib"

import type { QrPosterTemplateId } from "@/lib/qr/poster-templates"

export const A4_WIDTH = 595.28
export const A4_HEIGHT = 841.89

/** ISO B5 portrait — table tent print sheet (176 × 250 mm). */
export const B5_WIDTH = 498.9
export const B5_HEIGHT = 708.66

export type PosterStyle = {
  readonly background: RGB
  readonly foreground: RGB
  readonly accent: RGB
  readonly band: RGB
  readonly panel: RGB
  readonly headline: string
  readonly support: string
  readonly friction: string
  readonly qrCaption: string
}

export const POSTER_PDF_COLOR = {
  ink: rgb(33 / 255, 28 / 255, 22 / 255),
  inkSoft: rgb(79 / 255, 71 / 255, 61 / 255),
  paper: rgb(246 / 255, 241 / 255, 230 / 255),
  white: rgb(1, 1, 1),
} as const

const RED = rgb(207 / 255, 51 / 255, 10 / 255)
const BLUE = rgb(43 / 255, 67 / 255, 200 / 255)
const SUN = rgb(245 / 255, 166 / 255, 35 / 255)

export function posterStyle(
  template: QrPosterTemplateId,
  stamps: number
): PosterStyle {
  const firstStamp =
    stamps === 1
      ? "Your reward unlocks straight after."
      : "The rest unlock the mystery."
  const styles: Record<QrPosterTemplateId, PosterStyle> = {
    editorial: {
      background: POSTER_PDF_COLOR.paper,
      foreground: POSTER_PDF_COLOR.ink,
      accent: BLUE,
      band: BLUE,
      panel: POSTER_PDF_COLOR.white,
      headline:
        stamps === 1
          ? "One visit. One surprise."
          : `${stamps} visits. One surprise.`,
      support:
        stamps === 1
          ? "Your first stamp is already waiting. Scan now to unlock your mystery reward."
          : "Your first stamp is already waiting. Collect the rest to unlock the mystery.",
      friction: "NO APP  |  OPENS IN YOUR BROWSER",
      qrCaption: "Scan to unlock your mystery reward",
    },
    bold: {
      background: POSTER_PDF_COLOR.ink,
      foreground: POSTER_PDF_COLOR.paper,
      accent: RED,
      band: RED,
      panel: POSTER_PDF_COLOR.white,
      headline: "Everyone wins something.",
      support:
        "Your first stamp is already waiting. We are not allowed to tell you the reward.",
      friction: "NO APP  |  NO DOWNLOAD  |  NO SPAM",
      qrCaption: "Scan to claim your free stamp",
    },
    ticket: {
      background: POSTER_PDF_COLOR.paper,
      foreground: POSTER_PDF_COLOR.ink,
      accent: RED,
      band: RED,
      panel: POSTER_PDF_COLOR.white,
      headline: "First stamp's free.",
      support: `Claim stamp one today. ${firstStamp}`,
      friction: "NO ACCOUNT NEEDED  |  SCAN WITH YOUR CAMERA",
      qrCaption: "Scan here to claim your free stamp",
    },
    northstar: {
      background: POSTER_PDF_COLOR.ink,
      foreground: POSTER_PDF_COLOR.paper,
      accent: SUN,
      band: POSTER_PDF_COLOR.inkSoft,
      panel: POSTER_PDF_COLOR.white,
      headline: "Everyone wins something.",
      support:
        stamps === 1
          ? "Your first stamp is already inked. Scan to claim it now."
          : `You are one stamp in. ${stamps - 1} more ${stamps === 2 ? "visit unlocks" : "visits unlock"} the mystery.`,
      friction: "NO APP  |  NO DOWNLOAD  |  NO SPAM",
      qrCaption: "Scan to claim your free stamp",
    },
    thermal: {
      background: POSTER_PDF_COLOR.paper,
      foreground: POSTER_PDF_COLOR.ink,
      accent: RED,
      band: RED,
      panel: POSTER_PDF_COLOR.white,
      headline: "Loyalty receipt",
      support: `TODAY'S FIRST STAMP: FREE     ${stamps === 1 ? "VISIT" : "VISITS"} TO UNLOCK: ${stamps}`,
      friction: "TOTAL TO JOIN: GBP 0.00",
      qrCaption: "Scan to claim your free stamp",
    },
    "table-tent": {
      background: POSTER_PDF_COLOR.paper,
      foreground: POSTER_PDF_COLOR.ink,
      accent: RED,
      band: RED,
      panel: POSTER_PDF_COLOR.white,
      headline: "Visit. Stamp. Unlock.",
      support:
        stamps === 1
          ? "One visit unlocks your mystery reward."
          : `${stamps} visits unlock a mystery reward.`,
      friction: "NO APP  |  OPENS IN YOUR BROWSER",
      qrCaption: "Point your camera. Get stamped.",
    },
  }
  return styles[template]
}

export function drawQrCode(
  page: PDFPage,
  modules: BitMatrix,
  x: number,
  y: number,
  size: number
): void {
  const quietZone = 4
  const moduleSize = size / (modules.size + quietZone * 2)
  for (let row = 0; row < modules.size; row += 1) {
    for (let column = 0; column < modules.size; column += 1) {
      if (modules.get(row, column)) {
        page.drawRectangle({
          x: x + (column + quietZone) * moduleSize,
          y: y + (modules.size - row - 1 + quietZone) * moduleSize,
          width: moduleSize,
          height: moduleSize,
          color: POSTER_PDF_COLOR.ink,
        })
      }
    }
  }
}

export function stampRowLabel(count: number): string | null {
  return count > 12 ? `${count} VISITS TO UNLOCK` : null
}

export function drawStampRow(
  page: PDFPage,
  count: number,
  y: number,
  style: PosterStyle,
  font: PDFFont,
  centerX: number = A4_WIDTH / 2
): void {
  const label = stampRowLabel(count)
  if (label) {
    const width = font.widthOfTextAtSize(label, 11)
    page.drawText(label, {
      x: centerX - width / 2,
      y: y - 4,
      size: 11,
      font,
      color: style.foreground,
    })
    return
  }

  const gap = Math.min(38, 360 / count)
  const startX = centerX - (gap * (count - 1)) / 2
  for (let index = 0; index < count; index += 1) {
    page.drawCircle({
      x: startX + index * gap,
      y,
      size: 12,
      color: index === 0 ? style.accent : undefined,
      borderColor: style.foreground,
      borderWidth: 1.5,
    })
  }
}

export function fitSingleLineText(
  value: string,
  font: PDFFont,
  size: number,
  maxWidth: number
): string {
  if (font.widthOfTextAtSize(value, size) <= maxWidth) return value

  const suffix = "..."
  const characters = Array.from(value)
  while (characters.length > 0) {
    characters.pop()
    const candidate = `${characters.join("").trimEnd()}${suffix}`
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) return candidate
  }
  return suffix
}

export function standardFontText(
  value: string,
  font: PDFFont,
  fallback = "YOUR VENUE"
): string {
  const supported = new Set(font.getCharacterSet())
  const printable = Array.from(value.normalize("NFKD"))
    .filter((character) => supported.has(character.codePointAt(0) ?? -1))
    .join("")
    .replace(/\s+/g, " ")
    .trim()
  return printable || fallback
}

export function drawCenteredText(
  page: PDFPage,
  text: string,
  options: {
    readonly y: number
    readonly font: PDFFont
    readonly size: number
    readonly color: RGB
    readonly pageWidth?: number
  }
): void {
  const pageWidth = options.pageWidth ?? A4_WIDTH
  const width = options.font.widthOfTextAtSize(text, options.size)
  page.drawText(text, {
    x: (pageWidth - width) / 2,
    y: options.y,
    size: options.size,
    font: options.font,
    color: options.color,
  })
}

export function drawWrappedText(
  page: PDFPage,
  text: string,
  options: {
    readonly x: number
    readonly y: number
    readonly maxWidth: number
    readonly font: PDFFont
    readonly size: number
    readonly lineHeight: number
    readonly color: RGB
  }
): number {
  const lines: string[] = []
  for (const word of text.split(/\s+/)) {
    const current = lines.at(-1)
    const candidate = current ? `${current} ${word}` : word
    if (
      !current ||
      options.font.widthOfTextAtSize(candidate, options.size) > options.maxWidth
    ) {
      lines.push(word)
    } else {
      lines[lines.length - 1] = candidate
    }
  }
  lines.forEach((line, index) => {
    page.drawText(line, {
      x: options.x,
      y: options.y - index * options.lineHeight,
      font: options.font,
      size: options.size,
      color: options.color,
    })
  })
  return options.y - lines.length * options.lineHeight
}
