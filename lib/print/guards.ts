import type { BoxMm } from "./box"
import { contains, intersects } from "./box"
import type { Ledger, Mark } from "./ledger-types"

export type GuardViolation = {
  readonly guard: string
  readonly detail: string
}

/** Anything smaller than this renders as an empty box or a stray fragment. */
const MIN_AREA_MM2 = 0.01

function containerBoxOf(ledger: Ledger, name: string): BoxMm {
  const box = ledger.containers.get(name)
  if (!box) throw new Error(`Unknown container ${name}`)
  return box
}

/** G1 — every mark stays inside the container it belongs to. */
export function checkSafeArea(ledger: Ledger): GuardViolation[] {
  return ledger.marks
    .filter(
      (mark) => !contains(containerBoxOf(ledger, mark.container), mark.box)
    )
    .map((mark) => ({
      guard: "G1-safe-area",
      detail: `${mark.label} escapes container ${mark.container}`,
    }))
}

function mayOverlap(text: Mark, other: Mark): boolean {
  const allowed = text.overlaps
  if (!allowed) return false
  return allowed.includes(other.label)
}

/** G2 — no text run is crossed by a rule or shape it did not opt into. */
export function checkCollisions(ledger: Ledger): GuardViolation[] {
  const texts = ledger.marks.filter((mark) => mark.kind === "text")
  const blockers = ledger.marks.filter(
    (mark) => mark.kind === "rule" || mark.kind === "shape"
  )
  const violations: GuardViolation[] = []
  for (const text of texts) {
    for (const blocker of blockers) {
      if (mayOverlap(text, blocker)) continue
      if (!intersects(text.box, blocker.box)) continue
      violations.push({
        guard: "G2-collision",
        detail: `${blocker.label} crosses text ${text.label}`,
      })
    }
  }
  return violations
}

/** G3 — decorations declare a clip container and stay inside it. */
export function checkClips(ledger: Ledger): GuardViolation[] {
  return ledger.marks
    .filter((mark) => mark.role === "decoration")
    .flatMap((mark) => {
      const clipTo = mark.clipTo
      if (!clipTo) {
        return [{ guard: "G3-clip", detail: `${mark.label} has no clipTo` }]
      }
      if (contains(containerBoxOf(ledger, clipTo), mark.box)) return []
      return [
        { guard: "G3-clip", detail: `${mark.label} escapes clip ${clipTo}` },
      ]
    })
}

/** G4 — no zero-area marks, which render as empty boxes or stray fragments. */
export function checkDegenerate(ledger: Ledger): GuardViolation[] {
  return ledger.marks
    .filter((mark) => mark.box.widthMm * mark.box.heightMm < MIN_AREA_MM2)
    .map((mark) => ({
      guard: "G4-degenerate",
      detail: `${mark.label} has no drawable area`,
    }))
}

export function checkLedger(ledger: Ledger): GuardViolation[] {
  return [
    ...checkSafeArea(ledger),
    ...checkCollisions(ledger),
    ...checkClips(ledger),
    ...checkDegenerate(ledger),
  ]
}
