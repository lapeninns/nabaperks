import type { PDFPage } from "pdf-lib"

import type { BitMatrix } from "qrcode"

import {
  drawQrCode,
  mm,
  POSTER_PDF_COLOR,
  standardFontText,
} from "./poster-pdf-style"
import type { PdfFonts } from "./poster-pdf-types"
import type { TentFacePalette } from "./tent-pdf-pieces"
import { TENT_TYPE } from "./tent-pdf-typography"

/** The QR action column: shadowed light box + vermillion CTA plate. */
export function drawTentActionColumn(
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
    readonly qrBorder: TentFacePalette["qrBorder"]
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

/** The face footer: rule, date-rule line left, friction line right. */
export function drawTentFooter(
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
    readonly ink: TentFacePalette["ink"]
    readonly soft: TentFacePalette["soft"]
    readonly rule: TentFacePalette["soft"]
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
