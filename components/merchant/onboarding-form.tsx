"use client"

import { useActionState, useEffect, useRef, useState } from "react"

import {
  completeOnboardingAction,
  type OnboardingActionState,
} from "@/app/app/onboarding/actions"
import { Eyebrow, VenueMark } from "@/components/brand"
import {
  VenuePlaceAutocomplete,
  type VenuePlaceSelection,
} from "@/components/merchant/launch/venue-place-autocomplete"
import { VenueAddressFields } from "@/components/merchant/venue-address-fields"
import {
  MANUAL_VENUE_PROVENANCE,
  VenueProviderProvenanceFields,
  type ProviderProvenance,
} from "@/components/merchant/venue-provider-provenance-fields"
import { Button } from "@/components/ui/button"
import type { VenueAddressFormFields } from "@/lib/merchant/venue-address"
import { cn } from "@/lib/utils"

const initialState: OnboardingActionState = {}
const legacyDraftStorageKey = "nabaperks:onboarding-draft"

function onboardingDraftStorageKey(userId: string) {
  return `${legacyDraftStorageKey}:${userId}`
}

const onboardingInputClassName =
  "h-12 rounded-xl border-2 border-ink bg-secondary/60 px-4 text-sm outline-none transition-[border-color,box-shadow] duration-[var(--w-dur-fast)] ease-[var(--w-ease)] motion-reduce:transition-none focus:border-ring focus:ring-3 focus:ring-ring/25"

type OnboardingDraft = NonNullable<OnboardingActionState["fields"]>

