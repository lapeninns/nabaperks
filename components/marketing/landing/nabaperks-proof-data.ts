/**
 * Nabaperks loyalty proof — the approved fixed June 2026 first-party snapshot.
 * The canonical figures, the named benchmark, and the methodology all live in
 * one source (`lib/marketing/facts.ts`); this module shapes them for the proof
 * band. Gated: a stat renders only when `substantiated` is true.
 *
 * Methodology framing uses the approved wording only — no public count of
 * venues and no unsupported reproducibility claim.
 */

import { PROOF, PROOF_DISPLAY } from "@/lib/marketing/facts"

export const SHOW_NABAPERKS_PROOF = true
export const NABAPERKS_PROOF_AS_OF = PROOF.asOf

/** Production credibility kicker for the hero (top-of-page). */
export const NABAPERKS_AUTHORITY_LINE = `${PROOF_DISPLAY.returnedMembers} customers stamped in the last 3 months — already at UK tills`

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
  /** True only when the figure is part of the approved, fixed snapshot. */
  substantiated: boolean
}

/** Headline tiles — adoption, recent activity, the loop completing, retention. */
export const nabaperksStats: readonly NabaperksStat[] = [
  {
    value: PROOF_DISPLAY.members,
    label: "Loyalty members",
    helper: "Customers who saved a card at a venue.",
    substantiated: true,
  },
  {
    value: PROOF_DISPLAY.returnedMembers,
    label: "Visited in 3 months",
    helper: "Got at least one stamp in the last three months.",
    substantiated: true,
  },
  {
    value: PROOF_DISPLAY.rewardsRedeemed,
    label: "Rewards redeemed",
    helper: `Claimed at the counter — ${PROOF_DISPLAY.rewardsEarned} earned in total.`,
    substantiated: true,
  },
  {
    value: PROOF_DISPLAY.repeatRate,
    label: "Members who return",
    helper: "Came back for a second visit or more.",
    substantiated: true,
  },
]

/** Supporting line — the approved methodology, shown beneath the figures. */
export const NABAPERKS_PROOF_NOTE = PROOF.methodology

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
