import type { KeyboardEventHandler, ReactNode } from "react"

import Link from "next/link"
import { ArrowDown01Icon, ArrowUp01Icon } from "@hugeicons/core-free-icons"

import { Icon } from "@/components/brand"
import { ShowMoreList } from "@/components/data/show-more-list"
import { cn } from "@/lib/utils"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export type DataTableColumn<T> = {
  key: string
  header: ReactNode
  cell: (row: T) => ReactNode
  className?: string
  /**
   * Makes this header a sort control. The value is the token that reaches the
   * URL as `?sort=`, and it is deliberately NOT `key`: the sort token is an
   * allowlisted server-side column name, while `key` is a React list key a
   * caller may rename freely. A column without a `sortKey`, or a table without
   * a `sort` prop, renders exactly the inert header it always did.
   */
  sortKey?: string
}

type DataTableSortDirection = "asc" | "desc"

/**
 * URL-driven sorting for the console tables (ADM 04#60). Links, not client
 * state: the admin lists are server components whose filter and pagination are
 * already query params, so a sorted view stays linkable, back-button safe and
 * works with no JavaScript — and the ORDER BY happens in the database rather
 * than over whichever page happens to be loaded, which would rank each page
 * independently (the trap the fraud queue was left capped for, 04#6).
 */
export type DataTableSort = {
  /** The active sort token, or null when the list is in its default order. */
  readonly key: string | null
  readonly direction: DataTableSortDirection
  readonly hrefFor: (key: string, direction: DataTableSortDirection) => string
}

/**
 * Optional a11y/interaction attributes a caller can attach to each desktop
 * `<tr>` (and, when present, the mobile card `<li>`) via `getRowProps`. Narrowed
 * to the WAI-ARIA "interactive row" surface so a clickable row can also be a
 * real keyboard control (WCAG 2.1.1 / 4.1.2) without exposing the whole `<tr>`
 * element type. Every field is optional; returning `undefined` (the default)
 * leaves the row byte-identical to the legacy markup.
 */
export type DataTableRowProps = {
  tabIndex?: number
  role?: string
  "aria-selected"?: boolean
  onKeyDown?: KeyboardEventHandler<HTMLElement>
}

export type DataTableProps<T> = {
  caption: string
  columns: DataTableColumn<T>[]
  rows: T[]
  getRowKey: (row: T, index: number) => string
  emptyState?: ReactNode
  className?: string
  rowClassName?: (row: T, index: number) => string | undefined
  onRowClick?: (row: T, index: number) => void
  /**
   * Opt-in per-row a11y/interaction hook. Returns extra attributes merged onto
   * the desktop `<tr>` (and, when a `mobileCard` is used, the card `<li>`) so a
   * caller can make a clickable row keyboard-operable — e.g. `tabIndex={0}`,
   * `role="button"`, `aria-selected`, and an `onKeyDown` that activates the row
   * on Enter/Space (WCAG 2.1.1 / 4.1.2). Returning `undefined` (the default)
   * leaves the row byte-identical to the legacy markup, so existing call sites
   * are unaffected.
   */
  getRowProps?: (row: T, index: number) => DataTableRowProps | undefined
  /**
   * Opt-in mobile renderer. When provided, phone widths (below `sm`) show a
   * readable card per row instead of a horizontally scrolling table, and the
   * semantic table is reserved for `sm` and above. Place support actions inside
   * the returned card body so they are reachable without horizontal scroll.
   * When omitted, the component renders exactly as the plain table (no wrapper
   * or responsive-visibility changes).
   */
  mobileCard?: (row: T, index: number) => ReactNode
  /** Class applied to the mobile-card list (only when `mobileCard` is set). */
  mobileClassName?: string
  /**
   * Progressive reveal for the card stack: narrow viewports start with this
   * many cards and a "Show more" control instead of the full stack (an
   * unpaginated 100-row readback is a ~9,000px page at 375px). DEFAULTS TO 10
   * — the mitigation was opt-in and had been applied to 2 of 8 admin tables,
   * so the phone experience of the console varied by an order of magnitude
   * between routes. Pass a larger number, or `Number.POSITIVE_INFINITY`, to
   * render the whole stack. Desktop tables are unaffected. Ignored when
   * `onRowClick`/`getRowProps` are used — those need per-row handlers the
   * reveal wrapper does not thread through.
   */
  mobilePageSize?: number
  /**
   * Breakpoint at which the card stack switches to the semantic table (only
   * when `mobileCard` is set). `"sm"` (the default) keeps cards on phones and
   * the table from 640px up — byte-identical to the original behaviour. `"xl"`
   * is the admin console norm, keeping card records through tablet widths.
   */
  cardBreakpoint?: "sm" | "xl"
  /**
   * Sorting state + link builder. Omitted (the default) leaves every header
   * inert and the markup byte-identical to the unsorted table.
   */
  sort?: DataTableSort
}

