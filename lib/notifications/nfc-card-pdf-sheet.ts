import type { BitMatrix } from "qrcode"
import type { PDFDocument, PDFPage } from "pdf-lib"
import { rgb } from "pdf-lib"

import { resolveNfcCardContent } from "@/lib/qr/nfc-card-content"
import type { NfcCardContent } from "@/lib/qr/nfc-card-content"
import type { NfcCardDesignId } from "@/lib/qr/nfc-card-templates"

import {
  drawQrCode,
  mm,
  POSTER_PDF_COLOR,
  standardFontText,
} from "./poster-pdf-style"
import type { PdfFonts } from "./poster-pdf-types"

/** Catalogue type floor — nothing on the CR80 die may render below this. */
const TYPE_FLOOR = 6.5

/**
 * Draw front and back as two native CR80 pages (85.5 × 54 mm each).
 */
export function drawNfcCardCr80Pages(
  document: PDFDocument,
  design: NfcCardDesignId,
  merchantName: string,
  stampsRequired: number,
  qrModules: BitMatrix,
  fonts: PdfFonts,
  retainFonts: (page: PDFPage) => void
): void {
  const content = resolveNfcCardContent(design, stampsRequired)
  const venue = merchantName.trim()
  const pageSize: [number, number] = [
    mm(content.geometry.cardWidthMm),
    mm(content.geometry.cardHeightMm),
  ]

  const front = document.addPage(pageSize)
  retainFonts(front)
  drawFrontCard(front, content, venue, qrModules, fonts, 0, 0)

  const back = document.addPage(pageSize)
  retainFonts(back)
  drawBackCard(back, content, venue, fonts, 0, 0)
}

function drawFrontCard(
  page: PDFPage,
  content: NfcCardContent,
  venue: string,
  qrModules: BitMatrix,
  fonts: PdfFonts,
  originX: number,
  originY: number
): void {
  const w = mm(content.geometry.cardWidthMm)
  const h = mm(content.geometry.cardHeightMm)
  const half = w / 2
  const { front } = content

  page.drawRectangle({
    x: originX,
    y: originY,
    width: w,
    height: h,
    color: POSTER_PDF_COLOR.paper,
    borderColor: POSTER_PDF_COLOR.ink,
    borderWidth: mm(content.geometry.frameInsetMm),
  })

  page.drawText(standardFontText(front.brandEyebrow, fonts.monoBold), {
    x: originX + mm(2.2),
    y: originY + h - mm(5),
    size: TYPE_FLOOR,
    font: fonts.monoBold,
    color: POSTER_PDF_COLOR.inkSoft,
  })
  page.drawText(standardFontText(front.brandName, fonts.monoBold), {
    x: originX + mm(2.2),
    y: originY + h - mm(9.5),
    size: 11,
    font: fonts.bold,
    color: POSTER_PDF_COLOR.ink,
  })
  page.drawText(standardFontText(venue, fonts.monoBold).slice(0, 28), {
    x: originX + mm(2.2),
    y: originY + h - mm(13),
    size: TYPE_FLOOR,
    font: fonts.monoBold,
    color: POSTER_PDF_COLOR.inkSoft,
  })

  const sealSize = mm(22)
  const sealX = originX + (half - sealSize) / 2
  const sealY = originY + mm(16)
  page.drawEllipse({
    x: sealX + sealSize / 2,
    y: sealY + sealSize / 2,
    xScale: sealSize / 2,
    yScale: sealSize / 2,
    color: POSTER_PDF_COLOR.accent,
    borderColor: POSTER_PDF_COLOR.ink,
    borderWidth: mm(0.55),
  })
  const tapWord = standardFontText(front.tapWord, fonts.monoBold)
  page.drawText(tapWord, {
    x: sealX + sealSize / 2 - fonts.bold.widthOfTextAtSize(tapWord, 12) / 2,
    y: sealY + sealSize / 2 + mm(0.4),
    size: 12,
    font: fonts.bold,
    color: POSTER_PDF_COLOR.white,
  })
  const tapSub = standardFontText(front.tapSub, fonts.monoBold)
  page.drawText(tapSub, {
    x:
      sealX +
      sealSize / 2 -
      fonts.monoBold.widthOfTextAtSize(tapSub, TYPE_FLOOR) / 2,
    y: sealY + sealSize / 2 - mm(3.2),
    size: TYPE_FLOOR,
    font: fonts.monoBold,
    color: POSTER_PDF_COLOR.white,
  })

  page.drawRectangle({
    x: originX + mm(2.2),
    y: originY + mm(2),
    width: half - mm(4.4),
    height: mm(11),
    color: rgb(0.96, 0.78, 0.42),
    borderColor: POSTER_PDF_COLOR.ink,
    borderWidth: mm(0.28),
  })
  page.drawText(standardFontText(front.stampCue, fonts.monoBold).slice(0, 34), {
    x: originX + mm(3),
    y: originY + mm(6),
    size: TYPE_FLOOR,
    font: fonts.monoBold,
    color: POSTER_PDF_COLOR.ink,
  })

  page.drawRectangle({
    x: originX + half,
    y: originY,
    width: half,
    height: h,
    color: POSTER_PDF_COLOR.accent,
  })
  page.drawText(standardFontText(front.claimKicker, fonts.monoBold), {
    x: originX + half + mm(2.2),
    y: originY + h - mm(5),
    size: TYPE_FLOOR,
    font: fonts.monoBold,
    color: POSTER_PDF_COLOR.white,
  })
  const claimLines = wrapMono(
    standardFontText(front.claimLine, fonts.monoBold),
    fonts,
    8,
    half - mm(4.4)
  )
  claimLines.forEach((line, index) => {
    page.drawText(line, {
      x: originX + half + mm(2.2),
      y: originY + h - mm(10) - index * mm(3.4),
      size: 8,
      font: fonts.bold,
      color: POSTER_PDF_COLOR.white,
    })
  })

  front.flow.forEach((label, index) => {
    const cx = originX + half + mm(5) + index * mm(11)
    page.drawEllipse({
      x: cx,
      y: originY + h - mm(22),
      xScale: mm(2.1),
      yScale: mm(2.1),
      color: POSTER_PDF_COLOR.ink,
      borderColor: POSTER_PDF_COLOR.white,
      borderWidth: mm(0.2),
    })
    page.drawText(String(index + 1), {
      x:
        cx -
        fonts.monoBold.widthOfTextAtSize(String(index + 1), TYPE_FLOOR) / 2,
      y: originY + h - mm(22.7),
      size: TYPE_FLOOR,
      font: fonts.monoBold,
      color: POSTER_PDF_COLOR.white,
    })
    const flowLabel = standardFontText(label, fonts.monoBold).slice(0, 8)
    page.drawText(flowLabel, {
      x: cx - fonts.bold.widthOfTextAtSize(flowLabel, TYPE_FLOOR) / 2,
      y: originY + h - mm(26.5),
      size: TYPE_FLOOR,
      font: fonts.bold,
      color: POSTER_PDF_COLOR.white,
    })
  })

  const qrSize = mm(content.geometry.qrOuterMm)
  const qrX = originX + half + (half - qrSize) / 2
  // Keep the QR below the three flow labels on the compact CR80 face.
  const qrY = originY + mm(7.5)
  page.drawRectangle({
    x: qrX - mm(0.6),
    y: qrY - mm(0.6),
    width: qrSize + mm(1.2),
    height: qrSize + mm(1.2),
    color: POSTER_PDF_COLOR.white,
    borderColor: POSTER_PDF_COLOR.ink,
    borderWidth: mm(0.3),
  })
  drawQrCode(page, qrModules, qrX, qrY, qrSize)

  const claimFriction = standardFontText(content.claimFriction, fonts.monoBold)
  page.drawText(claimFriction, {
    x:
      originX +
      half +
      (half - fonts.monoBold.widthOfTextAtSize(claimFriction, TYPE_FLOOR)) / 2,
    y: originY + mm(3.5),
    size: TYPE_FLOOR,
    font: fonts.monoBold,
    color: POSTER_PDF_COLOR.white,
  })
}

