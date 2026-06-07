import type { ReactNode } from "react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

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
      className={cn("rounded-3xl bg-accent p-4 text-accent-foreground", className)}
    >
      <Badge
        variant={locked ? "secondary" : "default"}
        className={locked ? undefined : "bg-reward text-reward-foreground"}
      >
        {locked ? "Locked reward" : "Reward revealed"}
      </Badge>
      <h3 className="mt-3 text-lg font-extrabold leading-tight">{title}</h3>
      {description ? (
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      ) : null}
    </section>
  )
}
