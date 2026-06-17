import type { ReactNode } from "react"

import { cn } from "@/lib/utils"
import { Eyebrow, MonoTag, STATUS_ICON, type IconGlyph } from "@/components/brand"

const STATUS_PILL_ICON: Record<
  "neutral" | "good" | "warning" | "danger",
  IconGlyph | undefined
> = {
  neutral: undefined,
  good: STATUS_ICON.success,
  warning: STATUS_ICON.warning,
  danger: STATUS_ICON.error,
}

export const adminInputClasses =
  "min-h-11 rounded-xl border-2 border-ink bg-secondary/60 px-3 text-sm outline-none transition-[border-color,box-shadow] duration-[var(--w-dur-fast)] ease-[var(--w-ease)] motion-reduce:transition-none focus:border-ring focus:ring-3 focus:ring-ring/25"

export const adminTextareaClasses =
  "min-h-24 rounded-xl border-2 border-ink bg-secondary/60 px-3 py-2 text-sm outline-none transition-[border-color,box-shadow] duration-[var(--w-dur-fast)] ease-[var(--w-ease)] motion-reduce:transition-none focus:border-ring focus:ring-3 focus:ring-ring/25"

export function AdminPanel({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        "surface-card grid gap-4 p-5",
        className
      )}
    >
      {children}
    </section>
  )
}

export function AdminField({
  label,
  children,
  helper,
  className,
}: {
  label: ReactNode
  children: ReactNode
  helper?: ReactNode
  className?: string
}) {
  return (
    <label className={cn("grid gap-1.5 text-sm font-bold", className)}>
      <Eyebrow>{label}</Eyebrow>
      {children}
      {helper ? (
        <span className="text-xs leading-5 font-normal text-muted-foreground">
          {helper}
        </span>
      ) : null}
    </label>
  )
}

export function SourceLabel({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <MonoTag
      tone="plain"
      className={cn("border-ink bg-secondary text-muted-foreground", className)}
    >
      {children}
    </MonoTag>
  )
}

export function StatusPill({
  children,
  tone = "neutral",
}: {
  children: ReactNode
  tone?: "neutral" | "good" | "warning" | "danger"
}) {
  return (
    <MonoTag
      tone="plain"
      icon={STATUS_PILL_ICON[tone]}
      className={cn(
        "border-ink capitalize",
        tone === "good" && "bg-reward/15 text-reward-foreground",
        tone === "warning" && "bg-primary/15 text-primary",
        tone === "danger" && "bg-destructive/15 text-destructive",
        tone === "neutral" && "bg-secondary text-secondary-foreground"
      )}
    >
      {children}
    </MonoTag>
  )
}

export function formatAdminDate(value?: string | null) {
  if (!value) return "-"
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

export function first<T>(value: T | T[] | null | undefined) {
  if (!value) return undefined
  return Array.isArray(value) ? value[0] : value
}

export function maskAdminContact(value?: string | null) {
  if (!value) return "Customer"
  if (value.includes("@")) {
    const [name, domain] = value.split("@")
    return `${name.slice(0, 2)}***@${domain}`
  }
  return `${value.slice(0, 4)}***${value.slice(-2)}`
}
