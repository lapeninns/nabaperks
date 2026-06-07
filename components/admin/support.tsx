import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export const adminInputClasses =
  "min-h-11 rounded-xl border border-input bg-secondary/60 px-3 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/25"

export const adminTextareaClasses =
  "min-h-24 rounded-xl border border-input bg-secondary/60 px-3 py-2 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/25"

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
        "surface-card grid gap-4 rounded-3xl border bg-card p-5 shadow-xs",
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
      <span>{label}</span>
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
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full border bg-secondary px-3 py-1 font-mono text-[11px] font-semibold text-muted-foreground",
        className
      )}
    >
      {children}
    </span>
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
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-bold capitalize",
        tone === "good" && "bg-reward/15 text-reward-foreground",
        tone === "warning" && "bg-primary/15 text-primary",
        tone === "danger" && "bg-destructive/15 text-destructive",
        tone === "neutral" && "bg-secondary text-secondary-foreground"
      )}
    >
      {children}
    </span>
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
