import "server-only"

import { getCurrentMerchant } from "@/lib/auth/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export type MerchantVenueLocation = {
  id: string
  name: string
  address: string | null
  address_line_1: string | null
  address_line_2: string | null
  address_city: string | null
  address_postcode: string | null
  latitude: number | null
  longitude: number | null
  geofence_radius_meters: number
  require_geofence: boolean
  geocoded_at: string | null
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
      "id, name, address, address_line_1, address_line_2, address_city, address_postcode, latitude, longitude, geofence_radius_meters, require_geofence, geocoded_at"
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
          latitude: location.latitude,
          longitude: location.longitude,
          geofence_radius_meters: location.geofence_radius_meters ?? 150,
          require_geofence: Boolean(location.require_geofence),
          geocoded_at: location.geocoded_at,
        }
      : null,
  }
}
