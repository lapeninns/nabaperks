import { redirect } from "next/navigation"

import { MonoTag, ReceiptCard, SectionHeader } from "@/components/brand"
import { StatusBanner } from "@/components/loyalty/status-banner"
import { VenueLocationForm } from "@/components/merchant/launch/venue-location-form"
import { getCurrentVenueLocation } from "@/lib/merchant/location"

export async function VenuePanel() {
  const { merchant, location } = await getCurrentVenueLocation()

  if (!merchant) {
    redirect("/app/onboarding")
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <VenueLocationForm
        initialValues={{
          venueName: location?.name ?? "Main venue",
          address: location?.address ?? "",
          geofenceRadiusMeters: String(
            location?.geofence_radius_meters ?? 150
          ),
          requireGeofence: location?.require_geofence ?? false,
        }}
      />
      <ReceiptCard className="grid content-start gap-4 p-6">
        <SectionHeader
          eyebrow="Self-service checks"
          title="GPS stays soft"
          description="A stamp or redemption still completes if location is denied, unavailable, or outside the radius. Nabaperks records a review flag instead."
          actions={
            <MonoTag tone={location?.require_geofence ? "sun" : "plain"}>
              {location?.require_geofence ? "GPS review on" : "GPS review off"}
            </MonoTag>
          }
        />
        {location?.geocoded_at ? (
          <StatusBanner tone="success" title="Address geocoded.">
            Latitude {location.latitude}, longitude {location.longitude}.
          </StatusBanner>
        ) : (
          <StatusBanner tone="warning" title="Address not geocoded yet.">
            Save the venue address before printing the QR pack.
          </StatusBanner>
        )}
      </ReceiptCard>
    </div>
  )
}
