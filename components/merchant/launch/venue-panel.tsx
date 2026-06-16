import { redirect } from "next/navigation"

import { VenueLocationForm } from "@/components/merchant/launch/venue-location-form"
import { getCurrentVenueLocation } from "@/lib/merchant/location"
import { venueAddressFieldsFromLocation } from "@/lib/merchant/venue-address"

export async function VenuePanel() {
  const { merchant, location } = await getCurrentVenueLocation()

  if (!merchant) {
    redirect("/app/onboarding")
  }

  return (
    <div className="grid max-w-2xl gap-4">
      <VenueLocationForm
        initialValues={{
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
        }}
        geocoded={
          location?.geocoded_at
            ? { latitude: location.latitude, longitude: location.longitude }
            : null
        }
      />
    </div>
  )
}
