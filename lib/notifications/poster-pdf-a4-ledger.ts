import type { RGB } from "pdf-lib"

import type {
  PrimerPosterContent,
  SealPosterContent,
} from "@/lib/qr/poster-kit-content-types"

import {
  bodyLeading,
  displayLeading,
  drawWrappedText,
  mm,
  POSTER_PDF_COLOR,
} from "./poster-pdf-style"
import { drawKitMasthead, drawKitQrPanel } from "./poster-pdf-kit-pieces"
import { drawKitLedgerVenue } from "./poster-pdf-kit-venue"
import type { PosterPdfBaseContext } from "./poster-pdf-types"

/** Shared frame for the ledger family (primer + seal). */

export type LedgerContent = PrimerPosterContent | SealPosterContent

export type LedgerFrame = {
  readonly left: number
  readonly width: number
  readonly headlineBottom: number
}

export function drawLedgerTop(
  context: PosterPdfBaseContext,
  content: LedgerContent,
  lead: string,
  edition: string,
  ground: RGB
): LedgerFrame {
  const { page, fonts } = context
  const left = mm(content.geometry.safeMarginMm)
  const width = mm(content.geometry.sheetWidthMm) - left * 2
  page.drawRectangle({
    x: 0,
    y: 0,
    width: mm(content.geometry.sheetWidthMm),
    height: mm(content.geometry.sheetHeightMm),
    color: ground,
  })
  const ruleY = drawKitMasthead(page, {
    x: left,
    y: mm(278),
    width,
    lead,
    leadColor: POSTER_PDF_COLOR.ink,
    edition,
    editionColor: POSTER_PDF_COLOR.ink,
    fonts,
    rule: "solid",
    ruleColor: POSTER_PDF_COLOR.ink,
  })
  // First baseline hangs one display ascent plus a 3 mm gutter below the
  // masthead rule so the caps never strike it or the 15 mm safe frame.
  const headlineBottom = drawWrappedText(page, content.headline, {
    x: left,
    y: ruleY - mm(3) - content.typeTiers.hookPt * 0.96,
    maxWidth: width,
    font: fonts.bold,
    size: content.typeTiers.hookPt,
    lineHeight: displayLeading(content.typeTiers.hookPt),
    color: POSTER_PDF_COLOR.ink,
    maxLines: content.id === "primer" ? 4 : 2,
  })
  return { left, width, headlineBottom }
}

export function drawLedgerFoot(
  context: PosterPdfBaseContext,
  content: LedgerContent,
  issuerLabel: string,
  signature: string
): void {
  const { page, fonts } = context
  const left = mm(content.geometry.safeMarginMm)
  const width = mm(content.geometry.sheetWidthMm) - left * 2
  const qrSize = mm(content.qr.outerMm)
  drawKitQrPanel(page, context.qrModules, content.qrCaption, {
    x: left,
    y: mm(37),
    size: qrSize,
    font: fonts.monoBold,
    captionColor: POSTER_PDF_COLOR.ink,
    border: POSTER_PDF_COLOR.ink,
    shadow: content.id === "seal" ? POSTER_PDF_COLOR.sun : undefined,
  })
  drawKitLedgerVenue(page, {
    x: left + qrSize + mm(9),
    y: mm(74),
    width: width - qrSize - mm(9),
    issuerLabel,
    memberTag: content.memberTag,
    venue: context.merchantName,
    signature,
    fonts,
    ink: POSTER_PDF_COLOR.ink,
    soft: POSTER_PDF_COLOR.inkSoft,
  })
  page.drawRectangle({
    x: left,
    y: mm(24),
    width,
    height: 2.2,
    color: POSTER_PDF_COLOR.ink,
  })
  drawWrappedText(page, content.reassurance, {
    x: left,
    y: mm(20),
    maxWidth: width,
    font: fonts.monoBold,
    size: content.typeTiers.factsPt,
    lineHeight: bodyLeading(content.typeTiers.factsPt),
    color: POSTER_PDF_COLOR.inkSoft,
    maxLines: 2,
  })
}
