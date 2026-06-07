"use client"

import { useActionState } from "react"

import {
  saveRoiSettingsAction,
  type RoiSettingsState,
} from "@/app/app/settings/actions"
import { Button } from "@/components/ui/button"

export function RoiSettingsForm({
  averageOrderValuePence,
  estimatedGrossMarginBps,
  rewardCostPence,
}: {
  averageOrderValuePence: number
  estimatedGrossMarginBps: number
  rewardCostPence: number
}) {
  const initialState: RoiSettingsState = {
    fields: {
      averageOrderValue: formatInputMoney(averageOrderValuePence),
      estimatedGrossMargin: formatInputPercent(estimatedGrossMarginBps),
      rewardCost: formatInputMoney(rewardCostPence),
    },
  }
  const [state, action, pending] = useActionState(
    saveRoiSettingsAction,
    initialState
  )
  const fields = state.fields ?? initialState.fields

  return (
    <form action={action} className="grid gap-4 rounded-3xl border bg-card p-5 shadow-xs">
      <MoneyField
        id="averageOrderValue"
        label="Average order value"
        value={fields?.averageOrderValue ?? ""}
        error={state.errors?.averageOrderValue}
      />
      <NumberField
        id="estimatedGrossMargin"
        label="Estimated gross margin"
        suffix="%"
        value={fields?.estimatedGrossMargin ?? ""}
        error={state.errors?.estimatedGrossMargin}
      />
      <MoneyField
        id="rewardCost"
        label="Estimated reward cost"
        value={fields?.rewardCost ?? ""}
        error={state.errors?.rewardCost}
      />
      {state.errors?.form ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.errors.form}
        </p>
      ) : null}
      {state.message ? (
        <p className="rounded-xl border border-reward/30 bg-accent px-3 py-2 text-sm text-accent-foreground">
          {state.message}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Save settings"}
      </Button>
    </form>
  )
}

function MoneyField({
  id,
  label,
  value,
  error,
}: {
  id: string
  label: string
  value: string
  error?: string
}) {
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-sm font-bold">
        {label}
      </label>
      <div className="flex h-12 items-center rounded-xl border border-input bg-secondary/60 px-4 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/25">
        <span className="font-mono text-sm text-muted-foreground">£</span>
        <input
          id={id}
          name={id}
          type="number"
          min="0"
          step="0.01"
          defaultValue={value}
          className="h-full min-w-0 flex-1 bg-transparent px-2 text-sm outline-none"
          aria-invalid={Boolean(error)}
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}

function NumberField({
  id,
  label,
  suffix,
  value,
  error,
}: {
  id: string
  label: string
  suffix: string
  value: string
  error?: string
}) {
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-sm font-bold">
        {label}
      </label>
      <div className="flex h-12 items-center rounded-xl border border-input bg-secondary/60 px-4 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/25">
        <input
          id={id}
          name={id}
          type="number"
          min="0"
          max="100"
          step="0.01"
          defaultValue={value}
          className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none"
          aria-invalid={Boolean(error)}
        />
        <span className="font-mono text-sm text-muted-foreground">{suffix}</span>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}

function formatInputMoney(pence: number) {
  return (pence / 100).toFixed(2)
}

function formatInputPercent(bps: number) {
  return (bps / 100).toFixed(2)
}
