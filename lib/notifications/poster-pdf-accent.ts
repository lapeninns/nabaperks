import type { PDFFont, PDFPage, RGB } from "pdf-lib"

import type { AccentHeadline } from "@/lib/qr/poster-content"

import { standardFontText } from "./poster-pdf-style"

type AccentToken = {
  readonly text: string
  readonly accent: boolean
}

export function drawAccentHeadline(
  page: PDFPage,
  headline: AccentHeadline,
  options: {
    readonly x: number
    readonly y: number
    readonly maxWidth: number
    readonly font: PDFFont
    readonly size: number
    readonly lineHeight: number
    readonly foreground: RGB
    readonly accent: RGB
    readonly maxLines: number
    readonly uppercase?: boolean
  }
): number {
  const tokens: AccentToken[] = [
    { text: headline.beforeAccent, accent: false },
    { text: headline.accent, accent: true },
    { text: headline.afterAccent, accent: false },
  ].flatMap((segment) =>
    (segment.text.match(/\s+|\S+/g) ?? []).map((text) => ({
      text: options.uppercase ? text.toUpperCase() : text,
      accent: segment.accent,
    }))
  )
  const lines: Array<{ tokens: AccentToken[]; width: number }> = [
    { tokens: [], width: 0 },
  ]

  for (const token of tokens) {
    let line = lines[lines.length - 1]
    const whitespace = /^\s+$/.test(token.text)
    if (whitespace && line.tokens.length === 0) continue
    const printable = standardFontText(token.text, options.font, token.text)
    const width = options.font.widthOfTextAtSize(printable, options.size)
    const punctuation = /^[.,;:!?)]/.test(token.text)
    if (
      !whitespace &&
      !punctuation &&
      line.tokens.length > 0 &&
      line.width + width > options.maxWidth &&
      lines.length < options.maxLines
    ) {
      while (/^\s+$/.test(line.tokens.at(-1)?.text ?? "")) {
        const removed = line.tokens.pop()
        if (removed) {
          line.width -= options.font.widthOfTextAtSize(
            standardFontText(removed.text, options.font, removed.text),
            options.size
          )
        }
      }
      line = { tokens: [], width: 0 }
      lines.push(line)
    }
    line.tokens.push({ ...token, text: printable })
    line.width += width
  }

  lines.forEach((line, lineIndex) => {
    let cursorX = options.x
    for (const token of line.tokens) {
      const width = options.font.widthOfTextAtSize(token.text, options.size)
      if (!/^\s+$/.test(token.text)) {
        page.drawText(token.text, {
          x: cursorX,
          y: options.y - lineIndex * options.lineHeight,
          font: options.font,
          size: options.size,
          color: token.accent ? options.accent : options.foreground,
        })
      }
      cursorX += width
    }
  })

  return options.y - lines.length * options.lineHeight
}
