"use client"

import { useActionState, useState, type InputHTMLAttributes } from "react"
import type { TextareaHTMLAttributes } from "react"

import {
  saveVenueLocationAction,
  type VenueLocationActionState,
} from "@/app/app/launch/actions"
import { PageTitle } from "@/components/brand"
import { Disclosure } from "@/components/merchant/launch/disclosure"
import { StatusBanner } from "@/components/loyalty/status-banner"
import { Button } from "@/components/ui/button"

type VenueLocationFormValues = {
  venueName: string
  address: string
  geofenceRadiusMeters: string
  requireGeofence: boolean
}

const initialState: VenueLocationActionState = {}

export function VenueLocationForm({
  initialValues,
  geocoded,
}: {
  initialValues: VenueLocationFormValues
  /** Saved coordinates, shown as quiet confirmation inside the GPS section. */
  geocoded?: { latitude: number | null; longitude: number | null } | null
}) {
  const [state, action, pending] = useActionState(
    saveVenueLocationAction,
    initialState
  )
  const [draft, setDraft] = useState<VenueLocationFormValues>({
    ...initialValues,
    ...state.fields,
  })

  function updateDraft<K extends keyof VenueLocationFormValues>(
    field: K,
    value: VenueLocationFormValues[K]
  ) {
    setDraft((currentDraft) => ({ ...currentDraft, [field]: value }))
  }

  const hasGeocode = geocoded?.latitude != null && geocoded?.longitude != null

  return (
    <form action={action} className="surface-card grid gap-5 p-6">
      <PageTitle
        eyebrow="Step 3 · Venue"
        title="Where do scans happen?"
        description="Your printed QR never changes. GPS is an optional soft check — it never blocks a customer's stamp, it only flags an odd one for review."
        titleClassName="sm:text-3xl"
      />

      {state.saved ? (
        <StatusBanner tone="success" title="Venue location saved.">
          Your QR and stamp checks now use this address.
        </StatusBanner>
      ) : null}

      <TextareaField
        id="address"
        label="Venue address"
        name="address"
        value={draft.address}
        onChange={(event) => updateDraft("address", event.target.value)}
        error={state.errors?.address}
      />

      <Field
        id="venueName"
        label="Venue name"
        name="venueName"
        value={draft.venueName}
        onChange={(event) => updateDraft("venueName", event.target.value)}
        error={state.errors?.venueName}
      />

      <Disclosure
        label="Advanced GPS checks"
        defaultOpen={
          draft.requireGeofence || Boolean(state.errors?.geofenceRadiusMeters)
        }
      >
        <p className="text-xs leading-5 text-muted-foreground">
          Off by default. When on, a stamp from outside the radius still goes
          through — it is only flagged for you to review later.
        </p>
        <label className="flex items-center justify-between gap-4 rounded-lg border-2 border-ink bg-card px-4 py-3 text-sm font-bold">
          <span>Use GPS anomaly checks</span>
          <input
            name="requireGeofence"
            type="checkbox"
            checked={draft.requireGeofence}
            onChange={(event) =>
              updateDraft("requireGeofence", event.target.checked)
            }
            className="size-5 accent-primary"
          />
        </label>
        <Field
          id="geofenceRadiusMeters"
          label="Radius metres"
          name="geofenceRadiusMeters"
          inputMode="numeric"
          pattern="[0-9]*"
          value={draft.geofenceRadiusMeters}
          onChange={(event) =>
            updateDraft("geofenceRadiusMeters", event.target.value)
          }
          error={state.errors?.geofenceRadiusMeters}
        />
        {hasGeocode ? (
          <p className="font-mono text-xs text-muted-foreground">
            Geocoded to {geocoded?.latitude}, {geocoded?.longitude}.
          </p>
        ) : null}
      </Disclosure>

      {state.errors?.form ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.errors.form}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Saving location..." : "Save venue address"}
      </Button>
    </form>
  )
}

function Field({
  id,
  label,
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  id: string
  label: string
  error?: string
}) {
  return (
    <label className="grid gap-2" htmlFor={id}>
      <span className="text-sm font-bold">{label}</span>
      <input
        id={id}
        {...props}
        className="h-11 rounded-lg border-2 border-ink bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/35"
      />
      {error ? <span className="text-sm text-destructive">{error}</span> : null}
    </label>
  )
}

function TextareaField({
  id,
  label,
  error,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  id: string
  label: string
  error?: string
}) {
  return (
    <label className="grid gap-2" htmlFor={id}>
      <span className="text-sm font-bold">{label}</span>
      <textarea
        id={id}
        rows={3}
        {...props}
        className="min-h-28 rounded-lg border-2 border-ink bg-background px-3 py-2 text-sm leading-6 outline-none focus-visible:ring-3 focus-visible:ring-ring/35"
      />
      {error ? <span className="text-sm text-destructive">{error}</span> : null}
    </label>
  )
}
