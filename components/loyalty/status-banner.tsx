import type { ReactNode } from "react"

import { cn } from "@/lib/utils"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

const statusClasses = {
  success: "border-reward/30 bg-reward/10 text-reward-foreground",
  warning: "border-primary/30 bg-primary/10 text-primary-foreground",
  error: "border-destructive/30 bg-destructive/10 text-destructive",
  neutral: "border-border bg-card text-card-foreground",
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
    <Alert className={cn("rounded-3xl", statusClasses[tone], className)}>
      <AlertTitle className="font-extrabold">{title}</AlertTitle>
      {children ? (
        <AlertDescription className="text-current/75">{children}</AlertDescription>
      ) : null}
    </Alert>
  )
}
