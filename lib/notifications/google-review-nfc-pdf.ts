import type { BitMatrix } from "qrcode"
import { rgb, type PDFDocument, type PDFPage } from "pdf-lib"

import type { NfcCardContent } from "@/lib/qr/nfc-card-content"
import type { NfcSquareContent } from "@/lib/qr/nfc-square-content"

import {
  drawQrCode,
  mm,
  POSTER_PDF_COLOR,
  standardFontText,
} from "./poster-pdf-style"
import type { PdfFonts } from "./poster-pdf-types"

const REVIEW_COLOR = {
  blue: rgb(26 / 255, 115 / 255, 232 / 255),
  googleBlue: rgb(66 / 255, 133 / 255, 244 / 255),
  googleGreen: rgb(52 / 255, 168 / 255, 83 / 255),
  googleRed: rgb(234 / 255, 67 / 255, 53 / 255),
  yellow: rgb(251 / 255, 188 / 255, 4 / 255),
  yellowDeep: rgb(227 / 255, 116 / 255, 0),
  cream: rgb(247 / 255, 241 / 255, 232 / 255),
  line: rgb(229 / 255, 220 / 255, 205 / 255),
  faint: rgb(107 / 255, 98 / 255, 89 / 255),
}

const GOOGLE_MARK_PATHS = [
  {
    color: REVIEW_COLOR.googleBlue,
    path: "M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z",
  },
  {
    color: REVIEW_COLOR.googleGreen,
    path: "M12 22c2.7 0 4.97-.9 6.62-2.36l-3.24-2.54c-.9.6-2.05.96-3.38.96-2.6 0-4.81-1.76-5.6-4.13H3.05v2.62A10 10 0 0 0 12 22Z",
  },
  {
    color: REVIEW_COLOR.yellow,
    path: "M6.4 13.93A6.02 6.02 0 0 1 6.08 12c0-.67.12-1.32.32-1.93V7.45H3.05A10 10 0 0 0 2 12c0 1.62.39 3.15 1.05 4.55l3.35-2.62Z",
  },
  {
    color: REVIEW_COLOR.googleRed,
    path: "M12 5.94c1.47 0 2.78.5 3.82 1.5l2.86-2.87A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.95 5.45l3.35 2.62C7.19 7.7 9.4 5.94 12 5.94Z",
  },
] as const

const REVIEW_STAR_PATH =
  "M12 2.1 14.98 8.13 21.64 9.1 16.82 13.79 17.96 20.42 12 17.29 6.04 20.42 7.18 13.79 2.36 9.1 9.02 8.13Z"

type CardPagesInput = {
  readonly document: PDFDocument
  readonly content: NfcCardContent
  readonly venue: string
  readonly qrModules: BitMatrix
  readonly fonts: PdfFonts
  readonly retainFonts: (page: PDFPage) => void
}

export function drawGoogleReviewCardPages({
  document,
  content,
  venue,
  qrModules,
  fonts,
  retainFonts,
}: CardPagesInput): void {
  const pageSize: [number, number] = [
    mm(content.geometry.cardWidthMm),
    mm(content.geometry.cardHeightMm),
  ]
  const front = document.addPage(pageSize)
  retainFonts(front)
  drawCardFront(front, content, fonts)

  const back = document.addPage(pageSize)
  retainFonts(back)
  drawCardBack(back, content, venue, qrModules, fonts)
}

function drawCardFront(
  page: PDFPage,
  content: NfcCardContent,
  fonts: PdfFonts
): void {
  const width = mm(content.geometry.cardWidthMm)
  const height = mm(content.geometry.cardHeightMm)
  const stageHeight = height * 0.39
  const { front } = content
  const [headlineLead, headlineAccent] = splitTrailingWords(front.brandName, 1)

  drawBase(page, width, height)
  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height: stageHeight,
    color: REVIEW_COLOR.blue,
  })
  drawCentered(
    page,
    front.brandEyebrow.toUpperCase(),
    0,
    width,
    height - mm(6.2),
    fonts.bold,
    6.5,
    REVIEW_COLOR.blue
  )
  drawMixedCentered(
    page,
    headlineLead,
    headlineAccent,
    height - mm(12.7),
    fonts.bold,
    15.5,
    POSTER_PDF_COLOR.ink,
    REVIEW_COLOR.blue,
    width
  )
  drawCenteredWrapped(
    page,
    front.stampCue,
    mm(5),
    width - mm(10),
    height - mm(17.3),
    fonts.regular,
    6.7,
    POSTER_PDF_COLOR.inkSoft,
    3
  )
  drawGoogleBadge(page, width / 2, stageHeight + mm(1.75), mm(7.25))
  drawStars(page, width / 2 - mm(11.3), mm(11.5), mm(3.8))
  drawButton(
    page,
    front.tapWord.toUpperCase(),
    (width - mm(58)) / 2,
    mm(3),
    mm(58),
    mm(8),
    fonts,
    10.5
  )
}

