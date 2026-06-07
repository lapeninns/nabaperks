import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export function CustomerShell({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <main className="flex min-h-svh justify-center bg-background px-4 py-6 sm:px-6 sm:py-10">
      <div className={cn("w-full max-w-sm", className)}>{children}</div>
    </main>
  )
}
