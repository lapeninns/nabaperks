"use client"

import { useActionState } from "react"

import {
  pairStationAction,
  type PairStationState,
} from "@/app/staff/actions"
import { Button } from "@/components/ui/button"

const initialState: PairStationState = {}

export function StationPairingForm() {
  const [state, action, pending] = useActionState(
    pairStationAction,
    initialState
  )

  return (
    <section className="surface-card p-6">
      <form action={action} className="grid gap-4">
        <div className="grid gap-2">
          <label htmlFor="pairingCode" className="eyebrow text-center">
            Pairing code
          </label>
          <input
            id="pairingCode"
            name="pairingCode"
            type="text"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            maxLength={12}
            className="h-14 rounded-lg border-2 border-ink bg-card text-center font-mono text-2xl font-bold uppercase tracking-[0.3em] outline-none transition focus:ring-3 focus:ring-ring/30 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20"
            aria-invalid={Boolean(state.errors?.pairingCode)}
            aria-describedby={
              state.errors?.pairingCode ? "pairing-code-error" : undefined
            }
          />
          {state.errors?.pairingCode ? (
            <p id="pairing-code-error" className="text-sm text-destructive">
              {state.errors.pairingCode}
            </p>
          ) : null}
        </div>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Pairing..." : "Pair this station"}
        </Button>
        <p className="text-center font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
          The owner creates pairing codes in Settings &rsaquo; Staff
        </p>
      </form>
    </section>
  )
}
