import type { BoxMm } from "./box"
import type { Mark } from "./ledger-types"
import { RHYTHM_BASE_MM } from "./rhythm"

export type StepRailOptions = {
  readonly origin: BoxMm
  readonly steps: number
  readonly container: string
}

/** Tap -> Join -> Return geometry, intentionally distinct from stamp slots. */
export function stepRailMarks(options: StepRailOptions): readonly Mark[] {
  if (!Number.isInteger(options.steps) || options.steps < 1) {
    throw new Error("Step rail requires at least one step")
  }
  const laneWidthMm = options.origin.widthMm / options.steps
  const chevronSizeMm = Math.min(RHYTHM_BASE_MM, options.origin.heightMm)
  const labelHeightMm = Math.min(RHYTHM_BASE_MM, options.origin.heightMm)
  const marks: Mark[] = []
  for (let index = 0; index < options.steps; index += 1) {
    const laneXmm = options.origin.xMm + laneWidthMm * index
    marks.push({
      kind: "shape",
      role: "content",
      box: {
        xMm: laneXmm,
        yMm: options.origin.yMm,
        widthMm: chevronSizeMm,
        heightMm: chevronSizeMm,
      },
      container: options.container,
      label: `step-chevron-${index}`,
    })
    marks.push({
      kind: "text",
      role: "content",
      box: {
        xMm: laneXmm + chevronSizeMm + 2,
        yMm: options.origin.yMm,
        widthMm: laneWidthMm - chevronSizeMm - 2,
        heightMm: labelHeightMm,
      },
      container: options.container,
      label: `step-label-${index}`,
    })
  }
  return marks
}
