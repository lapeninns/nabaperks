import type { PDFPage } from "pdf-lib"

import type { TentContent, TentFaceContent } from "@/lib/qr/tent-content"
import type { BitMatrix } from "qrcode"

import {
  drawQrCode,
  drawWrappedText,
  fitSingleLineText,
  mm,
  POSTER_PDF_COLOR,
  standardFontText,
} from "./poster-pdf-style"
import type { PdfFonts } from "./poster-pdf-types"
import { drawStampStrip, tentFacePalette } from "./tent-pdf-pieces"
import {
  fitTentHeadlineSize,
  TENT_TYPE,
  tentDisplayLeading,
} from "./tent-pdf-typography"

/**
 * Draw one tent face to match the product TentFace layout:
 * header rail → two-column main (copy + QR action) → footer with rule.
 * Print stays in step with `components/merchant/qr-poster/table-tent/`.
 */
export function drawTentFace(
  page: PDFPage,
  content: TentContent,
  face: TentFaceContent,
  options: {
    readonly originX: number
    readonly originY: number
    readonly width: number
    readonly height: number
    readonly venue: string
    readonly fonts: PdfFonts
    readonly qrModules: BitMatrix
  }
): void {
  const { originX, originY, width, height, fonts } = options
  const p = tentFacePalette(face)
  const top = originY + height
  page.drawRectangle({
    x: originX,
    y: originY,
    width,
    height,
    color: p.ground,
  })

  const inset = mm(TENT_TYPE.railInsetMm)
  const railH = mm(TENT_TYPE.railHeightMm)
  const footerH = mm(TENT_TYPE.footerPadMm * 2 + 3)
  const mainBottom = originY + footerH
  const mainTop = top - railH
  const mainPad = mm(TENT_TYPE.mainPadMm)
  const mainGap = mm(TENT_TYPE.mainGapMm)
  const actionWidth = width * TENT_TYPE.actionColumnRatio
  const copyWidth = width - inset * 2 - mainGap - actionWidth
  const copyLeft = originX + inset
  const actionLeft = copyLeft + copyWidth + mainGap

  drawHeaderRail(page, {
    originX,
    top,
    width,
    railH,
    inset,
    venue: options.venue,
    kicker: content.kicker,
    fonts,
    ground: p.ground,
  })

  const headlineLines = face.headline.map((line) =>
    standardFontText(line.toUpperCase(), fonts.bold)
  )
  const headlineSize = fitTentHeadlineSize(headlineLines, fonts.bold, copyWidth)
  const headlineLeading = tentDisplayLeading(headlineSize)
  const capHeight = headlineSize * TENT_TYPE.displayCapHeight

  let cursor = mainTop - mainPad
  if (face.badge) {
    cursor = drawBadgePill(page, {
      x: copyLeft,
      y: cursor,
      label: face.badge,
      font: fonts.monoBold,
      fill:
        face.tone === "ink" ? POSTER_PDF_COLOR.sun : POSTER_PDF_COLOR.accent,
    })
    cursor -= mm(TENT_TYPE.copyStackGapMm) + capHeight
  } else {
    cursor -= capHeight
  }

  face.headline.forEach((line, index) => {
    page.drawText(headlineLines[index], {
      x: copyLeft,
      y: cursor,
      size: headlineSize,
      font: fonts.bold,
      color: line === face.accent ? p.accent : p.ink,
    })
    cursor -= headlineLeading
  })
  cursor -= mm(TENT_TYPE.copyStackGapMm)

  const bodyBottom = drawWrappedText(page, face.body, {
    x: copyLeft,
    y: cursor,
    maxWidth: copyWidth,
    font: fonts.bold,
    size: TENT_TYPE.bodyPt,
    lineHeight: TENT_TYPE.bodyLeadingPt,
    color: p.ink,
    maxLines: 4,
  })

  if (face.showStamps) {
    // Pin the stamp strip near the bottom of the main band (product
    // `.copy { justify-content: space-between }`), not under long body only.
    const stampY = Math.min(
      bodyBottom - mm(TENT_TYPE.stampsGapMm),
      mainBottom + mainPad + mm(5)
    )
    drawStampStrip(page, {
      x: copyLeft,
      y: Math.max(stampY, mainBottom + mainPad + mm(4)),
      count: content.stampsRequired,
      venue: options.venue,
      font: fonts.monoBold,
      ink: p.ink,
      soft: p.soft,
    })
  }

  drawActionColumn(page, {
    actionLeft,
    actionWidth,
    mainBottom,
    mainTop,
    qrModules: options.qrModules,
    qrOuterMm: content.qr.outerMm,
    cta: face.cta,
    fonts,
    qrBorder: p.qrBorder,
  })

  drawFooter(page, {
    originX,
    originY,
    width,
    inset,
    footerH,
    left: content.footer.left,
    right: content.footer.right,
    fonts,
    ink: p.ink,
    soft: p.soft,
    rule: p.soft,
  })
}

