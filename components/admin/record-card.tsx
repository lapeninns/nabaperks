import type { ReactNode } from "react"

import { Eyebrow } from "@/components/brand"
import { cn } from "@/lib/utils"

export type AdminRecordCardField = {
  label: string
  value: ReactNode
  mono?: boolean
  /**
   * The one value on the card that answers the operator's question. Renders in
   * the foreground at semibold instead of muted — without it every value from
   * a merchant name to a stamp count took --muted-foreground and hierarchy was
   * flat.
   */
  emphasis?: boolean
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
  /**
   * Prose that does not belong in a `dd`: a narrative, a quote, a reason.
   * Rendered as its own block below the field list at reading size, in the
   * foreground — a 1,200-character narrative inside a label/value list was
   * unreadable and made card heights wildly uneven in a two-column grid.
   */
  body?: ReactNode
  /** Optional support action or form, full-width at the bottom of the card. */
  action?: ReactNode
  /**
   * `inline` puts short values beside their labels from ~28rem of card width
   * (a container query, so it responds to the CARD, not the viewport), which
   * roughly halves card height. `stacked` keeps the two-line label/value pair.
   */
  layout?: "stacked" | "inline"
  className?: string
}

/**
 * A single Wet Ink surface record card for dense admin data at phone width.
 *
 * Returned from `DataTable`'s `mobileCard` renderer so admin tables read as
 * cards below their chosen breakpoint instead of clipping in `overflow-x-auto`.
 * The styling mirrors the existing per-record cards on the admin merchants
 * ("QR records") and privacy ("Data request workflow") pages: a surface card
 * with a 2px ink border, ~10px radius, hard offset shadow, eyebrow, bold title,
 * optional status, labelled values, optional prose body, and a full-width
 * action so support actions are reachable without horizontal scroll.
 */
export function AdminRecordCard({
  title,
  eyebrow,
  status,
  fields,
  body,
  action,
  layout = "stacked",
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

      {/* The container is the field list itself, so `@sm` below asks how wide
          THIS CARD is, not how wide the window is — the same card renders in a
          full-width panel and in a two-column grid. */}
      <dl className="@container grid min-w-0 gap-2.5">
        {fields.map((field, index) => (
          <div
            key={`${index}-${field.label}`}
            className={cn(
              "grid min-w-0 gap-1 text-sm",
              layout === "inline" &&
                "@sm:grid-cols-[minmax(0,8rem)_minmax(0,1fr)] @sm:items-baseline @sm:gap-x-3 @sm:gap-y-0"
            )}
          >
            <dt className="eyebrow">{field.label}</dt>
            <dd
              className={cn(
                "min-w-0 [overflow-wrap:anywhere] break-words",
                field.emphasis
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground",
                // .mono-meta, not a third `font-mono text-xs` register.
                field.mono && "mono-meta normal-case"
              )}
            >
              {field.value}
            </dd>
          </div>
        ))}
      </dl>

      {body ? (
        <div className="min-w-0 text-sm leading-6 [overflow-wrap:anywhere] break-words text-foreground">
          {body}
        </div>
      ) : null}

      {action ? <div className="grid min-w-0 gap-2">{action}</div> : null}
    </article>
  )
}
