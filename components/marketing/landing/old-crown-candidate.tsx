import { MonoTag } from "@/components/brand"

import { venueProofPool, venueProofSignoff } from "./venue-proof-data"

/**
 * Old Crown case-study CANDIDATE block. Names the venue (Old Crown Girton,
 * CB3 0QD) and uses the approved anonymous team note. No named person or
 * unverified aggregate figures are rendered. A dedicated Old Crown page is
 * deliberately deferred until venue-filtered evidence and attribution are
 * approved.
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
    <div className="surface-card px-6 py-8 sm:px-10 sm:py-10">
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
    </div>
  )
}
