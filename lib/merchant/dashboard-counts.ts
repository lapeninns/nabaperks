import "server-only"

import {
  countQrDownloadsBetween,
  countRewardsRedeemedBetween,
  countStampsIssuedBetween,
} from "@/lib/merchant/dashboard-period-counts"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export async function countRows(
  table:
    | "customer_memberships"
    | "stamp_events"
    | "reward_events"
    | "product_events",
  merchantId: string
) {
  const supabase = createSupabaseServiceRoleClient()
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("merchant_id", merchantId)

  if (error) {
    throw new Error(`Unable to count ${table}: ${error.message}`)
  }

  return count ?? 0
}

export async function countNewMembers(merchantId: string, since: string) {
  const supabase = createSupabaseServiceRoleClient()
  const { count, error } = await supabase
    .from("customer_memberships")
    .select("*", { count: "exact", head: true })
    .eq("merchant_id", merchantId)
    .gte("created_at", since)

  if (error) {
    throw new Error(`Unable to count new members: ${error.message}`)
  }

  return count ?? 0
}

export async function countMembersBefore(merchantId: string, before: string) {
  const supabase = createSupabaseServiceRoleClient()
  const { count, error } = await supabase
    .from("customer_memberships")
    .select("*", { count: "exact", head: true })
    .eq("merchant_id", merchantId)
    .lt("created_at", before)

  if (error) {
    throw new Error(`Unable to count members: ${error.message}`)
  }

  return count ?? 0
}

export async function countStampsIssued(
  merchantId: string,
  locationId?: string
) {
  return countStampsIssuedBetween(
    merchantId,
    new Date(0).toISOString(),
    locationId
  )
}

export async function countRepeatCustomers(merchantId: string) {
  const supabase = createSupabaseServiceRoleClient()
  const { count, error } = await supabase
    .from("customer_memberships")
    .select("*", { count: "exact", head: true })
    .eq("merchant_id", merchantId)
    .gt("total_stamps_earned", 1)

  if (error) {
    throw new Error(`Unable to count repeat customers: ${error.message}`)
  }

  return count ?? 0
}

export async function countRewardsRedeemed(
  merchantId: string,
  cardIds?: readonly string[]
) {
  return countRewardsRedeemedBetween(
    merchantId,
    new Date(0).toISOString(),
    cardIds
  )
}

export async function countQrDownloads(
  merchantId: string,
  qrCodeIds?: readonly string[]
) {
  return countQrDownloadsBetween(
    merchantId,
    new Date(0).toISOString(),
    qrCodeIds
  )
}

export async function getBillingStatus(merchantId: string, fallback: string) {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("billing_customers")
    .select("status")
    .eq("merchant_id", merchantId)
    .maybeSingle()

  if (error) {
    throw new Error(`Unable to load billing status: ${error.message}`)
  }

  return data?.status ?? fallback
}

export async function selectRewardRowsForCards(
  merchantId: string,
  cardIds: readonly string[],
  sinceIso: string
) {
  const supabase = createSupabaseServiceRoleClient()
  if (cardIds.length === 0) {
    return { data: [], error: null }
  }

  return supabase
    .from("reward_events")
    .select("created_at")
    .eq("merchant_id", merchantId)
    .eq("status", "redeemed")
    .in("loyalty_card_id", [...cardIds])
    .gte("created_at", sinceIso)
}
