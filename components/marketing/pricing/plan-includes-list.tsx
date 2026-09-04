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
  size = "sm",
  className,
}: {
  items: readonly string[]
  columns?: 1 | 2
  size?: "sm" | "lg"
  className?: string
}) {
  return (
    <ul
      className={cn(
        "grid gap-2.5",
        columns === 2 && "sm:grid-cols-2 sm:gap-x-6 sm:gap-y-4",
        className
      )}
    >
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3">
          <Icon
            icon={CheckmarkCircle02Icon}
            size={size === "lg" ? 20 : 18}
            className="mt-0.5 shrink-0 text-reward"
          />
          <span
            className={cn(
              "leading-6 text-foreground",
              size === "lg" ? "text-base font-medium lg:text-lg" : "text-sm"
            )}
          >
            {item}
          </span>
        </li>
      ))}
    </ul>
  )
}
