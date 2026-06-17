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
}: {
  label: ReactNode
  children: ReactNode
  /** Open on first paint (used when the section already holds saved values). */
  defaultOpen?: boolean
  className?: string
}) {
  return (
    <details
      open={defaultOpen}
      className={cn(
        "group rounded-lg border-2 border-dashed border-ink/25 bg-secondary/40",
        className
      )}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-4 py-3 text-sm font-extrabold text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/35 [&::-webkit-details-marker]:hidden">
        <span>{label}</span>
        <Icon
          icon={ArrowDown01Icon}
          size={18}
          className="text-muted-foreground transition-transform duration-[var(--w-dur-fast)] ease-[var(--w-ease)] motion-reduce:transition-none group-open:rotate-180"
        />
      </summary>
      <div className="grid gap-3 px-4 pt-1 pb-4">{children}</div>
    </details>
  )
}
