import "server-only"

import { getCurrentMerchant } from "@/lib/auth/session"
import type { GeofencePinSource } from "@/lib/merchant/venue-address"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export type MerchantVenueLocation = {
  id: string
  name: string
  address: string | null
  address_line_1: string | null
  address_line_2: string | null
  address_city: string | null
  address_postcode: string | null
  address_source: "manual_entry" | "provider_lookup" | null
  address_provider: "google_places" | null
  address_provider_id: string | null
  latitude: number | null
  longitude: number | null
  geofence_radius_meters: number
  require_geofence: boolean
  soft_geofence_trigger_stamp_number: number
  geocoded_at: string | null
  geofence_pin_source: GeofencePinSource
  geofence_pin_updated_at: string | null
  is_primary: boolean
}

export async function getCurrentVenueLocation() {
  const merchant = await getCurrentMerchant()

  if (!merchant) {
    return { merchant: null, location: null }
  }

  const supabase = await createSupabaseServerClient()
  const { data: location, error } = await supabase
    .from("merchant_locations")
    .select(
      "id, name, address, address_line_1, address_line_2, address_city, address_postcode, address_source, address_provider, address_provider_id, latitude, longitude, geofence_radius_meters, require_geofence, soft_geofence_trigger_stamp_number, geocoded_at, geofence_pin_source, geofence_pin_updated_at, is_primary"
    )
    .eq("merchant_id", merchant.id)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(`Unable to load venue location: ${error.message}`)
  }

  return {
    merchant,
    location: location
      ? {
          id: location.id,
          name: location.name,
          address: location.address,
          address_line_1: location.address_line_1,
          address_line_2: location.address_line_2,
          address_city: location.address_city,
          address_postcode: location.address_postcode,
          address_source:
            location.address_source === "provider_lookup"
              ? "provider_lookup"
              : location.address_source === "manual_entry"
                ? "manual_entry"
                : null,
          address_provider:
            location.address_provider === "google_places"
              ? "google_places"
              : null,
          address_provider_id: location.address_provider_id,
          latitude: location.latitude,
          longitude: location.longitude,
          geofence_radius_meters: location.geofence_radius_meters ?? 150,
          require_geofence: Boolean(location.require_geofence),
          soft_geofence_trigger_stamp_number:
            location.soft_geofence_trigger_stamp_number ?? 3,
          geocoded_at: location.geocoded_at,
          geofence_pin_source:
            location.geofence_pin_source === "merchant_pin"
              ? "merchant_pin"
              : "geocoded",
          geofence_pin_updated_at: location.geofence_pin_updated_at,
          is_primary: Boolean(location.is_primary),
        }
      : null,
  }
}
