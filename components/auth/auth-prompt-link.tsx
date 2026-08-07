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
 * drift. Pill-shaped with the 44px tap floor because these sit between form
 * steps, not inside a sentence.
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
        "focus-ring inline-flex min-h-11 items-center rounded-full px-3 py-2 font-bold text-primary underline-offset-4 hover:bg-accent hover:text-accent-foreground hover:underline",
        className
      )}
    >
      {children}
    </Link>
  )
}
