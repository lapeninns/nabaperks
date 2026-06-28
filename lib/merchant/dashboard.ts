import "server-only"

import { DEFAULT_STAMPS_REQUIRED } from "@/lib/merchant/customer-readback"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export {
  getMerchantDashboardData,
  getMerchantDashboardSeries,
  type MerchantDashboardMerchant,
  type MerchantDashboardSeries,
} from "@/lib/merchant/dashboard-metrics"
export type { MerchantDashboardTrends } from "@/lib/merchant/dashboard-trends"

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
  stamps_required: number
  customer: {
    email: string | null
    phone: string | null
    phone_last4: string | null
  }
  activeReward: {
    id: string
    redeemable_from: string | null
  } | null
  last_redeemed_at: string | null
}

export async function getMerchantActivity(merchantId: string, limit = 40) {
  return getRecentActivity(merchantId, limit)
}

export async function getMerchantCustomers(merchantId: string) {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("customer_memberships")
    .select(
      "id, current_stamp_count, total_stamps_earned, total_rewards_redeemed, last_visit_at, created_at, customers(email, phone, phone_last4)"
    )
    .eq("merchant_id", merchantId)
    .order("created_at", { ascending: false })
    .limit(100)

  if (error) {
    throw new Error(`Unable to load customers: ${error.message}`)
  }

  const memberships = data ?? []
  if (!memberships.length) return [] satisfies MerchantCustomerRow[]

  const membershipIds = memberships.map((row) => row.id)

  // Load active card stamp target and reward state in parallel — no new schema,
  // same tables already hit by the dashboard and reward-collection flows.
  const [cardResult, rewardResult, redeemedResult] = await Promise.all([
    supabase
      .from("loyalty_cards")
      .select("stamps_required")
      .eq("merchant_id", merchantId)
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1),
    supabase
      .from("reward_events")
      .select("id, membership_id, redeemable_from")
      .eq("merchant_id", merchantId)
      .eq("status", "unlocked")
      .in("membership_id", membershipIds),
    supabase
      .from("reward_events")
      .select("membership_id, redeemed_at")
      .eq("merchant_id", merchantId)
      .eq("status", "redeemed")
      .in("membership_id", membershipIds)
      .order("redeemed_at", { ascending: false }),
  ])

  const stampsRequired =
    (first(cardResult.data) as { stamps_required?: number } | undefined)
      ?.stamps_required ?? DEFAULT_STAMPS_REQUIRED

  // Index by membership_id for O(1) lookups inside the map below.
  const rewardByMembership = new Map<
    string,
    { id: string; redeemable_from: string | null }
  >()
  for (const r of rewardResult.data ?? []) {
    const row = r as {
      id: string
      membership_id: string
      redeemable_from: string | null
    }
    if (!rewardByMembership.has(row.membership_id)) {
      rewardByMembership.set(row.membership_id, {
        id: row.id,
        redeemable_from: row.redeemable_from,
      })
    }
  }

  const lastRedeemedByMembership = new Map<string, string>()
  for (const r of redeemedResult.data ?? []) {
    const row = r as { membership_id: string; redeemed_at: string | null }
    if (!lastRedeemedByMembership.has(row.membership_id) && row.redeemed_at) {
      lastRedeemedByMembership.set(row.membership_id, row.redeemed_at)
    }
  }

  return memberships.map((row) => {
    const customer = first(row.customers) ?? {
      email: null,
      phone: null,
      phone_last4: null,
    }
    return {
      id: row.id,
      current_stamp_count: row.current_stamp_count,
      total_stamps_earned: row.total_stamps_earned,
      total_rewards_redeemed: row.total_rewards_redeemed,
      last_visit_at: row.last_visit_at,
      created_at: row.created_at,
      stamps_required: stampsRequired,
      customer: {
        email: (customer as { email: string | null }).email ?? null,
        phone: (customer as { phone: string | null }).phone ?? null,
        phone_last4:
          (customer as { phone_last4: string | null }).phone_last4 ?? null,
      },
      activeReward: rewardByMembership.get(row.id) ?? null,
      last_redeemed_at: lastRedeemedByMembership.get(row.id) ?? null,
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
