import { Eyebrow, MonoTag } from "@/components/brand"
import { PROOF, PROOF_DISPLAY } from "@/lib/marketing/facts"

import { venueProofPool, venueProofSignoff } from "./venue-proof-data"

/**
 * Old Crown case-study CANDIDATE block. Names the venue (Old Crown Girton,
 * CB3 0QD) and uses the approved anonymous "From the team" note, but every hard
 * figure is explicitly PROGRAMME-LEVEL (the Counter-Loyalty Index, measured
 * across Nabaperks-powered venues) — never labelled as Old Crown-only. No named
 * person, no invented venue-specific stats. A dedicated Old Crown page is
 * deliberately deferred until venue-filtered figures + attribution are approved.
 *
 * Renders as a panel body inside the landing's merged proof section (the
 * `#old-crown` anchor lives on the panel wrapper there; heading is h3 under
 * the section's shared h2). `oldCrownCandidateReady()` lets the parent gate
 * the tab chip with the same condition as the body.
 */
const oldCrown = venueProofPool.find((venue) => venue.name === "Old Crown")

export function oldCrownCandidateReady() {
  return Boolean(oldCrown)
}

export function OldCrownCandidate() {
  if (!oldCrown) return null

  return (
    <div className="surface-card grid gap-6 px-6 py-8 sm:px-10 sm:py-10 lg:grid-cols-[1fr_0.85fr] lg:items-center">
      <div>
        <MonoTag tone="sun">Case study · candidate</MonoTag>
        <h3 className="mt-4 max-w-[24ch] text-[clamp(1.6rem,3.4vw,2.4rem)] leading-[1.05] font-extrabold tracking-[-0.02em] text-balance">
          Old Crown Girton runs Nabaperks.
        </h3>
        <p className="mono-meta mt-2 tracking-[0.08em] text-muted-foreground">
          Old Crown · {oldCrown.postcode} · England
        </p>
        <blockquote className="mt-4 max-w-[48ch] border-l-2 border-ink pl-4 text-[1.05rem] leading-relaxed font-semibold text-pretty">
          &ldquo;{oldCrown.review}&rdquo;
        </blockquote>
        <p className="mono-meta mt-3 tracking-[0.08em] text-muted-foreground">
          {venueProofSignoff(oldCrown)}
        </p>
        <p className="mt-4 max-w-[46ch] text-sm leading-relaxed text-pretty text-muted-foreground">
          From paper cards lost in the wash to a weekly note on who&rsquo;s
          coming back.
        </p>
      </div>

      <div className="rounded-[var(--radius)] border-2 border-dashed border-border p-5">
        <Eyebrow>Programme-level proof</Eyebrow>
        <p className="mt-3 text-[0.95rem] leading-relaxed text-pretty">
          <strong className="font-bold text-foreground">
            {PROOF_DISPLAY.repeatRate}
          </strong>{" "}
          of members return, and {PROOF_DISPLAY.rewardsRedeemed} of{" "}
          {PROOF_DISPLAY.rewardsEarned} rewards have been redeemed.
        </p>
        <p className="mono-id mt-3 font-normal leading-relaxed text-muted-foreground">
          {PROOF.measuredAcross} — {PROOF.indexName}, {PROOF.asOf}. Programme
          figures, not Old Crown alone.
        </p>
      </div>
    </div>
  )
}
