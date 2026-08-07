import type { ComponentProps, ReactNode } from "react"

import { cn } from "@/lib/utils"
import { Database01Icon } from "@hugeicons/core-free-icons"

import {
  EmptyState,
  Eyebrow,
  Icon,
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
  variant = "padded",
}: {
  children: ReactNode
  className?: string
  /** Optional anchor id so cross-links can target a panel on the same page. */
  id?: string
  /**
   * `flush` is the table/list panel: no padding, so a DataTable meets the
   * card edge. Seven panels hand-wrote `className="p-0"` plus an inner
   * `border-b p-5` header; the recipe lives here now.
   */
  variant?: "padded" | "flush"
}) {
  return (
    <section
      id={id}
      className={cn(
        "surface-card grid",
        variant === "flush" ? "gap-0 p-0" : "gap-4 p-5",
        className
      )}
    >
      {children}
    </section>
  )
}

/** Header block for a `flush` panel: the one bordered, padded header row. */
export function AdminPanelHeader({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn("grid gap-4 border-b p-5", className)}>{children}</div>
  )
}

/** Footer block for a `flush` panel (paginators sit here). */
export function AdminPanelFooter({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={cn("p-5", className)}>{children}</div>
}

/**
 * The de-styled EmptyState, once. Eleven-plus call sites copied
 * `className="rounded-none border-0 p-0 shadow-none"` — inconsistently, so
 * some inline empty states were inset by p-6 and some were flush.
 */
export function AdminEmptyState({
  className,
  padded = true,
  ...props
}: ComponentProps<typeof EmptyState> & {
  /** Keep the EmptyState's own padding (inside a flush panel body). */
  padded?: boolean
}) {
  return (
    <EmptyState
      {...props}
      className={cn(
        "rounded-none border-0 shadow-none",
        padded ? undefined : "p-0",
        className
      )}
    />
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
    // The helper sits OUTSIDE the <label>. Inside it, it was concatenated into
    // the field's accessible name — a screen reader announced "DELTA POSITIVE
    // ADDS STAMPS, NEGATIVE REMOVES THEM" as the name of the number input, and
    // the helper was never exposed as a description. It is now sibling
    // guidance, so the name is just the label.
    <div className={cn("grid min-w-0 gap-1.5", className)}>
      <label className="grid min-w-0 gap-1.5 text-sm font-bold">
        <Eyebrow>{label}</Eyebrow>
        {children}
      </label>
      {helper ? (
        // whitespace-normal: inside a table cell the helper would inherit the
        // cell's nowrap, and its single-line min-content inflates the field's
        // implicit track (the Delta/Reason overlap class of bug).
        <span className="text-xs leading-5 font-normal whitespace-normal text-muted-foreground">
          {helper}
        </span>
      ) : null}
    </div>
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
        className="ink-check focus-ring mt-0.5 shrink-0"
      />
      <span className="leading-5 font-semibold text-foreground">{label}</span>
    </label>
  )
}

/**
 * Provenance, not state. It used to be a `MonoTag` sharing mono face, ink
 * border and secondary fill with a neutral `StatusPill`, so "pending" and
 * "Source: audit_logs" had the same silhouette in the same row. Metadata now
 * reads as a quiet glyph + label with no pill outline, leaving the bordered
 * pill to mean state and nothing else.
 */
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
        "mono-meta inline-flex min-w-0 items-center gap-1.5 text-muted-foreground",
        className
      )}
    >
      <Icon icon={Database01Icon} size={13} strokeWidth={2.25} />
      <span className="min-w-0 truncate">{children}</span>
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

/**
 * One humanising step for the snake_case keys the database stores
 * (`data_request_logged`, `customer_pii_erased`, `qr_regenerated`). The audit
 * page printed them raw in bold Bricolage while fraud and privacy each
 * humanised the same class of value their own way — three readings of one
 * datum, and snake_case in the display face is a register violation (mono is
 * the printed voice). The raw token stays available wherever an operator
 * needs to grep for it.
 */
export function formatAdminAction(value?: string | null) {
  if (!value) return "-"
  const spaced = value.replaceAll("_", " ").trim()
  if (!spaced) return "-"
  return `${spaced.charAt(0).toUpperCase()}${spaced.slice(1)}`
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
