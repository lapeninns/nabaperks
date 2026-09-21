"use client"

import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons"

import { Icon } from "@/components/brand"
import { Button } from "@/components/ui/button"

/**
 * The selected day, announced politely, between two 44px steppers. This is
 * the accessible path to a column (columns are ~20px at 320px); the Numbers
 * overview and every metric detail share it.
 */
export function NumbersDayReadout({
  name,
  values,
  canStepBack,
  canStepForward,
  onStep,
}: {
  name: string
  /** "6 stamps · 4 joins" style parts, already pluralised. */
  values: readonly { value: number; noun: string }[]
  canStepBack: boolean
  canStepForward: boolean
  onStep: (delta: -1 | 1) => void
}) {
  return (
    <div
      className="flex items-center justify-between gap-3 rounded-lg border-2 border-ink bg-card px-3 py-2 shadow-xs"
      data-numbers-readout
    >
      <Button
        type="button"
        variant="secondary"
        size="icon"
        aria-label="Previous day"
        disabled={!canStepBack}
        onClick={() => onStep(-1)}
      >
        <Icon icon={ArrowLeft01Icon} size={18} />
      </Button>
      <p aria-live="polite" className="min-w-0 text-center">
        <span className="mono-meta block text-ink-soft">{name}</span>
        <span className="block text-sm font-bold">
          {values.map((part, index) => (
            <span key={part.noun}>
              {index > 0 ? " · " : ""}
              <span className="font-mono tabular-nums">{part.value}</span>{" "}
              {part.noun}
            </span>
          ))}
        </span>
      </p>
      <Button
        type="button"
        variant="secondary"
        size="icon"
        aria-label="Next day"
        disabled={!canStepForward}
        onClick={() => onStep(1)}
      >
        <Icon icon={ArrowRight01Icon} size={18} />
      </Button>
    </div>
  )
}
