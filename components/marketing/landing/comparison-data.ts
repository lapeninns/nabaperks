/**
 * The first-party comparison TABLE — the page's highest-leverage GEO asset.
 * Answer engines (ChatGPT, Perplexity, Gemini, AI Overviews) lift clean
 * comparison tables for "X vs Y" and "loyalty card without an app" queries, so
 * this ships as real semantic <table> markup.
 *
 * ASA/CAP-safe rule: every cell is a verifiable STRUCTURAL fact about each
 * category (needs an install? needs a POS? server-checked? physical?), never a
 * subjective superiority claim and never a competitor's price (those drift — keep
 * price specifics to maintained spoke pages). Nabaperks is honestly ✓ on every
 * row; every alternative falls short on at least one — that is the wedge.
 */

export type ComparisonColumn = {
  key: string
  label: string
  sub: string
  highlight?: boolean
}

export const COMPARISON_COLUMNS: readonly ComparisonColumn[] = [
  { key: "nabaperks", label: "Nabaperks", sub: "Browser-based card", highlight: true },
  { key: "wallet", label: "Wallet-pass apps", sub: "e.g. Loopy, Stamp Me" },
  { key: "paper", label: "Paper card", sub: "Punch / stamp" },
  { key: "pos", label: "POS loyalty", sub: "e.g. Square, Loyverse" },
]

export type ComparisonCell = boolean
export type ComparisonRow = {
  feature: string
  /** [nabaperks, wallet, paper, pos] — order matches COMPARISON_COLUMNS. */
  cells: [ComparisonCell, ComparisonCell, ComparisonCell, ComparisonCell]
}

export const COMPARISON_ROWS: readonly ComparisonRow[] = [
  { feature: "Nothing to download or install", cells: [true, false, true, false] },
  { feature: "Can't be lost or left at home", cells: [true, true, false, true] },
  { feature: "Every stamp is counter-verified — can't be faked", cells: [true, false, false, false] },
  { feature: "No POS or hardware — works on any till", cells: [true, true, true, false] },
  { feature: "The phone never crosses the counter", cells: [true, false, true, false] },
  { feature: "Gives you visit & redemption data", cells: [true, true, false, true] },
]

/** Rows an alternative category does not satisfy — for compact mobile summaries. */
export function comparisonGapsForColumn(columnIndex: number) {
  return COMPARISON_ROWS.filter((row) => !row.cells[columnIndex])
}
