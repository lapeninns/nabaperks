import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * ReadMore — mobile-only native `<details>` disclosure for trailing prose.
 *
 * The FAQ receipt-card recipe (no JS, keyboard/SR-friendly, content stays
 * server-rendered for crawlers) applied to secondary paragraphs that inflate
 * mobile height. From `sm` the disclosure chrome disappears and the content
 * renders open as today — desktop is untouched.
 */
export function ReadMore({
  summary,
  className,
  children,
}: {
  summary: string
  className?: string
  children: ReactNode
}) {
  return (
    <>
      <details
        className={cn(
          "group mt-3 rounded-[var(--radius)] border-2 border-line bg-card sm:hidden",
          className
        )}
      >
        <summary className="pressable mono-meta focus-ring flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 outline-none [&::-webkit-details-marker]:hidden">
          {summary}
          <span aria-hidden="true" className="text-primary">
            <span className="group-open:hidden">+</span>
            <span className="hidden group-open:inline">–</span>
          </span>
        </summary>
        <div className="px-4 pb-4">{children}</div>
      </details>
      <div className="hidden sm:block">{children}</div>
    </>
  )
}
