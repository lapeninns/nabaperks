"use client"

import { useEffect, useRef, useState } from "react"

import {
  mapGoogleAddressComponents,
  type GoogleAddressComponent,
  type VenueAddressFormFields,
} from "@/lib/merchant/venue-address"

/** A validated-on-the-client Google Places selection handed to the venue form. */
export type VenuePlaceSelection = {
  placeId: string
  displayName: string
  fields: VenueAddressFormFields
  latitude: number
  longitude: number
}

// Only the fields the venue form needs, per Places API (New) billing guidance.
const REQUIRED_PLACE_FIELDS = [
  "id",
  "displayName",
  "formattedAddress",
  "addressComponents",
  "location",
] as const

// idle states the merchant can see; the form keeps manual entry usable in all of
// them, so a missing key or a load failure never blocks venue setup.
type WidgetStatus = "unconfigured" | "loading" | "ready" | "error"

type GooglePlaceLocation =
  | { lat: () => number; lng: () => number }
  | { lat: number; lng: number }

type GooglePlaceComponent = {
  longText?: string | null
  shortText?: string | null
  types?: string[]
}

type GooglePlace = {
  id?: string
  displayName?: string | { text?: string } | null
  formattedAddress?: string | null
  addressComponents?: GooglePlaceComponent[] | null
  location?: GooglePlaceLocation | null
  fetchFields: (options: { fields: string[] }) => Promise<unknown>
}

type GmpSelectEvent = Event & {
  placePrediction?: { toPlace: () => GooglePlace } | null
  place?: GooglePlace | null
}

type PlaceAutocompleteElementConstructor = new (options: {
  includedRegionCodes?: string[]
  includedPrimaryTypes?: string[]
}) => HTMLElement

type PlacesLibrary = {
  PlaceAutocompleteElement: PlaceAutocompleteElementConstructor
}

type GoogleMaps = {
  importLibrary: (name: string) => Promise<unknown>
}

declare global {
  interface Window {
    google?: { maps?: GoogleMaps }
  }
}

const MAPS_CALLBACK = "__nabaperksGoogleMapsReady"
let mapsLoaderPromise: Promise<GoogleMaps> | null = null

/**
 * Inline dynamic loader for the Maps JavaScript API `places` library. Loads the
 * script only when a public key exists, reuses a single in-flight promise, and
 * resolves immediately when `importLibrary` is already present (which is how the
 * preview/Playwright mock injects a fake Google without any network call).
 */
