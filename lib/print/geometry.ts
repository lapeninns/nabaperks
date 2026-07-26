import type { BoxMm } from "./box"

/**
 * Only the A4 poster is specified here. Tent and NFC geometry land with their
 * own PRs — the tent needs a fold-safe band on the face's inner edge, which is
 * face-dependent and not worth guessing ahead of that work.
 */
export type FormatId = "a4Poster"

export type FormatSpec = {
  readonly trimWidthMm: number
  readonly trimHeightMm: number
  readonly bleedMm: number
  readonly marginMm: number
}

export const PRINT_FORMATS: Readonly<Record<FormatId, FormatSpec>> = {
  a4Poster: { trimWidthMm: 210, trimHeightMm: 297, bleedMm: 0, marginMm: 18 },
}

export function liveArea(format: FormatId): BoxMm {
  const spec = PRINT_FORMATS[format]
  return {
    xMm: spec.marginMm,
    yMm: spec.marginMm,
    widthMm: spec.trimWidthMm - spec.marginMm * 2,
    heightMm: spec.trimHeightMm - spec.marginMm * 2,
  }
}

/** Layout space is y-down from the trim top; pdf-lib is y-up from the bottom. */
export function toPdfYMm(
  format: FormatId,
  yDownMm: number,
  heightMm: number
): number {
  return PRINT_FORMATS[format].trimHeightMm - yDownMm - heightMm
}
