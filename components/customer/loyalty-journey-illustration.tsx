"use client"

import { MonoTag } from "@/components/brand"
import { PintGlass, StampGrid } from "@/components/loyalty"
import { cn } from "@/lib/utils"

/**
 * Decorative preview of stamp collection and the sealed mystery reward. Shown on
 * the public merchant landing before we know a visitor's progress — not their
 * live card state.
 */
export function LoyaltyJourneyIllustration({
  stampsRequired,
  minSpendLabel,
  className,
}: {
  stampsRequired: number
  minSpendLabel?: string
  className?: string
}) {
  const total = Math.max(stampsRequired, 1)
  const demoCurrent = Math.max(0, total - 1)

  return (
    <figure className={cn("grid gap-4", className)}>
      <figcaption className="sr-only">
        Example loyalty card showing stamp collection and a sealed mystery reward
      </figcaption>

      <div className="grid gap-3 rounded-lg border-2 border-dashed border-border bg-secondary/35 p-4">
        <div className="flex items-center justify-between gap-3">
          <MonoTag tone="accent">Collect stamps</MonoTag>
          <span className="font-mono text-[0.625rem] font-bold tracking-[0.08em] text-muted-foreground uppercase">
            Example · {demoCurrent} of {total}
          </span>
        </div>
        <StampGrid current={demoCurrent} total={total} className="py-1" />
        <p className="text-center text-xs leading-5 text-muted-foreground">
          Scan at the venue and collect one stamp per UK business day.
        </p>
      </div>

      <div
        aria-hidden="true"
        className="grid justify-items-center gap-1 text-muted-foreground"
      >
        <span className="h-4 w-px bg-border" />
        <span className="text-sm leading-none">↓</span>
        <span className="h-4 w-px bg-border" />
      </div>

      <div className="grid gap-3 rounded-lg border-2 border-dashed border-border bg-accent/35 p-4">
        <MonoTag tone="sun">Mystery reward</MonoTag>
        <div className="grid items-center gap-4 sm:grid-cols-[auto_1fr]">
          <div className="relative mx-auto grid place-items-center sm:mx-0">
            <PintGlass size={84} className="-rotate-3" />
            <span
              aria-hidden="true"
              className="absolute -top-1 -right-1 grid size-9 -rotate-6 place-items-center rounded-full border-2 border-ink bg-seal text-base font-extrabold text-seal-foreground shadow-xs"
            >
              ?
            </span>
          </div>
          <div className="grid gap-2 text-center sm:text-left">
            <p className="text-sm leading-snug font-extrabold">
              Sealed until the card is full
            </p>
            <p className="text-xs leading-5 text-muted-foreground">
              Complete {total} stamps to unseal a surprise reward, redeemable
              from the next UK business day.
              {minSpendLabel ? <> {minSpendLabel}</> : null}
            </p>
          </div>
        </div>
      </div>
    </figure>
  )
}
