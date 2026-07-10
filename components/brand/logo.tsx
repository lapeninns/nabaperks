import Link, { type LinkProps } from "next/link"

import { cn } from "@/lib/utils"

export function Logo({
  href = "/start",
  label = "Nabaperks",
  compact = false,
  linked = true,
  prefetch,
  wordmarkClassName,
  className,
}: {
  href?: string
  label?: string
  compact?: boolean
  linked?: boolean
  prefetch?: LinkProps["prefetch"]
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

  const content = (
    <>
      {mark}
      {compact ? (
        <span className="sr-only">{label}</span>
      ) : (
        <span className={cn(wordmarkClassName)}>{label}</span>
      )}
    </>
  )
  const rootClassName = cn(
    "inline-flex min-h-11 items-center gap-3 rounded-full pr-3 font-extrabold tracking-tight text-foreground lowercase transition-colors duration-[var(--w-dur-fast)] ease-[var(--w-ease)] motion-reduce:transition-none",
    linked && "pressable outline-none",
    className
  )

  if (!linked) {
    return <span className={rootClassName}>{content}</span>
  }

  return (
    <Link
      href={href}
      prefetch={prefetch}
      aria-label={`${label} home`}
      // Focus comes from the shared .pressable outline recipe (globals.css).
      className={rootClassName}
    >
      {content}
    </Link>
  )
}
