import { cn } from "@/lib/utils"

/**
 * PricingSheet — the offer sheet shell.
 *
 * A plain element, not a shadcn Card, deliberately: the unlayered
 * `[data-slot="card"]` rule in globals.css forces `--radius-lg` and would
 * silently defeat the 18px sheet radius. `--radius-sheet` is declared in
 * `:root`, not the `@theme` map, so there is no `rounded-sheet` utility —
 * the custom-property shorthand is the repo idiom (cf. `px-(--card-spacing)`).
 *
 * `overflow-hidden` is load-bearing: it clips the bonded campaign strip and
 * fine-print strip to the sheet's corners.
 *
 * `min-w-0` is load-bearing too: as a grid/flex child the sheet must be
 * allowed to shrink below its content's intrinsic width, or wide descendants
 * (nowrap buttons, long values) push it past a 320px viewport.
 */
export function PricingSheet({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "min-w-0 overflow-hidden rounded-sheet border-2 border-ink bg-card text-card-foreground shadow-md",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

/** The padded interior of a PricingSheet, between the bonded strips. */
export function PricingSheetBody({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("grid gap-6 p-5 sm:p-7", className)}>{children}</div>
  )
}
