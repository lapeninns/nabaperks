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
        "rounded-lg border-2 border-ink bg-qr-foreground p-4 text-qr shadow-md",
        className
      )}
    >
      <div className="rounded-md bg-qr-foreground p-2">{children}</div>
    </figure>
  )
}
