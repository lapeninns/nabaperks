import "server-only"

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

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

export type MerchantDashboardMerchant = {
  id: string
  business_name: string
  status: string
  average_order_value_pence: number
  estimated_gross_margin_bps: number
  reward_cost_pence: number
}

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

export async function getMerchantDashboardData(
  merchant: MerchantDashboardMerchant
) {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [
    members,
    newMembers,
    stampsIssued,
    repeatCustomers,
    rewardsRedeemed,
    qrDownloads,
    billingStatus,
    recentActivity,
  ] = await Promise.all([
    countRows("customer_memberships", merchant.id),
    countNewMembers(merchant.id, since),
    countStampsIssued(merchant.id),
    countRepeatCustomers(merchant.id),
    countRewardsRedeemed(merchant.id),
    countQrDownloads(merchant.id),
    getBillingStatus(merchant.id, merchant.status),
    getRecentActivity(merchant.id, 6),
  ])

  return {
    metrics: {
      members,
      newMembers,
      stampsIssued,
      repeatCustomers,
      rewardsRedeemed,
      qrDownloads,
      estimatedRepeatRevenuePence:
        repeatCustomers * merchant.average_order_value_pence,
    },
    billingStatus,
    recentActivity,
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

async function countRows(
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

async function countNewMembers(merchantId: string, since: string) {
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

async function countStampsIssued(merchantId: string) {
  const supabase = createSupabaseServiceRoleClient()
  const { count, error } = await supabase
    .from("stamp_events")
    .select("*", { count: "exact", head: true })
    .eq("merchant_id", merchantId)
    .eq("event_type", "earned")

  if (error) {
    throw new Error(`Unable to count stamps issued: ${error.message}`)
  }

  return count ?? 0
}

async function countRepeatCustomers(merchantId: string) {
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

async function countRewardsRedeemed(merchantId: string) {
  const supabase = createSupabaseServiceRoleClient()
  const { count, error } = await supabase
    .from("reward_events")
    .select("*", { count: "exact", head: true })
    .eq("merchant_id", merchantId)
    .eq("status", "redeemed")

  if (error) {
    throw new Error(`Unable to count rewards redeemed: ${error.message}`)
  }

  return count ?? 0
}

async function countQrDownloads(merchantId: string) {
  const supabase = createSupabaseServiceRoleClient()
  const { count, error } = await supabase
    .from("product_events")
    .select("*", { count: "exact", head: true })
    .eq("merchant_id", merchantId)
    .eq("event_name", "qr_downloaded")

  if (error) {
    throw new Error(`Unable to count QR downloads: ${error.message}`)
  }

  return count ?? 0
}

async function getBillingStatus(merchantId: string, fallback: string) {
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
