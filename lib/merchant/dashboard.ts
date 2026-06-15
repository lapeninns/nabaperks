import "server-only"

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export {
  getMerchantDashboardData,
  type MerchantDashboardMerchant,
} from "@/lib/merchant/dashboard-metrics"

const activityEvents = [
  "qr_scanned",
  "customer_joined",
  "stamp_claim_started",
  "stamp_issued",
  "reward_unlocked",
  "reward_redeemed",
  "qr_downloaded",
  "qr_created",
  "qr_enabled",
  "qr_disabled",
  "loyalty_card_created",
  "loyalty_card_updated",
  "merchant_signed_up",
  "subscription_started",
  "subscription_cancelled",
]

export type MerchantActivityItem = {
  id: string
  event_name: string
  created_at: string
  metadata: Record<string, unknown>
}

export type MerchantCustomerRow = {
  id: string
  current_stamp_count: number
  total_stamps_earned: number
  total_rewards_redeemed: number
  last_visit_at: string | null
  created_at: string
  customer: {
    email: string | null
    phone: string | null
  }
}

export async function getMerchantActivity(merchantId: string, limit = 40) {
  return getRecentActivity(merchantId, limit)
}

export async function getMerchantCustomers(merchantId: string) {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("customer_memberships")
    .select(
      "id, current_stamp_count, total_stamps_earned, total_rewards_redeemed, last_visit_at, created_at, customers(email, phone)"
    )
    .eq("merchant_id", merchantId)
    .order("created_at", { ascending: false })
    .limit(100)

  if (error) {
    throw new Error(`Unable to load customers: ${error.message}`)
  }

  return (data ?? []).map((row) => {
    const customer = first(row.customers) ?? { email: null, phone: null }
    return {
      id: row.id,
      current_stamp_count: row.current_stamp_count,
      total_stamps_earned: row.total_stamps_earned,
      total_rewards_redeemed: row.total_rewards_redeemed,
      last_visit_at: row.last_visit_at,
      created_at: row.created_at,
      customer,
    }
  }) satisfies MerchantCustomerRow[]
}

async function getRecentActivity(merchantId: string, limit: number) {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("product_events")
    .select("id, event_name, created_at, metadata")
    .eq("merchant_id", merchantId)
    .in("event_name", activityEvents)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(`Unable to load activity: ${error.message}`)
  }

  return (data ?? []) as MerchantActivityItem[]
}

function first<T>(value: T | T[] | null | undefined) {
  if (!value) return undefined
  return Array.isArray(value) ? value[0] : value
}
