"use client"

import { useState, type ReactNode } from "react"
import { ArrowDown01Icon } from "@hugeicons/core-free-icons"

import { Icon } from "@/components/brand"
import { cn } from "@/lib/utils"

/**
 * ProfileSection — one settings row on the profile page.
 *
 * The page was three consecutive `section.surface-card.p-5` blocks, each
 * opening with a `SectionHeader` (eyebrow + text-lg h2, ~50px) — about 150px of
 * heading chrome for what is functionally a settings list. The header is now a
 * single summary row carrying an optional state hint on the right, so a member
 * can read the current state without opening anything.
 *
 * `defaultOpen` keeps contact details open (the reason most people come here)
 * and collapses the rest. Content is only mounted while open, matching the
 * push panel's existing behaviour — its permission probe should not run just
 * because the page rendered. (02#45)
 */
export function ProfileSection({
  title,
  hint,
  defaultOpen = false,
  children,
  className,
}: {
  readonly title: string
  /** Current state, shown on the summary row, e.g. "Email on · SMS off". */
  readonly hint?: ReactNode
  readonly defaultOpen?: boolean
  readonly children: ReactNode
  readonly className?: string
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <details
      open={defaultOpen}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className={cn("surface-card p-5", className)}
    >
      <summary className="group focus-ring flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 rounded-lg [&::-webkit-details-marker]:hidden">
        <span className="grid min-w-0 gap-0.5 text-left">
          <span className="text-base leading-snug font-extrabold text-foreground">
            {title}
          </span>
          {hint ? (
            <span className="mono-id text-muted-foreground">{hint}</span>
          ) : null}
        </span>
        <Icon
          icon={ArrowDown01Icon}
          size={18}
          className="shrink-0 text-ink-soft transition-transform duration-[var(--w-dur-fast)] ease-[var(--w-ease)] group-open:rotate-180 motion-reduce:transition-none"
        />
      </summary>
      {open ? <div className="pt-4">{children}</div> : null}
    </details>
  )
}
