import type { ReactNode } from "react"

import { Eyebrow } from "@/components/brand"
import { cn } from "@/lib/utils"

export type AdminRecordCardField = {
  label: string
  value: ReactNode
  mono?: boolean
}

export type AdminRecordCardProps = {
  /** Primary identifier (bold, top of the card). */
  title: ReactNode
  /** Optional small label above the title (e.g. a code or id). */
  eyebrow?: ReactNode
  /** Optional StatusPill / MonoTag, shown under the title. */
  status?: ReactNode
  /** Labelled, stacked value rows (mirrors the AdminField label/value look). */
  fields: AdminRecordCardField[]
  /** Optional support action or form, full-width at the bottom of the card. */
  action?: ReactNode
  className?: string
}

/**
 * A single Wet Ink surface record card for dense admin data at phone width.
 *
 * Returned from `DataTable`'s `mobileCard` renderer so admin tables read as
 * cards below their chosen breakpoint instead of clipping in `overflow-x-auto`. The styling
 * mirrors the existing per-record cards on the admin merchants ("QR records")
 * and privacy ("Data request workflow") pages: a surface card with a 2px ink
 * border, ~10px radius, hard offset shadow, eyebrow, bold title, optional
 * status, stacked label/value fields, and a full-width action so support
 * actions are reachable without horizontal scroll.
 */
export function AdminRecordCard({
  title,
  eyebrow,
  status,
  fields,
  action,
  className,
}: AdminRecordCardProps) {
  return (
    <article className={cn("surface-card grid min-w-0 gap-3 p-4", className)}>
      <div className="grid min-w-0 gap-1">
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        <p className="min-w-0 font-bold [overflow-wrap:anywhere] break-words">
          {title}
        </p>
        {status ? (
          <div className="mt-1 flex flex-wrap gap-2">{status}</div>
        ) : null}
      </div>

      <dl className="grid min-w-0 gap-2.5">
        {fields.map((field, index) => (
          <div
            key={`${index}-${field.label}`}
            className="grid min-w-0 gap-1 text-sm"
          >
            <dt className="eyebrow">{field.label}</dt>
            <dd
              className={cn(
                "min-w-0 [overflow-wrap:anywhere] break-words text-muted-foreground",
                field.mono && "font-mono text-xs"
              )}
            >
              {field.value}
            </dd>
          </div>
        ))}
      </dl>

      {action ? <div className="grid min-w-0 gap-2">{action}</div> : null}
    </article>
  )
}
