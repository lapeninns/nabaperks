import type { BoxMm } from "./box"
import type { Mark } from "./ledger-types"
import { RHYTHM_BASE_MM } from "./rhythm"

export type StampRailOptions = {
  readonly origin: BoxMm
  readonly slots: number
  readonly container: string
}

const DIVIDER_WIDTH_MM = 0.5

/**
 * Shared stamp-progress geometry: empty slots, a divider, then a reward seal.
 * Slot fill is deliberately absent because a new customer has no stamp yet.
 */
export function stampRailMarks(options: StampRailOptions): readonly Mark[] {
  if (!Number.isInteger(options.slots) || options.slots < 1) {
    throw new Error("Stamp rail requires at least one slot")
  }
  const sizeMm = Math.min(options.origin.heightMm, RHYTHM_BASE_MM * 2)
  const pitchMm = sizeMm + RHYTHM_BASE_MM
  const slotsWidthMm =
    sizeMm * options.slots + RHYTHM_BASE_MM * (options.slots - 1)
  const dividerXmm = options.origin.xMm + slotsWidthMm + RHYTHM_BASE_MM
  const sealXmm = dividerXmm + DIVIDER_WIDTH_MM + RHYTHM_BASE_MM
  const requiredWidthMm = sealXmm + sizeMm - options.origin.xMm
  if (requiredWidthMm > options.origin.widthMm) {
    throw new Error("Stamp rail does not fit its origin")
  }

  const marks: Mark[] = Array.from({ length: options.slots }, (_, index) => ({
    kind: "shape",
    role: "content",
    box: {
      xMm: options.origin.xMm + index * pitchMm,
      yMm: options.origin.yMm,
      widthMm: sizeMm,
      heightMm: sizeMm,
    },
    container: options.container,
    label: `stamp-slot-${index}`,
  }))
  marks.push({
    kind: "rule",
    role: "chrome",
    box: {
      xMm: dividerXmm,
      yMm: options.origin.yMm,
      widthMm: DIVIDER_WIDTH_MM,
      heightMm: sizeMm,
    },
    container: options.container,
    label: "stamp-divider",
  })
  marks.push({
    kind: "shape",
    role: "content",
    box: {
      xMm: sealXmm,
      yMm: options.origin.yMm,
      widthMm: sizeMm,
      heightMm: sizeMm,
    },
    container: options.container,
    label: "stamp-seal",
  })
  return marks
}