function drawBackCard(
  page: PDFPage,
  content: NfcCardContent,
  venue: string,
  fonts: PdfFonts,
  originX: number,
  originY: number
): void {
  const w = mm(content.geometry.cardWidthMm)
  const h = mm(content.geometry.cardHeightMm)
  const { back } = content

  page.drawRectangle({
    x: originX,
    y: originY,
    width: w,
    height: h,
    color: POSTER_PDF_COLOR.paper,
    borderColor: POSTER_PDF_COLOR.ink,
    borderWidth: mm(content.geometry.frameInsetMm),
  })

  page.drawRectangle({
    x: originX,
    y: originY + h - mm(7),
    width: w,
    height: mm(7),
    color: POSTER_PDF_COLOR.paperDeep,
  })
  page.drawText(standardFontText(back.strap, fonts.monoBold).slice(0, 18), {
    x: originX + mm(2.4),
    y: originY + h - mm(4.6),
    size: TYPE_FLOOR,
    font: fonts.monoBold,
    color: POSTER_PDF_COLOR.ink,
  })
  const badge = standardFontText(back.badge, fonts.monoBold)
  const badgeW = fonts.monoBold.widthOfTextAtSize(badge, TYPE_FLOOR) + mm(2)
  const badgeX = originX + w - badgeW - mm(2.4)
  page.drawRectangle({
    x: badgeX,
    y: originY + h - mm(5.5),
    width: badgeW,
    height: mm(3.4),
    color: POSTER_PDF_COLOR.sun,
    borderColor: POSTER_PDF_COLOR.ink,
    borderWidth: mm(0.2),
  })
  page.drawText(badge, {
    x: badgeX + mm(1),
    y: originY + h - mm(4.6),
    size: TYPE_FLOOR,
    font: fonts.monoBold,
    color: POSTER_PDF_COLOR.ink,
  })
  const venueLabel = standardFontText(venue, fonts.monoBold).slice(0, 16)
  const venueW = fonts.monoBold.widthOfTextAtSize(venueLabel, TYPE_FLOOR)
  const venueX = badgeX - mm(1.4) - venueW
  if (venueX > originX + mm(28)) {
    page.drawText(venueLabel, {
      x: venueX,
      y: originY + h - mm(4.6),
      size: TYPE_FLOOR,
      font: fonts.monoBold,
      color: POSTER_PDF_COLOR.inkSoft,
    })
  }

  page.drawText(standardFontText(back.teaseLead, fonts.monoBold), {
    x: originX + mm(2.4),
    y: originY + h - mm(15),
    size: 12,
    font: fonts.bold,
    color: POSTER_PDF_COLOR.ink,
  })
  page.drawText(standardFontText(back.teaseAccent, fonts.monoBold), {
    x: originX + mm(2.4),
    y: originY + h - mm(19.5),
    size: 12,
    font: fonts.bold,
    color: POSTER_PDF_COLOR.accent,
  })

  const sealR = mm(6.8)
  page.drawEllipse({
    x: originX + w - mm(11.5),
    y: originY + h - mm(18),
    xScale: sealR,
    yScale: sealR,
    color: POSTER_PDF_COLOR.accent,
    borderColor: POSTER_PDF_COLOR.ink,
    borderWidth: mm(0.4),
  })
  const sealLabel = standardFontText(back.sealLabel, fonts.monoBold)
  page.drawText(sealLabel, {
    x:
      originX +
      w -
      mm(11.5) -
      fonts.monoBold.widthOfTextAtSize(sealLabel, TYPE_FLOOR) / 2,
    y: originY + h - mm(19),
    size: TYPE_FLOOR,
    font: fonts.monoBold,
    color: POSTER_PDF_COLOR.white,
  })

  const railY = originY + mm(12)
  const railH = mm(14)
  page.drawRectangle({
    x: originX + mm(2.4),
    y: railY,
    width: w - mm(4.8),
    height: railH,
    color: POSTER_PDF_COLOR.paper,
    borderColor: POSTER_PDF_COLOR.ink,
    borderWidth: mm(0.28),
  })
  const stepW = (w - mm(4.8)) / 3
  back.steps.forEach((step, index) => {
    const cx = originX + mm(2.4) + stepW * index + stepW / 2
    if (index > 0) {
      page.drawRectangle({
        x: cx - stepW,
        y: railY + railH - mm(5.2),
        width: stepW,
        height: mm(0.25),
        color: POSTER_PDF_COLOR.inkSoft,
        opacity: 0.45,
      })
    }
    page.drawEllipse({
      x: cx,
      y: railY + railH - mm(5),
      xScale: mm(2.2),
      yScale: mm(2.2),
      color: POSTER_PDF_COLOR.ink,
    })
    page.drawText(String(index + 1), {
      x:
        cx -
        fonts.monoBold.widthOfTextAtSize(String(index + 1), TYPE_FLOOR) / 2,
      y: railY + railH - mm(5.7),
      size: TYPE_FLOOR,
      font: fonts.monoBold,
      color: POSTER_PDF_COLOR.paper,
    })
    const title = standardFontText(step.title, fonts.monoBold)
    page.drawText(title, {
      x: cx - fonts.bold.widthOfTextAtSize(title, 7) / 2,
      y: railY + mm(5.2),
      size: 7,
      font: fonts.bold,
      color: POSTER_PDF_COLOR.ink,
    })
    const detail = standardFontText(step.detail, fonts.monoBold).slice(0, 14)
    page.drawText(detail, {
      x: cx - fonts.regular.widthOfTextAtSize(detail, TYPE_FLOOR) / 2,
      y: railY + mm(2),
      size: TYPE_FLOOR,
      font: fonts.regular,
      color: POSTER_PDF_COLOR.inkSoft,
    })
  })

  const friction = standardFontText(content.friction, fonts.monoBold)
  page.drawText(friction, {
    x:
      originX +
      w / 2 -
      fonts.monoBold.widthOfTextAtSize(friction, TYPE_FLOOR) / 2,
    y: originY + mm(9.2),
    size: TYPE_FLOOR,
    font: fonts.monoBold,
    color: POSTER_PDF_COLOR.inkSoft,
  })

  page.drawRectangle({
    x: originX,
    y: originY,
    width: w,
    height: mm(7),
    color: POSTER_PDF_COLOR.ink,
  })
  page.drawText(standardFontText(back.footBrand, fonts.monoBold), {
    x: originX + mm(2.4),
    y: originY + mm(2.5),
    size: TYPE_FLOOR,
    font: fonts.monoBold,
    color: POSTER_PDF_COLOR.white,
  })
  const dieRule = standardFontText(content.dieRule, fonts.monoBold).slice(0, 34)
  page.drawText(dieRule, {
    x:
      originX +
      w -
      mm(2.4) -
      fonts.monoBold.widthOfTextAtSize(dieRule, TYPE_FLOOR),
    y: originY + mm(2.5),
    size: TYPE_FLOOR,
    font: fonts.monoBold,
    color: POSTER_PDF_COLOR.paper,
  })
}

function wrapMono(
  text: string,
  fonts: PdfFonts,
  size: number,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ""
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (fonts.bold.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next
    } else {
      if (current) lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines.slice(0, 3)
}
