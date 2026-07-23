import type { PDFPage } from "pdf-lib"

import type { TentContent, TentFaceContent } from "@/lib/qr/tent-content"
import type { BitMatrix } from "qrcode"

import {
  drawWrappedText,
  mm,
  POSTER_PDF_COLOR,
  standardFontText,
} from "./poster-pdf-style"
import type { PdfFonts } from "./poster-pdf-types"
import { drawStampStrip, tentFacePalette } from "./tent-pdf-pieces"
import { drawTentActionColumn, drawTentFooter } from "./tent-pdf-face-action"
import { drawTentHeaderRail } from "./tent-pdf-face-rail"
import { drawTentIdentity } from "./tent-pdf-identity"
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

  drawTentHeaderRail(page, {
    originX,
    top,
    width,
    railH,
    inset,
    venue: options.venue,
    kicker: content.kicker,
    fonts,
    ground: p.ground,
    rail: p.ink,
  })

  // Per-design material identity, behind the copy and QR content.
  drawTentIdentity(page, content, {
    originX,
    originY,
    width,
    height,
    palette: p,
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

  drawTentActionColumn(page, {
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

  drawTentFooter(page, {
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
