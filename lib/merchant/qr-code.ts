import "server-only"

import { cache } from "react"

import { getCurrentMerchant } from "@/lib/auth/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export type ActiveCardSummary = {
  id: string
  card_name: string
  reward_name: string
  stamps_required: number
}

export type QrCodeSummary = {
  id: string
  qr_id: string
  destination_type: string
  is_active: boolean
}

export type QrSetup = {
  merchant: Awaited<ReturnType<typeof getCurrentMerchant>>
  location: {
    id: string
    name: string
    address: string | null
    latitude: number | null
    longitude: number | null
    geofence_radius_meters: number
    require_geofence: boolean
    geocoded_at: string | null
  } | null
  activeCard: ActiveCardSummary | null
  activeRewardPoolItemCount: number
  qrCode: QrCodeSummary | null
}

async function getQrSetupUncached(): Promise<QrSetup> {
  const merchant = await getCurrentMerchant()

  if (!merchant) {
    return {
      merchant: null,
      location: null,
      activeCard: null,
      activeRewardPoolItemCount: 0,
      qrCode: null,
    }
  }

  const supabase = await createSupabaseServerClient()
  const { data: location, error: locationError } = await supabase
    .from("merchant_locations")
    .select(
      "id, name, address, latitude, longitude, geofence_radius_meters, require_geofence, geocoded_at"
    )
    .eq("merchant_id", merchant.id)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (locationError) {
    throw new Error(`Unable to load merchant location: ${locationError.message}`)
  }

  if (!location) {
    return {
      merchant,
      location: null,
      activeCard: null,
      activeRewardPoolItemCount: 0,
      qrCode: null,
    }
  }

  const { data: activeCard, error: cardError } = await supabase
    .from("loyalty_cards")
    .select("id, card_name, reward_name, stamps_required")
    .eq("merchant_id", merchant.id)
    .eq("location_id", location.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (cardError) {
    throw new Error(`Unable to load active loyalty card: ${cardError.message}`)
  }

  if (!activeCard) {
    return {
      merchant,
      location,
      activeCard: null,
      activeRewardPoolItemCount: 0,
      qrCode: null,
    }
  }

  const [rewardPoolStatus, qrCodeStatus] = await Promise.all([
    supabase
      .from("reward_pool_items")
      .select("id", { count: "exact", head: true })
      .eq("merchant_id", merchant.id)
      .eq("location_id", location.id)
      .eq("loyalty_card_id", activeCard.id)
      .eq("is_active", true),
    supabase
      .from("qr_codes")
      .select("id, qr_id, destination_type, is_active")
      .eq("merchant_id", merchant.id)
      .eq("location_id", location.id)
      .eq("destination_type", "join")
      .order("is_active", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ])

  if (rewardPoolStatus.error) {
    throw new Error(
      `Unable to load reward pool status: ${rewardPoolStatus.error.message}`
    )
  }

  if (qrCodeStatus.error) {
    throw new Error(`Unable to load QR code: ${qrCodeStatus.error.message}`)
  }

  return {
    merchant,
    location,
    activeCard,
    activeRewardPoolItemCount: rewardPoolStatus.count ?? 0,
    qrCode: qrCodeStatus.data,
  }
}

export const getQrSetup = cache(getQrSetupUncached)

/** Uncached reload after server-side QR auto-provision. */
export async function getQrSetupFresh(): Promise<QrSetup> {
  return getQrSetupUncached()
}

export async function getOwnedQrImageContext(qrCodeId: string) {
  const { merchant, location, activeCard } = await getQrSetup()

  if (!merchant || !location || !activeCard) return null

  const supabase = await createSupabaseServerClient()
  const { data: qrCode, error } = await supabase
    .from("qr_codes")
    .select("id, qr_id, destination_type, is_active")
    .eq("id", qrCodeId)
    .eq("merchant_id", merchant.id)
    .eq("location_id", location.id)
    .maybeSingle()

  if (error) {
    throw new Error(`Unable to load QR image context: ${error.message}`)
  }

  if (!qrCode) return null

  return {
    merchant,
    location,
    activeCard,
    qrCode,
  }
}
