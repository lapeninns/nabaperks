import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export function QrFrame({
  children,
  label = "Scanner-safe QR code",
  className,
}: {
  children: ReactNode
  label?: string
  className?: string
}) {
  return (
    <figure
      aria-label={label}
      className={cn(
        // bg-qr-foreground / text-qr, not bg-white / text-black: --qr and
        // --qr-foreground exist precisely so scanner contrast is a token
        // decision, not a literal repeated at every QR surface.
        // One padding, not two. The frame used to be p-4 around an inner
        // `bg-qr-foreground p-2` — 24px of doubled quiet zone in the same
        // colour, on top of the quiet zone the QR image already carries. At the
        // 295px receipt measure that cost 24px of actual code for no visual
        // difference whatsoever (CUS 02#33).
        "rounded-lg border-2 border-ink bg-qr-foreground p-3 text-qr shadow-md",
        className
      )}
    >
      {children}
    </figure>
  )
}
