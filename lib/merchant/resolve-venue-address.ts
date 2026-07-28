import "server-only"

import {
  geocodeAddress,
  type GeocodeResult,
} from "@/lib/merchant/geocode"
import {
  formatVenueAddressDisplay,
  formatVenueAddressForGeocode,
  toStructuredVenueAddress,
  type VenueAddressFormFields,
  type VenueAddressPayload,
} from "@/lib/merchant/venue-address"

export async function resolveStructuredVenueAddress(
  fields: VenueAddressFormFields,
  geocoder: (address: string) => Promise<GeocodeResult | null> = geocodeAddress
): Promise<{ payload: VenueAddressPayload }> {
  const structured = toStructuredVenueAddress(fields)
  const geocoded = await geocoder(formatVenueAddressForGeocode(structured))

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
      latitude: geocoded?.latitude ?? null,
      longitude: geocoded?.longitude ?? null,
    },
  }
}

export type { VenueAddressPayload } from "@/lib/merchant/venue-address"
