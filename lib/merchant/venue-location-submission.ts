import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { resolveStructuredVenueAddress } from "@/lib/merchant/resolve-venue-address"
import {
  buildProviderVenueAddress,
  parseManualGeofencePin,
  parseVenueAddressFields,
  validateVenueAddressFields,
  type VenueAddressFieldErrors,
  type VenueAddressFormFields,
  type VenueAddressPayload,
} from "@/lib/merchant/venue-address"

export type VenueLocationSubmission = {
  venueName: string
  addressFields: VenueAddressFormFields
  geofenceRadiusMeters: string
  requireGeofence: boolean
  geofencePinSource: string
  venueLatitude: string
  venueLongitude: string
  addressSource: string
  addressProvider: string
  addressProviderId: string
  providerLatitude: string
  providerLongitude: string
}

export type VenueLocationSubmissionErrors = VenueAddressFieldErrors & {
  venueName?: string
  geofenceRadiusMeters?: string
  form?: string
}

export type VenueLocationWritePayload = Omit<
  VenueAddressPayload,
  "address_provider" | "address_provider_id"
> & {
  merchant_id: string
  name: string
  address_provider: VenueAddressPayload["address_provider"]
  address_provider_id: VenueAddressPayload["address_provider_id"]
  latitude: number
  longitude: number
  geofence_radius_meters: number
  require_geofence: boolean
  geocoded_at: string
  geofence_pin_source: "geocoded" | "merchant_pin"
  geofence_pin_updated_at: string
  is_primary: boolean
}

export function parseVenueLocationSubmission(
  formData: FormData,
  options?: {
    venueNameField?: "venueName" | "locationName"
    defaultVenueName?: string
  }
): VenueLocationSubmission {
  const venueNameField = options?.venueNameField ?? "venueName"
  // Preserve the raw parsed name so the required-name guard in
  // validateVenueLocationSubmission stays reachable. Callers that want a
  // placeholder fallback opt in explicitly via { defaultVenueName }.
  const rawVenueName = value(formData, venueNameField)

  return {
    venueName: rawVenueName || options?.defaultVenueName || "",
    addressFields: parseVenueAddressFields(formData),
    geofenceRadiusMeters: value(formData, "geofenceRadiusMeters") || "150",
    requireGeofence: formData.get("requireGeofence") === "on",
    geofencePinSource: value(formData, "geofencePinSource"),
    venueLatitude: value(formData, "venueLatitude"),
    venueLongitude: value(formData, "venueLongitude"),
    addressSource: value(formData, "addressSource"),
    addressProvider: value(formData, "addressProvider"),
    addressProviderId: value(formData, "addressProviderId"),
    providerLatitude: value(formData, "providerLatitude"),
    providerLongitude: value(formData, "providerLongitude"),
  }
}

export function validateVenueLocationSubmission(
  submission: VenueLocationSubmission,
  options?: { validateGeofence?: boolean }
): {
  errors: VenueLocationSubmissionErrors
  radius: number | null
  manualPin: { latitude: number; longitude: number } | null
} {
  const validateGeofence = options?.validateGeofence ?? true
  const errors: VenueLocationSubmissionErrors = {
    ...validateVenueAddressFields(submission.addressFields),
  }
  const radius = parseInteger(submission.geofenceRadiusMeters)
  const manualPin =
    submission.geofencePinSource === "merchant_pin"
      ? parseManualGeofencePin(
          submission.venueLatitude,
          submission.venueLongitude
        )
      : null

  if (!submission.venueName) {
    errors.venueName = "Enter the venue name."
  } else if (submission.venueName.length > 120) {
    errors.venueName = "Use 120 characters or fewer."
  }

  if (validateGeofence) {
    if (radius === null) {
      errors.geofenceRadiusMeters = "Enter a whole-number radius."
    } else if (radius < 25) {
      errors.geofenceRadiusMeters = "Use at least 25 metres."
    } else if (radius > 1000) {
      errors.geofenceRadiusMeters = "Use 1,000 metres or fewer."
    }

    if (submission.geofencePinSource === "merchant_pin" && manualPin === null) {
      errors.form = "Drop the pin on the map before saving."
    }
  }

  return { errors, radius, manualPin }
}

export async function resolveVenueLocationWritePayload(
  submission: VenueLocationSubmission,
  options: {
    merchantId: string
    radius: number
    manualPin: { latitude: number; longitude: number } | null
    isPrimary?: boolean
  }
): Promise<
  | { payload: VenueLocationWritePayload }
  | { errors: VenueLocationSubmissionErrors }
> {
  const isProviderLookup =
    submission.addressSource === "provider_lookup" &&
    submission.addressProvider === "google_places"
  const resolved = isProviderLookup
    ? buildProviderVenueAddress({
        fields: submission.addressFields,
        providerId: submission.addressProviderId,
        latitude: submission.providerLatitude,
        longitude: submission.providerLongitude,
      })
    : await resolveStructuredVenueAddress(submission.addressFields)

  if ("errors" in resolved) {
    return { errors: resolved.errors }
  }

  if ("error" in resolved) {
    return { errors: { address: resolved.error } }
  }

  const savedAt = new Date().toISOString()

  return {
    payload: {
      merchant_id: options.merchantId,
      name: submission.venueName,
      ...resolved.payload,
      latitude: options.manualPin?.latitude ?? resolved.payload.latitude,
      longitude: options.manualPin?.longitude ?? resolved.payload.longitude,
      geofence_radius_meters: options.radius,
      require_geofence: submission.requireGeofence,
      geocoded_at: savedAt,
      geofence_pin_source: options.manualPin ? "merchant_pin" : "geocoded",
      geofence_pin_updated_at: savedAt,
      is_primary: options.isPrimary ?? true,
    },
  }
}

export async function persistVenueLocationWrite({
  supabase,
  locationId,
  payload,
}: {
  supabase: SupabaseClient
  locationId?: string
  payload: VenueLocationWritePayload
}): Promise<{ locationId?: string; error?: string }> {
  if (locationId) {
    const { error } = await supabase
      .from("merchant_locations")
      .update(payload)
      .eq("id", locationId)

    if (error) {
      return { error: error.message }
    }

    return { locationId }
  }

  const { data, error } = await supabase
    .from("merchant_locations")
    .insert(payload)
    .select("id")
    .single()

  if (error) {
    return { error: error.message }
  }

  return { locationId: data?.id }
}

function value(formData: FormData, key: string) {
  const raw = formData.get(key)
  return typeof raw === "string" ? raw.trim() : ""
}

function parseInteger(input: string) {
  if (!/^\d+$/.test(input)) return null
  return Number.parseInt(input, 10)
}
