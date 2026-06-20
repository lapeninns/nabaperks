import { readFileSync } from "node:fs"
import { describe, expect, it, vi } from "vitest"

import { createSupabaseMock } from "../helpers/supabase"
import {
  formatVenueAddressDisplay,
  formatVenueAddressForGeocode,
  isUkPostcode,
  normalizeUkPostcode,
  toStructuredVenueAddress,
  validateVenueAddressFields,
} from "@/lib/merchant/venue-address"

const GEOCODE_ERROR =
  "We could not geocode this address. Check it and try again."

const sampleAddress = {
  addressLine1: "1 High Street",
  addressLine2: "Unit 2",
  addressCity: "London",
  addressPostcode: "e16an",
}

function form(values: Record<string, string | boolean>) {
  const data = new FormData()

  for (const [key, value] of Object.entries(values)) {
    data.set(key, value === true ? "on" : String(value))
  }

  return data
}

function readProjectFile(path: string) {
  return readFileSync(path, "utf8")
}

describe("structured venue address helpers", () => {
  it("normalises UK postcodes and validates them", () => {
    expect(normalizeUkPostcode("e16an")).toBe("E1 6AN")
    expect(isUkPostcode("SW1A 1AA")).toBe(true)
    expect(isUkPostcode("INVALID")).toBe(false)
  })

  it("requires line 1, city, and a valid postcode", () => {
    expect(validateVenueAddressFields(sampleAddress)).toEqual({})
    expect(
      validateVenueAddressFields({
        ...sampleAddress,
        addressLine1: "",
      })
    ).toMatchObject({
      addressLine1: "Enter the first line of the address.",
    })
    expect(
      validateVenueAddressFields({
        ...sampleAddress,
        addressPostcode: "NOPE",
      })
    ).toMatchObject({
      addressPostcode: "Enter a valid UK postcode.",
    })
  })

  it("formats structured addresses for display and geocoding", () => {
    const structured = toStructuredVenueAddress(sampleAddress)

    expect(structured.postcode).toBe("E1 6AN")
    expect(formatVenueAddressDisplay(structured)).toBe(
      "1 High Street, Unit 2, London, E1 6AN"
    )
    expect(formatVenueAddressForGeocode(structured)).toBe(
      "1 High Street, Unit 2, London, E1 6AN, United Kingdom"
    )
  })
})

