import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { GeocodeResult } from "@/lib/merchant/geocode"
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
  softGeofenceTriggerStamp: string
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
  softGeofenceTriggerStamp?: string
  form?: string
}

export type VenueLocationPersistencePayload = {
  name: string
  address_provider: VenueAddressPayload["address_provider"]
  address_provider_id: VenueAddressPayload["address_provider_id"]
  address_source: VenueAddressPayload["address_source"]
  address_line_1: string
  address_line_2: string | null
  address_city: string
  address_postcode: string
  latitude: number | null
  longitude: number | null
  geofence_radius_meters: number
  require_geofence: boolean
  soft_geofence_trigger_stamp_number: number
  geofence_pin_source: "geocoded" | "merchant_pin" | "unresolved"
}

export type VenueLocationWritePayload = VenueLocationPersistencePayload & {
  merchant_id: string
  address: string
  address_country: "GB"
  geocoded_at: string | null
  geofence_pin_updated_at: string | null
  is_primary: boolean
}

export function parseVenueLocationSubmission(
  formData: FormData,
  options: {
    canonicalVenueName: string
  }
): VenueLocationSubmission {
  return {
    venueName: options.canonicalVenueName.trim(),
    addressFields: parseVenueAddressFields(formData),
    geofenceRadiusMeters: value(formData, "geofenceRadiusMeters") || "150",
    requireGeofence: formData.get("requireGeofence") === "on",
    softGeofenceTriggerStamp:
      value(formData, "softGeofenceTriggerStamp") || "3",
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
  softGeofenceTriggerStamp: number | null
  manualPin: { latitude: number; longitude: number } | null
} {
  const validateGeofence = options?.validateGeofence ?? true
  const errors: VenueLocationSubmissionErrors = {
    ...validateVenueAddressFields(submission.addressFields),
  }
  const radius = parseInteger(submission.geofenceRadiusMeters)
  const softGeofenceTriggerStamp = parseInteger(
    submission.softGeofenceTriggerStamp
  )
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

  // The soft-geofence trigger stamp is validated regardless of the hard
  // geofence toggle: the soft location check applies whenever coordinates
  // exist, and the DB CHECK enforces the same 1–99 bound.
  if (softGeofenceTriggerStamp === null) {
    errors.softGeofenceTriggerStamp = "Enter a whole stamp number."
  } else if (softGeofenceTriggerStamp < 1 || softGeofenceTriggerStamp > 99) {
    errors.softGeofenceTriggerStamp = "Use a stamp number from 1 to 99."
  }

  return { errors, radius, softGeofenceTriggerStamp, manualPin }
}

export async function resolveVenueLocationWritePayload(
  submission: VenueLocationSubmission,
  options: {
    merchantId: string
    radius: number
    manualPin: { latitude: number; longitude: number } | null
    /** Cycle stamp that fires the soft location check; defaults to 3 for
     *  callers that do not expose the knob (e.g. onboarding). */
    softGeofenceTriggerStamp?: number
    isPrimary?: boolean
  }
): Promise<
  | { payload: VenueLocationWritePayload }
  | { errors: VenueLocationSubmissionErrors }
> {
  const resolved = await resolveVenueLocationPersistencePayload(submission, {
    radius: options.radius,
    manualPin: options.manualPin,
    softGeofenceTriggerStamp: options.softGeofenceTriggerStamp,
  })

  if ("errors" in resolved) return resolved

  const savedAt = new Date().toISOString()
  const payload = resolved.payload
  const hasCoordinates =
    payload.latitude !== null && payload.longitude !== null

  return {
    payload: {
      merchant_id: options.merchantId,
      ...payload,
      address: [
        payload.address_line_1,
        payload.address_line_2,
        payload.address_city,
        payload.address_postcode,
      ]
        .filter(Boolean)
        .join(", "),
      address_country: "GB",
      geocoded_at: hasCoordinates ? savedAt : null,
      geofence_pin_updated_at: hasCoordinates ? savedAt : null,
      is_primary: options.isPrimary ?? true,
    },
  }
}

export async function resolveVenueLocationPersistencePayload(
  submission: VenueLocationSubmission,
  options: {
    radius: number
    manualPin: { latitude: number; longitude: number } | null
    softGeofenceTriggerStamp?: number
    geocodeAddress?: (address: string) => Promise<GeocodeResult | null>
  }
): Promise<
  | { payload: VenueLocationPersistencePayload }
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
    : await resolveStructuredVenueAddress(
        submission.addressFields,
        options.geocodeAddress
      )

  if ("errors" in resolved) {
    return { errors: resolved.errors }
  }

  const latitude = options.manualPin?.latitude ?? resolved.payload.latitude
  const longitude = options.manualPin?.longitude ?? resolved.payload.longitude

  if (
    submission.requireGeofence &&
    (latitude === null || longitude === null)
  ) {
    return {
      errors: {
        form:
          "Choose a verified place or drop a map pin before using GPS anomaly checks.",
      },
    }
  }

  return {
    payload: {
      name: submission.venueName,
      address_line_1: resolved.payload.address_line_1,
      address_line_2: resolved.payload.address_line_2,
      address_city: resolved.payload.address_city,
      address_postcode: resolved.payload.address_postcode,
      address_provider: resolved.payload.address_provider,
      address_provider_id: resolved.payload.address_provider_id,
      address_source: resolved.payload.address_source,
      latitude,
      longitude,
      geofence_radius_meters: options.radius,
      require_geofence: submission.requireGeofence,
      soft_geofence_trigger_stamp_number: options.softGeofenceTriggerStamp ?? 3,
      geofence_pin_source: options.manualPin
        ? "merchant_pin"
        : latitude === null
          ? "unresolved"
          : "geocoded",
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
