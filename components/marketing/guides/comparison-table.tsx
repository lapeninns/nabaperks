import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import type { ComparisonRow } from "./guides-data"

/**
 * Paper-vs-QR comparison. Semantic table from `md:` up; below that each aspect
 * stacks as a labelled card so no cell copy is squeezed off a phone screen.
 *
 * `md:`, not `sm:`: at 640px inside a `width="narrow"` section each of the
 * three prose columns was ~197px minus cell padding, i.e. ~26 characters a
 * line. The outer `overflow-x-auto` is gone too — `Table` supplies its own
 * focusable scroll container, and nesting a second one is exactly what
 * options-matrix.tsx warns against.
 */
export function ComparisonTable({
  rows,
  caption,
}: {
  rows: readonly ComparisonRow[]
  caption: string
}) {
  return (
    <div className="grid gap-3">
      <div className="surface-card-flat hidden md:block">
        <Table>
          <TableCaption className="sr-only">{caption}</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead className="eyebrow">Aspect</TableHead>
              <TableHead className="eyebrow">Paper card</TableHead>
              <TableHead className="eyebrow">QR browser card</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.aspect}>
                <TableCell className="align-top text-sm font-bold whitespace-normal text-foreground">
                  {row.aspect}
                </TableCell>
                <TableCell className="align-top text-sm leading-6 whitespace-normal text-muted-foreground">
                  {row.paper}
                </TableCell>
                <TableCell className="align-top text-sm leading-6 whitespace-normal text-foreground">
                  {row.qr}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul aria-label={caption} className="grid gap-3 sm:grid-cols-2 md:hidden">
        {rows.map((row) => (
          <li key={row.aspect} className="surface-card-flat grid gap-2 p-4">
            <p className="eyebrow">{row.aspect}</p>
            <p className="text-sm leading-6 text-muted-foreground">
              <span className="font-bold text-foreground">Paper: </span>
              {row.paper}
            </p>
            <p className="text-sm leading-6 text-muted-foreground">
              <span className="font-bold text-foreground">QR card: </span>
              {row.qr}
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}
