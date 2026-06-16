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

export function DataTable<T>({
  caption,
  columns,
  rows,
  getRowKey,
  emptyState,
  className,
  rowClassName,
  onRowClick,
}: {
  caption: string
  columns: DataTableColumn<T>[]
  rows: T[]
  getRowKey: (row: T, index: number) => string
  emptyState?: ReactNode
  className?: string
  rowClassName?: (row: T, index: number) => string | undefined
  onRowClick?: (row: T, index: number) => void
}) {
  if (!rows.length && emptyState) {
    return <>{emptyState}</>
  }

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
                "transition-colors hover:bg-secondary/35",
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
