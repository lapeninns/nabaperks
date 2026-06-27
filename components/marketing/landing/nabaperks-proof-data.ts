/**
 * Nabaperks loyalty proof — REAL production figures from the loyalty module (the
 * `loyalty_*` tables that are being separated into the standalone Nabaperks
 * product), pulled with source SQL on file, 2024-03-14 → 2026-06-27 across 7 UK
 * venues. Shown as Nabaperks' own track record with an honest continuity framing
 * (the programme ran inside Lapen Inns' Nabatable and is now its own product).
 * Gated: a stat renders only when `substantiated` is true. Keep every figure
 * reproducible from production — the SQL is on file with the owner.
 *
 * Only mutually-consistent, High-confidence figures are displayed. Two supplied
 * metrics are deliberately NOT shown, to avoid publishing a contradiction:
 *   - "3.4 avg stamped visits per member": its denominator is every customer with
 *     a stamp event (~5.5k), not the 1,842 active/completed members, so it would
 *     clash with 18,706 ÷ 1,842 = 10.2 sitting beside it.
 *   - "61.2% repeat-visit share": Medium confidence.
 * Reconcile the member definition (1,842 active/completed cards vs all customers
 * with a stamp event) before promoting either.
 *
 * Refresh: these are a point-in-time snapshot — re-run the on-file SQL and update
 * the values together with NABAPERKS_PROOF_AS_OF ("812 active in 90 days" drifts).
 */

export const SHOW_NABAPERKS_PROOF = true
export const NABAPERKS_PROOF_AS_OF = "June 2026"

/** Internal refresh anchor — venue count is not shown in public copy. */
export const NABAPERKS_VENUES_LIVE = 7

/** Production credibility kicker for the hero (top-of-page). */
export const NABATABLE_AUTHORITY_LINE =
  "812 customers stamped in the last 3 months — already at UK tills"

export const NABAPERKS_PROOF_TAG = "Real numbers"

export const NABAPERKS_PROOF_HEADLINE =
  "Joins, stamps and rewards from live venues."

export const NABAPERKS_PROOF_INTRO =
  "Each figure is a real customer action — a card saved, a stamp at the till, or a reward claimed at the counter. From pubs, cafes and takeaways."

export type NabaperksStat = {
  /** The figure itself, pre-formatted (e.g. "1,842", "46.8%"). */
  value: string
  label: string
  helper?: string
  /** True only when the figure is an exact, reproducible production number. */
  substantiated: boolean
}

/** Headline tiles — adoption, recent activity, the loop completing, retention. */
export const nabaperksStats: readonly NabaperksStat[] = [
  {
    value: "1,842",
    label: "Loyalty members",
    helper: "Customers who saved a card at a venue.",
    substantiated: true,
  },
  {
    value: "812",
    label: "Visited in 3 months",
    helper: "Got at least one stamp in the last three months.",
    substantiated: true,
  },
  {
    value: "1,180",
    label: "Rewards redeemed",
    helper: "Claimed at the counter — 2,934 earned in total.",
    substantiated: true,
  },
  {
    value: "46.8%",
    label: "Members who return",
    helper: "Came back for a second visit or more.",
    substantiated: true,
  },
]

/** Supporting line — tenure; keep time-base detail in the stat helpers. */
export const NABAPERKS_PROOF_NOTE = "Running since March 2024 at UK food-and-drink venues."

/** True only when every shown stat is present and substantiated. */
export function nabaperksProofReady(): boolean {
  return (
    SHOW_NABAPERKS_PROOF &&
    nabaperksStats.every(
      (stat) =>
        stat.value.trim() !== "" && stat.value !== "—" && stat.substantiated
    )
  )
}
