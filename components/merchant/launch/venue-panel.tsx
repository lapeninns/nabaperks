import { redirect } from "next/navigation"

import { VenueLocationForm } from "@/components/merchant/launch/venue-location-form"
import type { ProviderProvenance } from "@/components/merchant/venue-provider-provenance-fields"
import { getCurrentVenueLocation } from "@/lib/merchant/location"
import { venueAddressFieldsFromLocation } from "@/lib/merchant/venue-address"

type CurrentVenueLocation = Awaited<
  ReturnType<typeof getCurrentVenueLocation>
>["location"]

export async function VenuePanel() {
  const { merchant, location } = await getCurrentVenueLocation()

  if (!merchant) {
    redirect("/app/onboarding")
  }

  return (
    <div className="grid gap-4">
      <VenueLocationForm
        initialValues={initialVenueFormValues(location)}
        geocoded={geocodedCoordinates(location)}
        pinSource={venuePinSource(location)}
        initialProvenance={venueProviderProvenance(location)}
      />
    </div>
  )
}

function initialVenueFormValues(location: CurrentVenueLocation) {
  return {
    venueName: location?.name ?? "Main venue",
    ...venueAddressFieldsFromLocation({
      address: location?.address ?? null,
      address_line_1: location?.address_line_1,
      address_line_2: location?.address_line_2,
      address_city: location?.address_city,
      address_postcode: location?.address_postcode,
    }),
    geofenceRadiusMeters: String(location?.geofence_radius_meters ?? 150),
    requireGeofence: location?.require_geofence ?? false,
    softGeofenceTriggerStamp: String(
      location?.soft_geofence_trigger_stamp_number ?? 3
    ),
  }
}

function geocodedCoordinates(location: CurrentVenueLocation) {
  if (location?.latitude == null || location.longitude == null) {
    return null
  }

  return { latitude: location.latitude, longitude: location.longitude }
}

function venuePinSource(location: CurrentVenueLocation) {
  return location?.geofence_pin_source === "merchant_pin"
    ? "merchant_pin"
    : "geocoded"
}

function venueProviderProvenance(
  location: CurrentVenueLocation
): ProviderProvenance | undefined {
  if (
    location?.address_source !== "provider_lookup" ||
    location.address_provider !== "google_places" ||
    !location.address_provider_id
  ) {
    return undefined
  }

  return {
    source: "provider_lookup",
    provider: "google_places",
    id: location.address_provider_id,
    latitude: location.latitude == null ? "" : String(location.latitude),
    longitude: location.longitude == null ? "" : String(location.longitude),
  }
}
