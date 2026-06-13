import Link from "next/link"

import { cn } from "@/lib/utils"

export function Logo({
  href = "/",
  label = "Nabaperks",
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
      className="grid size-9 -rotate-6 place-items-center rounded-full border-2 border-ink bg-primary text-base font-extrabold text-primary-foreground shadow-xs"
    >
      ✱
    </span>
  )

  return (
    <Link
      href={href}
      aria-label={`${label} home`}
      className={cn(
        "pressable inline-flex min-h-11 items-center gap-3 rounded-full pr-3 font-extrabold lowercase tracking-tight text-foreground outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/35",
        className
      )}
    >
      {mark}
      {compact ? <span className="sr-only">{label}</span> : <span>{label}</span>}
    </Link>
  )
}
