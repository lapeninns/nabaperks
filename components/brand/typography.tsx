import type { ReactNode } from "react"

import { cn } from "@/lib/utils"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"

export function Eyebrow({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <p className={cn("eyebrow", className)}>{children}</p>
}

export function PageTitle({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <section className={cn("grid gap-4 md:grid-cols-[1fr_auto] md:items-end", className)}>
      <div className="grid gap-3">
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        <h1 className="max-w-3xl text-3xl font-extrabold leading-tight tracking-tight text-foreground sm:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </section>
  )
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="grid gap-2">
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        <h2 className="text-lg font-extrabold leading-snug text-foreground">
          {title}
        </h2>
        {description ? (
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  )
}

export function MetricTile({
  label,
  value,
  helper,
  className,
}: {
  label: ReactNode
  value: ReactNode
  helper?: ReactNode
  className?: string
}) {
  return (
    <Card className={cn("surface-card shadow-xs", className)} size="sm">
      <CardHeader>
        <CardDescription className="text-xs font-bold uppercase tracking-wide">
          {label}
        </CardDescription>
        <CardTitle className="numeric-tabular text-2xl font-extrabold tracking-tight">
          {value}
        </CardTitle>
      </CardHeader>
      {helper ? (
        <CardContent>
          <p className="text-xs leading-5 text-muted-foreground">{helper}</p>
        </CardContent>
      ) : null}
    </Card>
  )
}

export function EmptyState({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <Empty className={cn("rounded-3xl border bg-card p-6 text-center shadow-xs", className)}>
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        {description ? <EmptyDescription>{description}</EmptyDescription> : null}
      </EmptyHeader>
      {actions ? <EmptyContent>{actions}</EmptyContent> : null}
    </Empty>
  )
}
