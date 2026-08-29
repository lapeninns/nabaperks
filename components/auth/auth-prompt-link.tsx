import type { ReactNode } from "react"
import Link from "next/link"

import { cn } from "@/lib/utils"

/**
 * AuthPromptLink — the inline navigation affordance in the auth funnel
 * ("Already have an account? Log in", "Back to sign up", recovery links).
 *
 * Was defined verbatim three times (as `SwitchPromptLink` in auth-form and as
 * `AuthPromptLink` in signup-details-form and signup-verify-form), so the
 * funnel's most-repeated control had three independent definitions that could
 * drift. Carries the 44px tap floor because these sit between form steps, not
 * inside a sentence.
 *
 * DESIGN.md · Shapes reserves full circles for the stamp family and names
 * its exceptions, one of which is "the legal-link halo family" — the /terms
 * /privacy /cookies row in the marketing footer (`legalLinkClass`), pinned by
 * tests/contracts/marketing-chrome-tokens. That contract's own reasoning
 * settles this one: links that are NAVIGATION "were never on the list". The
 * auth funnel's prompt links are navigation between form steps, so the pill
 * was drift. `rounded-(--radius-md)` is the house halo shape for a min-h-11
 * inline text link (marketing-header-nav, marketing/text-link, marquee,
 * hero-sample-card, pub-guide-hero, the footer disclosure summary).
 */
export function AuthPromptLink({
  href,
  className,
  children,
}: {
  readonly href: string
  readonly className?: string
  readonly children: ReactNode
}) {
  return (
    <Link
      href={href}
      className={cn(
        "focus-ring inline-flex min-h-11 items-center rounded-(--radius-md) px-3 py-2 font-bold text-primary underline-offset-4 hover:bg-accent hover:text-accent-foreground hover:underline",
        className
      )}
    >
      {children}
    </Link>
  )
}
