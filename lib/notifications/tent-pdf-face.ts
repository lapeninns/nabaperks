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
 * Draw one tent face within the box at (originX, originY) sized w x h (points),
 * laid out top-down: header rail, badge, headline, body, stamps, QR + CTA, and
 * the footer rail. The caller places and (for the top face) rotates the box.
 * All sizes and gaps come from the locked TENT_TYPE scale.
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

  const railH = mm(TENT_TYPE.railHeightMm)
  const railInset = mm(TENT_TYPE.railInsetMm)
  const railBaseline = top - railH / 2 - TENT_TYPE.railBaselineDropPt
  page.drawRectangle({
    x: originX,
    y: top - railH,
    width,
    height: railH,
    color: p.ink,
  })
  page.drawText("* Nab a Perks", {
    x: originX + railInset,
    y: railBaseline,
    size: TENT_TYPE.brandPt,
    font: fonts.bold,
    color: p.ground,
  })
  // Truncate the kicker so a long venue can never run under the brand or off
  // the rail; the full name still prints inside the copy column. Brand and
  // kicker share the mid-rail baseline.
  const brandWidth = fonts.bold.widthOfTextAtSize(
    "* Nab a Perks",
    TENT_TYPE.brandPt
  )
  const kicker = fitSingleLineText(
    standardFontText(
      `${content.kicker} · ${options.venue}`.toUpperCase(),
      fonts.monoBold
    ),
    fonts.monoBold,
    TENT_TYPE.kickerPt,
    width - railInset * 2 - brandWidth
  )
  const kickerWidth = fonts.monoBold.widthOfTextAtSize(
    kicker,
    TENT_TYPE.kickerPt
  )
  page.drawText(kicker, {
    x: originX + width - railInset - kickerWidth,
    y: railBaseline,
    size: TENT_TYPE.kickerPt,
    font: fonts.monoBold,
    color: p.ground,
  })

  const left = originX + railInset
  const copyWidth = width * 0.6
  const headlineLines = face.headline.map((line) =>
    standardFontText(line.toUpperCase(), fonts.bold)
  )
  const headlineSize = fitTentHeadlineSize(headlineLines, fonts.bold, copyWidth)
  const headlineLeading = tentDisplayLeading(headlineSize)
  // The first display baseline hangs a cap height below its anchor — the
  // badge baseline when a badge prints, otherwise the rail — so the fitted
  // caps always keep clear air above them.
  const capHeight = headlineSize * TENT_TYPE.displayCapHeight
  let cursor = top - railH - mm(TENT_TYPE.copyTopGapMm)
  if (face.badge) {
    page.drawText(standardFontText(face.badge.toUpperCase(), fonts.monoBold), {
      x: left,
      y: cursor,
      size: TENT_TYPE.badgePt,
      font: fonts.monoBold,
      color: p.accent,
    })
    cursor -= mm(TENT_TYPE.badgeClearMm) + capHeight
  } else {
    cursor = top - railH - mm(TENT_TYPE.displayClearMm) - capHeight
  }
  face.headline.forEach((line, index) => {
    page.drawText(headlineLines[index], {
      x: left,
      y: cursor,
      size: headlineSize,
      font: fonts.bold,
      color: line === face.accent ? p.accent : p.ink,
    })
    cursor -= headlineLeading
  })
  cursor -= mm(TENT_TYPE.bodyGapMm)
  const bodyBottom = drawWrappedText(page, face.body, {
    x: left,
    y: cursor,
    maxWidth: copyWidth - railInset,
    font: fonts.regular,
    size: TENT_TYPE.bodyPt,
    lineHeight: TENT_TYPE.bodyLeadingPt,
    color: p.ink,
    maxLines: 4,
  })
  if (face.showStamps) {
    drawStampStrip(page, {
      x: left,
      y: bodyBottom - mm(TENT_TYPE.stampsGapMm),
      count: content.stampsRequired,
      venue: options.venue,
      font: fonts.monoBold,
      ink: p.ink,
      soft: p.soft,
    })
  }

  const qrSize = mm(content.qr.outerMm)
  const qrX = originX + width - qrSize - mm(10)
  const qrY = originY + height / 2 - qrSize / 2 + mm(4)
  page.drawRectangle({
    x: qrX + 3,
    y: qrY - 3,
    width: qrSize,
    height: qrSize,
    color: p.qrBorder,
  })
  drawQrCode(page, options.qrModules, qrX, qrY, qrSize)
  page.drawRectangle({
    x: qrX,
    y: qrY,
    width: qrSize,
    height: qrSize,
    borderColor: p.qrBorder,
    borderWidth: 1.4,
  })
  const cta = standardFontText(face.cta.toUpperCase(), fonts.monoBold)
  const ctaWidth = fonts.monoBold.widthOfTextAtSize(cta, TENT_TYPE.ctaPt) + 12
  page.drawRectangle({
    x: qrX + qrSize / 2 - ctaWidth / 2,
    y: qrY - mm(9),
    width: ctaWidth,
    height: mm(6),
    color: POSTER_PDF_COLOR.accent,
    borderColor: POSTER_PDF_COLOR.ink,
    borderWidth: 1,
  })
  page.drawText(cta, {
    x: qrX + qrSize / 2 - ctaWidth / 2 + 6,
    y: qrY - mm(7),
    size: TENT_TYPE.ctaPt,
    font: fonts.monoBold,
    color: POSTER_PDF_COLOR.white,
  })

  const footerY = originY + mm(TENT_TYPE.footerBaselineMm)
  page.drawText(
    standardFontText(content.footer.left.toUpperCase(), fonts.monoBold),
    {
      x: left,
      y: footerY,
      size: TENT_TYPE.footerPt,
      font: fonts.monoBold,
      color: p.soft,
    }
  )
  const right = standardFontText(
    content.footer.right.toUpperCase(),
    fonts.monoBold
  )
  const rightWidth = fonts.monoBold.widthOfTextAtSize(right, TENT_TYPE.footerPt)
  page.drawText(right, {
    x: originX + width - railInset - rightWidth,
    y: footerY,
    size: TENT_TYPE.footerPt,
    font: fonts.monoBold,
    color: p.ink,
  })
}
