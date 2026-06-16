import { redirect } from "next/navigation"

import { VenueLocationForm } from "@/components/merchant/launch/venue-location-form"
import { getCurrentVenueLocation } from "@/lib/merchant/location"

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
          address: location?.address ?? "",
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
