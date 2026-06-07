"use client"

import { useActionState } from "react"

import {
  saveStaffPinAction,
  type StaffPinActionState,
} from "@/app/app/settings/actions"
import { Button } from "@/components/ui/button"
import type { StaffPinSetup } from "@/lib/merchant/staff-pin"

export function StaffPinSettingsForm({ setup }: { setup: StaffPinSetup }) {
  const initialState: StaffPinActionState = {
    configured: setup.configured,
    updatedAt: setup.updatedAt,
  }
  const [state, action, pending] = useActionState(
    saveStaffPinAction,
    initialState
  )
  const configured = state.configured ?? setup.configured
  const updatedAt = state.updatedAt ?? setup.updatedAt

  return (
    <form
      action={action}
      className="grid gap-4 rounded-3xl border bg-card p-5 shadow-xs"
    >
      <div
        className={
          configured
            ? "rounded-2xl border border-reward/30 bg-accent px-4 py-3"
            : "rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3"
        }
      >
        <p className="text-sm font-extrabold">
          {configured
            ? "PIN is active for counter staff."
            : "Set a PIN before customers can collect stamps."}
        </p>
        {configured && updatedAt ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Last changed {formatUpdatedAt(updatedAt)}.
          </p>
        ) : null}
      </div>

      <PinField
        id="pin"
        label="New PIN"
        error={state.errors?.pin}
        describedBy="pin-help"
      />
      <PinField
        id="confirmPin"
        label="Confirm PIN"
        error={state.errors?.confirmPin}
      />

      <p id="pin-help" className="text-sm leading-6 text-muted-foreground">
        Use 4-12 digits for stamp approval and reward redemption. Share it only
        with till staff.
      </p>

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
        {pending
          ? "Saving..."
          : configured
            ? "Change staff PIN"
            : "Save staff PIN"}
      </Button>
    </form>
  )
}

function PinField({
  id,
  label,
  error,
  describedBy,
}: {
  id: string
  label: string
  error?: string
  describedBy?: string
}) {
  const errorId = `${id}-error`

  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-sm font-bold">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="new-password"
        className="h-12 rounded-xl border border-input bg-secondary/60 px-4 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/25"
        aria-invalid={Boolean(error)}
        aria-describedby={
          [describedBy, error ? errorId : null].filter(Boolean).join(" ") ||
          undefined
        }
      />
      {error ? (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}

function formatUpdatedAt(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}
