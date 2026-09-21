"use client"

import Link from "next/link"
import { useState } from "react"

import { recordConsoleEventAction } from "@/app/app/console-events"
import { ReceiptCard } from "@/components/brand"
import { ColumnChart } from "@/components/data/column-chart"
import {
  metricTrendClassName,
  metricTrendGlyph,
} from "@/lib/merchant/dashboard-trends"
import { numbersRangeLabel } from "@/lib/merchant/numbers-nav"
import {
  formatComeBackDate,
  type NumbersOverviewModel,
} from "@/lib/merchant/numbers-overview-model"
import { cn } from "@/lib/utils"

import { NumbersDayReadout } from "./numbers-day-readout"
import { NumbersRangeSheet } from "./numbers-range-sheet"

const STAMP_NOUN = { singular: "stamp", plural: "stamps" }
const JOIN_NOUN = { singular: "join", plural: "joins" }

/**
 * Numbers overview (handoff §6.3.1). Two small multiples with their own
 * y-scales sharing one x-axis and one selection; the day readout is the
 * accessible path to a column and announces politely; the delta receipt
 * says direction in words with the glyph and colour redundant. Low-data
 * bands and partial failures render honestly rather than as empty boxes.
 */
export function NumbersOverview({
  model,
  basePath,
}: {
  model: NumbersOverviewModel
  basePath?: string
}) {
  const chart = model.chart
  const lastIndex = chart ? chart.days.length - 1 : 0
  // The selection is keyed to the range it was made in: a range change
  // (a server round-trip that may keep this instance mounted) resets it to
  // the most recent day instead of pointing past a shorter series.
  const [selection, setSelection] = useState({
    range: model.range,
    index: lastIndex,
  })
  const selected =
    selection.range === model.range
      ? Math.min(selection.index, lastIndex)
      : lastIndex
  const rangeLabel = numbersRangeLabel(model.range)

  function select(
    target: { index: number } | { delta: -1 | 1 },
    method: "column" | "stepper",
    metric: "stamps" | "members"
  ) {
    if (!chart) return
    // Functional update: a burst of stepper presses must each move one day
    // even when React has not re-rendered between them.
    setSelection((previous) => {
      const current =
        previous.range === model.range
          ? Math.min(previous.index, lastIndex)
          : lastIndex
      const requested =
        "index" in target ? target.index : current + target.delta
      const next = Math.min(
        Math.max(requested, chart.placeholderCount),
        lastIndex
      )
      if (next === current) return previous
      void recordConsoleEventAction({
        name: "numbers_day_selected",
        properties: { metric, method },
      })
      return { range: model.range, index: next }
    })
  }

  return (
    <div className="mx-auto grid w-full max-w-[35rem] gap-5 min-[900px]:max-w-[51.25rem]">
      <Headline model={model} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="mono-meta text-ink-soft">Range</p>
        <NumbersRangeSheet range={model.range} basePath={basePath} />
      </div>

      {model.band === "too-early" ? (
        <TooEarlyNote model={model} />
      ) : chart ? (
        <>
          <ReceiptCard className="grid gap-5 min-[600px]:grid-cols-2 min-[600px]:gap-6">
            <ColumnChart
              title="Stamps"
              noun={STAMP_NOUN}
              labels={chart.labels}
              names={chart.names}
              values={chart.stamps}
              placeholderCount={chart.placeholderCount}
              selectedIndex={selected}
              onSelect={(index) => select({ index }, "column", "stamps")}
              tone="ink"
              rangeLabel={rangeLabel}
            />
            <ColumnChart
              title="Joins"
              noun={JOIN_NOUN}
              labels={chart.labels}
              names={chart.names}
              values={chart.joins}
              placeholderCount={chart.placeholderCount}
              selectedIndex={selected}
              onSelect={(index) => select({ index }, "column", "members")}
              tone="cobalt"
              rangeLabel={rangeLabel}
            />
          </ReceiptCard>

          <NumbersDayReadout
            name={chart.names[selected] ?? ""}
            values={[
              {
                value: chart.stamps[selected] ?? 0,
                noun: (chart.stamps[selected] ?? 0) === 1 ? "stamp" : "stamps",
              },
              {
                value: chart.joins[selected] ?? 0,
                noun: (chart.joins[selected] ?? 0) === 1 ? "join" : "joins",
              },
            ]}
            canStepBack={selected > chart.placeholderCount}
            canStepForward={selected < lastIndex}
            onStep={(delta) => select({ delta }, "stepper", "stamps")}
          />
        </>
      ) : (
        <ReceiptCard
          data-numbers-series-error
          className="grid gap-2 border-dashed border-line-strong"
        >
          <p className="mono-meta text-ink-soft">Charts</p>
          <p className="text-sm leading-6 text-muted-foreground">
            The daily series could not be loaded just now. The totals below are
            unaffected. Refresh to try again.
          </p>
        </ReceiptCard>
      )}

      <DeltaReceipt model={model} basePath={basePath} />

      <p className="mono-id text-ink-soft" data-numbers-footnote>
        {rangeLabel} · Europe/London · refreshed{" "}
        {formatRefreshed(model.refreshedAt)}
      </p>
    </div>
  )
}

