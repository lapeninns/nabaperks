import type { PDFFont } from "pdf-lib"

import type { PrimerPosterContent } from "@/lib/qr/poster-kit-content-types"
import type { TextMetrics } from "@/lib/print/text"

import type { PrimerMetrics } from "./poster-pdf-a4-primer-layout"
import { primerLayout } from "./poster-pdf-a4-primer-layout"
import {
  bodyLeading,
  drawDashedLine,
  drawWrappedText,
  mm,
  POSTER_PDF_COLOR,
  POSTER_PDF_TYPE,
  standardFontText,
} from "./poster-pdf-style"
import { drawLedgerFoot, drawLedgerTop } from "./poster-pdf-a4-ledger"
import { popKitRotation, pushKitRotation } from "./poster-pdf-kit-venue"
import type { PdfFonts, PosterPdfBaseContext } from "./poster-pdf-types"

/** Exercise-book furniture: cobalt feints, red margin rule, punch holes. */
function drawPrimerRuledPage(
  context: PosterPdfBaseContext,
  topMm: number
): void {
  const { page } = context
  for (let y = topMm; y >= 30; y -= 8) {
    page.drawRectangle({
      x: mm(11),
      y: mm(y),
      width: mm(188),
      height: 0.5,
      color: POSTER_PDF_COLOR.cobalt,
      opacity: 0.14,
    })
  }
  page.drawRectangle({
    x: mm(26.5),
    y: mm(30),
    width: 0.7,
    height: mm(topMm - 28),
    color: POSTER_PDF_COLOR.accent,
    opacity: 0.35,
  })
  for (const holeY of [99, 198]) {
    page.drawCircle({
      x: mm(7),
      y: mm(holeY),
      size: mm(2.8),
      color: POSTER_PDF_COLOR.ink,
      opacity: 0.06,
      borderColor: POSTER_PDF_COLOR.inkSoft,
      borderWidth: 1,
      borderOpacity: 0.3,
    })
  }
}

function primerMetrics(fonts: PdfFonts): PrimerMetrics {
  const from = (font: PDFFont): TextMetrics => ({
    widthPt: (text, sizePt) => font.widthOfTextAtSize(text, sizePt),
    normalise: (text) => standardFontText(text, font),
  })
  return { display: from(fonts.bold), body: from(fonts.regular) }
}

export function drawPrimerA4(
  context: PosterPdfBaseContext,
  content: PrimerPosterContent
): void {
  const { page, fonts } = context
  const frame = drawLedgerTop(
    context,
    content,
    content.ledgerLabel,
    content.edition,
    POSTER_PDF_COLOR.paperDeep
  )
  drawPrimerRuledPage(context, (frame.headlineBottom * 25.4) / 72 - 2)

  // Clause geometry comes from the shared layout, which measures each detail
  // run with these exact fonts and places every separator below the measured
  // bottom. Guard G2 asserts no rule can land on the text.
  const { ledger } = primerLayout(content, primerMetrics(fonts))
  const markAt = (label: string) =>
    ledger.marks.find((mark) => mark.label === label)
  const pdfY = (yMm: number, heightMm: number) => mm(297 - yMm - heightMm)

  content.clauses.forEach((clause, index) => {
    const title = markAt(`clause-title-${index}`)
    const detail = markAt(`clause-detail-${index}`)
    if (!title || !detail) return
    const color = clause.sealed ? POSTER_PDF_COLOR.leaf : POSTER_PDF_COLOR.ink
    const titleY = pdfY(title.box.yMm, title.box.heightMm)
    page.drawText(clause.number, {
      x: mm(title.box.xMm),
      y: titleY,
      size: content.typeTiers.substantivePt,
      font: fonts.monoBold,
      color,
    })
    page.drawText(
      standardFontText(clause.title.toUpperCase(), fonts.monoBold),
      {
        x: mm(title.box.xMm + 14),
        y: titleY,
        size: content.typeTiers.substantivePt,
        font: fonts.monoBold,
        color,
      }
    )
    drawWrappedText(page, clause.detail, {
      x: mm(detail.box.xMm),
      y: pdfY(detail.box.yMm, 0) - bodyLeading(POSTER_PDF_TYPE.bodyPt),
      maxWidth: mm(detail.box.widthMm),
      font: fonts.regular,
      size: POSTER_PDF_TYPE.bodyPt,
      lineHeight: bodyLeading(POSTER_PDF_TYPE.bodyPt),
      color: POSTER_PDF_COLOR.inkSoft,
    })
    const rule = markAt(`clause-rule-${index}`)
    if (!rule) return
    const ruleY = pdfY(rule.box.yMm, rule.box.heightMm)
    drawDashedLine(page, {
      x1: mm(rule.box.xMm),
      y1: ruleY,
      x2: mm(rule.box.xMm + rule.box.widthMm),
      y2: ruleY,
      color: POSTER_PDF_COLOR.inkSoft,
    })
  })
  drawLedgerFoot(context, content, content.issuerLabel, content.signature)
  // Rubber-stamp frame around the ink signature the foot just set. Kept short
  // and low so its top edge sits under the venue name (baseline mm(64)) rather
  // than slicing through it.
  pushKitRotation(page, -2.5, mm(107), mm(57.5))
  page.drawRectangle({
    x: mm(76),
    y: mm(54),
    width: mm(62),
    height: mm(7),
    borderColor: POSTER_PDF_COLOR.accent,
    borderWidth: 1.6,
    borderOpacity: 0.85,
  })
  popKitRotation(page)
}
