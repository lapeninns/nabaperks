import "server-only"

import {
  PDFDocument,
  StandardFonts,
  concatTransformationMatrix,
  popGraphicsState,
  pushGraphicsState,
  type PDFFont,
  type PDFPage,
} from "pdf-lib"
import QRCode, { type BitMatrix } from "qrcode"

import {
  A4_HEIGHT,
  A4_WIDTH,
  B5_HEIGHT,
  B5_WIDTH,
  drawCenteredText,
  drawQrCode,
  drawStampRow,
  drawWrappedText,
  fitSingleLineText,
  POSTER_PDF_COLOR,
  posterStyle,
  standardFontText,
  type PosterStyle,
} from "@/lib/notifications/poster-pdf-style"
import {
  QR_POSTER_TEMPLATES,
  type QrPosterTemplateId,
} from "@/lib/qr/poster-templates"

export type PosterPdfAttachment = {
  readonly filename: string
  readonly content: string
}

type PosterPdfInput = {
  readonly merchantName: string
  readonly shareUrl: string
  readonly stampsRequired: number
}

type PdfFonts = {
  readonly regular: PDFFont
  readonly bold: PDFFont
  readonly mono: PDFFont
}

export async function buildPosterPdfAttachments({
  merchantName,
  shareUrl,
  stampsRequired,
}: PosterPdfInput): Promise<readonly PosterPdfAttachment[]> {
  const boundedMerchantName = merchantName.trim().slice(0, 120)
  const qrModules = QRCode.create(shareUrl, {
    errorCorrectionLevel: "H",
  }).modules
  return Promise.all(
    QR_POSTER_TEMPLATES.map(async ({ id }) => ({
      filename: `nabaperks-poster-${id}.pdf`,
      content: await buildPosterPdf(
        {
          merchantName: boundedMerchantName,
          shareUrl,
          stampsRequired: Math.max(1, stampsRequired),
          template: id,
        },
        qrModules
      ),
    }))
  )
}

async function buildPosterPdf(
  input: PosterPdfInput & { readonly template: QrPosterTemplateId },
  qrModules: BitMatrix
): Promise<string> {
  const document = await PDFDocument.create()
  document.setTitle(
    `Nabaperks ${input.template} poster for ${input.merchantName}`
  )
  document.setAuthor("Nabaperks")
  document.setSubject(
    input.template === "table-tent"
      ? "B5 table tent with landscape faces"
      : "A4 counter poster"
  )

  const [regular, bold, mono] = await Promise.all([
    document.embedFont(StandardFonts.Helvetica),
    document.embedFont(StandardFonts.HelveticaBold),
    document.embedFont(StandardFonts.CourierBold),
  ])
  const fonts = { regular, bold, mono }
  const style = posterStyle(input.template, input.stampsRequired)

  if (input.template === "table-tent") {
    return buildTableTentPdf(document, input, qrModules, fonts, style)
  }

  const page = document.addPage([A4_WIDTH, A4_HEIGHT])

  page.drawRectangle({
    x: 0,
    y: 0,
    width: A4_WIDTH,
    height: A4_HEIGHT,
    color: style.background,
  })

  if (input.template === "thermal") {
    page.drawRectangle({
      x: 82,
      y: 36,
      width: A4_WIDTH - 164,
      height: A4_HEIGHT - 72,
      color: style.panel,
      borderColor: style.foreground,
      borderWidth: 1.5,
    })
  } else {
    page.drawRectangle({
      x: 32,
      y: 32,
      width: A4_WIDTH - 64,
      height: A4_HEIGHT - 64,
      borderColor: style.foreground,
      borderWidth: 3,
    })
  }

  const left = input.template === "thermal" ? 112 : 58
  const contentWidth =
    input.template === "thermal" ? A4_WIDTH - 224 : A4_WIDTH - 116
  const merchantLabel = fitSingleLineText(
    standardFontText(input.merchantName.trim().toUpperCase(), mono),
    mono,
    12,
    contentWidth
  )
  page.drawText(merchantLabel, {
    x: left,
    y: 766,
    size: 12,
    font: mono,
    color: style.foreground,
  })

  const headlineBottom = drawWrappedText(page, style.headline, {
    x: left,
    y: 724,
    maxWidth: contentWidth,
    font: bold,
    size: input.template === "thermal" ? 31 : 42,
    lineHeight: input.template === "thermal" ? 35 : 46,
    color: style.foreground,
  })
  page.drawRectangle({
    x: left,
    y: headlineBottom - 17,
    width: Math.min(154, contentWidth),
    height: 8,
    color: style.accent,
  })

  const supportBottom = drawWrappedText(page, style.support, {
    x: left,
    y: headlineBottom - 45,
    maxWidth: contentWidth,
    font: regular,
    size: 14,
    lineHeight: 19,
    color: style.foreground,
  })
  page.drawRectangle({
    x: left,
    y: supportBottom - 38,
    width: contentWidth,
    height: 28,
    color: style.band,
  })
  page.drawText(style.friction, {
    x: left + 10,
    y: supportBottom - 29,
    size: 10,
    font: bold,
    color: POSTER_PDF_COLOR.white,
    maxWidth: contentWidth - 20,
  })

  const qrSize = input.template === "thermal" ? 180 : 218
  const qrX = (A4_WIDTH - qrSize) / 2
  const qrY = input.template === "thermal" ? 236 : 214
  page.drawRectangle({
    x: qrX - 13,
    y: qrY - 13,
    width: qrSize + 26,
    height: qrSize + 26,
    color: POSTER_PDF_COLOR.white,
    borderColor: style.foreground,
    borderWidth: 2,
  })
  drawQrCode(page, qrModules, qrX, qrY, qrSize)
  drawCenteredText(page, style.qrCaption, {
    y: qrY - 43,
    font: bold,
    size: 14,
    color: style.foreground,
  })

  drawStampRow(page, input.stampsRequired, qrY - 86, style, mono)
  drawCenteredText(page, "ONE STAMP PER DAY  |  MYSTERY UNTIL UNLOCK", {
    y: 82,
    font: mono,
    size: 9,
    color: style.foreground,
  })
  drawCenteredText(page, "*  POWERED BY NABAPERKS", {
    y: 58,
    font: bold,
    size: 11,
    color: style.accent,
  })

  return Buffer.from(await document.save()).toString("base64")
}

