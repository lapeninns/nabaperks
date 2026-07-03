import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import {
  buildMerchantCustomerReadback,
  DEFAULT_STAMPS_REQUIRED,
  type MerchantCustomerReadbackRow,
} from "@/lib/merchant/customer-readback"
import { CUSTOMERS_PAGE_SIZE } from "@/lib/merchant/customers-paging"
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

type MerchantMembershipRow = {
  id: string
  customer_id: string | null
  current_stamp_count: number
  total_stamps_earned: number
  total_rewards_redeemed: number
  last_visit_at: string | null
  created_at: string
}

type MaskedCustomerRow = {
  id: string
  email: string | null
  phone: string | null
  phone_last4: string | null
}

export async function getMerchantActivity(merchantId: string, limit = 40) {
  return getRecentActivity(merchantId, limit)
}

/** Members redeemed earlier than this many days ago no longer drive the badge. */
const REDEEMED_HISTORY_WINDOW_DAYS = 90

/**
 * Masked-safe customer rows for the Customers table. The merchant session reads
 * customer contact details from the `customers_masked` DB view, which withholds
 * raw contact columns even if a future caller forgets the app-level formatter.
 *
 * Read-path paging (MER-P2-10): `offset`/`limit` window the newest-first list
 * so merchants beyond the first page can reach every member. Defaults keep the
 * historical behaviour (first page of rows) for callers that pass no options; the
 * masked fields, RLS posture, and per-row shape are unchanged.
 */
export async function getMerchantCustomers(
  merchantId: string,
  now: Date = new Date(),
  options?: { readonly limit?: number; readonly offset?: number }
): Promise<MerchantCustomerReadbackRow[]> {
  const limit = Math.max(1, Math.floor(options?.limit ?? CUSTOMERS_PAGE_SIZE))
  const offset = Math.max(0, Math.floor(options?.offset ?? 0))

  // RLS-backed client: merchant-scoped SELECT policies on customer_memberships
  // and the customers_masked view act as a DB backstop in addition to the
  // app-level merchant_id filter.
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from("customer_memberships")
    .select(
      "id, customer_id, current_stamp_count, total_stamps_earned, total_rewards_redeemed, last_visit_at, created_at"
    )
    .eq("merchant_id", merchantId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    throw new Error(`Unable to load customers: ${error.message}`)
  }

  const memberships = (data ?? []) as MerchantMembershipRow[]
  if (!memberships.length) return []

  const membershipIds = memberships.map((row) => row.id)
  const customerIds = uniqueStrings(
    memberships.map((row) => row.customer_id).filter(isString)
  )
  const redeemedSinceIso = new Date(
    now.getTime() - REDEEMED_HISTORY_WINDOW_DAYS * 86_400_000
  ).toISOString()

  // Load active card stamp target and reward state in parallel — no new schema,
  // same tables already hit by the dashboard and reward-collection flows. The
  // redeemed history is bounded to the badge window: anything older can never
  // be the most-recent redemption that the "Redeemed …" badge surfaces.
  const [customerById, cardResult, rewardResult, redeemedResult] =
    await Promise.all([
      loadMaskedCustomers(supabase, customerIds),
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
    const customer = row.customer_id
      ? customerById.get(row.customer_id)
      : undefined
    const maskedCustomer = customer ?? {
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
        email: maskedCustomer.email ?? null,
        phone: maskedCustomer.phone ?? null,
        phone_last4: maskedCustomer.phone_last4 ?? null,
      },
      activeReward: rewardByMembership.get(row.id) ?? null,
      last_redeemed_at: lastRedeemedByMembership.get(row.id) ?? null,
    }
    return buildMerchantCustomerReadback(internalRow, now)
  })
}

async function loadMaskedCustomers(
  supabase: SupabaseClient,
  customerIds: string[]
) {
  const customerById = new Map<string, MaskedCustomerRow>()
  if (!customerIds.length) return customerById

  const { data, error } = await supabase
    .from("customers_masked")
    .select("id, email, phone, phone_last4")
    .in("id", customerIds)

  if (error) {
    throw new Error(`Unable to load masked customers: ${error.message}`)
  }

  for (const customer of (data ?? []) as MaskedCustomerRow[]) {
    customerById.set(customer.id, customer)
  }

  return customerById
}

/**
 * True membership count for a merchant. `getMerchantCustomers` caps its row read
 * per page, so its `.length` understates the real total once a merchant grows past
 * that. This is a `head: true` COUNT — it transfers only the integer, no rows and
 * no PII — so the Customers "Members" stat can show the real total while the list
 * is paged via {@link CUSTOMERS_PAGE_SIZE}. Uses the
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

function isString(value: string | null): value is string {
  return typeof value === "string" && value.length > 0
}

function uniqueStrings(values: string[]) {
  return [...new Set(values)]
}
