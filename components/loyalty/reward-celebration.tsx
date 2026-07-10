import type { ReactNode } from "react"

import { WetInkPop } from "@/components/motion"
import { cn } from "@/lib/utils"

import { RewardSeal } from "./reward-seal"

/** Hard-edged riso confetti — a few flat dots in the spot inks, not a shower.
 *  Delays are seconds (Framer) so each dot pops on its own beat via WetInkPop. */
const CONFETTI = [
  { className: "top-4 left-7 bg-primary", delay: 0.08 },
  { className: "top-3 left-1/3 rounded-full bg-seal", delay: 0.2 },
  { className: "top-5 right-10 bg-reward", delay: 0.12 },
  { className: "top-8 right-1/3 rounded-full bg-ink", delay: 0.3 },
  { className: "top-10 left-10 rounded-full bg-reward", delay: 0.26 },
] as const

/**
 * Card-complete celebration — the peak beat when the final stamp lands and the
 * seal lifts. The mystery seal pops in and a short, hard-edged riso burst fires
 * once. No pint, no party-app shower; a few flat spot-ink dots. Reduced motion
 * shows the finished seal and copy with no animation.
 */
export function RewardCelebration({
  title,
  message,
}: {
  title: ReactNode
  message: ReactNode
}) {
  return (
    <section
      aria-label="Card complete"
      // The peak moment announces itself: role="status" makes the celebration
      // a polite live region, so it reads out even when a host surface forgets
      // its own announcement.
      role="status"
      className="relative grid justify-items-center gap-3 overflow-hidden rounded-2xl border-2 border-ink bg-reward/12 px-5 py-6 text-center"
    >
      <span aria-hidden="true" className="pointer-events-none absolute inset-0">
        {CONFETTI.map((dot, index) => (
          <WetInkPop
            key={index}
            active
            delay={dot.delay}
            className={cn("absolute size-2 border-2 border-ink", dot.className)}
          />
        ))}
      </span>
      <RewardSeal state="sealed" size="lg" slammed />
      <div className="grid gap-1">
        <p className="text-lg leading-tight font-extrabold">{title}</p>
        <p className="text-sm leading-6 text-muted-foreground">{message}</p>
      </div>
    </section>
  )
}