function loadGoogleMaps(apiKey: string): Promise<GoogleMaps> {
  if (typeof window === "undefined") {
    return Promise.reject(
      new Error("Google Maps can only load in the browser.")
    )
  }

  const existing = window.google?.maps
  if (existing?.importLibrary) return Promise.resolve(existing)
  if (mapsLoaderPromise) return mapsLoaderPromise

  mapsLoaderPromise = new Promise<GoogleMaps>((resolve, reject) => {
    const settle = () => {
      const maps = window.google?.maps
      if (maps?.importLibrary) resolve(maps)
      else reject(new Error("Google Maps loaded without importLibrary."))
    }

    ;(window as unknown as Record<string, unknown>)[MAPS_CALLBACK] = settle

    const params = new URLSearchParams({
      key: apiKey,
      v: "weekly",
      libraries: "places",
      loading: "async",
      callback: MAPS_CALLBACK,
    })
    const script = document.createElement("script")
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`
    script.async = true
    script.onerror = () => {
      mapsLoaderPromise = null
      reject(new Error("Google Maps script failed to load."))
    }
    document.head.append(script)
  })

  return mapsLoaderPromise
}

function readLocation(
  location: GooglePlaceLocation | null | undefined
): { latitude: number; longitude: number } | null {
  if (!location) return null
  const rawLat = location.lat
  const rawLng = location.lng
  const latitude = typeof rawLat === "function" ? rawLat() : rawLat
  const longitude = typeof rawLng === "function" ? rawLng() : rawLng
  if (typeof latitude !== "number" || typeof longitude !== "number") return null
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  return { latitude, longitude }
}

function readDisplayName(displayName: GooglePlace["displayName"]): string {
  if (typeof displayName === "string") return displayName
  if (displayName && typeof displayName.text === "string")
    return displayName.text
  return ""
}

function toAddressComponents(
  components: GooglePlaceComponent[] | null | undefined
): GoogleAddressComponent[] {
  if (!Array.isArray(components)) return []
  return components.map((component) => ({
    longText: component.longText ?? null,
    shortText: component.shortText ?? null,
    types: Array.isArray(component.types) ? component.types : [],
  }))
}

function toVenuePlaceSelection(place: GooglePlace): VenuePlaceSelection | null {
  const coordinates = readLocation(place.location)
  if (!coordinates) return null
  const placeId = typeof place.id === "string" ? place.id.trim() : ""
  if (!placeId) return null

  return {
    placeId,
    displayName: readDisplayName(place.displayName),
    fields: mapGoogleAddressComponents(
      toAddressComponents(place.addressComponents)
    ),
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
  }
}

/**
 * Client-only Google Places (New) venue search for the merchant Launch venue
 * step. When `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is absent the component renders
 * nothing and the manual address fields below it stay fully usable. A load or
 * selection failure is caught and surfaced as a quiet hint, never thrown.
 */
export function VenuePlaceAutocomplete({
  onPlaceSelected,
  apiKey: apiKeyOverride,
}: {
  onPlaceSelected: (selection: VenuePlaceSelection) => void
  /** Optional key injection for the dev preview harness. Production callers omit
   *  it so the public env var is the single source of truth. */
  apiKey?: string
}) {
  const apiKey = apiKeyOverride ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const containerRef = useRef<HTMLDivElement | null>(null)
  const onSelectedRef = useRef(onPlaceSelected)
  const [status, setStatus] = useState<WidgetStatus>(
    apiKey ? "loading" : "unconfigured"
  )

  useEffect(() => {
    onSelectedRef.current = onPlaceSelected
  }, [onPlaceSelected])

  useEffect(() => {
    if (!apiKey) return
    let cancelled = false
    let detach = () => {}

    const handleSelect = (event: Event) => {
      const selectEvent = event as GmpSelectEvent
      void resolveSelection(selectEvent)
    }

    async function resolveSelection(selectEvent: GmpSelectEvent) {
      try {
        const place =
          selectEvent.placePrediction?.toPlace() ?? selectEvent.place ?? null
        if (!place) return
        await place.fetchFields({ fields: [...REQUIRED_PLACE_FIELDS] })
        const selection = toVenuePlaceSelection(place)
        if (selection) onSelectedRef.current(selection)
      } catch {
        // A failed selection must not break the form; manual entry remains.
      }
    }

    async function mount(key: string) {
      try {
        const maps = await loadGoogleMaps(key)
        const library = (await maps.importLibrary("places")) as PlacesLibrary
        const container = containerRef.current
        if (cancelled || !container) return

        const element = new library.PlaceAutocompleteElement({
          includedRegionCodes: ["gb"],
          includedPrimaryTypes: ["establishment"],
        })
        element.classList.add("w-full")
        element.setAttribute("placeholder", "Search for your venue")
        container.replaceChildren(element)
        element.addEventListener("gmp-select", handleSelect)
        detach = () => element.removeEventListener("gmp-select", handleSelect)
        setStatus("ready")
      } catch {
        if (!cancelled) setStatus("error")
      }
    }

    void mount(apiKey)

    return () => {
      cancelled = true
      detach()
    }
  }, [apiKey])

  // Unconfigured: render nothing so the manual address fields below stand alone.
  if (!apiKey) return null

  return (
    <div className="grid gap-2">
      <span className="text-sm font-bold">Find your venue</span>
      <div
        ref={containerRef}
        data-testid="venue-place-autocomplete"
        data-status={status}
        className="min-h-11"
      />
      {status === "loading" ? (
        <p className="text-xs leading-5 text-muted-foreground">
          Loading venue search…
        </p>
      ) : null}
      {status === "ready" ? (
        <p className="text-xs leading-5 text-muted-foreground">
          Search Google for your venue, or enter the address below.
        </p>
      ) : null}
      {status === "error" ? (
        <p className="text-xs leading-5 text-muted-foreground">
          Venue search is unavailable right now. Enter your address below.
        </p>
      ) : null}
    </div>
  )
}
