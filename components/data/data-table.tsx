import type { ReactNode } from "react"

import { Eyebrow } from "@/components/brand"
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
   * Breakpoint at which the card stack switches to the semantic table (only
   * when `mobileCard` is set). `"sm"` (the default) keeps cards on phones and
   * the table from 640px up — byte-identical to the original behaviour. `"lg"`
   * and `"xl"` keep cards through wider layouts before switching to the table.
   */
  cardBreakpoint?: "sm" | "lg" | "xl"
}

/**
 * Static class strings per breakpoint so Tailwind detects them at build time.
 * Do not build these by interpolation — Tailwind cannot statically extract
 * dynamically composed class names.
 */
const CARD_BREAKPOINT_CLASSES = {
  sm: { cards: "sm:hidden", table: "hidden sm:block" },
  lg: { cards: "lg:hidden", table: "hidden lg:block" },
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
}: Pick<
  DataTableProps<T>,
  | "caption"
  | "columns"
  | "rows"
  | "getRowKey"
  | "className"
  | "rowClassName"
  | "onRowClick"
>) {
  return (
    <div className={cn("surface-card overflow-x-auto", className)}>
      <Table className="min-w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <TableHeader className="bg-secondary/60">
          <TableRow className="border-b-2 border-ink hover:bg-transparent">
            {columns.map((column) => (
              <TableHead
                key={column.key}
                className={cn(
                  "h-10 px-4 text-xs font-extrabold whitespace-nowrap text-muted-foreground uppercase",
                  column.className
                )}
              >
                <Eyebrow className="text-[0.7rem]">{column.header}</Eyebrow>
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

export function DataTable<T>(props: DataTableProps<T>) {
  const {
    caption,
    rows,
    getRowKey,
    emptyState,
    rowClassName,
    onRowClick,
    mobileCard,
    mobileClassName,
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
