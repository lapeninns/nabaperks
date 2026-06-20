"use server"

import { revalidatePath } from "next/cache"

import { getCurrentMerchant } from "@/lib/auth/session"
import { resolveStructuredVenueAddress } from "@/lib/merchant/resolve-venue-address"
import {
  buildProviderVenueAddress,
  parseManualGeofencePin,
  parseVenueAddressFields,
  validateVenueAddressFields,
  type VenueAddressPayload,
  type VenueAddressFieldErrors,
  type VenueAddressFormFields,
} from "@/lib/merchant/venue-address"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export type VenueLocationActionState = {
  fields?: VenueAddressFormFields & {
    venueName?: string
    geofenceRadiusMeters?: string
    requireGeofence?: boolean
    /** Submitted manual pin coordinates, echoed back for re-render. */
    venueLatitude?: string
    venueLongitude?: string
    geofencePinSource?: string
  }
  errors?: VenueAddressFieldErrors & {
    venueName?: string
    geofenceRadiusMeters?: string
    form?: string
  }
  saved?: boolean
}

type VenueLocationWritePayload = Omit<
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

export async function saveVenueLocationAction(
  _state: VenueLocationActionState,
  formData: FormData
): Promise<VenueLocationActionState> {
  const merchant = await getCurrentMerchant()

  if (!merchant) {
    return { errors: { form: "Complete merchant onboarding first." } }
  }

  const venueName = value(formData, "venueName") || "Main venue"
  const addressFields = parseVenueAddressFields(formData)
  const geofenceRadiusMeters = value(formData, "geofenceRadiusMeters") || "150"
  const requireGeofence = formData.get("requireGeofence") === "on"
  const geofencePinSource = value(formData, "geofencePinSource")
  const venueLatitude = value(formData, "venueLatitude")
  const venueLongitude = value(formData, "venueLongitude")
  const manualPin =
    geofencePinSource === "merchant_pin"
      ? parseManualGeofencePin(venueLatitude, venueLongitude)
      : null
  const fields = {
    venueName,
    ...addressFields,
    geofenceRadiusMeters,
    requireGeofence,
    venueLatitude,
    venueLongitude,
    geofencePinSource,
  }
  const errors: NonNullable<VenueLocationActionState["errors"]> = {
    ...validateVenueAddressFields(addressFields),
  }
  const radius = parseInteger(geofenceRadiusMeters)

  if (!venueName) errors.venueName = "Enter the venue name."
  if (venueName.length > 120) errors.venueName = "Use 120 characters or fewer."
  if (radius === null) {
    errors.geofenceRadiusMeters = "Enter a whole-number radius."
  } else if (radius < 25) {
    errors.geofenceRadiusMeters = "Use at least 25 metres."
  } else if (radius > 1000) {
    errors.geofenceRadiusMeters = "Use 1,000 metres or fewer."
  }

  // A submitted manual pin must carry finite, in-range coordinates; reject an
  // invalid pin rather than silently falling back to the geocode.
  if (geofencePinSource === "merchant_pin" && manualPin === null) {
    errors.form = "Drop the pin on the map before saving."
  }

  if (Object.keys(errors).length > 0 || radius === null) {
    return { fields, errors }
  }

  // A Google Places selection arrives with a provider id and validated,
  // GB-bounded coordinates, so it skips the Nominatim geocode and records its
  // provenance through the existing provider columns. Manual entry still
  // geocodes the structured postcode through resolveStructuredVenueAddress.
  const isProviderLookup =
    value(formData, "addressSource") === "provider_lookup" &&
    value(formData, "addressProvider") === "google_places"
  const resolved = isProviderLookup
    ? buildProviderVenueAddress({
        fields: addressFields,
        providerId: value(formData, "addressProviderId"),
        latitude: value(formData, "providerLatitude"),
        longitude: value(formData, "providerLongitude"),
      })
    : await resolveStructuredVenueAddress(addressFields)

  if ("errors" in resolved) {
    return { fields, errors: { ...errors, ...resolved.errors } }
  }

  if ("error" in resolved) {
    return { fields, errors: { ...errors, address: resolved.error } }
  }

  // A valid manual pin wins over the resolved coordinates (postcode-centroid
  // geocode or provider location); provenance is recorded in geofence_pin_source,
  // never by overloading the address source.
  const savedAt = new Date().toISOString()
  const payload: VenueLocationWritePayload = {
    merchant_id: merchant.id,
    name: venueName,
    ...resolved.payload,
    latitude: manualPin?.latitude ?? resolved.payload.latitude,
    longitude: manualPin?.longitude ?? resolved.payload.longitude,
    geofence_radius_meters: radius,
    require_geofence: requireGeofence,
    geocoded_at: savedAt,
    geofence_pin_source: manualPin ? "merchant_pin" : "geocoded",
    geofence_pin_updated_at: savedAt,
    is_primary: true,
  }

  const supabase = await createSupabaseServerClient()
  const { data: existingLocation, error: loadError } = await supabase
    .from("merchant_locations")
    .select("id")
    .eq("merchant_id", merchant.id)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (loadError) {
    return { fields, errors: { form: "Unable to load venue location." } }
  }

  const write = existingLocation
    ? supabase
        .from("merchant_locations")
        .update(payload)
        .eq("id", existingLocation.id)
    : supabase.from("merchant_locations").insert(payload)
  const { error: writeError } = await write

  if (writeError) {
    return { fields, errors: { form: "Unable to save venue location." } }
  }

  revalidatePath("/app/launch")
  revalidatePath("/app")

  return { fields, saved: true }
}

function value(formData: FormData, key: string) {
  const raw = formData.get(key)
  return typeof raw === "string" ? raw.trim() : ""
}

function parseInteger(input: string) {
  if (!/^\d+$/.test(input)) return null
  return Number.parseInt(input, 10)
}
