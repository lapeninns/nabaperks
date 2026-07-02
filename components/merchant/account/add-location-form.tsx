"use client"

import { useActionState, useEffect } from "react"

import type { AddLocationFormState } from "@/app/app/account/actions"
import { Eyebrow } from "@/components/brand"
import { FormField, SubmitButton } from "@/components/forms"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"

type AddLocationAction = (
  state: AddLocationFormState,
  formData: FormData
) => Promise<AddLocationFormState>

const initialState: AddLocationFormState = {}

/**
 * Error key -> input id. The lib validates the location name under
 * `venueName` (parseVenueLocationSubmission maps the `locationName` field),
 * so the focus/error lookup translates it back to the rendered input.
 */
const ERROR_FIELD_IDS: ReadonlyArray<
  readonly [keyof NonNullable<AddLocationFormState["errors"]>, string]
> = [
  ["venueName", "locationName"],
  ["addressLine1", "addressLine1"],
  ["addressLine2", "addressLine2"],
  ["addressCity", "addressCity"],
  ["addressPostcode", "addressPostcode"],
]

/**
 * Add-location form on the useActionState pattern (field persistence,
 * per-field errors, first-invalid focus, shared pending recipe) — replaces
 * the bare `<form action>` whose validation redirect wiped every typed value
 * (MER-P2-12). `action` is optional so the DB-free /dev/app-harness can mount
 * the view without a server action; the fallback keeps the form inert.
 */
export function AddLocationForm({ action }: { action?: AddLocationAction }) {
  const [state, formAction] = useActionState(
    action ?? (async () => initialState),
    initialState
  )
  const fields = state.fields

  // Move focus to the first invalid field after a failed submit (the
  // profile-form pattern). Keyed on `state`: useActionState returns a fresh
  // object per dispatch.
  useEffect(() => {
    if (!state.errors) return
    const firstInvalid = ERROR_FIELD_IDS.find(([key]) => state.errors?.[key])
    const target = firstInvalid
      ? document.getElementById(firstInvalid[1])
      : null
    if (target instanceof HTMLElement) target.focus()
  }, [state])

  return (
    <form action={formAction} className="grid gap-4">
      <LocationField
        id="locationName"
        name="locationName"
        label="Location name"
        placeholder="White Horse Milton"
        autoComplete="organization"
        required
        defaultValue={fields?.locationName}
        error={state.errors?.venueName}
      />
      <LocationField
        id="addressLine1"
        name="addressLine1"
        label="Address line 1"
        placeholder="1 High Street"
        autoComplete="address-line1"
        required
        defaultValue={fields?.addressLine1}
        error={state.errors?.addressLine1}
      />
      <LocationField
        id="addressLine2"
        name="addressLine2"
        label="Address line 2"
        placeholder="Optional"
        autoComplete="address-line2"
        defaultValue={fields?.addressLine2}
        error={state.errors?.addressLine2}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <LocationField
          id="addressCity"
          name="addressCity"
          label="Town or city"
          placeholder="Cambridge"
          autoComplete="address-level2"
          required
          defaultValue={fields?.addressCity}
          error={state.errors?.addressCity}
        />
        <LocationField
          id="addressPostcode"
          name="addressPostcode"
          label="Postcode"
          placeholder="CB24 6DF"
          autoComplete="postal-code"
          required
          defaultValue={fields?.addressPostcode}
          error={state.errors?.addressPostcode}
        />
      </div>
      <input type="hidden" name="geofenceRadiusMeters" value="150" />
      <input type="hidden" name="geofencePinSource" value="geocoded" />
      {state.errors?.address || state.errors?.form ? (
        <Alert variant="destructive">
          <AlertDescription>
            {state.errors.address ?? state.errors.form}
          </AlertDescription>
        </Alert>
      ) : null}
      <SubmitButton
        pendingLabel="Creating location…"
        className="w-full sm:w-fit"
      >
        Create location QR
      </SubmitButton>
    </form>
  )
}

/**
 * Thin composition over the one input story (FormField + the themed slot
 * well) — no private styling or aria wiring lives here. Mirrors AuthField.
 */
function LocationField({
  id,
  label,
  error,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  readonly id: string
  readonly label: string
  readonly error?: string
}) {
  return (
    <FormField id={id} label={<Eyebrow>{label}</Eyebrow>} error={error}>
      <Input id={id} className="h-12" {...props} />
    </FormField>
  )
}
