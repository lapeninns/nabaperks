/** Axis-aligned box in millimetres, y measured DOWN from the trim top. */
export type BoxMm = {
  readonly xMm: number
  readonly yMm: number
  readonly widthMm: number
  readonly heightMm: number
}

/** Sub-0.05mm differences are float noise, not layout intent. */
const EPSILON_MM = 0.05

export function boxRight(box: BoxMm): number {
  return box.xMm + box.widthMm
}

export function boxBottom(box: BoxMm): number {
  return box.yMm + box.heightMm
}

export function contains(outer: BoxMm, inner: BoxMm): boolean {
  return (
    inner.xMm >= outer.xMm - EPSILON_MM &&
    inner.yMm >= outer.yMm - EPSILON_MM &&
    boxRight(inner) <= boxRight(outer) + EPSILON_MM &&
    boxBottom(inner) <= boxBottom(outer) + EPSILON_MM
  )
}

export function intersects(a: BoxMm, b: BoxMm): boolean {
  return (
    a.xMm < boxRight(b) - EPSILON_MM &&
    boxRight(a) > b.xMm + EPSILON_MM &&
    a.yMm < boxBottom(b) - EPSILON_MM &&
    boxBottom(a) > b.yMm + EPSILON_MM
  )
}
