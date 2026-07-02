"use client"

import { useActionState, useState } from "react"

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
import { Eyebrow, PageTitle } from "@/components/brand"
import { FormField, SubmitButton } from "@/components/forms"
import { StatusBanner } from "@/components/loyalty/status-banner"
import { Input } from "@/components/ui/input"
import { LaunchSaveNextAction } from "@/components/merchant/launch/launch-tab-auto-advance"
import type {
  GeofencePinSource,
  VenueAddressFormFields,
} from "@/lib/merchant/venue-address"

type VenueLocationFormValues = VenueAddressFormFields & {
  venueName: string
  geofenceRadiusMeters: string
  requireGeofence: boolean
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
  googleMapsApiKey,
}: {
  initialValues: VenueLocationFormValues
  /** Saved coordinates — drive the pin map and the quiet confirmation line. */
  geocoded?: { latitude: number | null; longitude: number | null } | null
  /** Saved coordinate provenance; seeds the hidden source field. */
  pinSource?: GeofencePinSource
  /** Dev-preview-only key injection; production uses the public env var. */
  googleMapsApiKey?: string
}) {
  const [state, action] = useActionState(
    saveVenueLocationAction,
    initialState
  )

  const [venueName, setVenueName] = useState(initialValues.venueName)
  const [geofenceRadiusMeters, setGeofenceRadiusMeters] = useState(
    initialValues.geofenceRadiusMeters
  )
  const [requireGeofence, setRequireGeofence] = useState(
    initialValues.requireGeofence
  )

  // Controlled address fields so a Google selection can fill them through state.
  const [address, setAddress] = useState<VenueAddressFormFields>({
    addressLine1: initialValues.addressLine1,
    addressLine2: initialValues.addressLine2,
    addressCity: initialValues.addressCity,
    addressPostcode: initialValues.addressPostcode,
  })
  const [provenance, setProvenance] = useState<ProviderProvenance>(
    MANUAL_VENUE_PROVENANCE
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
    if (selection.displayName) setVenueName(selection.displayName)
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
        eyebrow="Step 1 · Location"
        title="Where do scans happen?"
        description="Your printed QR never changes. GPS is an optional soft check. It never blocks a member's stamp, it only flags an odd one for review."
        titleClassName="sm:text-3xl"
      />

      {state.saved ? (
        <StatusBanner tone="success" title="Venue location saved.">
          Your QR and stamp checks now use this address.
          <LaunchSaveNextAction
            nextHref="/app/launch?tab=card"
            nextLabel="your card"
            stayHref="/app/launch?tab=venue"
          />
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

      {/* venueName normally travels hidden (set via Google place selection,
          defaulting to "Main venue"), but a server venueName error must never
          strand the merchant against an invisible field — surface an editable
          input whenever the error is present. */}
      {state.errors?.venueName ? (
        <FormField
          id="venueName"
          label={<Eyebrow>Venue name</Eyebrow>}
          error={state.errors.venueName}
        >
          <Input
            id="venueName"
            name="venueName"
            className="h-12 text-sm"
            value={venueName}
            onChange={(event) => setVenueName(event.target.value)}
          />
        </FormField>
      ) : (
        <input type="hidden" name="venueName" value={venueName} />
      )}

      <AdvancedGpsChecks
        requireGeofence={requireGeofence}
        geofenceRadiusMeters={geofenceRadiusMeters}
        geofenceRadiusError={state.errors?.geofenceRadiusMeters}
        pin={pin}
        geocoded={geocoded}
        hasGeocode={hasGeocode}
        mapRadiusMeters={mapRadiusMeters}
        onRequireGeofenceChange={setRequireGeofence}
        onRadiusChange={setGeofenceRadiusMeters}
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

      <SubmitButton pendingLabel="Saving location…" className="w-full">
        Save venue address
      </SubmitButton>
    </form>
  )
}