describe("venue save action — structured address entry", () => {
  function mockMerchantAndCache() {
    vi.doMock("next/cache", () => ({ revalidatePath: vi.fn() }))
    vi.doMock("@/lib/auth/session", () => ({
      getCurrentMerchant: vi.fn(async () => ({ id: "merchant-1" })),
    }))
  }

  it("geocodes and saves structured venue address fields", async () => {
    vi.resetModules()
    const mock = createSupabaseMock({
      from: {
        merchant_locations: [
          { data: { id: "location-1" }, error: null },
          { data: null, error: null },
        ],
      },
    })
    mockMerchantAndCache()
    vi.doMock("@/lib/merchant/geocode", () => ({
      geocodeAddress: vi.fn(async () => ({
        latitude: 51.52,
        longitude: -0.07,
      })),
    }))
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: vi.fn(async () => mock.client),
    }))
    const { saveVenueLocationAction } = await import("@/app/app/launch/actions")

    await expect(
      saveVenueLocationAction(
        {},
        form({
          venueName: "Old Crown Girton",
          ...sampleAddress,
          geofenceRadiusMeters: "150",
        })
      )
    ).resolves.toMatchObject({ saved: true })

    expect(mock.queryCalls).toContainEqual({
      table: "merchant_locations",
      method: "update",
      args: [
        expect.objectContaining({
          address: "1 High Street, Unit 2, London, E1 6AN",
          address_line_1: "1 High Street",
          address_line_2: "Unit 2",
          address_city: "London",
          address_postcode: "E1 6AN",
          address_country: "GB",
          address_source: "manual_entry",
          latitude: 51.52,
          longitude: -0.07,
        }),
      ],
    })
  })

  it("rejects invalid structured address fields before geocoding", async () => {
    vi.resetModules()
    const createSupabaseServerClient = vi.fn()
    mockMerchantAndCache()
    vi.doMock("@/lib/merchant/geocode", () => ({
      geocodeAddress: vi.fn(async () => null),
    }))
    vi.doMock("@/lib/supabase/server", () => ({ createSupabaseServerClient }))
    const { saveVenueLocationAction } = await import("@/app/app/launch/actions")

    await expect(
      saveVenueLocationAction(
        {},
        form({
          venueName: "Old Crown Girton",
          addressLine1: "",
          addressLine2: "",
          addressCity: "",
          addressPostcode: "BAD",
          geofenceRadiusMeters: "150",
        })
      )
    ).resolves.toMatchObject({
      errors: {
        addressLine1: "Enter the first line of the address.",
        addressCity: "Enter the town or city.",
        addressPostcode: "Enter a valid UK postcode.",
      },
    })
    expect(createSupabaseServerClient).not.toHaveBeenCalled()
  })

  it("rejects a structured address that cannot be geocoded", async () => {
    vi.resetModules()
    const createSupabaseServerClient = vi.fn()
    mockMerchantAndCache()
    vi.doMock("@/lib/merchant/geocode", () => ({
      geocodeAddress: vi.fn(async () => null),
    }))
    vi.doMock("@/lib/supabase/server", () => ({ createSupabaseServerClient }))
    const { saveVenueLocationAction } = await import("@/app/app/launch/actions")

    await expect(
      saveVenueLocationAction(
        {},
        form({
          venueName: "Old Crown Girton",
          ...sampleAddress,
          geofenceRadiusMeters: "150",
        })
      )
    ).resolves.toMatchObject({ errors: { address: GEOCODE_ERROR } })
    expect(createSupabaseServerClient).not.toHaveBeenCalled()
  })

  it("persists a valid manual pin over the geocode result", async () => {
    vi.resetModules()
    const mock = createSupabaseMock({
      from: {
        merchant_locations: [
          { data: { id: "location-1" }, error: null },
          { data: null, error: null },
        ],
      },
    })
    mockMerchantAndCache()
    vi.doMock("@/lib/merchant/geocode", () => ({
      geocodeAddress: vi.fn(async () => ({
        latitude: 51.52,
        longitude: -0.07,
      })),
    }))
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: vi.fn(async () => mock.client),
    }))
    const { saveVenueLocationAction } = await import("@/app/app/launch/actions")

    await expect(
      saveVenueLocationAction(
        {},
        form({
          venueName: "Old Crown Girton",
          ...sampleAddress,
          geofenceRadiusMeters: "100",
          requireGeofence: true,
          geofencePinSource: "merchant_pin",
          venueLatitude: "52.2425913",
          venueLongitude: "0.0814946",
        })
      )
    ).resolves.toMatchObject({ saved: true })

    // The dragged pin wins over the postcode-centroid geocode, and provenance is
    // recorded separately from address_source.
    expect(mock.queryCalls).toContainEqual({
      table: "merchant_locations",
      method: "update",
      args: [
        expect.objectContaining({
          latitude: 52.2425913,
          longitude: 0.0814946,
          address_source: "manual_entry",
          geofence_pin_source: "merchant_pin",
        }),
      ],
    })
  })

  it("records a geocoded pin source when no manual pin is submitted", async () => {
    vi.resetModules()
    const mock = createSupabaseMock({
      from: {
        merchant_locations: [
          { data: { id: "location-1" }, error: null },
          { data: null, error: null },
        ],
      },
    })
    mockMerchantAndCache()
    vi.doMock("@/lib/merchant/geocode", () => ({
      geocodeAddress: vi.fn(async () => ({
        latitude: 51.52,
        longitude: -0.07,
      })),
    }))
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: vi.fn(async () => mock.client),
    }))
    const { saveVenueLocationAction } = await import("@/app/app/launch/actions")

    await expect(
      saveVenueLocationAction(
        {},
        form({
          venueName: "Old Crown Girton",
          ...sampleAddress,
          geofenceRadiusMeters: "150",
          geofencePinSource: "geocoded",
        })
      )
    ).resolves.toMatchObject({ saved: true })

    expect(mock.queryCalls).toContainEqual({
      table: "merchant_locations",
      method: "update",
      args: [
        expect.objectContaining({
          latitude: 51.52,
          longitude: -0.07,
          geofence_pin_source: "geocoded",
        }),
      ],
    })
  })

  it("rejects an out-of-range manual pin without writing", async () => {
    vi.resetModules()
    const createSupabaseServerClient = vi.fn()
    mockMerchantAndCache()
    vi.doMock("@/lib/merchant/geocode", () => ({
      geocodeAddress: vi.fn(async () => ({
        latitude: 51.52,
        longitude: -0.07,
      })),
    }))
    vi.doMock("@/lib/supabase/server", () => ({ createSupabaseServerClient }))
    const { saveVenueLocationAction } = await import("@/app/app/launch/actions")

    const result = await saveVenueLocationAction(
      {},
      form({
        venueName: "Old Crown Girton",
        ...sampleAddress,
        geofenceRadiusMeters: "100",
        geofencePinSource: "merchant_pin",
        venueLatitude: "999",
        venueLongitude: "0.0814946",
      })
    )

    expect(result.saved).toBeUndefined()
    expect(result.errors?.form).toBeTruthy()
    expect(createSupabaseServerClient).not.toHaveBeenCalled()
  })
})