function drawCardBack(
  page: PDFPage,
  content: NfcCardContent,
  venue: string,
  qrModules: BitMatrix,
  fonts: PdfFonts
): void {
  const width = mm(content.geometry.cardWidthMm)
  const height = mm(content.geometry.cardHeightMm)
  const headerHeight = mm(12.5)
  const footerHeight = mm(6)
  const { back } = content

  drawBase(page, width, height)
  page.drawRectangle({
    x: 0,
    y: height - headerHeight,
    width,
    height: headerHeight,
    color: REVIEW_COLOR.blue,
  })
  const strapLines = splitAtWidth(
    standardFontText(back.strap, fonts.bold),
    fonts.bold,
    10.5,
    width - mm(15)
  ).slice(0, 2)
  strapLines.forEach((line, index) => {
    drawCentered(
      page,
      line,
      0,
      width,
      height - mm(5.2 + index * 4.4),
      fonts.bold,
      10.5,
      POSTER_PDF_COLOR.white
    )
  })
  drawGoogleBadge(page, width - mm(6.8), height - headerHeight / 2, mm(3.5))

  back.steps.forEach((step, index) => {
    const y = height - headerHeight - mm(7.2) - index * mm(8)
    drawText(
      page,
      String(index + 1),
      mm(5),
      y - mm(1),
      fonts.bold,
      19,
      REVIEW_COLOR.blue
    )
    drawText(
      page,
      step.title.toUpperCase(),
      mm(15),
      y,
      fonts.bold,
      8.5,
      POSTER_PDF_COLOR.ink
    )
    drawText(
      page,
      step.detail.slice(0, 34),
      mm(15),
      y - mm(3.2),
      fonts.regular,
      6.5,
      POSTER_PDF_COLOR.inkSoft
    )
  })

  const qrSize = mm(content.geometry.googleReviewQrOuterMm)
  const qrX = width - qrSize - mm(5)
  drawCentered(
    page,
    "NO TAP?",
    qrX - mm(1),
    qrSize + mm(2),
    footerHeight + qrSize + mm(7),
    fonts.bold,
    6.5,
    REVIEW_COLOR.blue
  )
  drawFramedQr(page, qrModules, qrX, footerHeight + mm(5), qrSize)
  drawCentered(
    page,
    "SCAN TO REVIEW",
    qrX - mm(1),
    qrSize + mm(2),
    footerHeight + mm(1.5),
    fonts.bold,
    6.5,
    REVIEW_COLOR.faint
  )

  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height: footerHeight,
    color: REVIEW_COLOR.cream,
    borderColor: REVIEW_COLOR.line,
    borderWidth: mm(0.2),
  })
  drawText(
    page,
    venue.slice(0, 28).toUpperCase(),
    mm(3),
    mm(2.2),
    fonts.bold,
    6.5,
    POSTER_PDF_COLOR.ink
  )
  const thanks = standardFontText(back.footBrand, fonts.regular)
  drawText(
    page,
    thanks,
    width - mm(3) - fonts.regular.widthOfTextAtSize(thanks, 6.5),
    mm(2.2),
    fonts.regular,
    6.5,
    REVIEW_COLOR.faint
  )
}

type PlateInput = {
  readonly page: PDFPage
  readonly content: NfcSquareContent
  readonly venue: string
  readonly qrModules: BitMatrix
  readonly fonts: PdfFonts
}

