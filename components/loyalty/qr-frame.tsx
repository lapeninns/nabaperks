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
        "rounded-lg border-2 border-ink bg-white p-4 text-black shadow-[4px_4px_0_var(--w-shadow-color)]",
        className
      )}
    >
      <div className="rounded-md bg-white p-2">{children}</div>
    </figure>
  )
}
