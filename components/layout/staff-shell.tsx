import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export function StaffShell({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <main className="flex min-h-svh justify-center overflow-x-hidden bg-background px-4 py-6 sm:px-6 sm:py-10">
      <div className={cn("w-full min-w-0 max-w-sm", className)}>
        {children}
      </div>
    </main>
  )
}
