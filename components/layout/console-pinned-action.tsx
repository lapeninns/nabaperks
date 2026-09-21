import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * The console's pinned-action row. Rendered by the screen that owns the
 * action (only Counter fills it), never by the shell, so a screen with no
 * primary action reserves nothing. It sticks to the bottom of the shell's
 * scrolling body row directly above the tab bar, so the action is reachable
 * without scrolling on every phone height and never scrolls off. `mt-auto`
 * keeps it at the foot of a short screen; `sticky` keeps it in view on a
 * long one.
 */
export function ConsolePinnedAction({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      data-console-pin
      className={cn(
        "sticky bottom-0 z-20 -mx-4 mt-auto border-t-2 border-ink bg-paper px-4 py-3 min-[360px]:-mx-5 min-[360px]:px-5 min-[430px]:-mx-6 min-[430px]:px-6",
        className
      )}
    >
      {children}
    </div>
  )
}
