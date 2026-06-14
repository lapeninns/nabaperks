"use server"

import { revalidatePath } from "next/cache"

import { getCurrentMerchant } from "@/lib/auth/session"
import { geocodeAddress } from "@/lib/merchant/geocode"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export type VenueLocationActionState = {
  fields?: {
    venueName?: string
    address?: string
    geofenceRadiusMeters?: string
    requireGeofence?: boolean
  }
  errors?: {
    venueName?: string
    address?: string
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
  const address = value(formData, "address")
  const geofenceRadiusMeters = value(formData, "geofenceRadiusMeters") || "150"
  const requireGeofence = formData.get("requireGeofence") === "on"
  const fields = {
    venueName,
    address,
    geofenceRadiusMeters,
    requireGeofence,
  }
  const errors: NonNullable<VenueLocationActionState["errors"]> = {}
  const radius = parseInteger(geofenceRadiusMeters)

  if (!venueName) errors.venueName = "Enter the venue name."
  if (venueName.length > 120) errors.venueName = "Use 120 characters or fewer."
  if (!address) errors.address = "Enter the venue address."
  if (radius === null) {
    errors.geofenceRadiusMeters = "Enter a whole-number radius."
  } else if (radius < 25) {
    errors.geofenceRadiusMeters = "Use at least 25 metres."
  } else if (radius > 1000) {
    errors.geofenceRadiusMeters = "Use 1,000 metres or fewer."
  }

  if (Object.keys(errors).length || radius === null) {
    return { fields, errors }
  }

  const geocoded = await geocodeAddress(address)

  if (!geocoded) {
    return {
      fields,
      errors: {
        address: "We could not geocode this address. Check it and try again.",
      },
    }
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

  const payload = {
    merchant_id: merchant.id,
    name: venueName,
    address,
    latitude: geocoded.latitude,
    longitude: geocoded.longitude,
    geofence_radius_meters: radius,
    require_geofence: requireGeofence,
    geocoded_at: new Date().toISOString(),
    is_primary: true,
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