export function drawGoogleReviewPlate({
  page,
  content,
  qrModules,
  fonts,
}: PlateInput): void {
  const width = mm(content.geometry.cardWidthMm)
  const height = mm(content.geometry.cardHeightMm)
  const stageHeight = height * 0.5
  const paperHeight = height - stageHeight
  const { front } = content
  const [headlineLead, headlineAccent] = splitTrailingWords(front.brandName, 2)

  drawBase(page, width, height)
  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height: stageHeight,
    color: REVIEW_COLOR.blue,
  })
  drawCentered(
    page,
    front.brandEyebrow.toUpperCase(),
    0,
    width,
    height - mm(11),
    fonts.bold,
    8.5,
    REVIEW_COLOR.blue
  )
  drawCentered(
    page,
    headlineLead,
    0,
    width,
    height - mm(17.5),
    fonts.bold,
    18.5,
    POSTER_PDF_COLOR.ink
  )
  drawCentered(
    page,
    headlineAccent,
    0,
    width,
    height - mm(25.5),
    fonts.bold,
    18.5,
    REVIEW_COLOR.blue
  )
  drawCenteredWrapped(
    page,
    front.claimLine,
    mm(8),
    width - mm(16),
    height - mm(30.5),
    fonts.regular,
    8.3,
    POSTER_PDF_COLOR.inkSoft,
    3
  )
  drawGoogleBadge(page, width / 2, paperHeight + mm(2), mm(9))
  drawStars(page, width / 2 - mm(15.5), mm(37.8), mm(5.2))
  drawButton(
    page,
    front.tapWord.toUpperCase(),
    (width - mm(70)) / 2,
    mm(25.5),
    mm(70),
    mm(11),
    fonts,
    14
  )

  const qrSize = mm(content.geometry.googleReviewQrOuterMm)
  const qrX = mm(70)
  drawFramedQr(page, qrModules, qrX, mm(3.8), qrSize, 0.8)
  drawCenteredWrapped(
    page,
    front.tapSub,
    mm(7),
    mm(53),
    mm(13),
    fonts.regular,
    7.5,
    POSTER_PDF_COLOR.white,
    2
  )
}

function drawBase(page: PDFPage, width: number, height: number): void {
  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height,
    color: REVIEW_COLOR.cream,
    borderColor: REVIEW_COLOR.line,
    borderWidth: mm(0.3),
  })
}

function drawButton(
  page: PDFPage,
  label: string,
  x: number,
  y: number,
  width: number,
  height: number,
  fonts: PdfFonts,
  size: number
): void {
  const radius = height / 2
  const pill = [
    `M ${radius} 0`,
    `H ${width - radius}`,
    `A ${radius} ${radius} 0 0 1 ${width - radius} ${height}`,
    `H ${radius}`,
    `A ${radius} ${radius} 0 0 1 ${radius} 0`,
    "Z",
  ].join(" ")
  page.drawSvgPath(pill, {
    x,
    y: y + height,
    color: REVIEW_COLOR.yellow,
    borderColor: REVIEW_COLOR.yellowDeep,
    borderWidth: mm(0.25),
  })

  const text = standardFontText(label, fonts.bold)
  const iconSize = Math.min(height * 0.42, mm(4.8))
  const gap = mm(1.5)
  const textWidth = fonts.bold.widthOfTextAtSize(text, size)
  const clusterX = x + (width - iconSize - gap - textWidth) / 2
  drawNfcMark(
    page,
    clusterX,
    y + (height - iconSize) / 2,
    iconSize,
    POSTER_PDF_COLOR.ink
  )
  drawText(
    page,
    text,
    clusterX + iconSize + gap,
    y + (height - size) / 2,
    fonts.bold,
    size,
    POSTER_PDF_COLOR.ink
  )
}

function drawGoogleBadge(
  page: PDFPage,
  centreX: number,
  centreY: number,
  radius: number
): void {
  page.drawEllipse({
    x: centreX,
    y: centreY,
    xScale: radius,
    yScale: radius,
    color: POSTER_PDF_COLOR.white,
  })
  const markSize = radius * 1.45
  const markScale = markSize / 24
  for (const mark of GOOGLE_MARK_PATHS) {
    page.drawSvgPath(mark.path, {
      x: centreX - markSize / 2,
      y: centreY + markSize / 2,
      scale: markScale,
      color: mark.color,
    })
  }
}

