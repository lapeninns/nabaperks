import Link from "next/link"

import { cn } from "@/lib/utils"

export function Logo({
  href = "/",
  label = "Nabaperks",
  compact = false,
  wordmarkClassName,
  className,
}: {
  href?: string
  label?: string
  compact?: boolean
  /**
   * Optional classes on the visible wordmark text (ignored when `compact`,
   * which renders mark-only with an `sr-only` label). Lets a caller hide the
   * wordmark responsively — e.g. `hidden sm:inline` so a tight mobile header
   * shows just the ✱ mark while desktop keeps the full wordmark. The accessible
   * name still comes from the link's `aria-label`, so hiding the text never
   * removes the name from the accessibility tree.
   */
  wordmarkClassName?: string
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
        "pressable inline-flex min-h-11 items-center gap-3 rounded-full pr-3 font-extrabold tracking-tight text-foreground lowercase transition-colors duration-[var(--w-dur-fast)] ease-[var(--w-ease)] outline-none focus-visible:ring-3 focus-visible:ring-ring/35 motion-reduce:transition-none",
        className
      )}
    >
      {mark}
      {compact ? (
        <span className="sr-only">{label}</span>
      ) : (
        <span className={cn(wordmarkClassName)}>{label}</span>
      )}
    </Link>
  )
}
