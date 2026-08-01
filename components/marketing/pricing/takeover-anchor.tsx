import Link from "next/link"

import { MonoTag } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { ROUTES, TAKEOVER } from "@/lib/marketing/facts"
import { cn } from "@/lib/utils"

/**
 * TakeoverAnchor — the bespoke engagement, on ink.
 *
 * Deliberately stacked BELOW the pricing sheet, never beside it: a
 * side-by-side column would read as a third tier, which the offer explicitly
 * is not. The ink ground gives it presence without granting it parity.
 * `TAKEOVER.price` is enquiry-only — there is no self-serve checkout.
 */
export function TakeoverAnchor({ className }: { className?: string }) {
  return (
    <aside
      data-takeover-enquiry
      className={cn(
        "grid gap-4 rounded-(--radius-sheet) border-2 border-ink bg-ink p-5 text-paper shadow-md sm:flex sm:flex-wrap sm:items-center sm:justify-between sm:gap-6 sm:p-7",
        className
      )}
    >
      <div className="grid gap-2">
        <MonoTag tone="sun" className="justify-self-start">
          Bespoke engagement · enquiry only
        </MonoTag>
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="numeric-tabular text-2xl leading-none font-extrabold text-seal sm:text-3xl">
            {TAKEOVER.price}
          </span>
          <span className="text-base leading-snug font-extrabold text-paper">
            {TAKEOVER.name}
          </span>
        </p>
        <p className="max-w-2xl text-sm leading-6 text-paper/80">
          {TAKEOVER.qualifier} Not a Growth Plan tier — no self-serve checkout.
        </p>
      </div>
      <Button asChild variant="secondary" className="w-fit shrink-0">
        <Link href={ROUTES.demo}>{TAKEOVER.action}</Link>
      </Button>
    </aside>
  )
}
