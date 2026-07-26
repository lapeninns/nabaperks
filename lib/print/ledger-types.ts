import type { BoxMm } from "./box"

export type MarkKind = "text" | "rule" | "shape" | "qr" | "image"

/** `decoration` marks must declare `clipTo`; guard G3 enforces it. */
export type MarkRole = "content" | "decoration" | "chrome"

export type Mark = {
  readonly kind: MarkKind
  readonly role: MarkRole
  readonly box: BoxMm
  readonly container: string
  readonly label: string
  readonly clipTo?: string
  /** Labels this mark is permitted to intersect, e.g. a chip's background. */
  readonly overlaps?: readonly string[]
}

export type Ledger = {
  readonly marks: readonly Mark[]
  readonly containers: ReadonlyMap<string, BoxMm>
}
