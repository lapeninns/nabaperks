"use client"

import { useActionState, useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import {
  saveVenueLocationAction,
  type VenueLocationActionState,
} from "@/app/app/launch/actions"
import { VenueAddressFields } from "@/components/merchant/venue-address-fields"
import {
  AdvancedGpsChecks,
  type VenueCoordinates,
} from "@/components/merchant/launch/advanced-gps-checks"
import {
  VenuePlaceAutocomplete,
  type VenuePlaceSelection,
} from "@/components/merchant/launch/venue-place-autocomplete"
import { PageTitle } from "@/components/brand"
import { SubmitButton } from "@/components/forms"
import { StatusBanner } from "@/components/loyalty/status-banner"
import type {
  GeofencePinSource,
  VenueAddressFormFields,
} from "@/lib/merchant/venue-address"

type VenueLocationFormValues = VenueAddressFormFields & {
  geofenceRadiusMeters: string
  requireGeofence: boolean
  /** Optional so callers that never expose the knob (dev harness) keep the 3 default. */
  softGeofenceTriggerStamp?: string
}

import {
  MANUAL_VENUE_PROVENANCE,
  VenueProviderProvenanceFields,
  type ProviderProvenance,
} from "@/components/merchant/venue-provider-provenance-fields"

const initialState: VenueLocationActionState = {}

export function VenueLocationForm({
  initialValues,
  geocoded,
  pinSource,
  initialProvenance,
  googleMapsApiKey,
}: {
  initialValues: VenueLocationFormValues
  /** Saved coordinates — drive the pin map and the quiet confirmation line. */
  geocoded?: { latitude: number | null; longitude: number | null } | null
  /** Saved coordinate provenance; seeds the hidden source field. */
  pinSource?: GeofencePinSource
  initialProvenance?: ProviderProvenance
  /** Dev-preview-only key injection; production uses the public env var. */
  googleMapsApiKey?: string
}) {
  const [state, action] = useActionState(saveVenueLocationAction, initialState)
  const router = useRouter()

  useEffect(() => {
    if (!state.saved) return
    router.refresh()
  }, [router, state.saved])

  const [geofenceRadiusMeters, setGeofenceRadiusMeters] = useState(
    initialValues.geofenceRadiusMeters
  )
  const [requireGeofence, setRequireGeofence] = useState(
    initialValues.requireGeofence
  )
  const [softGeofenceTriggerStamp, setSoftGeofenceTriggerStamp] = useState(
    initialValues.softGeofenceTriggerStamp ?? "3"
  )

  // Controlled address fields so a Google selection can fill them through state.
  const [address, setAddress] = useState<VenueAddressFormFields>({
    addressLine1: initialValues.addressLine1,
    addressLine2: initialValues.addressLine2,
    addressCity: initialValues.addressCity,
    addressPostcode: initialValues.addressPostcode,
  })
  const [provenance, setProvenance] = useState<ProviderProvenance>(
    initialProvenance ?? MANUAL_VENUE_PROVENANCE
  )

  const savedCoordinates: VenueCoordinates | null =
    geocoded?.latitude != null && geocoded?.longitude != null
      ? { latitude: geocoded.latitude, longitude: geocoded.longitude }
      : null
  const [pin, setPin] = useState(savedCoordinates)
  const [pendingPinSource, setPendingPinSource] = useState<GeofencePinSource>(
    pinSource ?? "geocoded"
  )

  const hasGeocode = geocoded?.latitude != null && geocoded?.longitude != null
  const parsedRadius = Number.parseInt(geofenceRadiusMeters, 10)
  const mapRadiusMeters =
    Number.isFinite(parsedRadius) && parsedRadius > 0 ? parsedRadius : 100

  // A manual address edit can no longer be trusted as a provider selection, so
  // drop provider provenance and reset the pin source back to geocoded.
  function handleAddressEdit() {
    setProvenance(MANUAL_VENUE_PROVENANCE)
    setPendingPinSource("geocoded")
  }

  function handleFieldChange(
    field: keyof VenueAddressFormFields,
    value: string
  ) {
    setAddress((previous) => ({ ...previous, [field]: value }))
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
    setPin({ latitude: selection.latitude, longitude: selection.longitude })
    setPendingPinSource("geocoded")
  }

  return (
    <form action={action} className="surface-card grid gap-5 p-6">
      <PageTitle
        headingLevel={2}
        eyebrow="Venue location"
        title="Review your address"
        description="Check the address customers visit. Your printed QR never changes; GPS is an optional soft check that only flags an odd stamp for review, never blocks one."
        titleClassName="sm:text-3xl"
      />

      {state.saved ? (
        <StatusBanner tone="success" title="Venue location saved.">
          Your QR and stamp checks now use this address.
        </StatusBanner>
      ) : null}

      <VenuePlaceAutocomplete
        onPlaceSelected={handlePlaceSelected}
        apiKey={googleMapsApiKey}
      />

      <VenueAddressFields
        values={address}
        errors={state.errors}
        columns={2}
        onFieldChange={handleFieldChange}
        onAddressChange={handleAddressEdit}
      />

      <VenueProviderProvenanceFields provenance={provenance} />

      <input type="hidden" name="venueLatitude" value={pin?.latitude ?? ""} />
      <input type="hidden" name="venueLongitude" value={pin?.longitude ?? ""} />
      <input type="hidden" name="geofencePinSource" value={pendingPinSource} />

      <AdvancedGpsChecks
        requireGeofence={requireGeofence}
        geofenceRadiusMeters={geofenceRadiusMeters}
        geofenceRadiusError={state.errors?.geofenceRadiusMeters}
        softGeofenceTriggerStamp={softGeofenceTriggerStamp}
        softGeofenceTriggerStampError={state.errors?.softGeofenceTriggerStamp}
        pin={pin}
        geocoded={geocoded}
        hasGeocode={hasGeocode}
        mapRadiusMeters={mapRadiusMeters}
        onRequireGeofenceChange={setRequireGeofence}
        onRadiusChange={setGeofenceRadiusMeters}
        onTriggerStampChange={setSoftGeofenceTriggerStamp}
        onPinChange={(coordinates) => {
          setPin(coordinates)
          setPendingPinSource("merchant_pin")
        }}
      />

      {state.errors?.form ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.errors.form}
        </p>
      ) : null}

      <SubmitButton pendingLabel="Saving venue…" className="w-full">
        Save venue details
      </SubmitButton>
    </form>
  )
}
