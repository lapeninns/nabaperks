import type { ReactNode } from "react"

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
}

export function DataTable<T>({
  caption,
  columns,
  rows,
  getRowKey,
  emptyState,
  className,
}: {
  caption: string
  columns: DataTableColumn<T>[]
  rows: T[]
  getRowKey: (row: T, index: number) => string
  emptyState?: ReactNode
  className?: string
}) {
  if (!rows.length && emptyState) {
    return <>{emptyState}</>
  }

  return (
    <div className={cn("overflow-x-auto rounded-3xl border bg-card shadow-xs", className)}>
      <Table>
        <caption className="sr-only">{caption}</caption>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column.key}>{column.header}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={getRowKey(row, index)}>
              {columns.map((column) => (
                <TableCell key={column.key}>{column.cell(row)}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
