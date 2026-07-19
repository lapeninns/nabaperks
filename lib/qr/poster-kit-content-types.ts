import type { A4ContentBase } from "./poster-content-types"

/**
 * Content models for the counter-kit concepts (Nº 06–15). Every string is
 * resolved catalogue copy; components and PDF renderers never own it.
 */

export type FrictionTriple = readonly [string, string, string]

export type DuotonePosterId = "window"

/** The duotone print-run ink — window runs in vermillion. */
export type DuotoneSpot = "vermillion"

export type DuotonePosterContent = A4ContentBase & {
  readonly id: DuotonePosterId
  readonly spot: DuotoneSpot
  readonly eyebrow: string
  readonly edition: string
  readonly headline: string
  readonly lede: string
  readonly friction: FrictionTriple
  readonly sealedLine: string
  readonly qrCaption: string
  readonly memberTag: string
}

export type LedgerClause = {
  readonly number: string
  readonly title: string
  readonly detail: string
  /** The sealed-reward clause prints in leaf ink. */
  readonly sealed: boolean
}

export type PrimerPosterContent = A4ContentBase & {
  readonly id: "primer"
  readonly ledgerLabel: string
  readonly edition: string
  readonly headline: string
  readonly clauses: readonly LedgerClause[]
  readonly qrCaption: string
  readonly issuerLabel: string
  readonly memberTag: string
  readonly signature: string
}

export type ManifestRow = {
  readonly label: string
  readonly value: string
  /** The reward row prints as an inked redaction bar instead of a value. */
  readonly redacted: boolean
  /** The starts-today row prints in vermillion. */
  readonly accent: boolean
}

export type SealPosterContent = A4ContentBase & {
  readonly id: "seal"
  readonly manifestLabel: string
  readonly edition: string
  readonly headline: string
  readonly sealedTag: string
  readonly rows: readonly ManifestRow[]
  readonly frictionLine: string
  readonly qrCaption: string
  readonly issuerLabel: string
  readonly memberTag: string
  readonly signature: string
}

export type PinnedPosterContent = A4ContentBase & {
  readonly id: "pinned"
  readonly eyebrow: string
  readonly edition: string
  readonly headline: string
  readonly lede: string
  readonly friction: FrictionTriple
  readonly qrCaption: string
  readonly memberTag: string
  readonly stubTop: string
  readonly stubBottom: string
}

export type TallyPosterContent = A4ContentBase & {
  readonly id: "tally"
  readonly eyebrow: string
  readonly edition: string
  readonly headline: string
  readonly cardLabel: string
  readonly cardCount: string
  readonly todayLabel: string
  readonly explainer: string
  readonly friction: FrictionTriple
  readonly dateRule: string
  readonly qrCaption: string
  readonly memberTag: string
}

/** Two-part night headline — the closing word carries the spot ink. */
export type NightHeadline = {
  readonly lead: string
  readonly accent: string
}

export type LastcallPosterContent = A4ContentBase & {
  readonly id: "lastcall"
  readonly eyebrow: string
  readonly edition: string
  readonly headline: NightHeadline
  readonly badge: string
  readonly lede: string
  readonly friction: FrictionTriple
  readonly sealedLine: string
  readonly qrCaption: string
  readonly memberTag: string
}

/** Till docket line items print resolved; the open visit slots are drawn
 * as blank dotted leaders, so only today's row and the sealed reward row
 * carry copy. */
export type ReceiptPosterContent = A4ContentBase & {
  readonly id: "receipt"
  readonly orderLabel: string
  readonly edition: string
  readonly hook: string
  readonly merchantLabel: string
  readonly cardLine: string
  readonly todayItem: string
  readonly todayValue: string
  readonly rewardItem: string
  readonly rewardValue: string
  readonly rewardNote: string
  readonly totalLabel: string
  readonly totalValue: string
  readonly footnotes: FrictionTriple
  readonly qrCaption: string
  readonly footLine: string
  readonly memberTag: string
}

export type ChalkPosterContent = A4ContentBase & {
  readonly id: "chalk"
  readonly eyebrow: string
  readonly edition: string
  readonly headline: string
  readonly todayLabel: string
  readonly rowNote: string
  readonly sealedLine: string
  readonly qrCaption: string
  readonly memberTag: string
}

export type CounterKitPosterContent =
  | PrimerPosterContent
  | DuotonePosterContent
  | PinnedPosterContent
  | SealPosterContent
  | TallyPosterContent
  | LastcallPosterContent
  | ReceiptPosterContent
  | ChalkPosterContent
