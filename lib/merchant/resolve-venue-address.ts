import "server-only"

import { geocodeAddress } from "@/lib/merchant/geocode"
import {
  formatVenueAddressDisplay,
  formatVenueAddressForGeocode,
  toStructuredVenueAddress,
  type VenueAddressFormFields,
  type VenueAddressPayload,
} from "@/lib/merchant/venue-address"

const GEOCODE_ERROR =
  "We could not geocode this address. Check it and try again."

export async function resolveStructuredVenueAddress(
  fields: VenueAddressFormFields
): Promise<{ payload: VenueAddressPayload } | { error: string }> {
  const structured = toStructuredVenueAddress(fields)
  const geocoded = await geocodeAddress(formatVenueAddressForGeocode(structured))

  if (!geocoded) return { error: GEOCODE_ERROR }

  return {
    payload: {
      address: formatVenueAddressDisplay(structured),
      address_line_1: structured.line1,
      address_line_2: structured.line2,
      address_city: structured.city,
      address_postcode: structured.postcode,
      address_country: structured.country,
      address_provider: null,
      address_provider_id: null,
      address_source: "manual_entry",
      latitude: geocoded.latitude,
      longitude: geocoded.longitude,
    },
  }
}

export type { VenueAddressPayload } from "@/lib/merchant/venue-address"
