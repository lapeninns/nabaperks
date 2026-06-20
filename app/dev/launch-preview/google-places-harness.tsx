"use client"

import { useState } from "react"

import { VenueLocationForm } from "@/components/merchant/launch/venue-location-form"

// Dev-only proof harness for the Google Places venue autocomplete. It installs a
// fake `window.google.maps.importLibrary` BEFORE the widget mounts, so the agent
// browser proof exercises the full select → fill flow with no Google network
// call and no real API key. Never imported by production routes.

const PREVIEW_API_KEY = "preview-google-key"

const FAKE_PLACE = {
  id: "ChIJpreviewOldCrownGirton",
  displayName: "Old Crown",
  formattedAddress: "High Street, Girton, Cambridge CB3 0QH, UK",
  addressComponents: [
    { longText: "High Street", shortText: "High Street", types: ["route"] },
    { longText: "Girton", shortText: "Girton", types: ["postal_town"] },
    { longText: "CB3 0QH", shortText: "CB3 0QH", types: ["postal_code"] },
  ],
  location: { lat: () => 52.2425913, lng: () => 0.0814946 },
  fetchFields: async () => {},
}

type FakeWindow = {
  google?: {
    maps?: { importLibrary?: (name: string) => Promise<unknown> }
  }
  __nabaperksPreviewAutocomplete?: HTMLElement
}

function installFakeGoogle() {
  if (typeof window === "undefined") return
  const fakeWindow = window as unknown as FakeWindow
  if (fakeWindow.google?.maps?.importLibrary) return

  fakeWindow.google = {
    maps: {
      importLibrary: async (name: string) => {
        if (name !== "places") return {}
        return {
          PlaceAutocompleteElement: function PlaceAutocompleteElement() {
            const element = document.createElement("div")
            element.setAttribute("role", "combobox")
            element.setAttribute("data-fake-place-autocomplete", "true")
            const input = document.createElement("input")
            input.setAttribute("type", "search")
            input.setAttribute("placeholder", "Search for your venue")
            input.className =
              "h-11 w-full rounded-lg border-2 border-ink bg-background px-3 text-sm"
            element.append(input)
            fakeWindow.__nabaperksPreviewAutocomplete = element
            return element
          },
        }
      },
    },
  }
}

export function GooglePlacesVenuePreview({
  apiKeyConfigured = true,
}: {
  apiKeyConfigured?: boolean
}) {
  // Lazy initializer runs once during this parent render, before the child
  // widget's mount effect — so the fake importLibrary is ready when it loads.
  useState(() => {
    if (apiKeyConfigured) installFakeGoogle()
    return null
  })

  function simulateSelection() {
    const fakeWindow = window as unknown as FakeWindow
    const element = fakeWindow.__nabaperksPreviewAutocomplete
    if (!element) return
    const event = new Event("gmp-select") as Event & {
      placePrediction?: { toPlace: () => typeof FAKE_PLACE }
    }
    event.placePrediction = { toPlace: () => FAKE_PLACE }
    element.dispatchEvent(event)
  }

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
          onClick={simulateSelection}
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
        // An explicit empty string forces the widget's no-key path even when a
        // local .env.local key exists, so the fallback scenario is deterministic.
        googleMapsApiKey={apiKeyConfigured ? PREVIEW_API_KEY : ""}
      />
    </div>
  )
}
