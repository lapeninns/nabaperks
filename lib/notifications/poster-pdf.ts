import "server-only"

import { PDFDocument, StandardFonts } from "pdf-lib"
import QRCode, { type BitMatrix } from "qrcode"

import {
  A4_HEIGHT,
  A4_WIDTH,
  drawCenteredText,
  drawQrCode,
  drawStampRow,
  drawWrappedText,
  fitSingleLineText,
  POSTER_PDF_COLOR,
  posterStyle,
  standardFontText,
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
  document.setSubject("A4 counter poster")

  const page = document.addPage([A4_WIDTH, A4_HEIGHT])
  const [regular, bold, mono] = await Promise.all([
    document.embedFont(StandardFonts.Helvetica),
    document.embedFont(StandardFonts.HelveticaBold),
    document.embedFont(StandardFonts.CourierBold),
  ])
  const style = posterStyle(input.template, input.stampsRequired)

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
