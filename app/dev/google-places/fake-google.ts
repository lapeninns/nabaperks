// Dev-only fake Google Maps loader for local browser proof. Never imported by
// production routes.

export const PREVIEW_GOOGLE_MAPS_API_KEY = "preview-google-key"

export const FAKE_GOOGLE_PLACE = {
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

export function installFakeGoogleMapsForPreview() {
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

export function simulateFakeGooglePlaceSelection() {
  const fakeWindow = window as unknown as FakeWindow
  const element = fakeWindow.__nabaperksPreviewAutocomplete
  if (!element) return

  const event = new Event("gmp-select") as Event & {
    placePrediction?: { toPlace: () => typeof FAKE_GOOGLE_PLACE }
  }
  event.placePrediction = { toPlace: () => FAKE_GOOGLE_PLACE }
  element.dispatchEvent(event)
}
