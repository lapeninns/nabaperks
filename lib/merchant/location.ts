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
  latitude: number | null
  longitude: number | null
  geofence_radius_meters: number
  require_geofence: boolean
  geocoded_at: string | null
  geofence_pin_source: GeofencePinSource
  geofence_pin_updated_at: string | null
  is_primary: boolean
}

export type MerchantDashboardLocation = {
  id: string
  name: string
  isPrimary: boolean
}

export type MerchantLocationQrSummary = {
  id: string
  name: string
  address: string | null
  isPrimary: boolean
  activeCardName: string | null
  joinQrCodeId: string | null
  joinQrPath: string | null
  pngPath: string | null
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
      "id, name, address, address_line_1, address_line_2, address_city, address_postcode, latitude, longitude, geofence_radius_meters, require_geofence, geocoded_at, geofence_pin_source, geofence_pin_updated_at, is_primary"
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

export async function getMerchantDashboardLocations(
  merchantId: string
): Promise<MerchantDashboardLocation[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from("merchant_locations")
    .select("id, name, is_primary")
    .eq("merchant_id", merchantId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true })

  if (error) {
    throw new Error(`Unable to load merchant locations: ${error.message}`)
  }

  return (data ?? []).map((location) => ({
    id: location.id,
    name: location.name,
    isPrimary: Boolean(location.is_primary),
  }))
}

export async function getMerchantLocationQrSummaries(
  merchantId: string
): Promise<MerchantLocationQrSummary[]> {
  const supabase = await createSupabaseServerClient()
  const { data: locations, error: locationError } = await supabase
    .from("merchant_locations")
    .select("id, name, address, address_line_1, address_city, address_postcode, is_primary")
    .eq("merchant_id", merchantId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true })

  if (locationError) {
    throw new Error(`Unable to load merchant locations: ${locationError.message}`)
  }

  const locationIds = (locations ?? []).map((location) => location.id)
  if (locationIds.length === 0) return []

  const [cards, qrs] = await Promise.all([
    supabase
      .from("loyalty_cards")
      .select("id, location_id, card_name, is_active")
      .eq("merchant_id", merchantId)
      .eq("is_active", true)
      .in("location_id", locationIds),
    supabase
      .from("qr_codes")
      .select("id, qr_id, location_id, is_active, destination_type")
      .eq("merchant_id", merchantId)
      .eq("destination_type", "join")
      .eq("is_active", true)
      .in("location_id", locationIds),
  ])

  if (cards.error) {
    throw new Error(`Unable to load location cards: ${cards.error.message}`)
  }

  if (qrs.error) {
    throw new Error(`Unable to load location QR codes: ${qrs.error.message}`)
  }

  const cardByLocation = new Map(
    (cards.data ?? []).map((card) => [card.location_id, card])
  )
  const qrByLocation = new Map(
    (qrs.data ?? []).map((qr) => [qr.location_id, qr])
  )

  return (locations ?? []).map((location) => {
    const card = cardByLocation.get(location.id)
    const qr = qrByLocation.get(location.id)
    const joinQrPath = qr ? `/q/${qr.qr_id}` : null
    return {
      id: location.id,
      name: location.name,
      address: formatLocationAddress(location),
      isPrimary: Boolean(location.is_primary),
      activeCardName: card?.card_name ?? null,
      joinQrCodeId: qr?.id ?? null,
      joinQrPath,
      pngPath: qr ? `/app/qr/image/${qr.id}` : null,
    }
  })
}

function formatLocationAddress(location: {
  address: string | null
  address_line_1: string | null
  address_city: string | null
  address_postcode: string | null
}) {
  const structured = [
    location.address_line_1,
    location.address_city,
    location.address_postcode,
  ].filter(Boolean)

  return structured.length ? structured.join(", ") : location.address
}
