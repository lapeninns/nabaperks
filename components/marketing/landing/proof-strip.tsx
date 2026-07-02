import { Section } from "@/components/layout"
import { cn } from "@/lib/utils"

import { PilotProofStrip } from "../pilot-proof-strip"

const stats = [
  { value: "Set up in minutes", label: "for your venue" },
  { value: "Fast enough", label: "for counter service" },
  { value: "30 days", label: "free to pilot" },
] as const

const setupNotes = [
  "Permanent venue QR",
  "Works on any phone, tablet or till",
  "No hardware, no POS",
] as const

function bandCellClassName(index: number) {
  return cn(
    "px-4 py-5 text-center sm:px-8 sm:py-6",
    index > 0 &&
      "border-t-2 border-dashed border-foreground/25 sm:border-t-0 sm:border-l-2"
  )
}

/**
 * Proof strip — three setup numbers and three honest setup facts in a receipt
 * band between dashed rules. Mobile-first: each column stacks with horizontal
 * rules; from `sm` the band splits into three equal columns with vertical rules.
 */
export function ProofStrip() {
  return (
    <Section size="compact">
      <div className="border-y-2 border-dashed border-foreground/25">
        <dl className="grid sm:grid-cols-3">
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
              <dd className="order-1 text-[clamp(1.85rem,4.8vw,2.35rem)] leading-none font-extrabold tracking-[-0.02em] tabular-nums">
                {stat.value}
              </dd>
            </div>
          ))}
        </dl>

        <ul className="grid border-t-2 border-dashed border-foreground/25 sm:grid-cols-3">
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
    </Section>
  )
}
