"use client"

import { useEffect, useId, useRef, useState } from "react"

import { selectColumnCaptions } from "@/lib/merchant/column-chart-labels"
import { describeColumn } from "@/lib/merchant/numbers-overview-model"
import { cn } from "@/lib/utils"

export type ColumnChartProps = {
  /** Metric name for the caption and table header, e.g. "Stamps". */
  title: string
  noun: { singular: string; plural: string }
  /** "Wed 16" captions under the columns, oldest first. */
  labels: readonly string[]
  /** "Wednesday 16 September" names for the accessible column labels. */
  names: readonly string[]
  values: readonly number[]
  /** Leading columns that precede the venue's first stamp. */
  placeholderCount?: number
  selectedIndex: number
  onSelect?: (index: number) => void
  /** Unselected column ink. Stamps are ink, joins are cobalt. */
  tone: "ink" | "cobalt"
  rangeLabel: string
  className?: string
}

/**
 * Filled-column chart, CSS + DOM, no charting library, own y-scale.
 *
 * Accessibility, and one deliberate departure from the handoff's letter:
 * `role="img"` on the chart root would make every column button
 * presentational, so the descriptive label (metric, range, max) sits on the
 * `<figure>` as a visually hidden caption, a visually hidden `<table>` of
 * the same numbers follows, and the columns are real `<button>`s named
 * "Wednesday 16 September, 9 stamps" with `aria-current` on the selected
 * day. Columns are about 20px wide at 320px, below the 44px floor by
 * geometry; the accessible path is the 44px stepper pair in the readout,
 * the columns are the shortcut. The selected column fills `bg-primary`,
 * the screen's single accent use. No entry animation under reduced motion
 * (there is none at all).
 */
export function ColumnChart({
  title,
  noun,
  labels,
  names,
  values,
  placeholderCount = 0,
  selectedIndex,
  onSelect,
  tone,
  rangeLabel,
  className,
}: ColumnChartProps) {
  const captionId = useId()
  const captionsRef = useRef<HTMLDivElement>(null)
  const [visibleCaptions, setVisibleCaptions] = useState<readonly number[]>([])
  useEffect(() => {
    const container = captionsRef.current
    if (!container) return
    let active = true
    const measure = () => {
      if (!active) return
      const labelWidths = Array.from(container.children, (element) => {
        const range = document.createRange()
        range.selectNodeContents(element)
        return range.getBoundingClientRect().width
      })
      const next = selectColumnCaptions({
        width: container.getBoundingClientRect().width,
        columnGap:
          Number.parseFloat(getComputedStyle(container).columnGap) || 0,
        labelWidths,
      })
      setVisibleCaptions((previous) =>
        previous.length === next.length &&
        previous.every((index, position) => index === next[position])
          ? previous
          : next
      )
    }
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    measure()
    void document.fonts.ready.then(measure)
    return () => {
      active = false
      observer.disconnect()
    }
  }, [labels])
  const recorded = values.slice(placeholderCount)
  const max = Math.max(0, ...recorded)
  const quiet = recorded.every((value) => value === 0)
  const columnWidthClass =
    values.length <= 7
      ? "gap-1.5 min-[430px]:gap-2"
      : "gap-0.5 min-[430px]:gap-1"

  return (
    <figure
      aria-labelledby={captionId}
      data-column-chart={title.toLowerCase()}
      className={cn("grid gap-2", className)}
    >
      <figcaption id={captionId} className="sr-only">
        {title} per day, {rangeLabel.toLowerCase()}, highest {max}{" "}
        {max === 1 ? noun.singular : noun.plural}.
      </figcaption>

      <div className="flex items-baseline justify-between gap-2">
        <p className="mono-meta text-ink-soft">{title}</p>
        <p className="mono-id text-ink-soft">
          {quiet ? `No ${noun.plural} in this range` : `Peak ${max}`}
        </p>
      </div>

      <div
        role="group"
        aria-label={`${title} by day. Select a day to read its values.`}
        className={cn(
          "grid h-28 auto-cols-fr grid-flow-col items-end border-b-2 border-ink pb-px",
          columnWidthClass
        )}
      >
        {values.map((value, index) => {
          const placeholder = index < placeholderCount
          const selected = index === selectedIndex
          const height = placeholder || max === 0 ? 0 : (value / max) * 100
          const name = names[index] ?? labels[index] ?? ""

          return (
            <button
              key={`${labels[index]}-${index}`}
              type="button"
              aria-label={
                placeholder
                  ? `${name}, not yet recorded`
                  : describeColumn(name, value, noun)
              }
              aria-current={selected ? "date" : undefined}
              // A placeholder day has nothing to select: disabling it keeps
              // the readout honest instead of redirecting to another day.
              disabled={!onSelect || placeholder}
              onClick={() => onSelect?.(index)}
              className="focus-ring group/col flex h-full min-w-0 flex-col justify-end rounded-sm"
            >
              {placeholder ? (
                <span
                  aria-hidden="true"
                  className="block h-1.5 w-full border-t-2 border-dashed border-line-strong"
                />
              ) : (
                <span
                  aria-hidden="true"
                  data-selected={selected}
                  style={{ height: `${height}%` }}
                  className={cn(
                    "block min-h-0.5 w-full rounded-t-sm transition-[background-color] duration-[var(--w-dur-fast)] ease-[var(--w-ease)] motion-reduce:transition-none",
                    selected
                      ? "bg-primary"
                      : tone === "cobalt"
                        ? "bg-cobalt group-hover/col:bg-cobalt/80"
                        : "bg-ink group-hover/col:bg-ink/80"
                  )}
                />
              )}
            </button>
          )
        })}
      </div>

      <div
        ref={captionsRef}
        data-column-captions
        aria-hidden="true"
        className={cn("grid auto-cols-fr grid-flow-col", columnWidthClass)}
      >
        {labels.map((label, index) => (
          <span
            key={`${label}-${index}`}
            className={cn(
              "mono-id overflow-visible text-center whitespace-nowrap text-ink-soft",
              index === 0 && "text-left",
              index === labels.length - 1 && "text-right",
              !visibleCaptions.includes(index) && "invisible"
            )}
          >
            {label}
          </span>
        ))}
      </div>

      {placeholderCount > 0 ? (
        <p className="mono-id text-ink-soft">Dashed days: not yet recorded</p>
      ) : null}

      <table className="sr-only">
        <caption>
          {title} per day, {rangeLabel.toLowerCase()}
        </caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">{title}</th>
          </tr>
        </thead>
        <tbody>
          {values.map((value, index) => (
            <tr key={`${labels[index]}-${index}`}>
              <th scope="row">{names[index]}</th>
              <td>{index < placeholderCount ? "Not yet recorded" : value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