function Headline({ model }: { model: NumbersOverviewModel }) {
  if (!model.totals) {
    return (
      <ReceiptCard
        data-numbers-totals-error
        className="grid gap-2 border-dashed border-line-strong"
      >
        <p className="mono-meta text-ink-soft">Members</p>
        <p className="text-sm leading-6 text-muted-foreground">
          The totals could not be loaded just now. Refresh to try again.
        </p>
      </ReceiptCard>
    )
  }

  return (
    <div className="grid gap-1" data-numbers-headline>
      <p className="mono-meta text-ink-soft">Members</p>
      <p className="font-mono text-4xl leading-none font-bold tabular-nums">
        {model.totals.members.toLocaleString("en-GB")}
      </p>
      {model.joinedLast7 !== null ? (
        <p className="text-sm leading-6 text-muted-foreground">
          {model.joinedLast7.toLocaleString("en-GB")} joined in the last 7 days
        </p>
      ) : null}
    </div>
  )
}

function TooEarlyNote({ model }: { model: NumbersOverviewModel }) {
  return (
    <ReceiptCard edge className="grid gap-3" data-numbers-too-early>
      <p className="mono-meta text-ink-soft">Trend</p>
      <p className="text-lg leading-tight font-extrabold">
        Too early to show a trend.
      </p>
      <p className="text-sm leading-6 text-muted-foreground">
        {model.trendFrom
          ? `Come back on ${formatComeBackDate(model.trendFrom)}.`
          : "Your first stamp starts the clock."}
      </p>
      {model.totals ? (
        <dl className="grid grid-cols-3 gap-3">
          {[
            ["Stamps", model.totals.stampsIssued],
            ["Rewards", model.totals.rewardsRedeemed],
            ["QR downloads", model.totals.qrDownloads],
          ].map(([label, value]) => (
            <div key={String(label)} className="grid gap-0.5">
              <dt className="mono-id text-ink-soft">{label}</dt>
              <dd className="font-mono text-xl font-bold tabular-nums">
                {Number(value).toLocaleString("en-GB")}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </ReceiptCard>
  )
}

/** Drilling into a metric keeps the range the owner chose. */
function detailHref(
  basePath: string | undefined,
  metric: string,
  range: number
): string {
  const path = `${(basePath ?? "/app/numbers").split("?")[0]}/${metric}`
  return range === 14 ? path : `${path}?range=${range}`
}

const DETAIL_METRIC = {
  newMembers: "members",
  stamps: "stamps",
  rewards: "rewards",
} as const

function DeltaReceipt({
  model,
  basePath,
}: {
  model: NumbersOverviewModel
  basePath?: string
}) {
  if (!model.deltas) return null

  return (
    <ReceiptCard edge className="grid gap-0" data-numbers-deltas>
      <div className="flex items-baseline justify-between gap-2 pb-2">
        <p className="mono-meta text-ink-soft">This week</p>
        <p className="mono-id text-ink-soft">vs the 7 days before</p>
      </div>
      <dl className="grid divide-y-2 divide-dashed divide-line">
        {model.deltas.map((row) => (
          <div
            key={row.key}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 py-2.5 min-[430px]:grid-cols-[minmax(0,1fr)_auto_minmax(0,12rem)]"
          >
            <dt className="text-sm font-bold">
              <Link
                href={detailHref(basePath, DETAIL_METRIC[row.key], model.range)}
                prefetch={false}
                data-numbers-metric-link={DETAIL_METRIC[row.key]}
                onClick={() => {
                  void recordConsoleEventAction({
                    name: "numbers_metric_opened",
                    properties: { metric: DETAIL_METRIC[row.key] },
                  })
                }}
                className="focus-ring inline-flex min-h-11 items-center underline underline-offset-4"
              >
                {row.label}
              </Link>
            </dt>
            <dd className="font-mono text-lg leading-none font-bold tabular-nums">
              {row.trend.current.toLocaleString("en-GB")}
            </dd>
            <dd
              className={cn(
                "mono-id col-span-2 mt-1 min-[430px]:col-span-1 min-[430px]:mt-0 min-[430px]:text-right",
                model.deltasEnabled
                  ? metricTrendClassName(row.trend.direction)
                  : "text-ink-soft"
              )}
            >
              {model.deltasEnabled ? (
                <>
                  <span aria-hidden="true">
                    {metricTrendGlyph(row.trend.direction)}{" "}
                  </span>
                  {row.trend.label}
                </>
              ) : (
                "not enough history to compare yet"
              )}
            </dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 pt-3">
        <Link
          href="/app/activity"
          prefetch={false}
          className="focus-ring inline-flex min-h-11 items-center text-sm font-bold text-foreground underline underline-offset-4"
        >
          See the activity behind these
        </Link>
        <Link
          href={detailHref(basePath, "qr", model.range)}
          prefetch={false}
          data-numbers-metric-link="qr"
          onClick={() => {
            void recordConsoleEventAction({
              name: "numbers_metric_opened",
              properties: { metric: "qr" },
            })
          }}
          className="focus-ring inline-flex min-h-11 items-center text-sm font-bold text-foreground underline underline-offset-4"
        >
          QR downloads
        </Link>
      </div>
    </ReceiptCard>
  )
}

function formatRefreshed(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso))
}