function drawStars(
  page: PDFPage,
  startX: number,
  y: number,
  diameter: number
): void {
  for (let index = 0; index < 5; index += 1) {
    page.drawSvgPath(REVIEW_STAR_PATH, {
      x: startX + index * (diameter + mm(0.9)),
      y: y + diameter,
      scale: diameter / 24,
      color: REVIEW_COLOR.yellow,
      borderColor: REVIEW_COLOR.yellowDeep,
      borderWidth: mm(0.15),
    })
  }
}

function drawNfcMark(
  page: PDFPage,
  x: number,
  y: number,
  size: number,
  color: ReturnType<typeof rgb>
): void {
  const scale = size / 24
  const originY = y + size
  for (const path of [
    "M6 8.5A7 7 0 0 1 6 15.5",
    "M10 5.5A12 12 0 0 1 10 18.5",
  ]) {
    page.drawSvgPath(path, {
      x,
      y: originY,
      scale,
      borderColor: color,
      borderWidth: mm(0.55),
    })
  }
  page.drawCircle({
    x: x + 3.2 * scale,
    y: originY - 12 * scale,
    size: 1.3 * scale,
    color,
  })
}

function drawFramedQr(
  page: PDFPage,
  modules: BitMatrix,
  x: number,
  y: number,
  size: number,
  paddingMm = 0.8
): void {
  const padding = mm(paddingMm)
  page.drawRectangle({
    x: x - padding,
    y: y - padding,
    width: size + padding * 2,
    height: size + padding * 2,
    color: POSTER_PDF_COLOR.white,
    borderColor: REVIEW_COLOR.line,
    borderWidth: mm(0.25),
  })
  drawQrCode(page, modules, x, y, size)
}

function drawText(
  page: PDFPage,
  value: string,
  x: number,
  y: number,
  font: PdfFonts["bold"],
  size: number,
  color: ReturnType<typeof rgb>
): void {
  page.drawText(standardFontText(value, font), { x, y, font, size, color })
}

function drawCentered(
  page: PDFPage,
  value: string,
  originX: number,
  width: number,
  y: number,
  font: PdfFonts["bold"],
  size: number,
  color: ReturnType<typeof rgb>
): void {
  const text = standardFontText(value, font)
  drawText(
    page,
    text,
    originX + (width - font.widthOfTextAtSize(text, size)) / 2,
    y,
    font,
    size,
    color
  )
}

function drawMixedCentered(
  page: PDFPage,
  first: string,
  second: string,
  y: number,
  font: PdfFonts["bold"],
  size: number,
  firstColor: ReturnType<typeof rgb>,
  secondColor: ReturnType<typeof rgb>,
  width: number
): void {
  const firstText = standardFontText(first.trimEnd(), font)
  const secondText = standardFontText(second.trimStart(), font)
  const gap = font.widthOfTextAtSize(" ", size)
  const firstWidth = font.widthOfTextAtSize(firstText, size)
  const secondWidth = font.widthOfTextAtSize(secondText, size)
  const x = (width - firstWidth - gap - secondWidth) / 2
  drawText(page, firstText, x, y, font, size, firstColor)
  drawText(page, secondText, x + firstWidth + gap, y, font, size, secondColor)
}

function splitTrailingWords(
  value: string,
  count: number
): readonly [string, string] {
  const words = value.trim().split(/\s+/)
  const splitAt = Math.max(1, words.length - count)
  return [words.slice(0, splitAt).join(" "), words.slice(splitAt).join(" ")]
}

function drawCenteredWrapped(
  page: PDFPage,
  value: string,
  originX: number,
  width: number,
  firstY: number,
  font: PdfFonts["bold"],
  size: number,
  color: ReturnType<typeof rgb>,
  maxLines: number
): void {
  splitAtWidth(standardFontText(value, font), font, size, width)
    .slice(0, maxLines)
    .forEach((line, index) => {
      drawCentered(
        page,
        line,
        originX,
        width,
        firstY - index * size * 1.25,
        font,
        size,
        color
      )
    })
}

function splitAtWidth(
  text: string,
  font: PdfFonts["bold"],
  size: number,
  maxWidth: number
): readonly string[] {
  const lines: string[] = []
  for (const word of text.split(/\s+/)) {
    const current = lines.at(-1)
    const candidate = current ? `${current} ${word}` : word
    if (current && font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      lines[lines.length - 1] = candidate
    } else {
      lines.push(word)
    }
  }
  return lines
}
