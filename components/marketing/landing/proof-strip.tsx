import { cn } from "@/lib/utils"

import { PilotProofStrip } from "../pilot-proof-strip"

const stats = [
  { value: "Set up in minutes", label: "for your venue" },
  { value: "Fast enough", label: "for counter service" },
  { value: "30 days", label: "free to pilot" },
] as const

const setupNotes = [
  "Printed QR kit posted to you",
  "Works on any phone, tablet or till",
  "No hardware, no POS",
] as const

function bandCellClassName(index: number) {
  return cn(
    "px-4 py-6 text-center sm:px-8 sm:py-7",
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
    <section className="mx-auto w-full max-w-6xl px-6 py-6 sm:py-8">
      <div className="border-y-2 border-dashed border-foreground/25">
        <dl className="grid sm:grid-cols-3">
          {stats.map((stat, index) => (
            <div key={stat.label} className={bandCellClassName(index)}>
              <dd className="text-[clamp(1.85rem,4.8vw,2.35rem)] leading-none font-extrabold tracking-[-0.02em] tabular-nums">
                {stat.value}
              </dd>
              <dt className="mt-2 font-mono text-[0.68rem] font-bold leading-snug tracking-[0.06em] text-muted-foreground uppercase">
                {stat.label}
              </dt>
            </div>
          ))}
        </dl>

        <ul className="grid border-t-2 border-dashed border-foreground/25 sm:grid-cols-3">
          {setupNotes.map((note, index) => (
            <li key={note} className={bandCellClassName(index)}>
              <span className="font-mono text-[0.66rem] leading-relaxed tracking-[0.05em] text-muted-foreground uppercase">
                {note}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <PilotProofStrip />
    </section>
  )
}
