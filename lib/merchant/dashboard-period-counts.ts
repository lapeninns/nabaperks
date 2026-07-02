import "server-only"

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export function weekComparisonBounds() {
  const currentStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const previousStart = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)

  return {
    currentStart: currentStart.toISOString(),
    previousStart: previousStart.toISOString(),
    previousEnd: currentStart.toISOString(),
  }
}

export async function countNewMembersBetween(
  merchantId: string,
  from: string,
  to: string
) {
  const supabase = createSupabaseServiceRoleClient()
  const { count, error } = await supabase
    .from("customer_memberships")
    .select("*", { count: "exact", head: true })
    .eq("merchant_id", merchantId)
    .gte("created_at", from)
    .lt("created_at", to)

  if (error) {
    throw new Error(`Unable to count new members: ${error.message}`)
  }

  return count ?? 0
}

export async function countStampsIssuedBetween(
  merchantId: string,
  from: string,
  locationId?: string,
  to?: string
) {
  const supabase = createSupabaseServiceRoleClient()
  let query = supabase
    .from("stamp_events")
    .select("*", { count: "exact", head: true })
    .eq("merchant_id", merchantId)
    .eq("event_type", "earned")
    .gte("created_at", from)

  if (locationId) {
    query = query.eq("location_id", locationId)
  }

  if (to) {
    query = query.lt("created_at", to)
  }

  const { count, error } = await query

  if (error) {
    throw new Error(`Unable to count stamps issued: ${error.message}`)
  }

  return count ?? 0
}

export async function countRewardsRedeemedBetween(
  merchantId: string,
  from: string,
  cardIds?: readonly string[],
  to?: string
) {
  if (cardIds && cardIds.length === 0) return 0

  const supabase = createSupabaseServiceRoleClient()
  let query = supabase
    .from("reward_events")
    .select("*", { count: "exact", head: true })
    .eq("merchant_id", merchantId)
    .eq("status", "redeemed")
    .gte("created_at", from)

  if (cardIds) {
    query = query.in("loyalty_card_id", [...cardIds])
  }

  if (to) {
    query = query.lt("created_at", to)
  }

  const { count, error } = await query

  if (error) {
    throw new Error(`Unable to count rewards redeemed: ${error.message}`)
  }

  return count ?? 0
}

export async function countQrDownloadsBetween(
  merchantId: string,
  from: string,
  qrCodeIds?: readonly string[],
  to?: string
) {
  if (qrCodeIds && qrCodeIds.length === 0) return 0

  const supabase = createSupabaseServiceRoleClient()
  let query = supabase
    .from("product_events")
    .select("*", { count: "exact", head: true })
    .eq("merchant_id", merchantId)
    .eq("event_name", "qr_downloaded")
    .gte("created_at", from)

  if (qrCodeIds) {
    query = query.in("qr_code_id", [...qrCodeIds])
  }

  if (to) {
    query = query.lt("created_at", to)
  }

  const { count, error } = await query

  if (error) {
    throw new Error(`Unable to count QR downloads: ${error.message}`)
  }

  return count ?? 0
}
