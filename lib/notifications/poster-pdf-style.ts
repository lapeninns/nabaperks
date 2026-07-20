import { type BitMatrix } from "qrcode"
import { rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib"
import { posterPalette, posterQrDefaults } from "@/lib/qr/poster-token-readers"

const POSTER_QR = posterQrDefaults()
const POSTER_PALETTE = posterPalette()

function rgbHex(value: string): RGB {
  if (!/^#[0-9a-f]{6}$/i.test(value)) {
    throw new Error(`Invalid poster colour ${value}`)
  }
  return rgb(
    Number.parseInt(value.slice(1, 3), 16) / 255,
    Number.parseInt(value.slice(3, 5), 16) / 255,
    Number.parseInt(value.slice(5, 7), 16) / 255
  )
}

export const POSTER_PDF_COLOR = {
  ink: rgbHex(POSTER_PALETTE.ink),
  inkSoft: rgbHex(POSTER_PALETTE.inkSoft),
  paper: rgbHex(POSTER_PALETTE.paper),
  paperDeep: rgbHex(POSTER_PALETTE.paperDeep),
  card: rgbHex(POSTER_PALETTE.paper),
  accent: rgbHex(POSTER_PALETTE.accent),
  sun: rgbHex(POSTER_PALETTE.sun),
  leaf: rgbHex(POSTER_PALETTE.leaf),
  cobalt: rgbHex(POSTER_PALETTE.cobalt),
  qr: rgbHex(POSTER_QR.ink),
  white: rgbHex(POSTER_PALETTE.white),
}

export function mm(value: number): number {
  return (value * 72) / 25.4
}

/**
 * Locked print type rhythm shared by every A4 sheet: multi-line display
 * stacks breathe at ~1.06x their size, body copy sets at ~1.4x, long-form
 * body prints in the regular weight at one shared size, and the supporting
 * tiers (friction rows, side-lane venue lines, mono meta) each use a single
 * size so the eight designs read as one family.
 */
export const POSTER_PDF_TYPE = {
  displayLeading: 1.06,
  bodyLeading: 1.4,
  bodyPt: 12,
  frictionPt: 12.5,
  laneVenuePt: 15,
  metaPt: 9,
}

export function displayLeading(sizePt: number): number {
  return sizePt * POSTER_PDF_TYPE.displayLeading
}

export function bodyLeading(sizePt: number): number {
  return sizePt * POSTER_PDF_TYPE.bodyLeading
}

export function drawQrCode(
  page: PDFPage,
  modules: BitMatrix,
  x: number,
  y: number,
  outerSize: number
): void {
  page.drawRectangle({
    x,
    y,
    width: outerSize,
    height: outerSize,
    color: POSTER_PDF_COLOR.white,
  })
  const quietZone = POSTER_QR.quietZoneModules
  const moduleSize = outerSize / (modules.size + quietZone * 2)
  for (let row = 0; row < modules.size; row += 1) {
    for (let column = 0; column < modules.size; column += 1) {
      if (!modules.get(row, column)) continue
      page.drawRectangle({
        x: x + (column + quietZone) * moduleSize,
        y: y + (modules.size - row - 1 + quietZone) * moduleSize,
        width: moduleSize,
        height: moduleSize,
        color: POSTER_PDF_COLOR.qr,
      })
    }
  }
}

export function fitSingleLineText(
  value: string,
  font: PDFFont,
  size: number,
  maxWidth: number
): string {
  if (font.widthOfTextAtSize(value, size) <= maxWidth) return value
  const characters = Array.from(value)
  while (characters.length > 0) {
    characters.pop()
    const candidate = `${characters.join("").trimEnd()}...`
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) return candidate
  }
  return "..."
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
    readonly maxLines?: number
  }
): number {
  const words = standardFontText(text, options.font).split(/\s+/)
  const lines: string[] = []
  for (const word of words) {
    const currentIndex = lines.length - 1
    const current = lines[currentIndex]
    const candidate = current ? `${current} ${word}` : word
    if (
      current &&
      options.font.widthOfTextAtSize(candidate, options.size) <=
        options.maxWidth
    ) {
      lines[currentIndex] = candidate
    } else if (!options.maxLines || lines.length < options.maxLines) {
      lines.push(word)
    } else {
      const last = lines.length - 1
      lines[last] = fitSingleLineText(
        `${lines[last]} ${word}`,
        options.font,
        options.size,
        options.maxWidth
      )
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

export function drawDashedLine(
  page: PDFPage,
  options: {
    readonly x1: number
    readonly y1: number
    readonly x2: number
    readonly y2: number
    readonly color: RGB
  }
): void {
  const vertical = options.x1 === options.x2
  const length = vertical
    ? Math.abs(options.y2 - options.y1)
    : Math.abs(options.x2 - options.x1)
  for (let offset = 0; offset < length; offset += 10) {
    const segment = Math.min(6, length - offset)
    page.drawRectangle({
      x: vertical ? options.x1 : Math.min(options.x1, options.x2) + offset,
      y: vertical ? Math.min(options.y1, options.y2) + offset : options.y1,
      width: vertical ? 1 : segment,
      height: vertical ? segment : 1,
      color: options.color,
      opacity: 0.55,
    })
  }
}
