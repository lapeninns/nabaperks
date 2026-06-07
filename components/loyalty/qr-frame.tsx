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
        "rounded-[2rem] bg-white p-4 text-black shadow-sm ring-1 ring-black/10",
        className
      )}
    >
      <div className="rounded-3xl bg-white p-2">{children}</div>
    </figure>
  )
}
