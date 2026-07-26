import type { GuardViolation } from "./guards"
import { isRhythmGap } from "./rhythm"
import type { ZoneName, ZoneStack } from "./zones"

/** Below this, consumer printing and phone cameras stop being reliable. */
export const QR_MODULE_FLOOR_MM = 0.5

export function qrModuleSizeMm(
  outerMm: number,
  modules: number,
  quietZoneModules: number
): number {
  return outerMm / (modules + quietZoneModules * 2)
}

/** G6 — the printed module never drops below the scan floor. */
export function checkQrFloor(
  outerMm: number,
  modules: number,
  quietZoneModules: number,
  label: string
): GuardViolation[] {
  const size = qrModuleSizeMm(outerMm, modules, quietZoneModules)
  if (size >= QR_MODULE_FLOOR_MM) return []
  return [
    {
      guard: "G6-qr-floor",
      detail: `${label} module ${size.toFixed(3)}mm is below ${QR_MODULE_FLOOR_MM}mm`,
    },
  ]
}

const ZONE_ORDER: readonly ZoneName[] = [
  "rail",
  "statement",
  "proof",
  "action",
  "legal",
]

/** G5 — every inter-zone gap sits on the 6mm rhythm scale. */
export function checkZoneRhythm(zones: ZoneStack): GuardViolation[] {
  const violations: GuardViolation[] = []
  for (let index = 1; index < ZONE_ORDER.length; index += 1) {
    const previous = zones[ZONE_ORDER[index - 1]]
    const current = zones[ZONE_ORDER[index]]
    const gap = current.yMm - (previous.yMm + previous.heightMm)
    if (isRhythmGap(gap)) continue
    violations.push({
      guard: "G5-rhythm",
      detail: `gap ${gap.toFixed(2)}mm before ${ZONE_ORDER[index]} is off the scale`,
    })
  }
  return violations
}