/**
 * Static class strings per breakpoint so Tailwind detects them at build time.
 * Do not build these by interpolation — Tailwind cannot statically extract
 * dynamically composed class names.
 */
/** Cards revealed before the "Show more" control; see `mobilePageSize`. */
const DEFAULT_MOBILE_PAGE_SIZE = 10

const CARD_BREAKPOINT_CLASSES = {
  sm: { cards: "sm:hidden", table: "hidden sm:block" },
  xl: { cards: "xl:hidden", table: "hidden xl:block" },
} as const

function DataTableCore<T>({
  caption,
  columns,
  rows,
  getRowKey,
  className,
  rowClassName,
  onRowClick,
  getRowProps,
  sort,
}: Pick<
  DataTableProps<T>,
  | "caption"
  | "columns"
  | "rows"
  | "getRowKey"
  | "className"
  | "rowClassName"
  | "onRowClick"
  | "getRowProps"
  | "sort"
>) {
  return (
    // The inner ui Table provides the one focusable scroll container; the
    // card only CLIPS to its rounded corners (overflow-hidden), so there are
    // no nested scroll regions / double scrollbars.
    <div className={cn("surface-card overflow-hidden", className)}>
      <Table label={caption} className="min-w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <TableHeader className="bg-secondary/60">
          <TableRow className="border-b-2 border-ink hover:bg-transparent">
            {columns.map((column) => (
              // One type recipe: the `th` used to set a 12px Bricolage
              // uppercase style that the nested `.eyebrow` then overrode to
              // 11.5px mono, and the block <p> defeated the h-10 centring.
              // .eyebrow lives on the cell now; the wrapper element is gone.
              <TableHead
                key={column.key}
                aria-sort={ariaSort(column, sort)}
                className={cn(
                  "eyebrow h-10 px-4 whitespace-nowrap",
                  column.className
                )}
              >
                <SortableHeader column={column} sort={sort} />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow
              key={getRowKey(row, index)}
              className={cn(
                "transition-colors duration-[var(--w-dur-fast)] ease-[var(--w-ease)] hover:bg-secondary/35 motion-reduce:transition-none",
                onRowClick && "cursor-pointer select-none",
                rowClassName?.(row, index)
              )}
              onClick={onRowClick ? () => onRowClick(row, index) : undefined}
              {...interactiveRowProps(row, index, onRowClick, getRowProps)}
            >
              {columns.map((column) => (
                <TableCell
                  key={column.key}
                  className={cn(
                    "px-4 py-3 align-top text-sm",
                    column.className
                  )}
                >
                  {column.cell(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

/**
 * `aria-sort` belongs on the header CELL, not on the control inside it
 * (WAI-ARIA 1.2), and only one column may claim a direction at a time. A
 * sortable column that is not the active one reports "none"; a column that
 * cannot be sorted reports nothing at all, because `aria-sort="none"` on an
 * inert header tells a screen-reader user the table sorts when it does not.
 */
function ariaSort<T>(
  column: DataTableColumn<T>,
  sort?: DataTableSort
): "ascending" | "descending" | "none" | undefined {
  if (!sort || !column.sortKey) return undefined
  if (sort.key !== column.sortKey) return "none"
  return sort.direction === "asc" ? "ascending" : "descending"
}

/**
 * A sortable header is a real link — the console's whole lookup model is query
 * params — so it is middle-clickable, copyable and needs no JavaScript.
 * Pressing the active column toggles its direction; pressing a new one starts
 * at descending, which is the direction an operator triaging by severity or
 * recency wants first.
 */
function SortableHeader<T>({
  column,
  sort,
}: {
  readonly column: DataTableColumn<T>
  readonly sort?: DataTableSort
}) {
  if (!sort || !column.sortKey) return <>{column.header}</>

  const active = sort.key === column.sortKey
  const next: DataTableSortDirection =
    active && sort.direction === "desc" ? "asc" : "desc"

  return (
    <Link
      href={sort.hrefFor(column.sortKey, next)}
      // "Sort by When" does not say what pressing it will do, and an admin
      // table can carry four of these.
      aria-label={`Sort by ${headerLabel(column)}, ${
        next === "asc" ? "ascending" : "descending"
      }`}
      className="focus-ring -mx-1 inline-flex items-center gap-1 rounded-sm px-1 outline-none hover:text-foreground"
    >
      {column.header}
      <Icon
        icon={
          active && sort.direction === "asc" ? ArrowUp01Icon : ArrowDown01Icon
        }
        size={12}
        className={cn(!active && "opacity-35")}
        aria-hidden="true"
      />
    </Link>
  )
}

/** A readable name for the sort link, falling back to the sort token. */
function headerLabel<T>(column: DataTableColumn<T>): string {
  return typeof column.header === "string"
    ? column.header
    : (column.sortKey ?? column.key)
}

/**
 * Keyboard operability by default: when a caller sets `onRowClick` without
 * supplying `getRowProps`, the row still becomes a real keyboard control
 * (`tabIndex=0`, `role="button"`, Enter/Space activation — WCAG 2.1.1).
 * Caller-provided `getRowProps` wins untouched; rows without `onRowClick`
 * stay byte-identical to the legacy markup.
 */
function interactiveRowProps<T>(
  row: T,
  index: number,
  onRowClick?: (row: T, index: number) => void,
  getRowProps?: (row: T, index: number) => DataTableRowProps | undefined
): DataTableRowProps | undefined {
  const provided = getRowProps?.(row, index)
  if (provided) return provided
  if (!onRowClick) return undefined

  return {
    tabIndex: 0,
    role: "button",
    onKeyDown: (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault()
        onRowClick(row, index)
      }
    },
  }
}

export function DataTable<T>(props: DataTableProps<T>) {
  const {
    caption,
    rows,
    getRowKey,
    emptyState,
    rowClassName,
    onRowClick,
    getRowProps,
    mobileCard,
    mobileClassName,
    mobilePageSize = DEFAULT_MOBILE_PAGE_SIZE,
    cardBreakpoint = "sm",
  } = props

  // Legacy path: no mobile renderer requested. Render exactly as before so
  // existing consumers keep identical DOM and classes.
  if (!mobileCard) {
    if (!rows.length && emptyState) {
      return <>{emptyState}</>
    }
    return <DataTableCore {...props} />
  }

  // Opt-in responsive path: cards below the breakpoint, semantic table at and
  // above it. Default `"sm"` is byte-identical to the original behaviour.
  const breakpoint = CARD_BREAKPOINT_CLASSES[cardBreakpoint]
  const isEmpty = !rows.length

  return (
    <>
      {/* Mobile: card stack (hidden at the breakpoint and above). */}
      <div className={breakpoint.cards}>
        {isEmpty ? (
          (emptyState ?? null)
        ) : mobilePageSize &&
          rows.length > mobilePageSize &&
          !onRowClick &&
          !getRowProps ? (
          <ShowMoreList
            label={caption}
            initialCount={mobilePageSize}
            className={mobileClassName}
            items={rows.map((row, index) => ({
              key: getRowKey(row, index),
              content: mobileCard(row, index),
            }))}
          />
        ) : (
          <ul
            aria-label={caption}
            className={cn("grid gap-2.5", mobileClassName)}
          >
            {rows.map((row, index) => (
              <li
                key={getRowKey(row, index)}
                className={cn(
                  onRowClick && "cursor-pointer select-none",
                  rowClassName?.(row, index)
                )}
                onClick={onRowClick ? () => onRowClick(row, index) : undefined}
                {...interactiveRowProps(row, index, onRowClick, getRowProps)}
              >
                {mobileCard(row, index)}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Desktop/tablet: semantic table (hidden below the breakpoint). */}
      <div className={breakpoint.table}>
        {isEmpty && emptyState ? emptyState : <DataTableCore {...props} />}
      </div>
    </>
  )
}