function drawHeaderRail(
  page: PDFPage,
  options: {
    readonly originX: number
    readonly top: number
    readonly width: number
    readonly railH: number
    readonly inset: number
    readonly venue: string
    readonly kicker: string
    readonly fonts: PdfFonts
    readonly ground: ReturnType<typeof tentFacePalette>["ground"]
  }
): void {
  const { originX, top, width, railH, inset, fonts, ground } = options
  page.drawRectangle({
    x: originX,
    y: top - railH,
    width,
    height: railH,
    color: POSTER_PDF_COLOR.ink,
  })

  const mark = mm(TENT_TYPE.brandMarkMm)
  const markX = originX + inset
  const markY = top - railH / 2 - mark / 2
  page.drawCircle({
    x: markX + mark / 2,
    y: markY + mark / 2,
    size: mark / 2,
    color: POSTER_PDF_COLOR.accent,
    borderColor: ground,
    borderWidth: 0.8,
  })
  page.drawText("*", {
    x: markX + mark / 2 - 2.2,
    y: markY + mark / 2 - 3.2,
    size: 8,
    font: fonts.bold,
    color: POSTER_PDF_COLOR.white,
  })

  const brandBaseline = top - railH / 2 - TENT_TYPE.railBaselineDropPt
  const nab = "Nab "
  const a = "a"
  const perks = " Perks"
  let brandX = markX + mark + mm(1.5)
  page.drawText(nab, {
    x: brandX,
    y: brandBaseline,
    size: TENT_TYPE.brandPt,
    font: fonts.bold,
    color: ground,
  })
  brandX += fonts.bold.widthOfTextAtSize(nab, TENT_TYPE.brandPt)
  page.drawText(a, {
    x: brandX,
    y: brandBaseline,
    size: TENT_TYPE.brandPt,
    font: fonts.bold,
    color: POSTER_PDF_COLOR.sun,
  })
  brandX += fonts.bold.widthOfTextAtSize(a, TENT_TYPE.brandPt)
  page.drawText(perks, {
    x: brandX,
    y: brandBaseline,
    size: TENT_TYPE.brandPt,
    font: fonts.bold,
    color: ground,
  })

  // Product edition pill: kicker label + venue chip (matches TentFace kicker).
  const venueChip = fitSingleLineText(
    standardFontText(options.venue.toUpperCase(), fonts.monoBold),
    fonts.monoBold,
    TENT_TYPE.kickerPt,
    width * 0.28
  )
  const chipPadX = 4
  const chipPadY = 2
  const chipTextW = fonts.monoBold.widthOfTextAtSize(
    venueChip,
    TENT_TYPE.kickerPt
  )
  const chipW = chipTextW + chipPadX * 2
  const chipH = TENT_TYPE.kickerPt + chipPadY * 2
  const chipX = originX + width - inset - chipW
  const chipY = top - railH / 2 - chipH / 2
  page.drawRectangle({
    x: chipX,
    y: chipY,
    width: chipW,
    height: chipH,
    color: POSTER_PDF_COLOR.accent,
  })
  page.drawText(venueChip, {
    x: chipX + chipPadX,
    y: chipY + chipPadY,
    size: TENT_TYPE.kickerPt,
    font: fonts.monoBold,
    color: POSTER_PDF_COLOR.white,
  })

  const kickerLabel = fitSingleLineText(
    standardFontText(options.kicker.toUpperCase(), fonts.monoBold),
    fonts.monoBold,
    TENT_TYPE.kickerPt,
    chipX - brandX - mm(8)
  )
  const kickerW = fonts.monoBold.widthOfTextAtSize(
    kickerLabel,
    TENT_TYPE.kickerPt
  )
  page.drawText(kickerLabel, {
    x: chipX - mm(2) - kickerW,
    y: brandBaseline,
    size: TENT_TYPE.kickerPt,
    font: fonts.monoBold,
    color: ground,
  })
}

function drawBadgePill(
  page: PDFPage,
  options: {
    readonly x: number
    readonly y: number
    readonly label: string
    readonly font: PdfFonts["monoBold"]
    readonly fill: ReturnType<typeof tentFacePalette>["accent"]
  }
): number {
  const text = standardFontText(options.label.toUpperCase(), options.font)
  const padX = mm(TENT_TYPE.badgePadXMm)
  const padY = mm(TENT_TYPE.badgePadYMm)
  const textW = options.font.widthOfTextAtSize(text, TENT_TYPE.badgePt)
  const boxW = textW + padX * 2
  const boxH = TENT_TYPE.badgePt + padY * 2
  const boxY = options.y - boxH
  page.drawRectangle({
    x: options.x,
    y: boxY,
    width: boxW,
    height: boxH,
    color: options.fill,
    borderColor: POSTER_PDF_COLOR.ink,
    borderWidth: 1,
  })
  page.drawText(text, {
    x: options.x + padX,
    y: boxY + padY,
    size: TENT_TYPE.badgePt,
    font: options.font,
    color: POSTER_PDF_COLOR.ink,
  })
  return boxY
}

