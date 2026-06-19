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
