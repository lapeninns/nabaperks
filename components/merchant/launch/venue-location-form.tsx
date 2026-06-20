"use client"

import dynamic from "next/dynamic"
import { useActionState, useState, type InputHTMLAttributes } from "react"

import {
  saveVenueLocationAction,
  type VenueLocationActionState,
} from "@/app/app/launch/actions"
import { PageTitle } from "@/components/brand"
import { VenueAddressFields } from "@/components/merchant/venue-address-fields"
import { Disclosure } from "@/components/merchant/launch/disclosure"
import {
  VenuePlaceAutocomplete,
  type VenuePlaceSelection,
} from "@/components/merchant/launch/venue-place-autocomplete"
import { StatusBanner } from "@/components/loyalty/status-banner"
import { Button } from "@/components/ui/button"
import type {
  GeofencePinSource,
  VenueAddressFormFields,
} from "@/lib/merchant/venue-address"

// Client-only: Leaflet touches window/document and ships its own CSS, so the
// map must never render on the server (Next dynamic ssr:false from a Client
// Component).
const VenuePinMap = dynamic(() => import("./venue-pin-map"), {
  ssr: false,
  loading: () => (
    <div
      className="h-64 w-full rounded-lg border-2 border-dashed border-border bg-card"
      aria-hidden
    />
  ),
})

type VenueLocationFormValues = VenueAddressFormFields & {
  venueName: string
  geofenceRadiusMeters: string
  requireGeofence: boolean
}

// Address provenance the hidden fields submit. A fresh Google Places selection
// sets provider_lookup/google_places; any manual edit resets it to manual_entry
// so the server geocodes the typed address instead of trusting stale provider
// coordinates.
type ProviderProvenance = {
  source: "manual_entry" | "provider_lookup"
  provider: "" | "google_places"
  id: string
  latitude: string
  longitude: string
}

const MANUAL_PROVENANCE: ProviderProvenance = {
  source: "manual_entry",
  provider: "",
  id: "",
  latitude: "",
  longitude: "",
}

type VenueCoordinates = {
  latitude: number
  longitude: number
}

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
  const [state, action, pending] = useActionState(
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
  const [provenance, setProvenance] =
    useState<ProviderProvenance>(MANUAL_PROVENANCE)

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
    setProvenance(MANUAL_PROVENANCE)
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
        eyebrow="Step 3 · Venue"
        title="Where do scans happen?"
        description="Your printed QR never changes. GPS is an optional soft check. It never blocks a customer's stamp, it only flags an odd one for review."
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

      <ProviderProvenanceFields provenance={provenance} />

      <input type="hidden" name="venueLatitude" value={pin?.latitude ?? ""} />
      <input type="hidden" name="venueLongitude" value={pin?.longitude ?? ""} />
      <input type="hidden" name="geofencePinSource" value={pendingPinSource} />

      <Field
        id="venueName"
        label="Venue name"
        name="venueName"
        value={venueName}
        onChange={(event) => setVenueName(event.target.value)}
        error={state.errors?.venueName}
      />

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

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Saving location..." : "Save venue address"}
      </Button>
    </form>
  )
}

function ProviderProvenanceFields({
  provenance,
}: {
  provenance: ProviderProvenance
}) {
  return (
    <>
      <input type="hidden" name="addressSource" value={provenance.source} />
      <input type="hidden" name="addressProvider" value={provenance.provider} />
      <input type="hidden" name="addressProviderId" value={provenance.id} />
      <input
        type="hidden"
        name="providerLatitude"
        value={provenance.latitude}
      />
      <input
        type="hidden"
        name="providerLongitude"
        value={provenance.longitude}
      />
    </>
  )
}

function AdvancedGpsChecks({
  requireGeofence,
  geofenceRadiusMeters,
  geofenceRadiusError,
  pin,
  geocoded,
  hasGeocode,
  mapRadiusMeters,
  onRequireGeofenceChange,
  onRadiusChange,
  onPinChange,
}: {
  requireGeofence: boolean
  geofenceRadiusMeters: string
  geofenceRadiusError?: string
  pin: VenueCoordinates | null
  geocoded?: { latitude: number | null; longitude: number | null } | null
  hasGeocode: boolean
  mapRadiusMeters: number
  onRequireGeofenceChange: (checked: boolean) => void
  onRadiusChange: (value: string) => void
  onPinChange: (coordinates: VenueCoordinates) => void
}) {
  return (
    <Disclosure
      label="Advanced GPS checks"
      defaultOpen={requireGeofence || Boolean(geofenceRadiusError)}
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
          checked={requireGeofence}
          onChange={(event) => onRequireGeofenceChange(event.target.checked)}
          className="size-5 accent-primary"
        />
      </label>
      <Field
        id="geofenceRadiusMeters"
        label="Radius metres"
        name="geofenceRadiusMeters"
        inputMode="numeric"
        pattern="[0-9]*"
        value={geofenceRadiusMeters}
        onChange={(event) => onRadiusChange(event.target.value)}
        error={geofenceRadiusError}
      />
      <p className="text-xs leading-5 text-muted-foreground">
        100m suits most small, single-site venues. Set anything from 25m to
        1000m.
      </p>
      {requireGeofence && pin ? (
        <div className="grid gap-2">
          <VenuePinMap
            latitude={pin.latitude}
            longitude={pin.longitude}
            radiusMeters={mapRadiusMeters}
            onPinChange={onPinChange}
          />
          <p className="text-xs leading-5 text-muted-foreground">
            Drag the pin to your real entrance — the soft GPS check measures
            from this exact spot, not the postcode centre.
          </p>
        </div>
      ) : null}
      {hasGeocode ? (
        <p className="font-mono text-xs text-muted-foreground">
          Geocoded to {geocoded?.latitude}, {geocoded?.longitude}.
        </p>
      ) : null}
    </Disclosure>
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
