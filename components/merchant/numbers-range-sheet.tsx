"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { ArrowDown01Icon } from "@hugeicons/core-free-icons"

import { recordConsoleEventAction } from "@/app/app/console-events"
import { Icon } from "@/components/brand"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  NUMBERS_RANGES,
  numbersRangeLabel,
  type NumbersRange,
} from "@/lib/merchant/numbers-nav"

/**
 * The range picker (handoff §6.6 `ScopeSheet`): a bottom sheet with a radio
 * list. Choosing a range is a server round-trip via `?range=`; the page's
 * Suspense boundary is keyed on the range so the chart shows its skeleton
 * rather than old data at a new scale.
 */
export function NumbersRangeSheet({
  range,
  basePath = "/app/numbers",
}: {
  range: NumbersRange
  basePath?: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  function choose(next: NumbersRange) {
    if (next !== range) {
      void recordConsoleEventAction({
        name: "numbers_range_changed",
        properties: { range: next, from_range: range },
      })
      startTransition(() => {
        router.push(`${basePath}?range=${next}`, { scroll: false })
      })
    }
    setOpen(false)
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-busy={pending}
          data-numbers-range-trigger
          className="focus-ring mono-meta inline-flex min-h-11 items-center gap-1 rounded-lg border-2 border-ink bg-card px-3 text-foreground shadow-xs"
        >
          {numbersRangeLabel(range)}
          <Icon icon={ArrowDown01Icon} size={14} />
        </button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        aria-modal="true"
        data-numbers-range-sheet
        className="grid max-h-[86dvh] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 rounded-t-[var(--radius-sheet)] border-t-2 border-ink bg-card p-0 text-foreground"
      >
        <SheetHeader className="border-b-2 border-dashed border-line p-5">
          <SheetTitle className="text-xl font-extrabold">
            How far back?
          </SheetTitle>
          <SheetDescription className="text-sm leading-6 text-muted-foreground">
            Both charts and the day readout follow the range you choose.
          </SheetDescription>
        </SheetHeader>

        <div
          role="radiogroup"
          aria-label="Range"
          className="grid min-h-0 gap-2 overflow-y-auto p-5"
        >
          {NUMBERS_RANGES.map((option) => {
            const checked = option === range
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={checked}
                onClick={() => choose(option)}
                className="focus-ring flex min-h-12 items-center justify-between gap-3 rounded-lg border-2 border-ink bg-card px-4 text-left text-sm font-bold shadow-xs aria-checked:bg-paper-deep"
              >
                {numbersRangeLabel(option)}
                <span aria-hidden="true" className="mono-id text-ink-soft">
                  {checked ? "Selected" : ""}
                </span>
              </button>
            )
          })}
        </div>

        <SheetFooter className="border-t-2 border-ink p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
          <SheetClose asChild>
            <Button
              type="button"
              variant="secondary"
              size="lg"
              className="w-full"
            >
              Cancel
            </Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
