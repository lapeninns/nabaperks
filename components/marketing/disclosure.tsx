import type { ReactNode } from "react"
import { MinusSignIcon, PlusSignIcon } from "@hugeicons/core-free-icons"

import { Icon } from "@/components/brand"
import { cn } from "@/lib/utils"

/**
 * MarketingDisclosure — the one "expand to read more" control on the public
 * surface.
 *
 * There used to be three dialects of the same interaction on pages a reader
 * visits in sequence: the FAQ card, the numbered FAQ ledger, and
 * `GuaranteeStack`'s summary — the last at `.mono-id`, i.e. a 10px uppercase
 * control label on a `min-h-11` row that looked empty. One treatment now:
 * `text-sm font-bold` summary on the 44px row, the glyph through the
 * Hugeicons contract rather than literal `+`/`−` characters, and the body on a
 * dashed tear line.
 *
 * Native `<details>` — zero JS, works before hydration, and the open state is
 * the browser's, not ours.
 */
export function MarketingDisclosure({
  summary,
  summaryPrefix,
  children,
  className,
  summaryClassName,
  bodyClassName,
}: {
  summary: ReactNode
  /** Optional leading node (the FAQ ledger's mono index). */
  summaryPrefix?: ReactNode
  children: ReactNode
  className?: string
  summaryClassName?: string
  bodyClassName?: string
}) {
  return (
    <details className={cn("group", className)}>
      <summary
        className={cn(
          "focus-ring flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-lg px-4 py-3 [&::-webkit-details-marker]:hidden",
          summaryClassName
        )}
      >
        {summaryPrefix}
        <span className="min-w-0 flex-1 text-sm leading-6 font-bold text-foreground">
          {summary}
        </span>
        <Icon
          icon={PlusSignIcon}
          size={16}
          className="text-muted-foreground group-open:hidden"
        />
        <Icon
          icon={MinusSignIcon}
          size={16}
          className="hidden text-muted-foreground group-open:inline-block"
        />
      </summary>
      <div
        className={cn(
          "grid gap-2 border-t-2 border-dashed border-border px-4 py-3",
          bodyClassName
        )}
      >
        {children}
      </div>
    </details>
  )
}
