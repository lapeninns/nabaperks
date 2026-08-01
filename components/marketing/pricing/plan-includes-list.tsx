import { CheckmarkCircle02Icon } from "@hugeicons/core-free-icons"

import { Icon } from "@/components/brand"
import { cn } from "@/lib/utils"

/**
 * PlanIncludesList — the shared "what you get" list. Extracted from the two
 * call sites that previously duplicated this markup, so the pricing sheet and
 * the landing band cannot drift apart again.
 */
export function PlanIncludesList({
  items,
  columns = 1,
  className,
}: {
  items: readonly string[]
  columns?: 1 | 2
  className?: string
}) {
  return (
    <ul
      className={cn(
        "grid gap-2.5",
        columns === 2 && "sm:grid-cols-2 sm:gap-x-6",
        className
      )}
    >
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3">
          <Icon
            icon={CheckmarkCircle02Icon}
            size={18}
            className="mt-0.5 shrink-0 text-reward"
          />
          <span className="text-sm leading-6 text-foreground">{item}</span>
        </li>
      ))}
    </ul>
  )
}
