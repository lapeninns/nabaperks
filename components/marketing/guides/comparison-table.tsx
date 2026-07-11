import { cn } from "@/lib/utils"

export type GuideComparisonRow = {
  feature: string
  /** [baseline, highlighted] — order matches `columns`. */
  cells: [string, string]
}

/**
 * GuideComparisonTable — the two-column "X vs Y" table for guide spokes. Same
 * sticky-pinned-feature-column family as the landing ComparisonTable: on
 * narrow screens the table scrolls horizontally while the row headers stay
 * pinned on an opaque background (`border-separate` keeps cell borders
 * attached to the sticky cells), so the highlighted second column — usually
 * the page's whole argument — is read in context instead of sitting off-screen
 * behind context-free cells. Real semantic <table> markup (scoped headers +
 * caption) so answer engines can lift it. Server component.
 */
export function GuideComparisonTable({
  ariaLabel,
  caption,
  columns,
  rows,
}: {
  ariaLabel: string
  caption: string
  /** [baseline, highlighted] — the second column gets the ink header. */
  columns: [string, string]
  rows: GuideComparisonRow[]
}) {
  return (
    <div className="grid gap-2">
      {/* Phones start with the highlighted column off-screen; the cue + edge
          fade say "there's more" without hiding the pinned feature column. */}
      <p
        aria-hidden="true"
        className="mono-meta text-muted-foreground sm:hidden"
      >
        Swipe to compare →
      </p>
      {/* min-w-0: as a grid child this wrapper must shrink below the table's
          min-width so the region scrolls internally instead of inflating. */}
      <div className="relative min-w-0">
        <div
          aria-label={ariaLabel}
          className="[scrollbar-width:thin] overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          role="region"
          tabIndex={0}
        >
          <table className="w-full min-w-[30rem] border-separate border-spacing-0 text-left text-sm">
            <caption className="sr-only">{caption}</caption>
            <thead>
              <tr>
                <th
                  scope="col"
                  className="sticky left-0 z-[2] w-[28%] border-r border-dashed border-foreground/20 bg-background p-0"
                />
                <th
                  scope="col"
                  className="border-b-2 border-ink px-3 py-3 align-bottom font-extrabold"
                >
                  {columns[0]}
                </th>
                <th
                  scope="col"
                  className="rounded-t-[var(--radius)] border-b-2 border-ink bg-ink px-3 py-3 align-bottom font-extrabold text-paper"
                >
                  {columns[1]}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.feature}>
                  <th
                    scope="row"
                    className={cn(
                      "sticky left-0 z-[1] border-r border-dashed border-foreground/20 bg-background py-3 pr-3 align-top font-bold text-pretty",
                      index > 0 && "border-t"
                    )}
                  >
                    {row.feature}
                  </th>
                  <td
                    className={cn(
                      "px-3 py-3 align-top text-muted-foreground",
                      index > 0 && "border-t border-dashed border-foreground/20"
                    )}
                  >
                    {row.cells[0]}
                  </td>
                  <td
                    className={cn(
                      "bg-ink/[0.04] px-3 py-3 align-top dark:bg-paper/[0.06]",
                      index > 0 && "border-t border-dashed border-foreground/20"
                    )}
                  >
                    {row.cells[1]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background to-transparent sm:hidden"
        />
      </div>
    </div>
  )
}
