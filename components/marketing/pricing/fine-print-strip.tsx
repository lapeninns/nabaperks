import { cn } from "@/lib/utils"

/**
 * FinePrintStrip — the bonded footer of a PricingSheet. Sits on the deeper
 * paper ground with an ink top border so the disclosures read as printed
 * terms rather than floating body copy.
 *
 * Set in 12px sentence case, NOT `.mono-meta`: this strip concatenates the
 * billing disclosure, the processing-fee line and the cancellation line into
 * a ~200-character run, and 200 characters of tracked uppercase mono is
 * effectively unread. The mono register is for printed facts (IDs, codes,
 * dates); material commercial information is spoken voice.
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
        "border-t-2 border-ink bg-secondary px-5 py-4 text-xs leading-5 text-muted-foreground sm:px-7",
        className
      )}
    >
      {children}
    </div>
  )
}
