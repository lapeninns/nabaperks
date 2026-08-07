import type { ReactNode } from "react"

import { cn } from "@/lib/utils"
import {
  Eyebrow,
  MonoTag,
  STATUS_ICON,
  type IconGlyph,
} from "@/components/brand"

const STATUS_PILL_ICON: Record<
  "neutral" | "good" | "warning" | "danger",
  IconGlyph | undefined
> = {
  neutral: undefined,
  good: STATUS_ICON.success,
  warning: STATUS_ICON.warning,
  danger: STATUS_ICON.error,
}

export function AdminPanel({
  children,
  className,
  id,
}: {
  children: ReactNode
  className?: string
  /** Optional anchor id so cross-links can target a panel on the same page. */
  id?: string
}) {
  return (
    <section id={id} className={cn("surface-card grid gap-4 p-5", className)}>
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
        // whitespace-normal: inside a table cell the helper would inherit the
        // cell's nowrap, and its single-line min-content inflates the field's
        // implicit track (the Delta/Reason overlap class of bug).
        <span className="text-xs leading-5 font-normal whitespace-normal text-muted-foreground">
          {helper}
        </span>
      ) : null}
    </label>
  )
}

/**
 * Explicit confirmation for irreversible admin actions (regenerate QR,
 * cancel reward): a required native checkbox, so the form cannot submit until
 * the operator ticks the consequence statement. Progressive by design — no
 * client JS involved.
 */
export function AdminConfirmCheck({ label }: { label: ReactNode }) {
  return (
    // The irreversibility gate reads as a gate: a 2px-ink well, a 20px box on
    // the 44px tap row, and foreground (not muted) consequence copy. A 16px
    // native tick set in muted grey was the quietest element in a destructive
    // form.
    <label className="focus-ring-within flex min-h-11 items-start gap-3 rounded-lg border-2 border-ink bg-destructive/8 px-3 py-2.5 text-sm font-normal">
      <input
        type="checkbox"
        required
        className="mt-0.5 size-5 shrink-0 accent-destructive"
      />
      <span className="leading-5 font-semibold text-foreground">{label}</span>
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
        // No text-transform utility here: the unlayered [data-slot="badge"]
        // rule forces uppercase and defeats any layered utility.
        "border-ink",
        tone === "good" && "bg-reward/15 text-foreground",
        // Warning takes the sun wash, not `primary`. `--primary` (#cf330a) and
        // `--destructive` (#ea5f46) are both red-orange, so at a 15% wash a
        // warning flag and a danger flag were separable only by their glyph —
        // unusable for scanning a fraud queue by severity. Sun gives warning
        // its own hue; danger keeps red and gains weight via a heavier wash.
        tone === "warning" && "bg-seal/30 text-foreground",
        tone === "danger" && "bg-destructive/25 text-foreground",
        tone === "neutral" && "bg-secondary text-secondary-foreground"
      )}
    >
      {children}
    </MonoTag>
  )
}

// Operators are UK-based: pin the console clock to Europe/London so audit and
// fraud timestamps do not silently read an hour off during BST on UTC hosts.
const ADMIN_TIME_ZONE = "Europe/London"

const adminDateFormat = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: ADMIN_TIME_ZONE,
})

// Audit evidence carries the zone label ("14:05 BST") so a timestamp can be
// correlated with server logs without guessing the offset. Component options
// only: ECMA-402 forbids mixing dateStyle/timeStyle with timeZoneName.
const adminAuditDateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: ADMIN_TIME_ZONE,
  timeZoneName: "short",
})

export function formatAdminDate(value?: string | null) {
  if (!value) return "-"
  return adminDateFormat.format(new Date(value))
}

export function formatAdminAuditDate(value?: string | null) {
  if (!value) return "-"
  return adminAuditDateFormat.format(new Date(value))
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

/**
 * Masked contact for an admin customer row. Plaintext phone no longer exists
 * at rest (db phone plaintext retirement); phone-identity customers are
 * disambiguated by their stored last4.
 */
export function maskAdminCustomer(
  customer?: {
    email?: string | null
    phone_last4?: string | null
  } | null
) {
  if (customer?.email) return maskAdminContact(customer.email)
  if (customer?.phone_last4) return `Phone ending ${customer.phone_last4}`
  return "Customer"
}
