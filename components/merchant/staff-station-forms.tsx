"use client"

import { useActionState } from "react"

import {
  addStaffMemberAction,
  createStationAction,
  type AddStaffState,
  type CreateStationState,
} from "@/app/app/staff/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const addStaffInitial: AddStaffState = {}
const createStationInitial: CreateStationState = {}

export function AddStaffForm() {
  const [state, action, pending] = useActionState(
    addStaffMemberAction,
    addStaffInitial
  )

  return (
    <form action={action} className="grid gap-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <label htmlFor="staff-display-name" className="eyebrow">
            Display name
          </label>
          <Input
            id="staff-display-name"
            name="displayName"
            placeholder="Maya"
            aria-invalid={Boolean(state.errors?.displayName)}
            aria-describedby={
              state.errors?.displayName ? "staff-name-error" : undefined
            }
          />
          {state.errors?.displayName ? (
            <p id="staff-name-error" className="text-sm text-destructive">
              {state.errors.displayName}
            </p>
          ) : null}
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="staff-pin" className="eyebrow">
            Their PIN (4–6 digits)
          </label>
          <Input
            id="staff-pin"
            name="pin"
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            autoComplete="off"
            aria-invalid={Boolean(state.errors?.pin)}
            aria-describedby={state.errors?.pin ? "staff-pin-error" : undefined}
          />
          {state.errors?.pin ? (
            <p id="staff-pin-error" className="text-sm text-destructive">
              {state.errors.pin}
            </p>
          ) : null}
        </div>
      </div>
      {state.added ? (
        <p
          className="surface-card bg-accent px-3 py-2 text-sm"
          role="status"
        >
          {state.added} can now start sessions on any paired station.
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="justify-self-start">
        {pending ? "Adding..." : "Add staff member"}
      </Button>
    </form>
  )
}

export function CreateStationForm() {
  const [state, action, pending] = useActionState(
    createStationAction,
    createStationInitial
  )

  return (
    <form action={action} className="grid gap-3">
      <div className="grid gap-1.5">
        <label htmlFor="station-name" className="eyebrow">
          Station name
        </label>
        <Input
          id="station-name"
          name="stationName"
          placeholder="Front till"
          aria-invalid={Boolean(state.errors?.stationName)}
          aria-describedby={
            state.errors?.stationName ? "station-name-error" : undefined
          }
        />
        {state.errors?.stationName ? (
          <p id="station-name-error" className="text-sm text-destructive">
            {state.errors.stationName}
          </p>
        ) : null}
      </div>
      {state.pairing ? (
        <div
          className="grid gap-1 rounded-xl border-2 border-ink bg-ink p-4 text-paper"
          role="status"
        >
          <p className="font-mono text-[11px] uppercase tracking-wide text-paper/60">
            Pairing code for {state.pairing.stationName}
          </p>
          <p className="font-mono text-3xl font-bold uppercase tracking-[0.2em]">
            {state.pairing.pairingCode}
          </p>
          <p className="font-mono text-[11px] uppercase tracking-wide text-paper/60">
            Enter it at /staff on the counter device · lives for 15 minutes
          </p>
        </div>
      ) : null}
      <Button type="submit" disabled={pending} className="justify-self-start">
        {pending ? "Creating..." : "Create station"}
      </Button>
    </form>
  )
}
