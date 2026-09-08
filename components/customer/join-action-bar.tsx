import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * The one primary action of a join screen, pinned to the bottom of the
 * viewport while the screen's content is taller than the phone, and sitting
 * in flow once it fits. Keeps the next tap inside the thumb zone on every
 * phone height without the customer scrolling to find it.
 *
 * Only for screens without a text field: with the on-screen keyboard up, a
 * bottom-pinned bar fights the keyboard on iOS, so the phone and code steps
 * keep their button in flow and stay short enough to fit instead.
 *
 * `order-last` places the bar last in the column's layout (so `sticky` holds
 * it at the bottom until the content ends) while the JSX keeps the action
 * ahead of supporting detail in source and reading order.
 */
export function JoinActionBar({
  children,
  note,
  className,
}: {
  children: ReactNode
  /** One reassurance line under the action, kept out of the button itself. */
  note?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-10 order-last -mx-4 grid gap-2 bg-gradient-to-t from-background from-70% to-background/0 px-4 pt-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:-mx-6 sm:px-6",
        className
      )}
    >
      {children}
      {note ? (
        <p className="text-center text-xs leading-5 font-semibold text-muted-foreground">
          {note}
        </p>
      ) : null}
    </div>
  )
}
