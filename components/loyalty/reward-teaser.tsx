import type { ReactNode } from "react"

import { cn } from "@/lib/utils"
import { MonoTag } from "@/components/brand"

export function RewardTeaser({
  locked,
  title,
  description,
  className,
}: {
  locked: boolean
  title: ReactNode
  description?: ReactNode
  className?: string
}) {
  return (
    <section
      aria-label="Reward status"
      className={cn(
        "surface-card bg-accent p-4 text-accent-foreground",
        locked && "border-dashed",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <MonoTag tone={locked ? "sun" : "leaf"}>
          {locked ? "Locked reward" : "Reward revealed"}
        </MonoTag>
        <span
          aria-hidden="true"
          className={cn(
            "grid size-9 -rotate-6 place-items-center rounded-full border-2 border-ink text-base font-extrabold shadow-xs",
            locked ? "bg-seal text-seal-foreground" : "bg-reward text-reward-foreground"
          )}
        >
          {locked ? "?" : "✓"}
        </span>
      </div>
      <h3 className="mt-3 text-lg font-extrabold leading-tight">{title}</h3>
      {description ? (
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      ) : null}
    </section>
  )
}
