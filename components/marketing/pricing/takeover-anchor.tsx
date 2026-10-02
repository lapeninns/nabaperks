import Link from "next/link"

import { MonoTag } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { ROUTES, TAKEOVER } from "@/lib/marketing/facts"
import { cn } from "@/lib/utils"

/**
 * TakeoverAnchor — the bespoke engagement, on ink.
 *
 * Deliberately stacked BELOW the pricing sheet, never beside it: a
 * column next to the Growth Plan would read as a third tier, which the
 * offer explicitly is not. The ink ground gives it presence without
 * granting it parity. `TAKEOVER.price` is enquiry-only — there is no
 * self-serve checkout.
 */
export function TakeoverAnchor({ className }: { className?: string }) {
  return (
    <aside
      data-takeover-enquiry
      className={cn(
        "grid grid-cols-1 gap-10 overflow-hidden rounded-(--radius-sheet) border-2 border-ink bg-ink p-5 text-paper shadow-md sm:p-12 md:grid-cols-2 md:items-center md:gap-12 lg:p-16",
        className
      )}
    >
      <div className="grid min-w-0 grid-cols-1 gap-5">
        <MonoTag
          tone="sun"
          className="h-auto min-w-0 justify-self-start whitespace-normal [&>span]:overflow-visible [&>span]:whitespace-normal"
        >
          Bespoke engagement · enquiry only
        </MonoTag>
        <p className="numeric-tabular text-5xl leading-none font-extrabold tracking-tighter text-paper sm:text-6xl lg:text-7xl">
          {TAKEOVER.price}
        </p>
        <p className="text-2xl leading-tight font-extrabold text-paper sm:text-3xl lg:text-4xl">
          {TAKEOVER.name}
        </p>
        <p className="max-w-lg text-base leading-7 text-paper/80 lg:text-xl">
          {TAKEOVER.qualifier} Not a Growth Plan tier — no self-serve checkout.
        </p>
      </div>
      <div className="min-w-0 md:justify-self-end">
        <Button
          asChild
          variant="secondary"
          size="xl"
          className="h-auto min-h-14 max-w-full py-3 whitespace-normal"
        >
          <Link href={ROUTES.demo}>{TAKEOVER.action}</Link>
        </Button>
      </div>
    </aside>
  )
}
