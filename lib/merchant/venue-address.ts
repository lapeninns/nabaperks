export type StructuredVenueAddress = {
  line1: string
  line2: string | null
  city: string
  postcode: string
  country: string
}

export type VenueAddressFormFields = {
  addressLine1: string
  addressLine2: string
  addressCity: string
  addressPostcode: string
}

export type VenueAddressFieldErrors = {
  addressLine1?: string
  addressLine2?: string
  addressCity?: string
  addressPostcode?: string
  /** Geocode failure shown against the address block. */
  address?: string
}

export type VenueAddressPayload = {
  address: string
  address_line_1: string
  address_line_2: string | null
  address_city: string
  address_postcode: string
  address_country: string
  address_provider: null
  address_provider_id: null
  address_source: "manual_entry"
  latitude: number
  longitude: number
}

const UK_POSTCODE_PATTERN = /^[A-Z]{1,2}\d[A-Z\d]?\s\d[A-Z]{2}$/

export function parseVenueAddressFields(
  formData: FormData
): VenueAddressFormFields {
  return {
    addressLine1: formValue(formData, "addressLine1"),
    addressLine2: formValue(formData, "addressLine2"),
    addressCity: formValue(formData, "addressCity"),
    addressPostcode: formValue(formData, "addressPostcode"),
  }
}

export type GeofencePinSource = "geocoded" | "merchant_pin"

/**
 * Parse a submitted manual geofence pin. Valid for this slice only when both
 * coordinates are finite and within global latitude/longitude bounds — no UK
 * bounds or distance-from-geocode constraint. Returns null for any invalid,
 * out-of-range, or empty input so the caller can fall back or reject.
 */
export function parseManualGeofencePin(
  latitude: string,
  longitude: string
): { latitude: number; longitude: number } | null {
  const lat = parseGeofenceCoordinate(latitude, 90)
  const lon = parseGeofenceCoordinate(longitude, 180)

  if (lat === null || lon === null) return null

  return { latitude: lat, longitude: lon }
}

function parseGeofenceCoordinate(input: string, bound: number): number | null {
  if (input.trim() === "") return null

  const parsed = Number(input)

  if (!Number.isFinite(parsed) || parsed < -bound || parsed > bound) return null

  return parsed
}

export function validateVenueAddressFields(
  fields: VenueAddressFormFields
): VenueAddressFieldErrors {
  const errors: VenueAddressFieldErrors = {}

  if (!fields.addressLine1) {
    errors.addressLine1 = "Enter the first line of the address."
  } else if (fields.addressLine1.length > 120) {
    errors.addressLine1 = "Use 120 characters or fewer."
  }

  if (fields.addressLine2.length > 120) {
    errors.addressLine2 = "Use 120 characters or fewer."
  }

  if (!fields.addressCity) {
    errors.addressCity = "Enter the town or city."
  } else if (fields.addressCity.length > 80) {
    errors.addressCity = "Use 80 characters or fewer."
  }

  if (!fields.addressPostcode) {
    errors.addressPostcode = "Enter the postcode."
  } else if (!isUkPostcode(fields.addressPostcode)) {
    errors.addressPostcode = "Enter a valid UK postcode."
  }

  return errors
}

export function normalizeUkPostcode(input: string) {
  const compact = input.replace(/\s+/g, "").toUpperCase()
  if (compact.length < 5) return compact
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`
}

export function isUkPostcode(input: string) {
  return UK_POSTCODE_PATTERN.test(normalizeUkPostcode(input))
}

export function toStructuredVenueAddress(
  fields: VenueAddressFormFields
): StructuredVenueAddress {
  return {
    line1: fields.addressLine1,
    line2: fields.addressLine2 || null,
    city: fields.addressCity,
    postcode: normalizeUkPostcode(fields.addressPostcode),
    country: "GB",
  }
}

export function formatVenueAddressDisplay(address: StructuredVenueAddress) {
  return [address.line1, address.line2, address.city, address.postcode]
    .filter(Boolean)
    .join(", ")
}

export function formatVenueAddressForGeocode(address: StructuredVenueAddress) {
  return [
    address.line1,
    address.line2,
    address.city,
    address.postcode,
    "United Kingdom",
  ]
    .filter(Boolean)
    .join(", ")
}

export function venueAddressFieldsFromLocation(location: {
  address: string | null
  address_line_1?: string | null
  address_line_2?: string | null
  address_city?: string | null
  address_postcode?: string | null
}): VenueAddressFormFields {
  if (location.address_line_1) {
    return {
      addressLine1: location.address_line_1,
      addressLine2: location.address_line_2 ?? "",
      addressCity: location.address_city ?? "",
      addressPostcode: location.address_postcode ?? "",
    }
  }

  return {
    addressLine1: location.address ?? "",
    addressLine2: "",
    addressCity: "",
    addressPostcode: "",
  }
}

function formValue(formData: FormData, key: string) {
  const raw = formData.get(key)
  return typeof raw === "string" ? raw.trim() : ""
}