function drawActionColumn(
  page: PDFPage,
  options: {
    readonly actionLeft: number
    readonly actionWidth: number
    readonly mainBottom: number
    readonly mainTop: number
    readonly qrModules: BitMatrix
    readonly qrOuterMm: number
    readonly cta: string
    readonly fonts: PdfFonts
    readonly qrBorder: ReturnType<typeof tentFacePalette>["qrBorder"]
  }
): void {
  const qrSize = mm(options.qrOuterMm)
  const shadow = mm(TENT_TYPE.qrShadowOffsetMm)
  const ctaHeight = mm(TENT_TYPE.ctaHeightMm)
  const ctaGap = mm(TENT_TYPE.ctaGapMm)
  const stackH = qrSize + ctaGap + ctaHeight
  const midY = (options.mainTop + options.mainBottom) / 2
  const stackTop = midY + stackH / 2
  const qrY = stackTop - qrSize
  const qrX = options.actionLeft + (options.actionWidth - qrSize) / 2

  // Product `.qrBox` uses an offset wet-ink shadow.
  page.drawRectangle({
    x: qrX + shadow,
    y: qrY - shadow,
    width: qrSize,
    height: qrSize,
    color: options.qrBorder,
  })
  page.drawRectangle({
    x: qrX,
    y: qrY,
    width: qrSize,
    height: qrSize,
    color: POSTER_PDF_COLOR.white,
  })
  drawQrCode(page, options.qrModules, qrX, qrY, qrSize)
  page.drawRectangle({
    x: qrX,
    y: qrY,
    width: qrSize,
    height: qrSize,
    borderColor: options.qrBorder,
    borderWidth: 1.2,
  })

  const cta = standardFontText(
    options.cta.toUpperCase(),
    options.fonts.monoBold
  )
  const ctaPadX = mm(TENT_TYPE.ctaPadXMm)
  const ctaWidth =
    options.fonts.monoBold.widthOfTextAtSize(cta, TENT_TYPE.ctaPt) + ctaPadX * 2
  const ctaX = qrX + qrSize / 2 - ctaWidth / 2
  const ctaY = qrY - ctaGap - ctaHeight
  // Shadow plate under the CTA (product box-shadow).
  page.drawRectangle({
    x: ctaX + 1.5,
    y: ctaY - 1.5,
    width: ctaWidth,
    height: ctaHeight,
    color: POSTER_PDF_COLOR.ink,
  })
  page.drawRectangle({
    x: ctaX,
    y: ctaY,
    width: ctaWidth,
    height: ctaHeight,
    color: POSTER_PDF_COLOR.accent,
    borderColor: POSTER_PDF_COLOR.ink,
    borderWidth: 1,
  })
  page.drawText(cta, {
    x: ctaX + ctaPadX,
    y: ctaY + ctaHeight / 2 - TENT_TYPE.ctaPt * 0.35,
    size: TENT_TYPE.ctaPt,
    font: options.fonts.monoBold,
    color: POSTER_PDF_COLOR.white,
  })
}

function drawFooter(
  page: PDFPage,
  options: {
    readonly originX: number
    readonly originY: number
    readonly width: number
    readonly inset: number
    readonly footerH: number
    readonly left: string
    readonly right: string
    readonly fonts: PdfFonts
    readonly ink: ReturnType<typeof tentFacePalette>["ink"]
    readonly soft: ReturnType<typeof tentFacePalette>["soft"]
    readonly rule: ReturnType<typeof tentFacePalette>["soft"]
  }
): void {
  const ruleY = options.originY + options.footerH
  page.drawRectangle({
    x: options.originX + options.inset,
    y: ruleY,
    width: options.width - options.inset * 2,
    height: mm(TENT_TYPE.footerRuleMm),
    color: options.rule,
  })
  const footerY = options.originY + mm(TENT_TYPE.footerPadMm)
  page.drawText(
    standardFontText(options.left.toUpperCase(), options.fonts.monoBold),
    {
      x: options.originX + options.inset,
      y: footerY,
      size: TENT_TYPE.footerPt,
      font: options.fonts.monoBold,
      color: options.soft,
    }
  )
  const right = standardFontText(
    options.right.toUpperCase(),
    options.fonts.monoBold
  )
  const rightWidth = options.fonts.monoBold.widthOfTextAtSize(
    right,
    TENT_TYPE.footerPt
  )
  page.drawText(right, {
    x: options.originX + options.width - options.inset - rightWidth,
    y: footerY,
    size: TENT_TYPE.footerPt,
    font: options.fonts.monoBold,
    color: options.ink,
  })
}
