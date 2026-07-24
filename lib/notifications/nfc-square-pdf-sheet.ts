import type { BitMatrix } from "qrcode"
import type { PDFDocument, PDFPage } from "pdf-lib"

import { resolveNfcSquareContent } from "@/lib/qr/nfc-square-content"
import type { NfcSquareContent } from "@/lib/qr/nfc-square-content"
import type { NfcSquareDesignId } from "@/lib/qr/nfc-square-templates"

import {
  drawQrCode,
  mm,
  POSTER_PDF_COLOR,
  standardFontText,
} from "./poster-pdf-style"
import type { PdfFonts } from "./poster-pdf-types"
import { drawGoogleReviewPlate } from "./google-review-nfc-pdf"

const TYPE_FLOOR = 6.5

/**
 * Draw one native 100×100 mm wall plate page — page size is the die.
 * Billboard: hero → TAP action → proof band.
 */
export function drawNfcSquarePage(
  document: PDFDocument,
  design: NfcSquareDesignId,
  merchantName: string,
  stampsRequired: number,
  qrModules: BitMatrix,
  fonts: PdfFonts,
  retainFonts: (page: PDFPage) => void,
  locality?: string | null
): void {
  const venue = merchantName.trim()
  const content = resolveNfcSquareContent(
    design,
    stampsRequired,
    locality?.trim() || venue
  )
  const pageSize: [number, number] = [
    mm(content.geometry.cardWidthMm),
    mm(content.geometry.cardHeightMm),
  ]

  const page = document.addPage(pageSize)
  retainFonts(page)
  if (design === "google-review") {
    drawGoogleReviewPlate({ page, content, venue, qrModules, fonts })
    return
  }
  drawPlateFace(page, content, venue, qrModules, fonts, 0, 0)
}

