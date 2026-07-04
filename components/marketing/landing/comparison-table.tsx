import { Cancel01Icon, Tick02Icon } from "@hugeicons/core-free-icons"

import { Icon, MonoTag } from "@/components/brand"
import { Section } from "@/components/layout"
import { cn } from "@/lib/utils"

import {
  COMPARISON_COLUMNS,
  COMPARISON_ROWS,
  comparisonGapsForColumn,
  type ComparisonCell,
} from "./comparison-data"

function Mark({ value }: { value: ComparisonCell }) {
  return (
    <>
      <Icon
        icon={value ? Tick02Icon : Cancel01Icon}
        size={20}
        strokeWidth={2.75}
        className={cn(
          "mx-auto",
          value ? "text-reward" : "text-muted-foreground/70"
        )}
      />
      <span className="sr-only">{value ? "Yes" : "No"}</span>
    </>
  )
}

const nabaperksColumn = COMPARISON_COLUMNS[0]
const alternativeColumns = COMPARISON_COLUMNS.slice(1)

/**
 * Mobile — lead with the Nabaperks wedge (all six structural checks), then tuck
 * the alternative gaps behind one disclosure. Same facts as the table, far less
 * scroll than a matrix re-flow.
 */
function ComparisonMobileWedge() {
  return (
    <div className="surface-card mt-6 overflow-hidden md:hidden">
      <div className="rounded-t-[var(--radius-lg)] bg-ink px-4 py-3 text-paper">
        <p className="text-sm leading-tight font-extrabold">
          {nabaperksColumn.label}
        </p>
        <p className="mono-id mt-0.5 text-paper/70">{nabaperksColumn.sub}</p>
        <p className="mt-2 text-sm leading-snug text-paper/80">
          Checks every row below — no install, no wallet pass, no plastic.
        </p>
      </div>

      <ul
        aria-label="What a Nabaperks browser card includes"
        className="divide-y-2 divide-dashed divide-line"
      >
        {COMPARISON_ROWS.map((row) => (
          <li
            key={row.feature}
            className="flex items-start gap-3 px-4 py-2.5"
          >
            <Icon
              icon={Tick02Icon}
              size={18}
              strokeWidth={2.75}
              className="mt-0.5 shrink-0 text-reward"
              aria-hidden
            />
            <span className="text-sm leading-snug font-medium text-pretty">
              {row.feature}
            </span>
          </li>
        ))}
      </ul>

      <details className="group border-t-2 border-dashed border-line">
        <summary className="pressable mono-meta focus-ring flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 outline-none [&::-webkit-details-marker]:hidden">
          Where wallet pass, paper and POS fall short
          <span aria-hidden="true" className="text-primary">
            <span className="group-open:hidden">+</span>
            <span className="hidden group-open:inline">–</span>
          </span>
        </summary>
        <div
          aria-label="Where wallet-pass apps, paper cards and POS loyalty fall short"
          className="divide-y-2 divide-dashed divide-line border-t-2 border-dashed border-line"
        >
          {alternativeColumns.map((column, index) => {
            const gaps = comparisonGapsForColumn(index + 1)

            return (
              <div key={column.key} className="px-4 py-3">
                <p className="text-sm font-extrabold">{column.label}</p>
                <p className="mono-id mt-0.5 font-normal text-muted-foreground">
                  {column.sub}
                </p>
                <ul className="mt-2 space-y-1.5">
                  {gaps.map((row) => (
                    <li
                      key={row.feature}
                      className="flex items-start gap-2.5 text-sm leading-snug text-muted-foreground"
                    >
                      <Icon
                        icon={Cancel01Icon}
                        size={16}
                        strokeWidth={2.75}
                        className="mt-0.5 shrink-0 text-muted-foreground/70"
                        aria-hidden
                      />
                      <span>{row.feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </details>
    </div>
  )
}

/**
 * The browser-card vs wallet-pass vs paper vs POS comparison — the page's most
 * citable GEO asset. Real semantic <table> markup (with scoped headers and a
 * caption) so answer engines can lift it for "loyalty card without an app" and
 * "X vs Y" queries. Below `md`, a compact Nabaperks wedge replaces the clipped
 * horizontal table; from `md` up the full matrix renders with sticky row headers.
 */
export function ComparisonTable() {
  return (
    <Section id="no-app">
      <div className="max-w-[44ch]">
        <MonoTag tone="accent">No app · no wallet · no plastic</MonoTag>
        <h2 className="mt-4 text-[clamp(1.85rem,4vw,2.75rem)] leading-[1.02] font-extrabold tracking-[-0.02em] text-balance">
          A real browser card — not a wallet pass.
        </h2>
        <p className="mt-3 text-base leading-relaxed text-pretty text-muted-foreground">
          Most “no-app” loyalty cards still make customers install an Apple or
          Google <strong className="font-bold text-foreground">Wallet pass</strong>.
          Nabaperks just opens in the browser and saves in one tap — so{" "}
          <strong className="font-bold text-foreground">“saved” and “usable”
          are the same moment</strong>, with nothing to install.
        </p>
      </div>

      <ComparisonMobileWedge />

      <div className="relative mt-6 hidden md:block">
        <div
          aria-label="Browser-card comparison table"
          className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5"
          role="region"
          tabIndex={0}
        >
          <table className="w-full min-w-[34rem] border-separate border-spacing-0 text-left">
            <caption className="sr-only">
              How a Nabaperks browser card compares with wallet-pass loyalty apps,
              paper punch cards and POS loyalty across install, fraud, hardware and
              data.
            </caption>
            <thead>
              <tr>
                <th
                  scope="col"
                  className="sticky left-0 z-[2] w-[34%] border-r border-dashed border-foreground/20 bg-background p-0"
                />
                {COMPARISON_COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    scope="col"
                    className={cn(
                      "border-b-2 border-ink px-3 py-3 text-center align-bottom",
                      col.highlight && "rounded-t-[var(--radius)] bg-ink text-paper"
                    )}
                  >
                    <span className="block text-sm leading-tight font-extrabold">
                      {col.label}
                    </span>
                    <span
                      className={cn(
                        "mono-id mt-0.5 block",
                        col.highlight ? "text-paper/70" : "text-muted-foreground"
                      )}
                    >
                      {col.sub}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map((row, rowIndex) => (
                <tr key={row.feature}>
                  <th
                    scope="row"
                    className={cn(
                      "sticky left-0 z-[1] border-r border-dashed border-foreground/20 bg-background py-3 pr-3 align-middle text-[0.9rem] leading-snug font-bold text-pretty",
                      rowIndex > 0 && "border-t"
                    )}
                  >
                    {row.feature}
                  </th>
                  {row.cells.map((cell, colIndex) => (
                    <td
                      key={COMPARISON_COLUMNS[colIndex].key}
                      className={cn(
                        "px-3 py-3 text-center align-middle",
                        rowIndex > 0 &&
                          "border-t border-dashed border-foreground/20",
                        COMPARISON_COLUMNS[colIndex].highlight &&
                          "bg-ink/[0.04] dark:bg-paper/[0.06]"
                      )}
                    >
                      <Mark value={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-5 max-w-[58ch] text-sm leading-relaxed text-pretty text-muted-foreground">
        With wallet-pass tools, customers often end up{" "}
        <strong className="font-bold text-foreground">enrolled but not
        installed</strong> — they tap “add to wallet”, never finish, and can’t
        find the reward on a locked phone. A browser card has no install step to
        abandon.
      </p>
    </Section>
  )
}
