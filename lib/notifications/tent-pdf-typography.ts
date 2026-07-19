import type { PDFFont } from "pdf-lib"

import { mm } from "./poster-pdf-style"
import { fitSingleLineSize } from "./poster-pdf-text"

/**
 * Locked type scale and vertical rhythm for the fold-to-peak tent face
 * (print PDF). Sizes are pt, rhythm is mm. The display stack fits the copy
 * column inside the hook band and breathes at ~1.08x its size; body copy
 * sets in the regular weight at ~1.43x so hierarchy comes from the display
 * tier, not from bold paragraphs. Brand and kicker share one mid-rail
 * baseline.
 */
export const TENT_TYPE = {
  brandPt: 11,
  kickerPt: 7.5,
  badgePt: 9,
  hookMaxPt: 30,
  hookMinPt: 20,
  displayLeading: 1.08,
  bodyPt: 10.5,
  bodyLeadingPt: 15,
  ctaPt: 7.5,
  footerPt: 7,
  railHeightMm: 11,
  railInsetMm: 6,
  railBaselineDropPt: 4,
  copyTopGapMm: 9,
  displayClearMm: 4,
  badgeClearMm: 3,
  displayCapHeight: 0.72,
  bodyGapMm: 3,
  stampsGapMm: 10,
  footerBaselineMm: 4,
  headlineBandMaxMm: 58,
}

/**
 * One display size per face: the largest hook-band size at which every
 * headline line fits the copy column and the whole stack stays inside the
 * headline band. The catalogue's longest line decides, so a face's lines
 * always share a single size.
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
