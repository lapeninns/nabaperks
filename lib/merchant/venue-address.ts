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

type VenueAddressCanonicalFields = {
  address: string
  address_line_1: string
  address_line_2: string | null
  address_city: string
  address_postcode: string
  address_country: string
  latitude: number
  longitude: number
}

export type ManualVenueAddressPayload = VenueAddressCanonicalFields & {
  address_provider: null
  address_provider_id: null
  address_source: "manual_entry"
}

export type ProviderVenueAddressPayload = VenueAddressCanonicalFields & {
  address_provider: "google_places"
  address_provider_id: string
  address_source: "provider_lookup"
}

export type VenueAddressPayload =
  | ManualVenueAddressPayload
  | ProviderVenueAddressPayload

/** One entry from Google Places `Place.addressComponents` (Places API New). */
export type GoogleAddressComponent = {
  longText: string | null
  shortText?: string | null
  types: string[]
}

export type ProviderVenueAddressInput = {
  fields: VenueAddressFormFields
  /** Google `place.id`, the re-verifiable provider identity. */
  providerId: string
  /** Provider `place.location` latitude/longitude as submitted strings. */
  latitude: string
  longitude: string
}

export type ProviderVenueAddressErrors = VenueAddressFieldErrors & {
  /** Provider provenance/coordinate failure shown against the form. */
  form?: string
}

const UK_POSTCODE_PATTERN = /^[A-Z]{1,2}\d[A-Z\d]?\s\d[A-Z]{2}$/

// Generous GB bounding box (incl. Shetland and the Channel Islands). Provider
// coordinates outside it are rejected so a tampered client cannot persist an
// arbitrary venue location under the trusted provider-lookup banner.
const UK_BOUNDS = {
  latMin: 49.0,
  latMax: 61.5,
  lngMin: -8.8,
  lngMax: 2.1,
} as const

const MAX_PROVIDER_ID_LENGTH = 255

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

/**
 * Map Google Places `addressComponents` (Places API New) into the structured UK
 * venue form fields. Pure and provider-shaped only; the server still re-validates
 * the result, so a malformed selection cannot bypass address validation.
 */
export function mapGoogleAddressComponents(
  components: GoogleAddressComponent[]
): VenueAddressFormFields {
  const pick = (type: string) =>
    components
      .find((component) => component.types.includes(type))
      ?.longText?.trim() ?? ""

  const street = [pick("street_number"), pick("route")]
    .filter(Boolean)
    .join(" ")
  const premise = pick("premise")
  const subpremise = pick("subpremise")

  const addressLine1 = street || premise
  // subpremise (flat/unit) is the natural second line; otherwise surface the
  // premise/building name when the street already fills line 1.
  const addressLine2 =
    subpremise || (premise && addressLine1 !== premise ? premise : "")

  const addressCity =
    pick("postal_town") ||
    pick("locality") ||
    pick("administrative_area_level_2") ||
    pick("administrative_area_level_1")

  const postalCode = pick("postal_code")
  const postalSuffix = pick("postal_code_suffix")
  const addressPostcode = postalSuffix
    ? `${postalCode}-${postalSuffix}`
    : postalCode

  return { addressLine1, addressLine2, addressCity, addressPostcode }
}

function parseFiniteCoordinate(value: string): number | null {
  if (value.trim() === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * Parse provider-supplied venue coordinates, accepting only finite values inside
 * the GB bounding box. Returns null for empty, non-finite, or non-GB input so a
 * tampered client cannot persist an arbitrary location via provider lookup.
 */
export function parseUkVenueCoordinates(
  latitude: string,
  longitude: string
): { latitude: number; longitude: number } | null {
  const lat = parseFiniteCoordinate(latitude)
  const lng = parseFiniteCoordinate(longitude)

  if (lat === null || lng === null) return null
  if (lat < UK_BOUNDS.latMin || lat > UK_BOUNDS.latMax) return null
  if (lng < UK_BOUNDS.lngMin || lng > UK_BOUNDS.lngMax) return null

  return { latitude: lat, longitude: lng }
}

const PROVIDER_PLACE_ERROR =
  "We could not confirm this place. Enter the address manually."
const PROVIDER_LOCATION_ERROR =
  "We could not confirm this place's location. Enter the address manually."

/**
 * Validate a Google Places selection server-side and build a canonical
 * provider-lookup payload. The structured address must pass the same UK
 * validation as manual entry, the provider place id must be present and bounded,
 * and the coordinates must fall inside the GB bounding box before they are
 * trusted. Any failure returns field/form errors and writes nothing.
 */
export function buildProviderVenueAddress(
  input: ProviderVenueAddressInput
):
  | { payload: ProviderVenueAddressPayload }
  | { errors: ProviderVenueAddressErrors } {
  const errors: ProviderVenueAddressErrors = {
    ...validateVenueAddressFields(input.fields),
  }
  const providerId = input.providerId.trim()
  const coordinates = parseUkVenueCoordinates(input.latitude, input.longitude)

  if (!providerId || providerId.length > MAX_PROVIDER_ID_LENGTH) {
    errors.form = PROVIDER_PLACE_ERROR
  } else if (!coordinates) {
    errors.form = PROVIDER_LOCATION_ERROR
  }

  if (Object.keys(errors).length > 0 || !coordinates) {
    return { errors }
  }

  const structured = toStructuredVenueAddress(input.fields)

  return {
    payload: {
      address: formatVenueAddressDisplay(structured),
      address_line_1: structured.line1,
      address_line_2: structured.line2,
      address_city: structured.city,
      address_postcode: structured.postcode,
      address_country: structured.country,
      address_provider: "google_places",
      address_provider_id: providerId,
      address_source: "provider_lookup",
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
    },
  }
}

function formValue(formData: FormData, key: string) {
  const raw = formData.get(key)
  return typeof raw === "string" ? raw.trim() : ""
}