/** ISO B5: fold top half down; centre fold is the peak of landscape faces. */
async function buildTableTentPdf(
  document: PDFDocument,
  input: PosterPdfInput,
  qrModules: BitMatrix,
  fonts: PdfFonts,
  style: PosterStyle
): Promise<string> {
  const pageWidth = B5_WIDTH
  const pageHeight = B5_HEIGHT
  const page = document.addPage([pageWidth, pageHeight])
  const faceHeight = pageHeight / 2

  page.drawRectangle({
    x: 0,
    y: 0,
    width: pageWidth,
    height: pageHeight,
    color: style.background,
  })

  const topCx = pageWidth / 2
  const topCy = faceHeight + faceHeight / 2
  page.pushOperators(
    pushGraphicsState(),
    concatTransformationMatrix(-1, 0, 0, -1, 2 * topCx, 2 * topCy)
  )
  drawTableTentFace(page, {
    pageWidth,
    panelBottom: faceHeight,
    faceHeight,
    merchantName: input.merchantName,
    stampsRequired: input.stampsRequired,
    qrModules,
    fonts,
    style,
  })
  page.pushOperators(popGraphicsState())

  drawTableTentFace(page, {
    pageWidth,
    panelBottom: 0,
    faceHeight,
    merchantName: input.merchantName,
    stampsRequired: input.stampsRequired,
    qrModules,
    fonts,
    style,
  })

  drawFoldGuide(page, pageWidth, faceHeight, fonts.mono, style)

  return Buffer.from(await document.save()).toString("base64")
}

function drawFoldGuide(
  page: PDFPage,
  pageWidth: number,
  centreY: number,
  mono: PDFFont,
  style: PosterStyle
): void {
  const dash = 7
  const gap = 4
  let x = 40
  while (x < pageWidth - 40) {
    const segment = Math.min(dash, pageWidth - 40 - x)
    page.drawRectangle({
      x,
      y: centreY - 0.55,
      width: segment,
      height: 1.1,
      color: style.foreground,
      opacity: 0.45,
    })
    x += dash + gap
  }

  const label = "FOLD TO PEAK"
  const size = 7
  const width = mono.widthOfTextAtSize(label, size)
  page.drawRectangle({
    x: pageWidth / 2 - width / 2 - 6,
    y: centreY - 6,
    width: width + 12,
    height: 12,
    color: POSTER_PDF_COLOR.white,
    borderColor: style.foreground,
    borderWidth: 1,
  })
  page.drawText(label, {
    x: pageWidth / 2 - width / 2,
    y: centreY - 2.5,
    size,
    font: mono,
    color: style.foreground,
  })
}

