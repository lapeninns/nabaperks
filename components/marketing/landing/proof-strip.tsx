import { cn } from "@/lib/utils"

import { PilotProofStrip } from "../pilot-proof-strip"

const stats = [
  { value: "<5 min", label: "to set the venue up" },
  { value: "<10 sec", label: "from scan to stamp" },
  { value: "30 days", label: "free to pilot" },
] as const

/**
 * Proof strip — three plain numbers between dashed receipt rules. Mobile-first:
 * the figures stack with horizontal rules between them and split into three
 * columns with vertical rules from `sm`.
 */
export function ProofStrip() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-2">
      <ul className="grid border-y-2 border-dashed border-foreground/25 sm:grid-cols-3">
        {stats.map((stat, index) => (
          <li
            key={stat.label}
            className={cn(
              "flex items-baseline gap-3 py-5 sm:px-6",
              index > 0 &&
                "border-t-2 border-dashed border-foreground/25 sm:border-t-0 sm:border-l-2"
            )}
          >
            <span className="text-[1.9rem] leading-none font-extrabold tracking-[-0.02em] whitespace-nowrap tabular-nums sm:text-[2.05rem]">
              {stat.value}
            </span>
            <span className="font-mono text-[0.7rem] leading-snug tracking-[0.05em] text-muted-foreground uppercase">
              {stat.label}
            </span>
          </li>
        ))}
      </ul>
      <PilotProofStrip />
    </section>
  )
}
