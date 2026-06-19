import type { ReactNode } from "react"

import { cn } from "@/lib/utils"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

const statusClasses = {
  success: "border-2 border-ink bg-reward/12 text-foreground",
  warning: "border-2 border-ink bg-primary/12 text-foreground",
  error: "border-2 border-ink bg-destructive/10 text-destructive",
  neutral: "border-2 border-ink bg-card text-card-foreground",
} as const

export type StatusBannerTone = keyof typeof statusClasses

export function StatusBanner({
  title,
  children,
  tone = "neutral",
  className,
}: {
  title: ReactNode
  children?: ReactNode
  tone?: StatusBannerTone
  className?: string
}) {
  return (
    <Alert className={cn(statusClasses[tone], className)}>
      <AlertTitle className="font-extrabold">{title}</AlertTitle>
      {children ? (
        <AlertDescription className="text-current">{children}</AlertDescription>
      ) : null}
    </Alert>
  )
}
