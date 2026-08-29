import type { ComponentPropsWithoutRef } from "react"

import { cn } from "@/lib/utils"

/**
 * SkipLink — the single "skip to content" affordance for every shell.
 *
 * WCAG 2.4.1 (Bypass Blocks). Previously only MarketingLayout shipped one, so
 * keyboard and switch users tabbed the full chrome of the merchant console,
 * admin console and customer app on every navigation. The target must be the
 * shell's `<main id="main">`.
 *
 * Visually hidden until focused, then pinned top-left above sticky headers
 * (z-50) using the standard 2px ink border, `--radius-lg`, the offset shadow
 * and the one sanctioned focus recipe (`.focus-ring`), so the first thing a
 * keyboard user meets looks like the rest of the system rather than a one-off.
 */
export function SkipLink({
  className,
  href = "#main",
  children = "Skip to content",
  ...props
}: ComponentPropsWithoutRef<"a">) {
  return (
    <a
      href={href}
      className={cn(
        "focus-ring sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-3 focus-visible:left-3 focus-visible:z-50 focus-visible:inline-flex focus-visible:min-h-11 focus-visible:items-center focus-visible:rounded-(--radius-lg) focus-visible:border-2 focus-visible:border-ink focus-visible:bg-card focus-visible:px-4 focus-visible:py-2 focus-visible:text-sm focus-visible:font-bold focus-visible:no-underline focus-visible:shadow-sm",
        className
      )}
      {...props}
    >
      {children}
    </a>
  )
}
