"use client"

import { useState } from "react"

import {
  PREVIEW_GOOGLE_MAPS_API_KEY,
  installFakeGoogleMapsForPreview,
  simulateFakeGooglePlaceSelection,
} from "@/app/dev/google-places/fake-google"
import { OnboardingForm } from "@/components/merchant/onboarding-form"

export function GooglePlacesOnboardingPreview({
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
      className="grid gap-4"
      data-testid="google-places-onboarding-preview"
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
      <OnboardingForm
        googleMapsApiKey={apiKeyConfigured ? PREVIEW_GOOGLE_MAPS_API_KEY : ""}
      />
    </div>
  )
}
