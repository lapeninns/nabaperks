import type { ReactNode } from "react"

import { cn } from "@/lib/utils"
import type { MetricTrendDirection } from "@/lib/merchant/dashboard-trends"
import { metricTrendClassName } from "@/lib/merchant/dashboard-trends"
import { Icon, type IconGlyph } from "./icon"
import { IconRoundel } from "./icon-roundel"
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
  titleClassName,
  descriptionClassName,
  headingLevel = 1,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
  titleClassName?: string
  descriptionClassName?: string
  /**
   * Heading rank (default h1). Panels rendered UNDER a page-level h1 (the
   * launch tabs, /app/qr) pass 2 so a document never carries two h1s — the
   * EmptyState headingLevel pattern.
   */
  headingLevel?: 1 | 2 | 3
}) {
  const Heading = `h${headingLevel}` as const

  return (
    <section
      className={cn(
        "grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end",
        className
      )}
    >
      <div className="grid min-w-0 gap-3">
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        <Heading
          className={cn(
            "type-page-title max-w-3xl min-w-0 text-balance break-words text-foreground",
            titleClassName
          )}
        >
          {title}
        </Heading>
        {description ? (
          <p
            className={cn(
              "max-w-2xl text-sm leading-6 text-muted-foreground",
              descriptionClassName
            )}
          >
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap gap-2 md:self-end md:justify-self-end">
          {actions}
        </div>
      ) : null}
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
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between",
        className
      )}
    >
      <div className="grid gap-2">
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        <h2 className="text-lg leading-snug font-extrabold text-foreground">
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
  trend,
  icon,
  className,
}: {
  label: ReactNode
  value: ReactNode
  helper?: ReactNode
  trend?: {
    label: string
    direction: MetricTrendDirection
  } | null
  /** Optional leading glyph from the @hugeicons set. */
  icon?: IconGlyph
  className?: string
}) {
  return (
    // The data-slot layer owns the surface; data-elevation="flat" pins dense
    // tiles at the same 2px offset as StatStrip (shadow utilities on a
    // slotted Card are defeated by the layer, so the variant is the recipe).
    <Card className={cn("h-full", className)} size="sm" data-elevation="flat">
      <CardHeader className="h-full">
        {/* Uppercase meta is Space Mono (.eyebrow) — one KPI label register
            with KpiTile; never Bricolage uppercase. */}
        <CardDescription className="eyebrow flex min-h-8 items-start gap-1.5">
          {icon ? <Icon icon={icon} size={14} strokeWidth={2.25} /> : null}
          {label}
        </CardDescription>
        <CardTitle className="numeric-tabular flex min-h-[2rem] items-end text-2xl font-extrabold">
          {value}
        </CardTitle>
        {trend ? (
          <p className={cn("mono-id", metricTrendClassName(trend.direction))}>
            {trend.label}
          </p>
        ) : null}
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
  icon,
  className,
  headingLevel = 2,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  /** Optional leading glyph from the @hugeicons set, shown above the title. */
  icon?: IconGlyph
  className?: string
  headingLevel?: 1 | 2 | 3
}) {
  return (
    <Empty className={cn("border-2 bg-card p-6 text-center", className)}>
      <EmptyHeader>
        {/* IconRoundel is the sanctioned framing circle and its docblock names
            this exact family; the hand-rolled span was a second copy of it. */}
        {icon ? (
          <IconRoundel
            icon={icon}
            iconSize={22}
            size="lg"
            className="mx-auto text-muted-foreground"
          />
        ) : null}
        <EmptyTitle as={`h${headingLevel}`}>{title}</EmptyTitle>
        {description ? (
          <EmptyDescription>{description}</EmptyDescription>
        ) : null}
      </EmptyHeader>
      {actions ? <EmptyContent>{actions}</EmptyContent> : null}
    </Empty>
  )
}
