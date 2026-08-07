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
 * (z-50) using the standard 2px ink border and `--radius` so it matches the
 * Wet Ink surface vocabulary rather than inventing a one-off pill.
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
        "sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-3 focus-visible:left-3 focus-visible:z-50 focus-visible:rounded-lg focus-visible:border-2 focus-visible:border-ink focus-visible:bg-card focus-visible:px-4 focus-visible:py-2 focus-visible:text-sm focus-visible:font-bold focus-visible:no-underline focus-visible:shadow-sm",
        className
      )}
      {...props}
    >
      {children}
    </a>
  )
}
