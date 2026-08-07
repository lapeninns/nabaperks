import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * FinePrint — material commercial information on the public surface.
 *
 * `PRODUCT.cancelLine` ("Card required — cancel renewal anytime after a short
 * exit review from your billing page.") is a 96-character sentence about a
 * recurring charge. It used to render as `.mono-id` — 10px Space Mono,
 * uppercase, letter-spaced — at nine independent call sites. Uppercase mono
 * destroys word-shape recognition, which is exactly the wrong treatment for
 * the one line a prospect most needs to read, and DESIGN.md · Typography
 * reserves the mono register for printed facts (IDs, codes, dates), not for
 * sentences with a verb.
 *
 * 12px sentence case, one component, so a wording or treatment change lands
 * everywhere at once.
 */
export function FinePrint({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <p className={cn("text-xs leading-5 text-muted-foreground", className)}>
      {children}
    </p>
  )
}