function drawTableTentFace(
  page: PDFPage,
  {
    pageWidth,
    panelBottom,
    faceHeight,
    merchantName,
    stampsRequired,
    qrModules,
    fonts,
    style,
  }: {
    readonly pageWidth: number
    readonly panelBottom: number
    readonly faceHeight: number
    readonly merchantName: string
    readonly stampsRequired: number
    readonly qrModules: BitMatrix
    readonly fonts: PdfFonts
    readonly style: PosterStyle
  }
): void {
  const gutter = 10
  const cardX = gutter
  const cardY = panelBottom + gutter
  const cardW = pageWidth - gutter * 2
  const cardH = faceHeight - gutter * 2
  const panelTop = cardY + cardH
  const brandH = cardH * 0.175
  const footH = cardH * 0.09
  const mainTop = panelTop - brandH
  const mainBottom = cardY + footH
  const mainH = mainTop - mainBottom
  const splitX = cardX + cardW * 0.59
  const left = cardX + 12
  const copyWidth = splitX - left - 10

  page.drawRectangle({
    x: cardX,
    y: cardY,
    width: cardW,
    height: cardH,
    color: POSTER_PDF_COLOR.paper,
    borderColor: style.foreground,
    borderWidth: 1.5,
  })

  page.drawRectangle({
    x: cardX,
    y: mainTop,
    width: cardW,
    height: brandH,
    color: style.foreground,
  })
  page.drawText("NABA/PERKS", {
    x: left,
    y: mainTop + brandH / 2 - 3.5,
    size: 10,
    font: fonts.bold,
    color: POSTER_PDF_COLOR.paper,
  })
  page.drawText(`TABLE REWARDS  NO. ${String(stampsRequired).padStart(2, "0")}`, {
    x: cardX + cardW - 148,
    y: mainTop + brandH / 2 - 2.5,
    size: 6.5,
    font: fonts.mono,
    color: POSTER_PDF_COLOR.paper,
  })

  const merchantLabel = fitSingleLineText(
    standardFontText(merchantName.trim().toUpperCase(), fonts.mono),
    fonts.mono,
    7.5,
    copyWidth
  )
  page.drawText(merchantLabel, {
    x: left,
    y: mainTop - 14,
    size: 7.5,
    font: fonts.mono,
    color: style.foreground,
  })

  const stack = ["VISIT.", "STAMP.", "UNLOCK."]
  stack.forEach((line, index) => {
    page.drawText(line, {
      x: left,
      y: mainTop - 38 - index * 22,
      size: 20,
      font: fonts.bold,
      color: index === 2 ? style.accent : style.foreground,
    })
  })

  drawStampRow(
    page,
    stampsRequired,
    mainBottom + 30,
    style,
    fonts.mono,
    left + 36
  )

  page.drawRectangle({
    x: splitX,
    y: mainBottom,
    width: cardX + cardW - splitX,
    height: mainH,
    color: style.accent,
  })

  page.drawText("01 / START HERE", {
    x: splitX + 10,
    y: mainTop - 16,
    size: 6.5,
    font: fonts.mono,
    color: POSTER_PDF_COLOR.white,
  })

  const qrSize = 86
  const qrX = splitX + (cardX + cardW - splitX - qrSize) / 2
  const qrY = mainBottom + (mainH - qrSize) / 2
  page.drawRectangle({
    x: qrX - 4,
    y: qrY - 4,
    width: qrSize + 8,
    height: qrSize + 8,
    color: POSTER_PDF_COLOR.white,
    borderColor: style.foreground,
    borderWidth: 1.75,
  })
  drawQrCode(page, qrModules, qrX, qrY, qrSize)

  page.drawText("POINT YOUR CAMERA.", {
    x: splitX + 10,
    y: mainBottom + 24,
    size: 7,
    font: fonts.bold,
    color: POSTER_PDF_COLOR.white,
  })
  page.drawText("GET STAMPED.", {
    x: splitX + 10,
    y: mainBottom + 14,
    size: 7,
    font: fonts.bold,
    color: POSTER_PDF_COLOR.white,
  })

  page.drawRectangle({
    x: cardX,
    y: cardY,
    width: cardW,
    height: footH,
    color: POSTER_PDF_COLOR.paper,
    borderColor: style.foreground,
    borderWidth: 1,
  })
  page.drawText("ONE STAMP PER DAY", {
    x: left,
    y: cardY + footH / 2 - 2.5,
    size: 6,
    font: fonts.mono,
    color: style.foreground,
  })
  page.drawText("* REGULARS", {
    x: pageWidth / 2 - 28,
    y: cardY + footH / 2 - 2.5,
    size: 6,
    font: fonts.mono,
    color: style.foreground,
  })
  page.drawText("MYSTERY UNTIL UNLOCK", {
    x: cardX + cardW - 118,
    y: cardY + footH / 2 - 2.5,
    size: 6,
    font: fonts.mono,
    color: style.foreground,
  })
}