describe("merchant_locations geofence pin source migration", () => {
  it("adds idempotent pin-source columns and a constraint without touching address_source", () => {
    const migration = readProjectFile(
      "supabase/migrations/20260620100000_merchant_geofence_pin_source.sql"
    )

    expect(migration).toContain("add column if not exists geofence_pin_source")
    expect(migration).toContain(
      "add column if not exists geofence_pin_updated_at"
    )
    expect(migration).toContain("default 'geocoded'")
    expect(migration).toContain(
      "geofence_pin_source in ('geocoded', 'merchant_pin')"
    )
    // Backfill existing rows from the geocode timestamp.
    expect(migration).toContain("geofence_pin_updated_at = geocoded_at")
    // This slice must not redefine the address provenance constraint.
    expect(migration).not.toContain("address_source")
  })
})

describe("venue location form — structured address fields", () => {
  it("wires structured venue address fields into the venue form", () => {
    const venueForm = readProjectFile(
      "components/merchant/launch/venue-location-form.tsx"
    )
    const addressFields = readProjectFile(
      "components/merchant/venue-address-fields.tsx"
    )

    for (const fieldName of [
      "venueName",
      "requireGeofence",
      "geofenceRadiusMeters",
    ]) {
      expect(venueForm).toContain(`name="${fieldName}"`)
    }
    expect(venueForm).toContain("VenueAddressFields")
    expect(venueForm).toContain("GPS anomaly checks")

    for (const fieldName of [
      "addressLine1",
      "addressLine2",
      "addressCity",
      "addressPostcode",
    ]) {
      expect(addressFields).toContain(`name="${fieldName}"`)
    }
  })
})

describe("merchant_locations canonical address migration", () => {
  it("adds idempotent canonical address columns and a source constraint", () => {
    const migration = readProjectFile(
      "supabase/migrations/20260616110000_venue_canonical_address.sql"
    )

    for (const column of [
      "address_line_1",
      "address_line_2",
      "address_city",
      "address_postcode",
      "address_country",
      "address_provider",
      "address_provider_id",
      "address_source",
    ]) {
      expect(migration).toContain(`add column if not exists ${column}`)
    }

    expect(migration).toContain(
      "address_source in ('provider_lookup', 'manual_entry')"
    )
    expect(migration).toContain("pg_constraint")
  })
})

describe("venue geofence pin map wiring", () => {
  it("ships a client-only Leaflet pin map with a draggable marker and cleanup", () => {
    const map = readProjectFile("components/merchant/launch/venue-pin-map.tsx")

    expect(map).toContain('"use client"')
    expect(map).toContain('from "leaflet"')
    expect(map).toContain('import "leaflet/dist/leaflet.css"')
    expect(map).toContain('data-testid="venue-pin-map"')
    expect(map).toContain("draggable: true")
    // Radius circle plus a size recalculation and unmount cleanup.
    expect(map).toContain("L.circle")
    expect(map).toContain("invalidateSize")
    expect(map).toContain(".remove()")
  })

  it("loads the map client-side only and exposes hidden pin fields in the venue form", () => {
    const form = readProjectFile(
      "components/merchant/launch/venue-location-form.tsx"
    )

    expect(form).toContain("ssr: false")
    expect(form).toContain('import("./venue-pin-map")')
    expect(form).toContain('name="venueLatitude"')
    expect(form).toContain('name="venueLongitude"')
    expect(form).toContain('name="geofencePinSource"')
    expect(form).toContain("requireGeofence")
    // Editing the address resets the pending source back to geocoded.
    expect(form).toContain("onAddressChange")
    expect(form).toContain('"geocoded"')
  })

  it("lets the address fields report edits without becoming controlled", () => {
    const fields = readProjectFile(
      "components/merchant/venue-address-fields.tsx"
    )

    expect(fields).toContain("onAddressChange")
    // Inputs stay uncontrolled (defaultValue), so the callback is additive.
    expect(fields).toContain("defaultValue")
  })

  it("exposes named venue geofence preview scenarios", () => {
    const page = readProjectFile("app/dev/launch-preview/page.tsx")
    const screens = readProjectFile("app/dev/launch-preview/screens.tsx")

    expect(page).toContain("searchParams")
    expect(page).toContain("scenario")
    expect(screens).toContain("geofence-on")
    expect(screens).toContain("geofence-off")
    // Old Crown Girton pilot coordinates drive the geofence-on scenario.
    expect(screens).toContain("52.2425913")
  })
})
