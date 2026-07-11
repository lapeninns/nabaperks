import type { ReactNode } from "react"
import { ArrowDown01Icon } from "@hugeicons/core-free-icons"

import { Icon } from "@/components/brand"
import { cn } from "@/lib/utils"

/**
 * Progressive disclosure for the launch flow — keeps power-user fields (reward
 * weighting, GPS radius) and secondary assets out of the first decision without
 * hiding them. A native <details> so it needs no client JS and stays keyboard
 * and screen-reader accessible by default.
 */
export function Disclosure({
  label,
  children,
  defaultOpen = false,
  className,
  name,
  summaryClassName,
}: {
  label: ReactNode
  children: ReactNode
  /** Open on first paint (used when the section already holds saved values). */
  defaultOpen?: boolean
  className?: string
  /**
   * Native exclusive-accordion group: disclosures sharing a `name` let the
   * browser keep at most one of them open (admin record actions).
   */
  name?: string
  /** Extra summary classes (e.g. `min-h-11` where the tap floor must hold). */
  summaryClassName?: string
}) {
  return (
    <details
      open={defaultOpen}
      name={name}
      className={cn(
        "group min-w-0 overflow-hidden rounded-lg border-2 border-dashed border-ink/25 bg-secondary/40",
        className
      )}
    >
      <summary
        className={cn(
          "focus-ring flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm font-extrabold text-foreground sm:px-4 sm:py-3 [&::-webkit-details-marker]:hidden",
          summaryClassName
        )}
      >
        <span className="min-w-0 text-pretty break-words">{label}</span>
        <Icon
          icon={ArrowDown01Icon}
          size={18}
          className="shrink-0 text-muted-foreground transition-transform duration-[var(--w-dur-fast)] ease-[var(--w-ease)] group-open:rotate-180 motion-reduce:transition-none"
        />
      </summary>
      <div className="grid min-w-0 gap-3 overflow-x-clip px-3 pt-1 pb-3 sm:px-4 sm:pb-4">
        {children}
      </div>
    </details>
  )
}
