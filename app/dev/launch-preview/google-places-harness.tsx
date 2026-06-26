"use client"

import { useState } from "react"

import {
  PREVIEW_GOOGLE_MAPS_API_KEY,
  installFakeGoogleMapsForPreview,
  simulateFakeGooglePlaceSelection,
} from "@/app/dev/google-places/fake-google"
import { VenueLocationForm } from "@/components/merchant/launch/venue-location-form"

export function GooglePlacesVenuePreview({
  apiKeyConfigured = true,
}: {
  apiKeyConfigured?: boolean
}) {
  useState(() => {
    if (apiKeyConfigured) installFakeGoogleMapsForPreview()
    return null
  })

  return (
    <div
      className="mx-auto grid max-w-2xl gap-4 p-6"
      data-testid="google-places-venue-preview"
      data-api-key-configured={String(apiKeyConfigured)}
    >
      {apiKeyConfigured ? (
        <button
          type="button"
          data-testid="simulate-place-selection"
          onClick={simulateFakeGooglePlaceSelection}
          className="w-fit rounded-lg border-2 border-ink bg-secondary px-3 py-2 text-sm font-bold"
        >
          Simulate Google selection
        </button>
      ) : null}
      <VenueLocationForm
        initialValues={{
          venueName: "",
          addressLine1: "",
          addressLine2: "",
          addressCity: "",
          addressPostcode: "",
          geofenceRadiusMeters: "100",
          requireGeofence: false,
        }}
        googleMapsApiKey={apiKeyConfigured ? PREVIEW_GOOGLE_MAPS_API_KEY : ""}
      />
    </div>
  )
}
