"use client"

import { useActionState, useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"

import {
  completeOnboardingAction,
  type OnboardingActionState,
} from "@/app/app/onboarding/actions"
import { Eyebrow, VenueMark } from "@/components/brand"
import type {
  VenuePlaceAutocompleteProps,
  VenuePlaceSelection,
} from "@/components/merchant/launch/venue-place-autocomplete"
import {
  BusinessTypeField,
  OnboardingField,
  OnboardingFormError,
  onboardingInputClassName,
  type BusinessTypeOption,
} from "@/components/merchant/onboarding-form-fields"
import { VenueAddressFields } from "@/components/merchant/venue-address-fields"
import {
  MANUAL_VENUE_PROVENANCE,
  VenueProviderProvenanceFields,
  type ProviderProvenance,
} from "@/components/merchant/venue-provider-provenance-fields"
import { Button } from "@/components/ui/button"
import type { VenueAddressFormFields } from "@/lib/merchant/venue-address"
import { cn } from "@/lib/utils"

const VenuePlaceAutocomplete = dynamic<VenuePlaceAutocompleteProps>(
  () =>
    import("@/components/merchant/launch/venue-place-autocomplete").then(
      (module) => module.VenuePlaceAutocomplete
    ),
  { ssr: false }
)

const initialState: OnboardingActionState = {}
const legacyDraftStorageKey = "nabaperks:onboarding-draft"
const businessTypeOptions = [
  { value: "cafe", label: "Cafe" },
  { value: "dessert", label: "Dessert shop" },
  { value: "bubble_tea", label: "Bubble tea" },
  { value: "pub", label: "Pub or bar" },
  { value: "takeaway", label: "Takeaway / quick service" },
  { value: "barber", label: "Barber" },
  { value: "salon", label: "Salon" },
  { value: "other", label: "Other local business" },
] satisfies readonly BusinessTypeOption[]

function onboardingDraftStorageKey(userId: string) {
  return `${legacyDraftStorageKey}:${userId}`
}

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
  const [businessName, setBusinessName] = useState(
    state.fields?.businessName ?? initialFields.businessName ?? ""
  )
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
      if (fields.businessName !== undefined) {
        setBusinessName(fields.businessName)
      }

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
        if (draft.businessName) setBusinessName(draft.businessName)
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
      <OnboardingField
        id="businessName"
        label="Business name"
        name="businessName"
        required
        value={businessName}
        onChange={(event) => {
          setBusinessName(event.target.value)
          updateDraft({ businessName: event.target.value })
        }}
        error={state.errors?.businessName}
      />
      <BusinessTypeField
        value={state.fields?.businessType}
        options={businessTypeOptions}
        error={state.errors?.businessType}
        onChange={(value) => updateDraft({ businessType: value })}
      />

      <VenuePlaceAutocomplete
        onPlaceSelected={handlePlaceSelected}
        apiKey={googleMapsApiKey}
      />

      <VenueAddressFields
        values={address}
        errors={state.errors}
        columns={2}
        requireAddress
        labelClassName="eyebrow"
        inputClassName={onboardingInputClassName}
        onFieldChange={handleFieldChange}
        onAddressChange={handleAddressEdit}
      />

      <VenueProviderProvenanceFields provenance={provenance} />

      <input type="hidden" name="geofenceRadiusMeters" value="150" />
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

      <input
        type="hidden"
        name="locationName"
        value={locationName || businessName}
      />
      {state.errors?.locationName ? (
        <OnboardingFormError>{state.errors.locationName}</OnboardingFormError>
      ) : null}
      <OnboardingField
        id="phone"
        label="Phone number"
        name="phone"
        type="tel"
        autoComplete="tel"
        defaultValue={state.fields?.phone}
        onChange={(event) => updateDraft({ phone: event.target.value })}
      />
      {state.errors?.form ? (
        <OnboardingFormError>{state.errors.form}</OnboardingFormError>
      ) : null}
      <Button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="w-full"
      >
        {pending ? "Saving…" : "Finish setup"}
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
  if (
    !value ||
    !(field instanceof HTMLInputElement || field instanceof HTMLSelectElement)
  ) {
    return
  }

  field.value = value
}
