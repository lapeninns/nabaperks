import { cn } from "@/lib/utils"

import { PilotProofStrip } from "../pilot-proof-strip"

const stats = [
  { value: "4 setup steps", label: "before billing" },
  { value: "Self-serve", label: "on customer phones" },
  { value: "30 days", label: "free to pilot" },
] as const

const setupNotes = [
  "Permanent venue QR",
  "Works on any phone, tablet or till",
  "No hardware, no POS",
] as const

function bandCellClassName(index: number) {
  // 3-up from the smallest phones — the band reads as one receipt row instead
  // of six stacked cells; vertical rules separate columns at every width.
  return cn(
    "px-2 py-3.5 text-center sm:px-8 sm:py-6",
    index > 0 && "border-l-2 border-dashed border-foreground/25"
  )
}

/**
 * Proof strip — three setup numbers and three honest setup facts in a receipt
 * band between dashed rules. Mobile-first: each column stacks with horizontal
 * rules; from `sm` the band splits into three equal columns with vertical rules.
 * Renders as the always-visible stat band inside the landing's merged proof
 * section (the parent Section owns the vertical rhythm).
 */
export function ProofStrip() {
  return (
    <div>
      <div className="border-y-2 border-dashed border-foreground/25">
        <dl className="grid grid-cols-3">
          {stats.map((stat, index) => (
            // Valid dt-before-dd DOM order, flipped visually with flex order-*
            // (the same trick as nabaperks-proof) so screen readers get the
            // name/value pairing while the big value still renders first.
            <div
              key={stat.label}
              className={cn(bandCellClassName(index), "flex flex-col")}
            >
              <dt className="mono-meta order-2 mt-2 leading-snug text-muted-foreground">
                {stat.label}
              </dt>
              <dd className="order-1 text-[clamp(1.05rem,4.8vw,2.35rem)] leading-tight font-extrabold tracking-[-0.02em] tabular-nums sm:leading-none">
                {stat.value}
              </dd>
            </div>
          ))}
        </dl>

        <ul className="grid grid-cols-3 border-t-2 border-dashed border-foreground/25">
          {setupNotes.map((note, index) => (
            <li key={note} className={bandCellClassName(index)}>
              <span className="mono-id font-normal leading-relaxed text-muted-foreground">
                {note}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <PilotProofStrip />
    </div>
  )
}
