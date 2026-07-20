import type { PDFFont } from "pdf-lib"

import { mm } from "./poster-pdf-style"
import { fitSingleLineSize } from "./poster-pdf-text"

/**
 * Type scale mirrored from the in-app TentFace (`tent-face.module.css`).
 * Layout is a header / two-column main (copy + QR action) / footer — same
 * structure as the product preview — so print PDFs stay visually richer and
 * in step with what merchants see.
 *
 * At a ~200mm face width, cqw → approx pt: brand 2.4cqw≈14, headline ≤7.4cqw≈42,
 * body 1.75cqw≈10, meta ~1.1cqw≈6.5. We clamp the display fit so multi-line
 * hooks still clear the copy column.
 */
export const TENT_TYPE = {
  brandPt: 13,
  brandMarkMm: 5,
  kickerPt: 6.5,
  badgePt: 7,
  hookMaxPt: 38,
  hookMinPt: 22,
  /** Product headline line-height is 0.86 — keep display stack tight. */
  displayLeading: 0.92,
  /** Product body is bold; keep weight + size faithful to TentFace. */
  bodyPt: 11,
  bodyLeadingPt: 14,
  ctaPt: 7,
  footerPt: 6.5,
  railHeightMm: 12,
  railInsetMm: 6.5,
  railBaselineDropPt: 4,
  /** Matches `.main { grid-template-columns: 1fr 32% }` — copy gets the rest. */
  actionColumnRatio: 0.32,
  mainGapMm: 6,
  mainPadMm: 6,
  displayCapHeight: 0.72,
  badgePadXMm: 2.5,
  badgePadYMm: 1.2,
  copyStackGapMm: 3.5,
  stampsGapMm: 4,
  qrShadowOffsetMm: 1.4,
  ctaPadXMm: 2.2,
  ctaHeightMm: 5.5,
  ctaGapMm: 2.5,
  footerPadMm: 3.5,
  footerRuleMm: 0.35,
  headlineBandMaxMm: 72,
}

/**
 * One display size per face: the largest size that fits every headline line
 * in the copy column and stays inside the headline band.
 */
export function fitTentHeadlineSize(
  lines: readonly string[],
  font: PDFFont,
  maxWidth: number
): number {
  const bandHeight =
    mm(TENT_TYPE.headlineBandMaxMm) /
    Math.max(lines.length, 1) /
    TENT_TYPE.displayLeading
  let size = Math.min(TENT_TYPE.hookMaxPt, bandHeight)
  for (const line of lines) {
    size = Math.min(
      size,
      fitSingleLineSize(line, font, size, TENT_TYPE.hookMinPt, maxWidth)
    )
  }
  return Math.max(size, TENT_TYPE.hookMinPt)
}

export function tentDisplayLeading(sizePt: number): number {
  return sizePt * TENT_TYPE.displayLeading
}
