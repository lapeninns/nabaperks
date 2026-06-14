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
    <main className="flex min-h-[100dvh] justify-center overflow-x-hidden bg-background px-4 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6 sm:pt-10 sm:pb-10">
      <div className={cn("w-full max-w-sm min-w-0", className)}>{children}</div>
    </main>
  )
}
