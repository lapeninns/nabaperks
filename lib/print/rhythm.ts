/**
 * Derived from the locked body tier: 12pt x 1.4 leading = 16.8pt ~ 5.9mm,
 * rounded to 6mm. Every vertical gap in the kit is a multiple of this.
 */
export const RHYTHM_BASE_MM = 6

export type RhythmGapMm = 6 | 12 | 18 | 24 | 36

export const RHYTHM_GAPS_MM: readonly RhythmGapMm[] = [6, 12, 18, 24, 36]

const EPSILON_MM = 0.01

export function isRhythmGap(valueMm: number): boolean {
  return RHYTHM_GAPS_MM.some((gap) => Math.abs(gap - valueMm) < EPSILON_MM)
}