function drawPlateFace(
  page: PDFPage,
  content: NfcSquareContent,
  venue: string,
  qrModules: BitMatrix,
  fonts: PdfFonts,
  originX: number,
  originY: number
): void {
  const w = mm(content.geometry.cardWidthMm)
  const h = mm(content.geometry.cardHeightMm)
  const { front, stampsRequired } = content
  const heroH = mm(22)
  const proofH = mm(34)
  const actionH = h - heroH - proofH

  page.drawRectangle({
    x: originX,
    y: originY,
    width: w,
    height: h,
    color: POSTER_PDF_COLOR.paper,
    borderColor: POSTER_PDF_COLOR.ink,
    borderWidth: mm(content.geometry.frameInsetMm),
  })

  // Hero
  page.drawRectangle({
    x: originX,
    y: originY + h - heroH,
    width: w,
    height: heroH,
    color: POSTER_PDF_COLOR.paperDeep,
  })
  page.drawRectangle({
    x: originX + mm(0.5),
    y: originY + h - heroH,
    width: w - mm(1),
    height: mm(0.35),
    color: POSTER_PDF_COLOR.ink,
  })

  page.drawText(standardFontText(front.brandEyebrow, fonts.monoBold), {
    x: originX + mm(3.2),
    y: originY + h - mm(5.2),
    size: TYPE_FLOOR,
    font: fonts.monoBold,
    color: POSTER_PDF_COLOR.inkSoft,
  })
  page.drawText(standardFontText(front.brandName, fonts.bold), {
    x: originX + mm(3.2),
    y: originY + h - mm(9.4),
    size: 10,
    font: fonts.bold,
    color: POSTER_PDF_COLOR.ink,
  })
  page.drawText(standardFontText(venue, fonts.bold).slice(0, 28), {
    x: originX + mm(3.2),
    y: originY + h - mm(17.5),
    size: 13,
    font: fonts.bold,
    color: POSTER_PDF_COLOR.ink,
  })

  // Action — TAP block
  const inkPadX = mm(5.5)
  const inkPadTop = mm(2.8)
  const inkPadBottom = mm(8.5)
  const inkW = w - inkPadX * 2
  const inkBlockH = actionH - inkPadTop - inkPadBottom
  const inkX = originX + inkPadX
  const inkY = originY + proofH + inkPadBottom

  page.drawRectangle({
    x: inkX + mm(1.2),
    y: inkY - mm(1),
    width: inkW,
    height: inkBlockH,
    color: POSTER_PDF_COLOR.ink,
  })
  page.drawRectangle({
    x: inkX,
    y: inkY,
    width: inkW,
    height: inkBlockH,
    color: POSTER_PDF_COLOR.accent,
    borderColor: POSTER_PDF_COLOR.ink,
    borderWidth: mm(0.5),
  })

  const tapWord = standardFontText(front.tapWord, fonts.bold)
  const tapSize = 22
  page.drawText(tapWord, {
    x: inkX + inkW / 2 - fonts.bold.widthOfTextAtSize(tapWord, tapSize) / 2,
    y: inkY + inkBlockH / 2 + mm(1.2),
    size: tapSize,
    font: fonts.bold,
    color: POSTER_PDF_COLOR.white,
  })
  const tapSub = standardFontText(front.tapSub, fonts.monoBold)
  page.drawText(tapSub, {
    x: inkX + inkW / 2 - fonts.monoBold.widthOfTextAtSize(tapSub, 7) / 2,
    y: inkY + inkBlockH / 2 - mm(5),
    size: 7,
    font: fonts.monoBold,
    color: POSTER_PDF_COLOR.white,
  })

  const claim = standardFontText(front.claimLine, fonts.bold)
  const claimSize = 7
  page.drawText(claim, {
    x: originX + w / 2 - fonts.bold.widthOfTextAtSize(claim, claimSize) / 2,
    y: originY + proofH + mm(2.2),
    size: claimSize,
    font: fonts.bold,
    color: POSTER_PDF_COLOR.ink,
  })

  // Proof band
  page.drawRectangle({
    x: originX,
    y: originY,
    width: w,
    height: proofH,
    color: POSTER_PDF_COLOR.paperDeep,
  })
  page.drawRectangle({
    x: originX + mm(0.5),
    y: originY + proofH - mm(0.35),
    width: w - mm(1),
    height: mm(0.35),
    color: POSTER_PDF_COLOR.ink,
  })

  page.drawText(standardFontText(front.mysteryKicker, fonts.monoBold), {
    x: originX + mm(3),
    y: originY + proofH - mm(5),
    size: TYPE_FLOOR,
    font: fonts.monoBold,
    color: POSTER_PDF_COLOR.inkSoft,
  })
  page.drawText(standardFontText(front.mysteryAccent, fonts.bold), {
    x: originX + mm(3),
    y: originY + proofH - mm(9.5),
    size: 10,
    font: fonts.bold,
    color: POSTER_PDF_COLOR.accent,
  })

  const flowY = originY + proofH - mm(15)
  const flowW = (w - mm(28)) / 3
  front.flow.forEach((label, index) => {
    const cx = originX + mm(3) + flowW * index
    page.drawEllipse({
      x: cx + mm(2.1),
      y: flowY + mm(1.2),
      xScale: mm(2.1),
      yScale: mm(2.1),
      color: POSTER_PDF_COLOR.ink,
    })
    page.drawText(String(index + 1), {
      x:
        cx +
        mm(2.1) -
        fonts.monoBold.widthOfTextAtSize(String(index + 1), TYPE_FLOOR) / 2,
      y: flowY + mm(0.5),
      size: TYPE_FLOOR,
      font: fonts.monoBold,
      color: POSTER_PDF_COLOR.paper,
    })
    page.drawText(standardFontText(label, fonts.bold), {
      x: cx + mm(5),
      y: flowY + mm(0.6),
      size: TYPE_FLOOR,
      font: fonts.bold,
      color: POSTER_PDF_COLOR.ink,
    })
  })

  // Stamp track
  const trackY = originY + mm(12.5)
  const trackX = originX + mm(3)
  const trackW = w - mm(28)
  page.drawRectangle({
    x: trackX,
    y: trackY,
    width: trackW,
    height: mm(6),
    color: POSTER_PDF_COLOR.paper,
    borderColor: POSTER_PDF_COLOR.ink,
    borderWidth: mm(0.25),
  })
  page.drawEllipse({
    x: trackX + mm(4),
    y: trackY + mm(3),
    xScale: mm(2.2),
    yScale: mm(2.2),
    color: POSTER_PDF_COLOR.accent,
    borderColor: POSTER_PDF_COLOR.ink,
    borderWidth: mm(0.25),
  })
  page.drawText("01", {
    x: trackX + mm(4) - fonts.monoBold.widthOfTextAtSize("01", TYPE_FLOOR) / 2,
    y: trackY + mm(2.2),
    size: TYPE_FLOOR,
    font: fonts.monoBold,
    color: POSTER_PDF_COLOR.white,
  })
  if (stampsRequired > 1) {
    page.drawEllipse({
      x: trackX + mm(10),
      y: trackY + mm(3),
      xScale: mm(2.2),
      yScale: mm(2.2),
      color: POSTER_PDF_COLOR.paper,
      borderColor: POSTER_PDF_COLOR.ink,
      borderWidth: mm(0.25),
    })
    page.drawText("02", {
      x:
        trackX +
        mm(10) -
        fonts.monoBold.widthOfTextAtSize("02", TYPE_FLOOR) / 2,
      y: trackY + mm(2.2),
      size: TYPE_FLOOR,
      font: fonts.monoBold,
      color: POSTER_PDF_COLOR.inkSoft,
    })
  }
  const rewardLabel = `${stampsRequired} = REWARD`
  page.drawText(standardFontText(rewardLabel, fonts.monoBold), {
    x:
      trackX +
      trackW -
      mm(2) -
      fonts.monoBold.widthOfTextAtSize(rewardLabel, TYPE_FLOOR),
    y: trackY + mm(2.2),
    size: TYPE_FLOOR,
    font: fonts.monoBold,
    color: POSTER_PDF_COLOR.ink,
  })

  page.drawText(standardFontText(content.friction, fonts.monoBold), {
    x: originX + mm(3),
    y: originY + mm(7.5),
    size: TYPE_FLOOR,
    font: fonts.monoBold,
    color: POSTER_PDF_COLOR.inkSoft,
  })
  page.drawText(standardFontText(content.dieRule, fonts.monoBold), {
    x: originX + mm(3),
    y: originY + mm(4),
    size: TYPE_FLOOR,
    font: fonts.monoBold,
    color: POSTER_PDF_COLOR.ink,
  })

  const qrSize = mm(content.geometry.qrOuterMm)
  const qrX = originX + w - mm(3) - qrSize
  const qrY = originY + mm(8)
  page.drawRectangle({
    x: qrX - mm(0.7),
    y: qrY - mm(0.7),
    width: qrSize + mm(1.4),
    height: qrSize + mm(1.4),
    color: POSTER_PDF_COLOR.white,
    borderColor: POSTER_PDF_COLOR.ink,
    borderWidth: mm(0.3),
  })
  drawQrCode(page, qrModules, qrX, qrY, qrSize)

  const [fallbackLead, fallbackAction] = content.claimFriction.split("? ")
  const fallbackLines = fallbackAction
    ? [`${fallbackLead}?`, fallbackAction]
    : [content.claimFriction]
  fallbackLines.forEach((line, index) => {
    const fallback = standardFontText(line, fonts.monoBold)
    page.drawText(fallback, {
      x:
        qrX +
        qrSize / 2 -
        fonts.monoBold.widthOfTextAtSize(fallback, TYPE_FLOOR) / 2,
      y: originY + mm(4.5 - index * 2.6),
      size: TYPE_FLOOR,
      font: fonts.monoBold,
      color: POSTER_PDF_COLOR.inkSoft,
    })
  })
}
