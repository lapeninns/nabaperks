"use client"

import { useActionState, useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"

import {
  completeOnboardingAction,
  type OnboardingActionState,
} from "@/app/app/onboarding/actions"
import { Eyebrow } from "@/components/brand"
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
import {
  clearOnboardingDraft,
  readOnboardingDraft,
  saveOnboardingDraft,
  type OnboardingDraftFields,
} from "@/lib/merchant/onboarding-draft-storage"
import { cn } from "@/lib/utils"

const VenuePlaceAutocomplete = dynamic<VenuePlaceAutocompleteProps>(
  () =>
    import("@/components/merchant/launch/venue-place-autocomplete").then(
      (module) => module.VenuePlaceAutocomplete
    ),
  { ssr: false }
)

const initialState: OnboardingActionState = {}
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

type OnboardingDraft = OnboardingDraftFields
type ClientErrors = NonNullable<OnboardingActionState["errors"]>

export function mergeOnboardingDraft(
  serverFields: OnboardingDraft,
  draftFields: Partial<OnboardingDraft>
): OnboardingDraft {
  const value = (key: keyof OnboardingDraft) =>
    hasText(serverFields[key]) ? serverFields[key] : draftFields[key]

  return {
    businessName: value("businessName"),
    businessType: value("businessType"),
    phone: value("phone"),
    addressLine1: value("addressLine1"),
    addressLine2: value("addressLine2"),
    addressCity: value("addressCity"),
    addressPostcode: value("addressPostcode"),
  }
}

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
  const hasInitialFields = Object.values(initialFields).some(Boolean)
  const [state, action, pending] = useActionState(
    async (previousState: OnboardingActionState, formData: FormData) => {
      try {
        const nextState = await completeOnboardingAction(
          previousState,
          formData
        )
        if (!nextState.errors) {
          clearOnboardingDraft(window.localStorage, draftUserId)
        }
        return nextState
      } catch (error) {
        if (isNextRedirect(error)) {
          clearOnboardingDraft(window.localStorage, draftUserId)
        }
        throw error
      }
    },
    hasInitialFields ? { ...initialState, fields: initialFields } : initialState
  )
  const formRef = useRef<HTMLFormElement>(null)
  // Inline client validation mirrors the signup form: catch empty required
  // fields before the server round-trip, surface them in the app's styled
  // errors, and focus the first invalid field. Format/geocode checks still run
  // server-side, and server errors take precedence once they return.
  const [clientErrors, setClientErrors] = useState<ClientErrors>({})
  const [validationAttempt, setValidationAttempt] = useState(0)
  const errors = { ...clientErrors, ...(state.errors ?? {}) }
  const [businessName, setBusinessName] = useState(
    state.fields?.businessName ?? initialFields.businessName ?? ""
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
    if (!state.errors) return

    clearMerchantOnboardingCompletionPending(window.sessionStorage)

    const timeoutId = window.setTimeout(() => {
      // Move focus to the first invalid field after a failed submit so SR and
      // keyboard users land on the error instead of staying on the button.
      const firstInvalid = formRef.current?.querySelector<HTMLElement>(
        '[aria-invalid="true"]'
      )
      const focusTarget =
        firstInvalid ??
        formRef.current?.querySelector<HTMLElement>("#onboarding-form-error")
      focusTarget?.focus()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [state.errors])

  useEffect(() => {
    window.localStorage.removeItem(legacyDraftStorageKey)
  }, [])

  useEffect(() => {
    let draft: OnboardingDraft = {}

    try {
      draft = readOnboardingDraft(window.localStorage, draftUserId) ?? {}
    } catch (error) {
      if (error instanceof DOMException) return
      throw error
    }

    const form = formRef.current
    if (!form) return

    const merged = mergeOnboardingDraft(state.fields ?? initialFields, draft)
    setBusinessName(merged.businessName ?? "")
    restoreField(form, "businessType", merged.businessType)
    restoreField(form, "phone", merged.phone)
    setAddress({
      addressLine1: merged.addressLine1 ?? "",
      addressLine2: merged.addressLine2 ?? "",
      addressCity: merged.addressCity ?? "",
      addressPostcode: merged.addressPostcode ?? "",
    })
  }, [draftUserId, initialFields, state.fields])

  function updateDraft(partial: Partial<OnboardingDraft>) {
    try {
      const currentDraft =
        readOnboardingDraft(window.localStorage, draftUserId) ?? {}
      const nextDraft: OnboardingDraft = {
        ...initialFields,
        ...currentDraft,
        ...partial,
      }
      saveOnboardingDraft(window.localStorage, draftUserId, nextDraft)
    } catch (error) {
      if (error instanceof DOMException) return
      throw error
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
    updateDraft(selection.fields)
  }

  return (
    <form
      ref={formRef}
      action={action}
      noValidate
      onSubmit={(event) => {
        const formData = new FormData(event.currentTarget)
        const readField = (key: string) =>
          (formData.get(key)?.toString() ?? "").trim()
        const nextErrors: ClientErrors = {}
        if (!readField("businessName"))
          nextErrors.businessName = "Enter the venue name."
        if (!readField("businessType"))
          nextErrors.businessType = "Choose a business type."
        if (!readField("addressLine1"))
          nextErrors.addressLine1 = "Enter the first line of the address."
        if (!readField("addressCity"))
          nextErrors.addressCity = "Enter the town or city."
        if (!readField("addressPostcode"))
          nextErrors.addressPostcode = "Enter the postcode."

        if (Object.keys(nextErrors).length) {
          event.preventDefault()
          setClientErrors(nextErrors)
          setValidationAttempt((attempt) => attempt + 1)
          const firstInvalid = [
            "businessName",
            "businessType",
            "addressLine1",
            "addressCity",
            "addressPostcode",
          ].find((key) => nextErrors[key as keyof ClientErrors])
          document.getElementById(firstInvalid ?? "businessName")?.focus()
          return
        }
        setClientErrors({})
        markMerchantOnboardingCompletionPending(
          window.sessionStorage,
          draftUserId
        )
      }}
      className={cn("surface-card grid gap-4 p-6", className)}
    >
      {validationAttempt > 0 && Object.keys(clientErrors).length > 0 ? (
        <p key={validationAttempt} role="alert" className="sr-only">
          Check the highlighted fields. The first problem is focused below.
        </p>
      ) : null}
      <div className="grid gap-1">
        <Eyebrow>Your venue</Eyebrow>
        <p className="text-sm leading-6 text-muted-foreground">
          The name customers see on the loyalty card.
        </p>
      </div>
      <OnboardingField
        id="businessName"
        label="Venue name"
        name="businessName"
        required
        value={businessName}
        onChange={(event) => {
          setBusinessName(event.target.value)
          updateDraft({ businessName: event.target.value })
        }}
        error={errors.businessName}
      />
      <BusinessTypeField
        value={state.fields?.businessType}
        options={businessTypeOptions}
        error={errors.businessType}
        onChange={(value) => updateDraft({ businessType: value })}
      />
      <OnboardingField
        id="phone"
        label="Business phone"
        name="phone"
        type="tel"
        autoComplete="tel"
        defaultValue={state.fields?.phone}
        onChange={(event) => updateDraft({ phone: event.target.value })}
      />

      <hr className="w-rule" />
      <div className="grid gap-1">
        <Eyebrow>Where customers visit</Eyebrow>
        <p className="text-sm leading-6 text-muted-foreground">
          Where customers scan to collect stamps. Search to autofill the
          address, then check the details below.
        </p>
      </div>

      <VenuePlaceAutocomplete
        onPlaceSelected={handlePlaceSelected}
        apiKey={googleMapsApiKey}
      />

      <VenueAddressFields
        values={address}
        errors={errors}
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
      {errors.form ? (
        <OnboardingFormError>{errors.form}</OnboardingFormError>
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

function hasText(value: string | undefined) {
  return typeof value === "string" && value.trim().length > 0
}

function isNextRedirect(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false
  if (!("digest" in error)) return false
  const digest = error.digest
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")
}
