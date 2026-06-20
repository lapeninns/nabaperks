import { readFileSync } from "node:fs"
import { describe, expect, it, vi } from "vitest"

import { createSupabaseMock } from "../helpers/supabase"
import {
  buildProviderVenueAddress,
  formatVenueAddressDisplay,
  formatVenueAddressForGeocode,
  isUkPostcode,
  mapGoogleAddressComponents,
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

  it("still rejects a geofence radius below the 25m minimum", async () => {
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
        geofenceRadiusMeters: "10",
      })
    )

    expect(result.errors?.geofenceRadiusMeters).toMatch(/at least 25/)
    expect(createSupabaseServerClient).not.toHaveBeenCalled()
  })

  it("still rejects a geofence radius above the 1000m maximum", async () => {
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
        geofenceRadiusMeters: "2000",
      })
    )

    expect(result.errors?.geofenceRadiusMeters).toMatch(/1,000/)
    expect(createSupabaseServerClient).not.toHaveBeenCalled()
  })
})

describe("Old Crown Girton pilot seed and merchant geofence copy", () => {
  it("seeds the Old Crown Girton demo location with pilot geofence defaults", () => {
    const seed = readProjectFile("supabase/seed.sql")

    // Operator-supplied pilot coordinates, a 100m soft radius, geofence on, and a
    // merchant-placed pin.
    expect(seed).toContain("52.2425913")
    expect(seed).toContain("0.0814946")
    expect(seed).toContain("require_geofence")
    expect(seed).toContain("geofence_pin_source")
    expect(seed).toContain("merchant_pin")
  })

  it("recommends 100m for small single-site venues in the launch copy", () => {
    const form = readProjectFile(
      "components/merchant/launch/venue-location-form.tsx"
    )

    expect(form).toContain("100m")
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
    expect(map).toContain("var(--seal)")
    expect(map).not.toContain("#b8742c")
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

  it("controls the address field values so a provider selection can fill them", () => {
    const fields = readProjectFile(
      "components/merchant/venue-address-fields.tsx"
    )

    expect(fields).toContain("onAddressChange")
    // Inputs are controlled (value + onChange) so a Google Places selection can
    // set them through React state instead of mutating the DOM after selection.
    expect(fields).toContain("value={")
    expect(fields).toContain("onChange")
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

// --- MS-MERCHANT-LOYALTY-CARD-BUILDER-010: Google Places venue autocomplete ---

type GoogleAddressComponentFixture = {
  longText: string
  shortText?: string
  types: string[]
}

function googleComponent(
  longText: string,
  types: string[]
): GoogleAddressComponentFixture {
  return { longText, shortText: longText, types }
}

describe("Google Places address-component mapping", () => {
  it("maps street number + route into address line 1", () => {
    const fields = mapGoogleAddressComponents([
      googleComponent("12", ["street_number"]),
      googleComponent("High Street", ["route"]),
      googleComponent("London", ["postal_town"]),
      googleComponent("E1 6AN", ["postal_code"]),
    ])

    expect(fields).toMatchObject({
      addressLine1: "12 High Street",
      addressLine2: "",
      addressCity: "London",
      addressPostcode: "E1 6AN",
    })
  })

  it("maps subpremise into address line 2 and premise when no street is present", () => {
    expect(
      mapGoogleAddressComponents([
        googleComponent("Flat 2", ["subpremise"]),
        googleComponent("221B", ["street_number"]),
        googleComponent("Baker Street", ["route"]),
        googleComponent("London", ["postal_town"]),
        googleComponent("NW1 6XE", ["postal_code"]),
      ])
    ).toMatchObject({
      addressLine1: "221B Baker Street",
      addressLine2: "Flat 2",
    })

    expect(
      mapGoogleAddressComponents([
        googleComponent("Old Crown", ["premise"]),
        googleComponent("Girton", ["postal_town"]),
        googleComponent("CB3 0QH", ["postal_code"]),
      ])
    ).toMatchObject({
      addressLine1: "Old Crown",
      addressCity: "Girton",
    })
  })

  it("falls back from postal_town to locality then administrative area for the city", () => {
    expect(
      mapGoogleAddressComponents([
        googleComponent("1 King's Parade", ["street_number", "route"]),
        googleComponent("Cambridge", ["locality"]),
        googleComponent("CB2 1SJ", ["postal_code"]),
      ]).addressCity
    ).toBe("Cambridge")

    expect(
      mapGoogleAddressComponents([
        googleComponent("Main Street", ["route"]),
        googleComponent("Cambridgeshire", ["administrative_area_level_2"]),
        googleComponent("CB1 1AA", ["postal_code"]),
      ]).addressCity
    ).toBe("Cambridgeshire")
  })

  it("appends a postal code suffix when present", () => {
    expect(
      mapGoogleAddressComponents([
        googleComponent("Main Street", ["route"]),
        googleComponent("Townsville", ["postal_town"]),
        googleComponent("12345", ["postal_code"]),
        googleComponent("6789", ["postal_code_suffix"]),
      ]).addressPostcode
    ).toBe("12345-6789")
  })
})

describe("Google Places provider submission parsing", () => {
  const validFields = {
    addressLine1: "High Street",
    addressLine2: "",
    addressCity: "Girton",
    addressPostcode: "CB3 0QH",
  }

  it("accepts a valid UK provider selection and builds a provider_lookup payload", () => {
    const result = buildProviderVenueAddress({
      fields: validFields,
      providerId: "ChIJ_valid_place_id",
      latitude: "52.2425913",
      longitude: "0.0814946",
    })

    expect(result).toMatchObject({
      payload: {
        address_source: "provider_lookup",
        address_provider: "google_places",
        address_provider_id: "ChIJ_valid_place_id",
        address_line_1: "High Street",
        address_city: "Girton",
        address_postcode: "CB3 0QH",
        address_country: "GB",
        latitude: 52.2425913,
        longitude: 0.0814946,
      },
    })
  })

  it("rejects a provider selection without a valid postcode", () => {
    const result = buildProviderVenueAddress({
      fields: { ...validFields, addressPostcode: "NOPE" },
      providerId: "ChIJ_valid_place_id",
      latitude: "52.2425913",
      longitude: "0.0814946",
    })

    expect("payload" in result).toBe(false)
    expect("errors" in result && result.errors.addressPostcode).toBeTruthy()
  })

  it("rejects a provider selection with non-GB coordinates", () => {
    const result = buildProviderVenueAddress({
      fields: validFields,
      providerId: "ChIJ_valid_place_id",
      latitude: "40.7128",
      longitude: "-74.006",
    })

    expect("payload" in result).toBe(false)
    expect("errors" in result && result.errors.form).toBeTruthy()
  })

  it("rejects a provider selection with non-finite coordinates", () => {
    const result = buildProviderVenueAddress({
      fields: validFields,
      providerId: "ChIJ_valid_place_id",
      latitude: "not-a-number",
      longitude: "0.0814946",
    })

    expect("payload" in result).toBe(false)
    expect("errors" in result && result.errors.form).toBeTruthy()
  })

  it("rejects a provider selection without a provider place id", () => {
    const result = buildProviderVenueAddress({
      fields: validFields,
      providerId: "",
      latitude: "52.2425913",
      longitude: "0.0814946",
    })

    expect("payload" in result).toBe(false)
    expect("errors" in result && result.errors.form).toBeTruthy()
  })
})

describe("venue save action — Google Places provider lookup", () => {
  function mockMerchantAndCache() {
    vi.doMock("next/cache", () => ({ revalidatePath: vi.fn() }))
    vi.doMock("@/lib/auth/session", () => ({
      getCurrentMerchant: vi.fn(async () => ({ id: "merchant-1" })),
    }))
  }

  const providerForm = {
    venueName: "Old Crown Girton",
    addressLine1: "High Street",
    addressLine2: "",
    addressCity: "Girton",
    addressPostcode: "CB3 0QH",
    addressSource: "provider_lookup",
    addressProvider: "google_places",
    addressProviderId: "ChIJ_test_place_id",
    providerLatitude: "52.2425913",
    providerLongitude: "0.0814946",
    geofenceRadiusMeters: "100",
  }

  it("persists a Google Places selection with provider provenance and skips geocoding", async () => {
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
    const geocodeAddress = vi.fn(async () => ({ latitude: 99, longitude: 99 }))
    vi.doMock("@/lib/merchant/geocode", () => ({ geocodeAddress }))
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: vi.fn(async () => mock.client),
    }))
    const { saveVenueLocationAction } = await import("@/app/app/launch/actions")

    await expect(
      saveVenueLocationAction({}, form(providerForm))
    ).resolves.toMatchObject({ saved: true })

    expect(geocodeAddress).not.toHaveBeenCalled()
    expect(mock.queryCalls).toContainEqual({
      table: "merchant_locations",
      method: "update",
      args: [
        expect.objectContaining({
          address: "High Street, Girton, CB3 0QH",
          address_line_1: "High Street",
          address_city: "Girton",
          address_postcode: "CB3 0QH",
          address_country: "GB",
          address_source: "provider_lookup",
          address_provider: "google_places",
          address_provider_id: "ChIJ_test_place_id",
          latitude: 52.2425913,
          longitude: 0.0814946,
          geofence_pin_source: "geocoded",
        }),
      ],
    })
  })

  it("rejects a provider selection with out-of-UK coordinates without writing", async () => {
    vi.resetModules()
    const createSupabaseServerClient = vi.fn()
    mockMerchantAndCache()
    const geocodeAddress = vi.fn(async () => ({
      latitude: 51.52,
      longitude: -0.07,
    }))
    vi.doMock("@/lib/merchant/geocode", () => ({ geocodeAddress }))
    vi.doMock("@/lib/supabase/server", () => ({ createSupabaseServerClient }))
    const { saveVenueLocationAction } = await import("@/app/app/launch/actions")

    const result = await saveVenueLocationAction(
      {},
      form({
        ...providerForm,
        providerLatitude: "40.7128",
        providerLongitude: "-74.006",
      })
    )

    expect(result.saved).toBeUndefined()
    expect(result.errors?.form ?? result.errors?.address).toBeTruthy()
    expect(createSupabaseServerClient).not.toHaveBeenCalled()
    expect(geocodeAddress).not.toHaveBeenCalled()
  })

  it("rejects a provider selection missing the provider place id", async () => {
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
      form({ ...providerForm, addressProviderId: "" })
    )

    expect(result.saved).toBeUndefined()
    expect(result.errors?.form ?? result.errors?.address).toBeTruthy()
    expect(createSupabaseServerClient).not.toHaveBeenCalled()
  })

  it("lets a dragged manual pin override provider coordinates while keeping provider provenance", async () => {
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
    const geocodeAddress = vi.fn(async () => ({ latitude: 99, longitude: 99 }))
    vi.doMock("@/lib/merchant/geocode", () => ({ geocodeAddress }))
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: vi.fn(async () => mock.client),
    }))
    const { saveVenueLocationAction } = await import("@/app/app/launch/actions")

    await expect(
      saveVenueLocationAction(
        {},
        form({
          ...providerForm,
          requireGeofence: true,
          geofencePinSource: "merchant_pin",
          venueLatitude: "52.5",
          venueLongitude: "0.1",
        })
      )
    ).resolves.toMatchObject({ saved: true })

    expect(geocodeAddress).not.toHaveBeenCalled()
    expect(mock.queryCalls).toContainEqual({
      table: "merchant_locations",
      method: "update",
      args: [
        expect.objectContaining({
          latitude: 52.5,
          longitude: 0.1,
          address_source: "provider_lookup",
          address_provider: "google_places",
          address_provider_id: "ChIJ_test_place_id",
          geofence_pin_source: "merchant_pin",
        }),
      ],
    })
  })

  it("still saves manual entry as manual_entry and geocodes when no provider fields are present", async () => {
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
    const geocodeAddress = vi.fn(async () => ({
      latitude: 51.52,
      longitude: -0.07,
    }))
    vi.doMock("@/lib/merchant/geocode", () => ({ geocodeAddress }))
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

    expect(geocodeAddress).toHaveBeenCalled()
    expect(mock.queryCalls).toContainEqual({
      table: "merchant_locations",
      method: "update",
      args: [
        expect.objectContaining({
          address_source: "manual_entry",
          address_provider: null,
          address_provider_id: null,
          latitude: 51.52,
          longitude: -0.07,
        }),
      ],
    })
  })
})