export function OnboardingForm({
  className,
  initialFields = {},
  draftUserId,
  googleMapsApiKey,
}: {
  className?: string
  initialFields?: OnboardingDraft
  /** Scopes browser draft storage to the signed-in merchant account. */
  draftUserId: string
  /** Dev-preview key injection; production uses the server-passed public key. */
  googleMapsApiKey?: string
}) {
  const draftStorageKey = onboardingDraftStorageKey(draftUserId)
  const hasInitialFields = Object.values(initialFields).some(Boolean)
  const [state, action, pending] = useActionState(
    completeOnboardingAction,
    hasInitialFields ? { ...initialState, fields: initialFields } : initialState
  )
  const formRef = useRef<HTMLFormElement>(null)
  const [locationName, setLocationName] = useState(
    state.fields?.locationName ?? initialFields.locationName ?? ""
  )
  const [address, setAddress] = useState<VenueAddressFormFields>({
    addressLine1: state.fields?.addressLine1 ?? "",
    addressLine2: state.fields?.addressLine2 ?? "",
    addressCity: state.fields?.addressCity ?? "",
    addressPostcode: state.fields?.addressPostcode ?? "",
  })
  const [provenance, setProvenance] = useState<ProviderProvenance>(
    MANUAL_VENUE_PROVENANCE
  )
  const [providerCoordinates, setProviderCoordinates] = useState<{
    latitude: string
    longitude: string
  }>({ latitude: "", longitude: "" })

  useEffect(() => {
    if (!state.fields) return

    const fields = state.fields
    const timeoutId = window.setTimeout(() => {
      if (fields.locationName !== undefined) {
        setLocationName(fields.locationName)
      }

      setAddress({
        addressLine1: fields.addressLine1 ?? "",
        addressLine2: fields.addressLine2 ?? "",
        addressCity: fields.addressCity ?? "",
        addressPostcode: fields.addressPostcode ?? "",
      })

      // Move focus to the first invalid field after a failed submit so SR and
      // keyboard users land on the error instead of staying on the button.
      const firstInvalid = formRef.current?.querySelector<HTMLElement>(
        '[aria-invalid="true"]'
      )
      firstInvalid?.focus()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [state.fields])

  useEffect(() => {
    window.localStorage.removeItem(legacyDraftStorageKey)
  }, [])

  useEffect(() => {
    if (hasInitialFields) return

    const timeoutId = window.setTimeout(() => {
      try {
        const savedDraft = window.localStorage.getItem(draftStorageKey)
        const draft = savedDraft
          ? (JSON.parse(savedDraft) as Partial<OnboardingDraft>)
          : {}
        const form = formRef.current
        if (!form || Object.values(state.fields ?? {}).some(Boolean)) return

        restoreField(form, "businessName", draft.businessName)
        restoreField(form, "businessType", draft.businessType)
        restoreField(form, "phone", draft.phone)
        if (draft.locationName) setLocationName(draft.locationName)
        setAddress({
          addressLine1: draft.addressLine1 ?? "",
          addressLine2: draft.addressLine2 ?? "",
          addressCity: draft.addressCity ?? "",
          addressPostcode: draft.addressPostcode ?? "",
        })
      } catch {
        window.localStorage.removeItem(draftStorageKey)
      }
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [draftStorageKey, hasInitialFields, state.fields])

  function updateDraft(partial: Partial<OnboardingDraft>) {
    try {
      const currentDraft = JSON.parse(
        window.localStorage.getItem(draftStorageKey) ?? "{}"
      ) as OnboardingDraft
      const nextDraft: OnboardingDraft = {
        ...initialFields,
        ...currentDraft,
        ...partial,
      }
      window.localStorage.setItem(draftStorageKey, JSON.stringify(nextDraft))
    } catch {
      window.localStorage.removeItem(draftStorageKey)
    }
  }

  function handleAddressEdit() {
    setProvenance(MANUAL_VENUE_PROVENANCE)
    setProviderCoordinates({ latitude: "", longitude: "" })
  }

  function handleFieldChange(
    field: keyof VenueAddressFormFields,
    value: string
  ) {
    setAddress((previous) => ({ ...previous, [field]: value }))
    updateDraft({ [field]: value })
  }

  function handlePlaceSelected(selection: VenuePlaceSelection) {
    setAddress(selection.fields)
    if (selection.displayName) {
      setLocationName(selection.displayName)
      updateDraft({ locationName: selection.displayName })
    }
    setProvenance({
      source: "provider_lookup",
      provider: "google_places",
      id: selection.placeId,
      latitude: String(selection.latitude),
      longitude: String(selection.longitude),
    })
    setProviderCoordinates({
      latitude: String(selection.latitude),
      longitude: String(selection.longitude),
    })
    updateDraft({
      ...selection.fields,
      locationName: selection.displayName || locationName,
    })
  }

  return (
    <form
      ref={formRef}
      action={action}
      className={cn("surface-card grid gap-4 p-6", className)}
    >
      <div className="flex items-center gap-3">
        <VenueMark name="Nabaperks" size={48} />
        <Eyebrow>Merchant setup</Eyebrow>
      </div>
      <hr className="w-rule" />
      <Field
        id="businessName"
        label="Business name"
        name="businessName"
        required
        defaultValue={state.fields?.businessName}
        onChange={(event) => updateDraft({ businessName: event.target.value })}
        error={state.errors?.businessName}
      />
      <div className="grid gap-2">
        <label htmlFor="businessType" className="eyebrow">
          Business type{" "}
          <span aria-hidden="true" className="text-destructive">
            *
          </span>
          <span className="sr-only"> (required)</span>
        </label>
        <select
          id="businessType"
          name="businessType"
          required
          aria-required="true"
          defaultValue={state.fields?.businessType ?? ""}
          onChange={(event) => updateDraft({ businessType: event.target.value })}
          className={onboardingInputClassName}
          aria-invalid={Boolean(state.errors?.businessType)}
          aria-describedby={
            state.errors?.businessType ? "businessType-error" : undefined
          }
        >
          <option value="" disabled>
            Select type
          </option>
          <option value="cafe">Cafe</option>
          <option value="dessert">Dessert shop</option>
          <option value="bubble_tea">Bubble tea</option>
          <option value="pub">Pub or bar</option>
          <option value="takeaway">Takeaway / quick service</option>
          <option value="barber">Barber</option>
          <option value="salon">Salon</option>
          <option value="other">Other local business</option>
        </select>
        {state.errors?.businessType ? (
          <p id="businessType-error" className="text-sm text-destructive">
            {state.errors.businessType}
          </p>
        ) : null}
      </div>

      <VenuePlaceAutocomplete
        onPlaceSelected={handlePlaceSelected}
        apiKey={googleMapsApiKey}
      />

      <VenueAddressFields
        values={address}
        errors={state.errors}
        columns={2}
        labelClassName="eyebrow"
        inputClassName={onboardingInputClassName}
        onFieldChange={handleFieldChange}
        onAddressChange={handleAddressEdit}
      />

      <VenueProviderProvenanceFields provenance={provenance} />

      <input
        type="hidden"
        name="geofenceRadiusMeters"
        value="150"
      />
      <input type="hidden" name="geofencePinSource" value="geocoded" />
      <input
        type="hidden"
        name="venueLatitude"
        value={providerCoordinates.latitude}
      />
      <input
        type="hidden"
        name="venueLongitude"
        value={providerCoordinates.longitude}
      />

      <Field
        id="locationName"
        label="First location name"
        name="locationName"
        required
        value={locationName}
        onChange={(event) => {
          setLocationName(event.target.value)
          updateDraft({ locationName: event.target.value })
        }}
        error={state.errors?.locationName}
      />
      <Field
        id="phone"
        label="Phone number"
        name="phone"
        type="tel"
        autoComplete="tel"
        defaultValue={state.fields?.phone}
        onChange={(event) => updateDraft({ phone: event.target.value })}
      />
      {state.errors?.form ? (
        <p
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {state.errors.form}
        </p>
      ) : null}
      <Button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="w-full"
      >
        {pending ? "Saving..." : "Finish setup"}
      </Button>
    </form>
  )
}

function restoreField(
  form: HTMLFormElement,
  fieldName: keyof OnboardingDraft,
  value?: string
) {
  const field = form.elements.namedItem(fieldName)
  if (!value || !(field instanceof HTMLInputElement || field instanceof HTMLSelectElement)) {
    return
  }

  field.value = value
}

function Field({
  id,
  label,
  error,
  required,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  id: string
  label: string
  error?: string
}) {
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="eyebrow">
        {label}
        {required ? (
          <>
            {" "}
            <span aria-hidden="true" className="text-destructive">
              *
            </span>
            <span className="sr-only"> (required)</span>
          </>
        ) : null}
      </label>
      <input
        id={id}
        className={onboardingInputClassName}
        required={required}
        aria-required={required || undefined}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      />
      {error ? (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
