import { cn } from "@/lib/utils"

/**
 * FinePrintStrip — the bonded footer of a PricingSheet. Sits on the deeper
 * paper ground with an ink top border so the disclosures read as printed
 * terms rather than floating body copy. Uses `.mono-meta` (11.5px): the
 * system's micro scale has exactly two sanctioned sizes and 10px is the
 * floor, guarded by scripts/check-design-tokens.mjs.
 */
export function FinePrintStrip({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "mono-meta border-t-2 border-ink bg-secondary px-5 py-4 leading-5 text-muted-foreground sm:px-7",
        className
      )}
    >
      {children}
    </div>
  )
}