describe("venue form — Google Places autocomplete wiring", () => {
  it("ships a client-only Google Places widget gated on the public key with manual fallback", () => {
    const widget = readProjectFile(
      "components/merchant/launch/venue-place-autocomplete.tsx"
    )

    expect(widget).toContain('"use client"')
    expect(widget).toContain("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY")
    // Places New widget + selection event + dynamic library import.
    expect(widget).toContain("PlaceAutocompleteElement")
    expect(widget).toContain("gmp-select")
    expect(widget).toContain("importLibrary")
    // Only the required fields are fetched.
    expect(widget).toContain("fetchFields")
    for (const field of [
      "displayName",
      "formattedAddress",
      "addressComponents",
      "location",
    ]) {
      expect(widget).toContain(field)
    }
    // UK establishment restriction.
    expect(widget).toContain("gb")
    // Graceful states: no key / load failure must not throw and keep manual entry.
    expect(widget).toContain("unconfigured")
  })

  it("wires controlled provider state and hidden provider fields into the venue form", () => {
    const venueForm = readProjectFile(
      "components/merchant/launch/venue-location-form.tsx"
    )

    expect(venueForm).toContain("VenuePlaceAutocomplete")
    for (const fieldName of [
      "addressSource",
      "addressProvider",
      "addressProviderId",
      "providerLatitude",
      "providerLongitude",
    ]) {
      expect(venueForm).toContain(`name="${fieldName}"`)
    }
    // A selection sets provider provenance; a manual edit resets it.
    expect(venueForm).toContain("provider_lookup")
    expect(venueForm).toContain("google_places")
    expect(venueForm).toContain("manual_entry")
  })
})
