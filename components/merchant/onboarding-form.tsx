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
import { FormActionBar } from "@/components/merchant/launch/form-action-bar"
import { VenueAddressFields } from "@/components/merchant/venue-address-fields"
import {
  MANUAL_VENUE_PROVENANCE,
  VenueProviderProvenanceFields,
  type ProviderProvenance,
} from "@/components/merchant/venue-provider-provenance-fields"
import { SubmitButton } from "@/components/forms"
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
type ClientErrors = NonNullable<OnboardingActionState["errors"]>
type RequiredFieldName = Extract<
  keyof ClientErrors,
  | "businessName"
  | "businessType"
  | "addressLine1"
  | "addressCity"
  | "addressPostcode"
>

/**
 * The five server-required fields, in DOM order. One list drives blur-time
 * validation, the submit sweep, the focus target and the error summary, so the
 * three can never drift apart.
 */
const REQUIRED_FIELDS: readonly {
  readonly name: RequiredFieldName
  readonly label: string
  readonly message: string
}[] = [
  {
    name: "businessName",
    label: "Venue name",
    message: "Enter the venue name.",
  },
  {
    name: "businessType",
    label: "Business type",
    message: "Choose a business type.",
  },
  {
    name: "addressLine1",
    label: "Address line 1",
    message: "Enter the first line of the address.",
  },
  {
    name: "addressCity",
    label: "Town or city",
    message: "Enter the town or city.",
  },
  {
    name: "addressPostcode",
    label: "Postcode",
    message: "Enter the postcode.",
  },
]

function isRequiredFieldName(name: string): name is RequiredFieldName {
  return REQUIRED_FIELDS.some((field) => field.name === name)
}

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
  const draftStorageKey = onboardingDraftStorageKey(draftUserId)
  const hasInitialFields = Object.values(initialFields).some(Boolean)
  const [state, action] = useActionState(
    completeOnboardingAction,
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
  const invalidFields = REQUIRED_FIELDS.filter((field) => errors[field.name])
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
    let draft: Partial<OnboardingDraft> = {}

    try {
      const savedDraft = window.localStorage.getItem(draftStorageKey)
      draft = savedDraft
        ? (JSON.parse(savedDraft) as Partial<OnboardingDraft>)
        : {}
    } catch {
      window.localStorage.removeItem(draftStorageKey)
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
  }, [draftStorageKey, initialFields, state.fields])

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

  /** Blur-time check for one required field; the submit sweep stays the backstop. */
  function validateRequiredField(name: RequiredFieldName, value: string) {
    const field = REQUIRED_FIELDS.find((entry) => entry.name === name)
    if (!field) return

    setClientErrors((current) => {
      const next = { ...current }

      if (value.trim()) {
        delete next[name]
      } else {
        next[name] = field.message
      }

      return next
    })
  }

  function clearClientError(name: string) {
    if (!isRequiredFieldName(name)) return

    setClientErrors((current) => {
      if (!current[name]) return current

      const next = { ...current }
      delete next[name]
      return next
    })
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
    if (value.trim()) clearClientError(field)
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
      onBlur={(event) => {
        // Blur-time validation for the required fields: the merchant learns a
        // field is empty as they leave it, not after a full-form submit throws
        // them back up the page behind a phone keyboard.
        const target = event.target
        if (!(
          target instanceof HTMLInputElement ||
          target instanceof HTMLSelectElement
        )) {
          return
        }
        if (!isRequiredFieldName(target.name)) return

        validateRequiredField(target.name, target.value)
      }}
      onSubmit={(event) => {
        const formData = new FormData(event.currentTarget)
        const readField = (key: string) =>
          (formData.get(key)?.toString() ?? "").trim()
        const nextErrors: ClientErrors = {}
        for (const field of REQUIRED_FIELDS) {
          if (!readField(field.name)) nextErrors[field.name] = field.message
        }

        if (Object.keys(nextErrors).length) {
          event.preventDefault()
          setClientErrors(nextErrors)
          setValidationAttempt((attempt) => attempt + 1)
          const firstInvalid = REQUIRED_FIELDS.find(
            (field) => nextErrors[field.name]
          )
          document.getElementById(firstInvalid?.name ?? "businessName")?.focus()
          return
        }
        setClientErrors({})
      }}
      className={cn("surface-card grid gap-4 p-6", className)}
    >
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
          if (event.target.value.trim()) clearClientError("businessName")
        }}
        error={errors.businessName}
      />
      <BusinessTypeField
        value={state.fields?.businessType}
        options={businessTypeOptions}
        error={errors.businessType}
        onChange={(value) => {
          updateDraft({ businessType: value })
          if (value.trim()) clearClientError("businessType")
        }}
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
      {/* A summary above the commit, so the merchant sees every outstanding
          field at once and can jump straight to one instead of being thrown
          back up the form a field at a time. */}
      {invalidFields.length > 0 && (validationAttempt > 0 || state.errors) ? (
        <div
          key={validationAttempt}
          role="alert"
          className="grid gap-2 rounded-lg border-2 border-destructive/40 bg-destructive/10 px-3 py-2.5"
        >
          <p className="text-sm font-extrabold text-destructive">
            Check {invalidFields.length}{" "}
            {invalidFields.length === 1 ? "field" : "fields"} before finishing
            setup.
          </p>
          <ul className="grid">
            {invalidFields.map((field) => (
              <li key={field.name}>
                <a
                  href={`#${field.name}`}
                  onClick={() => {
                    document.getElementById(field.name)?.focus()
                  }}
                  className="focus-ring inline-flex min-h-11 items-center rounded-lg text-sm text-destructive underline underline-offset-2"
                >
                  {field.label} — {errors[field.name]}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <FormActionBar className="-mx-6 px-6 sm:px-0" offset="safe-area">
        <SubmitButton className="w-full" pendingLabel="Saving…">
          Finish setup
        </SubmitButton>
      </FormActionBar>
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
