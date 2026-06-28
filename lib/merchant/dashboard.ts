import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import {
  buildMerchantCustomerReadback,
  deriveMerchantCustomerRewardBadge,
  DEFAULT_STAMPS_REQUIRED,
  type MerchantCustomerReadbackRow,
} from "@/lib/merchant/customer-readback"
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server"

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

/** Members redeemed earlier than this many days ago no longer drive the badge. */
const REDEEMED_HISTORY_WINDOW_DAYS = 90

/**
 * Masked-safe customer rows for the Customers table. Masking happens here, in
 * `lib/merchant/*`, so raw email/phone never leave the server boundary — the
 * return type is the same pre-masked view model the client table consumes.
 */
export async function getMerchantCustomers(
  merchantId: string,
  now: Date = new Date()
): Promise<MerchantCustomerReadbackRow[]> {
  // RLS-backed client: merchant-scoped SELECT policies on customer_memberships /
  // customers act as a DB backstop in addition to the app-level merchant_id
  // filter (mirrors lib/merchant/profile.ts). Both callers pass the
  // session-derived merchant id, so the cookie-scoped session sees these rows.
  const supabase = await createSupabaseServerClient()
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
  if (!memberships.length) return []

  const membershipIds = memberships.map((row) => row.id)
  const redeemedSinceIso = new Date(
    now.getTime() - REDEEMED_HISTORY_WINDOW_DAYS * 86_400_000
  ).toISOString()

  // Load active card stamp target and reward state in parallel — no new schema,
  // same tables already hit by the dashboard and reward-collection flows. The
  // redeemed history is bounded to the badge window: anything older can never
  // be the most-recent redemption that the "Redeemed …" badge surfaces.
  const [cardResult, rewardResult, redeemedResult] = await Promise.all([
    getActiveCardResult(supabase, merchantId),
    getUnlockedRewardResult(supabase, merchantId, membershipIds),
    supabase
      .from("reward_events")
      .select("membership_id, redeemed_at")
      .eq("merchant_id", merchantId)
      .eq("status", "redeemed")
      .in("membership_id", membershipIds)
      .gte("redeemed_at", redeemedSinceIso)
      .order("redeemed_at", { ascending: false }),
  ])

  const stampsRequired = resolveStampsRequired(cardResult)
  const rewardByMembership = indexUnlockedRewards(rewardResult)

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
    const internalRow: MerchantCustomerRow = {
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
    // Mask before the row leaves this module: raw email/phone never escape.
    return buildMerchantCustomerReadback(internalRow, now)
  })
}

/**
 * True membership count for a merchant. `getMerchantCustomers` caps its row read
 * at 100, so its `.length` understates the real total once a merchant grows past
 * that. This is a `head: true` COUNT — it transfers only the integer, no rows and
 * no PII — so the Customers "Members" stat can show the real total while the list
 * stays capped (full >100 pagination is intentionally out of scope). Uses the
 * RLS-backed server client to match `getMerchantCustomers`' merchant-scoped read.
 */
export async function getMerchantCustomerCount(
  merchantId: string
): Promise<number> {
  const supabase = await createSupabaseServerClient()
  const { count, error } = await supabase
    .from("customer_memberships")
    .select("id", { count: "exact", head: true })
    .eq("merchant_id", merchantId)

  if (error) {
    throw new Error(`Unable to count customers: ${error.message}`)
  }

  return count ?? 0
}

export type MerchantDashboardCustomerCounts = {
  readyCount: number
  quietCount: number
}

/**
 * The dashboard "Do next" card needs only two integers — how many members have
 * a reward ready and how many have gone quiet. Deriving those from the full
 * masked customer list pulled PII into the dashboard path and ran four queries
 * for two numbers. This computes the same counts from a PII-free projection,
 * reusing the single badge source of truth so first-match precedence (ready →
 * waiting → new → quiet) stays identical. The redeemed-history query is dropped
 * entirely: redeemed/collecting both rank below quiet and never change either
 * count.
 */
export async function getMerchantDashboardCustomerCounts(
  merchantId: string,
  now: Date = new Date()
): Promise<MerchantDashboardCustomerCounts> {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("customer_memberships")
    .select("id, current_stamp_count, last_visit_at, created_at")
    .eq("merchant_id", merchantId)
    .order("created_at", { ascending: false })
    .limit(100)

  if (error) {
    throw new Error(`Unable to load customer counts: ${error.message}`)
  }

  const memberships = data ?? []
  if (!memberships.length) return { readyCount: 0, quietCount: 0 }

  const membershipIds = memberships.map((row) => row.id)
  const [cardResult, rewardResult] = await Promise.all([
    getActiveCardResult(supabase, merchantId),
    getUnlockedRewardResult(supabase, merchantId, membershipIds),
  ])

  const stampsRequired = resolveStampsRequired(cardResult)
  const rewardByMembership = indexUnlockedRewards(rewardResult)

  let readyCount = 0
  let quietCount = 0
  for (const row of memberships) {
    const m = row as {
      id: string
      current_stamp_count: number
      last_visit_at: string | null
      created_at: string
    }
    const activeReward = rewardByMembership.get(m.id) ?? null
    const badge = deriveMerchantCustomerRewardBadge(
      {
        createdAt: m.created_at,
        lastVisitAt: m.last_visit_at,
        currentStampCount: m.current_stamp_count,
        stampsRequired,
        // Below quiet in precedence and irrelevant to ready/quiet, so omitted.
        lastRedeemedAt: null,
        activeReward: activeReward
          ? { id: activeReward.id, redeemableFrom: activeReward.redeemable_from }
          : null,
      },
      now
    )
    if (badge.tone === "ready") readyCount += 1
    else if (badge.tone === "quiet") quietCount += 1
  }

  return { readyCount, quietCount }
}

type ActiveCardResult = Awaited<ReturnType<typeof getActiveCardResult>>

function getActiveCardResult(supabase: SupabaseClient, merchantId: string) {
  return supabase
    .from("loyalty_cards")
    .select("stamps_required")
    .eq("merchant_id", merchantId)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
}

function getUnlockedRewardResult(
  supabase: SupabaseClient,
  merchantId: string,
  membershipIds: string[]
) {
  return supabase
    .from("reward_events")
    .select("id, membership_id, redeemable_from")
    .eq("merchant_id", merchantId)
    .eq("status", "unlocked")
    .in("membership_id", membershipIds)
}

function resolveStampsRequired(cardResult: ActiveCardResult): number {
  return (
    (first(cardResult.data) as { stamps_required?: number } | undefined)
      ?.stamps_required ?? DEFAULT_STAMPS_REQUIRED
  )
}

function indexUnlockedRewards(
  rewardResult: Awaited<ReturnType<typeof getUnlockedRewardResult>>
): Map<string, { id: string; redeemable_from: string | null }> {
  // Index by membership_id for O(1) lookups; keep the first row per membership
  // to match the prior behaviour the badge logic was tuned against.
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
  return rewardByMembership
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
