"use client"

import { useActionState } from "react"

import {
  issueStaffStampAction,
  type StaffStampState,
} from "@/app/staff/stamp/actions"
import { Button } from "@/components/ui/button"

const initialState: StaffStampState = {}

export function StaffPinForm({ membershipId }: { membershipId: string }) {
  const [state, action, pending] = useActionState(
    issueStaffStampAction,
    initialState
  )

  return (
    <form action={action} className="grid gap-4">
      <input
        type="hidden"
        name="membershipId"
        value={state.fields?.membershipId ?? membershipId}
      />
      <div className="grid gap-2">
        <label htmlFor="pin" className="text-sm font-bold">
          Staff PIN
        </label>
        <input
          id="pin"
          name="pin"
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="one-time-code"
          className="h-12 rounded-xl border border-input bg-secondary/60 px-4 font-mono text-lg tracking-widest outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/25"
          aria-invalid={Boolean(state.errors?.pin)}
          aria-describedby={state.errors?.pin ? "staff-pin-error" : undefined}
        />
        {state.errors?.pin ? (
          <p id="staff-pin-error" className="text-sm text-destructive">
            {state.errors.pin}
          </p>
        ) : null}
      </div>
      {state.errors?.form ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.errors.form}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Issuing..." : "Issue stamp"}
      </Button>
    </form>
  )
}
