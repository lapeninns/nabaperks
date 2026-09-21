"use client"

import Link from "next/link"
import { useState } from "react"
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons"

import { recordConsoleEventAction } from "@/app/app/console-events"
import { Icon, ReceiptCard } from "@/components/brand"
import { ColumnChart } from "@/components/data/column-chart"
import { ActivityCompactFeed } from "@/components/merchant/activity-compact-feed"
import type { ActivityDisplayRow } from "@/lib/merchant/activity-display"
import {
  metricTrendClassName,
  metricTrendGlyph,
} from "@/lib/merchant/dashboard-trends"
import type { NumbersDetailModel } from "@/lib/merchant/numbers-detail-model"
import { numbersRangeLabel } from "@/lib/merchant/numbers-nav"
import { formatComeBackDate } from "@/lib/merchant/numbers-overview-model"
import { cn } from "@/lib/utils"

import { NumbersRangeSheet } from "./numbers-range-sheet"

/**
 * One metric's detail (handoff §6.3.2): the big tabular value and its range,
 * the full-width column chart for that metric alone, this week against the
 * seven days before in words, best and quietest day, and the five most
 * recent matching activity rows linking into the filtered feed. Breakdown
 * blocks with no query behind them are not rendered at all.
 */
export function NumbersDetail({
  model,
  recentRows,
  basePath = "/app/numbers",
  activityHref = "/app/activity",
}: {
  model: NumbersDetailModel
  recentRows: readonly ActivityDisplayRow[] | null
  basePath?: string
  activityHref?: string
}) {
  const chart = model.chart
  const lastIndex = chart ? chart.values.length - 1 : 0
  const [selection, setSelection] = useState({
    range: model.range,
    index: lastIndex,
  })
  const selected =
    selection.range === model.range
      ? Math.min(selection.index, lastIndex)
      : lastIndex
  const rangeLabel = numbersRangeLabel(model.range)
  const metricForEvent = model.metric

  return (
    <div className="mx-auto grid w-full max-w-[35rem] gap-5 min-[900px]:max-w-[51.25rem]">
      <div className="flex items-center justify-between gap-3">
        <Link
          href={basePath}
          prefetch={false}
          className="focus-ring inline-flex min-h-11 items-center gap-1 text-sm font-bold text-foreground underline underline-offset-4"
        >
          <Icon icon={ArrowLeft01Icon} size={16} />
          Numbers
        </Link>
        {model.metric !== "qr" ? (
          <NumbersRangeSheet
            range={model.range}
            basePath={`${basePath}/${model.metric}`}
          />
        ) : null}
      </div>

      <div className="grid gap-1" data-numbers-detail-headline>
        <p className="mono-meta text-ink-soft">{model.label}</p>
        <p className="font-mono text-4xl leading-none font-bold tabular-nums">
          {model.headline === null
            ? "—"
            : model.headline.toLocaleString("en-GB")}
        </p>
        <p className="text-sm leading-6 text-muted-foreground">
          {model.headlineCaption}
        </p>
      </div>

      {model.band === "too-early" ? (
        <ReceiptCard edge className="grid gap-2" data-numbers-too-early>
          <p className="text-lg leading-tight font-extrabold">
            Too early to show a trend.
          </p>
          <p className="text-sm leading-6 text-muted-foreground">
            {model.trendFrom
              ? `Come back on ${formatComeBackDate(model.trendFrom)}.`
              : "Your first stamp starts the clock."}
          </p>
        </ReceiptCard>
      ) : chart ? (
        <ReceiptCard className="grid gap-4">
          <ColumnChart
            title={model.label}
            noun={model.noun}
            labels={chart.labels}
            names={chart.names}
            values={chart.values}
            placeholderCount={chart.placeholderCount}
            selectedIndex={selected}
            onSelect={(index) => {
              setSelection({ range: model.range, index })
              void recordConsoleEventAction({
                name: "numbers_day_selected",
                properties: { metric: metricForEvent, method: "column" },
              })
            }}
            tone={chart.tone}
            rangeLabel={rangeLabel}
          />
          <p
            aria-live="polite"
            data-numbers-detail-readout
            className="text-center text-sm font-bold"
          >
            <span className="mono-meta block text-ink-soft">
              {chart.names[selected]}
            </span>
            <span className="font-mono tabular-nums">
              {chart.values[selected] ?? 0}
            </span>{" "}
            {(chart.values[selected] ?? 0) === 1
              ? model.noun.singular
              : model.noun.plural}
          </p>
        </ReceiptCard>
      ) : model.metric === "qr" ? null : (
        <ReceiptCard
          data-numbers-series-error
          className="grid gap-2 border-dashed border-line-strong"
        >
          <p className="text-sm leading-6 text-muted-foreground">
            The daily series could not be loaded just now. Refresh to try again.
          </p>
        </ReceiptCard>
      )}

      {model.comparison ? (
        <ReceiptCard edge className="grid gap-2" data-numbers-comparison>
          <p className="mono-meta text-ink-soft">This week</p>
          <p className="text-sm font-bold">
            <span className="font-mono text-lg tabular-nums">
              {model.comparison.current.toLocaleString("en-GB")}
            </span>{" "}
            {model.comparison.current === 1
              ? model.noun.singular
              : model.noun.plural}{" "}
            in the last 7 days
          </p>
          <p
            className={cn(
              "mono-id",
              model.comparisonEnabled
                ? metricTrendClassName(model.comparison.direction)
                : "text-ink-soft"
            )}
          >
            {model.comparisonEnabled ? (
              <>
                <span aria-hidden="true">
                  {metricTrendGlyph(model.comparison.direction)}{" "}
                </span>
                {model.comparison.label}
              </>
            ) : (
              "not enough history to compare yet"
            )}
          </p>
        </ReceiptCard>
      ) : null}

      {model.bestDay && model.quietestDay ? (
        <dl className="grid grid-cols-2 gap-3" data-numbers-best-quiet>
          {[
            ["Best day", model.bestDay],
            ["Quietest day", model.quietestDay],
          ].map(([label, day]) => (
            <div
              key={String(label)}
              className="grid gap-0.5 rounded-lg border-2 border-ink bg-card p-3 shadow-xs"
            >
              <dt className="mono-id text-ink-soft">{String(label)}</dt>
              <dd className="text-sm font-bold">
                {(day as { name: string }).name}
              </dd>
              <dd className="font-mono text-lg font-bold tabular-nums">
                {(day as { value: number }).value}{" "}
                <span className="font-sans text-sm font-bold">
                  {(day as { value: number }).value === 1
                    ? model.noun.singular
                    : model.noun.plural}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      <section className="grid gap-3" data-numbers-recent>
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="mono-meta text-ink-soft">
            Recent {model.label.toLowerCase()} activity
          </h2>
          <Link
            href={`${activityHref}?filter=${model.activityCategory}`}
            prefetch={false}
            className="focus-ring inline-flex min-h-11 items-center text-sm font-bold text-foreground underline underline-offset-4"
          >
            All in Activity
          </Link>
        </div>
        {recentRows ? (
          <ActivityCompactFeed
            rows={[...recentRows]}
            emptyState={
              <p className="rounded-lg border-2 border-dashed border-line-strong p-4 text-sm leading-6 text-muted-foreground">
                Nothing here yet. The first {model.noun.singular} lands here.
              </p>
            }
          />
        ) : (
          <p className="rounded-lg border-2 border-dashed border-line-strong p-4 text-sm leading-6 text-muted-foreground">
            Recent activity could not be loaded just now.
          </p>
        )}
      </section>
    </div>
  )
}
