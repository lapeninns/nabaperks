import Link from "next/link"

import { cn } from "@/lib/utils"

export function Logo({
  href = "/",
  label = "Stampiee",
  compact = false,
  className,
}: {
  href?: string
  label?: string
  compact?: boolean
  className?: string
}) {
  const mark = (
    <span
      aria-hidden="true"
      className="grid size-9 place-items-center rounded-full bg-primary text-sm font-extrabold text-primary-foreground shadow-xs"
    >
      S
    </span>
  )

  return (
    <Link
      href={href}
      aria-label={`${label} home`}
      className={cn(
        "pressable inline-flex min-h-11 items-center gap-3 rounded-full pr-3 font-extrabold tracking-tight text-foreground outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/35",
        className
      )}
    >
      {mark}
      {compact ? <span className="sr-only">{label}</span> : <span>{label}</span>}
    </Link>
  )
}
