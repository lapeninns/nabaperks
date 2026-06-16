"use server"

import { revalidatePath } from "next/cache"

import { getCurrentMerchant } from "@/lib/auth/session"
import { resolveStructuredVenueAddress } from "@/lib/merchant/resolve-venue-address"
import {
  parseVenueAddressFields,
  validateVenueAddressFields,
  type VenueAddressFieldErrors,
  type VenueAddressFormFields,
} from "@/lib/merchant/venue-address"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export type VenueLocationActionState = {
  fields?: VenueAddressFormFields & {
    venueName?: string
    geofenceRadiusMeters?: string
    requireGeofence?: boolean
  }
  errors?: VenueAddressFieldErrors & {
    venueName?: string
    geofenceRadiusMeters?: string
    form?: string
  }
  saved?: boolean
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
  const fields = {
    venueName,
    ...addressFields,
    geofenceRadiusMeters,
    requireGeofence,
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

  if (Object.keys(errors).length > 0 || radius === null) {
    return { fields, errors }
  }

  const resolved = await resolveStructuredVenueAddress(addressFields)

  if ("error" in resolved) {
    return { fields, errors: { ...errors, address: resolved.error } }
  }

  const payload = {
    merchant_id: merchant.id,
    name: venueName,
    ...resolved.payload,
    geofence_radius_meters: radius,
    require_geofence: requireGeofence,
    geocoded_at: new Date().toISOString(),
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
