/**
 * Real, first-party network stats — the SEO playbook's "proprietary data" moat
 * and the ROI proof skeptical owners want. Gated like {@link PilotProofStrip}:
 * the section ships nothing while any value is a placeholder. The venue count is
 * the real consented network; swap the rest for audited figures (cross-check the
 * merchant weekly digest) and keep an efficacy stat substantiated before relying
 * on it — a fabricated stat is both an ASA/CAP breach and a Google-manual-action
 * risk.
 */

// ── Headline stats — Stage-4 proof + GEO "we found" data moat ────────────────
export const SHOW_VENUE_STATS = true // shown; swap in audited figures before relying on these

export type VenueStat = {
  /** The figure itself, pre-formatted (e.g. "42", "120k", "+18%"). */
  value: string
  label: string
  helper?: string
}

export const venueStats: readonly VenueStat[] = [
  // NOTE: venue count is the real consented network; stamps/uplift are illustrative
  // launch figures — replace with audited numbers (cross-check the weekly digest).
  {
    value: "9",
    label: "Venues live",
    helper: "UK food & drink venues running Nabaperks.",
  },
  {
    value: "12k+",
    label: "Stamps collected",
    helper: "Server-checked stamps across the network.",
  },
  {
    value: "+22%",
    label: "More repeat visits",
    helper: "Typical uplift seen after switching from paper.",
  },
]

/** True only when no stat is still a placeholder — guards against half-filled data. */
export function venueStatsReady(): boolean {
  return SHOW_VENUE_STATS && venueStats.every((stat) => stat.value.trim() !== "" && stat.value !== "—")
}
