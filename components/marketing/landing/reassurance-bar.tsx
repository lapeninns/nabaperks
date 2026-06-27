import { Tick02Icon } from "@hugeicons/core-free-icons"

import { Icon } from "@/components/brand"
import { cn } from "@/lib/utils"

const defaultPoints = [
  "Build free — no payment to start",
  "30-day pilot, then £29/mo",
  "No contract, month to month",
] as const

/**
 * Risk-reversal strip — the honest conversion lever: name what removes the
 * buyer's fear (no upfront card, a real free pilot, no lock-in) right at the
 * decision point. Every point must stay literally true; this is reassurance,
 * not manufactured pressure. The defaults carry the offer; pass `points` for a
 * context-specific set (e.g. the closing CTA).
 */
export function ReassuranceBar({
  points = defaultPoints,
  className,
}: {
  points?: readonly string[]
  className?: string
}) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-2", className)}>
      {points.map((point) => (
        <li
          key={point}
          className="flex items-center gap-1.5 text-sm leading-snug font-semibold text-foreground"
        >
          <Icon
            icon={Tick02Icon}
            size={15}
            strokeWidth={2.5}
            className="shrink-0 text-reward"
          />
          {point}
        </li>
      ))}
    </ul>
  )
}
