import "server-only"

import {
  buildMerchantDashboardTrends,
  type MerchantDashboardTrends,
} from "@/lib/merchant/dashboard-trends"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export type MerchantDashboardMerchant = {
  id: string
  business_name: string
  status: string
}

export async function getMerchantDashboardData(
  merchant: MerchantDashboardMerchant
) {
  // The headline metrics (RPC, with a per-query fallback) and the week-over-week
  // trends are data-independent, so run them on parallel arms instead of serially
  // awaiting one after the other.
  const [dashboard, trends] = await Promise.all([
    getMerchantDashboardMetrics(merchant).then(
      (rpcResult) => rpcResult ?? getMerchantDashboardDataByQuery(merchant)
    ),
    loadMerchantDashboardTrends(merchant.id),
  ])

  return {
    ...dashboard,
    trends,
  }
}

export type MerchantDashboardSeries = {
  /** Europe/London yyyy-mm-dd day keys, oldest first (length = DASHBOARD_SERIES_DAYS). */
  days: string[]
  joins: number[]
  stamps: number[]
  rewards: number[]
  /**
   * Cumulative member count over the window. Seeded from the true member count
   * before the window (memberships created before the first bucket) and then
   * accumulating per-day joins, so the final point approximates — but does not
   * guarantee — the current total once deletions are taken into account.
   */
  members: number[]
}

const DASHBOARD_SERIES_DAYS = 14

/**
 * Daily counts for the last 14 days, powering the dashboard sparklines and the
 * Stamps-vs-Joins trend chart. There is no per-day aggregate in the schema, so
 * we read the raw `created_at` timestamps for the window and bucket them by
 * Europe/London calendar day (matching the customer-facing badges) — three
 * small selects plus one scoped baseline count, all real data (never
 * fabricated).
 */
export async function getMerchantDashboardSeries(
  merchantId: string
): Promise<MerchantDashboardSeries> {
  const buckets = buildDayBuckets(DASHBOARD_SERIES_DAYS)
  const sinceIso = buckets[0]?.iso ?? new Date().toISOString()
  const supabase = createSupabaseServiceRoleClient()

  const [joinRows, stampRows, rewardRows, baselineMembers] = await Promise.all([
    supabase
      .from("customer_memberships")
      .select("created_at")
      .eq("merchant_id", merchantId)
      .gte("created_at", sinceIso),
    supabase
      .from("stamp_events")
      .select("created_at")
      .eq("merchant_id", merchantId)
      .eq("event_type", "earned")
      .gte("created_at", sinceIso),
    supabase
      .from("reward_events")
      .select("created_at")
      .eq("merchant_id", merchantId)
      .eq("status", "redeemed")
      .gte("created_at", sinceIso),
    // True member count entering the window (memberships created before the
    // oldest bucket). Replaces the previous full-table count that duplicated
    // metrics.members and ignored churn when back-computing the baseline.
    countMembersBefore(merchantId, sinceIso),
  ])

  const failure =
    joinRows.error?.message ??
    stampRows.error?.message ??
    rewardRows.error?.message
  if (failure) {
    throw new Error(`Unable to load dashboard series: ${failure}`)
  }

  const joins = bucketize(joinRows.data, buckets)
  const stamps = bucketize(stampRows.data, buckets)
  const rewards = bucketize(rewardRows.data, buckets)

  // Seed the cumulative line with the real pre-window count, then add each
  // day's joins on top of it.
  let running = baselineMembers
  const members = joins.map((value) => (running += value))

  return {
    days: buckets.map((bucket) => bucket.key),
    joins,
    stamps,
    rewards,
    members,
  }
}

type DayBucket = { key: string; iso: string }

const LONDON = "Europe/London"

function buildDayBuckets(days: number): DayBucket[] {
  // Anchor on noon UTC so each 24h step back stays safely mid-day in London
  // (UTC+0/+1), never straddling local midnight across the yearly DST switch.
  const todayKey = londonDayKey(new Date())
  const anchorNoon = Date.parse(`${todayKey}T12:00:00Z`)
  const buckets: DayBucket[] = []
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const key = londonDayKey(new Date(anchorNoon - offset * 86_400_000))
    buckets.push({ key, iso: londonMidnightFloorIso(key) })
  }
  return buckets
}

/**
 * UTC instant guaranteed to be at or before Europe/London midnight for `dayKey`.
 * London is UTC+0 (GMT) or UTC+1 (BST), so local midnight is at most one hour
 * before UTC midnight; subtracting an hour covers BST exactly and is harmlessly
 * early under GMT (bucketize discards the surplus by London day key).
 */
function londonMidnightFloorIso(dayKey: string): string {
  return new Date(Date.parse(`${dayKey}T00:00:00Z`) - 3_600_000).toISOString()
}

function bucketize(
  rows: { created_at?: string | null }[] | null | undefined,
  buckets: DayBucket[]
): number[] {
  const indexByKey = new Map(
    buckets.map((bucket, index) => [bucket.key, index])
  )
  const counts = new Array<number>(buckets.length).fill(0)
  for (const row of rows ?? []) {
    const createdAt = row?.created_at
    if (typeof createdAt !== "string") continue
    const index = indexByKey.get(londonDayKey(new Date(createdAt)))
    if (index !== undefined) counts[index] += 1
  }
  return counts
}

function londonDayKey(value: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: LONDON,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value)
  const year = parts.find((part) => part.type === "year")?.value
  const month = parts.find((part) => part.type === "month")?.value
  const day = parts.find((part) => part.type === "day")?.value
  return `${year}-${month}-${day}`
}

async function getMerchantDashboardDataByQuery(
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
  ] = await Promise.all([
    countRows("customer_memberships", merchant.id),
    countNewMembers(merchant.id, since),
    countStampsIssued(merchant.id),
    countRepeatCustomers(merchant.id),
    countRewardsRedeemed(merchant.id),
    countQrDownloads(merchant.id),
    getBillingStatus(merchant.id, merchant.status),
  ])

  return {
    metrics: {
      members,
      newMembers,
      stampsIssued,
      repeatCustomers,
      rewardsRedeemed,
      qrDownloads,
    },
    billingStatus,
  }
}

async function getMerchantDashboardMetrics(
  merchant: MerchantDashboardMerchant
) {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc("get_merchant_dashboard_metrics", {
    target_merchant_id: merchant.id,
  })

  if (error) {
    if (isMissingRpcError(error)) {
      return null
    }

    throw new Error(`Unable to load dashboard metrics: ${error.message}`)
  }

  return parseMerchantDashboardMetrics(data, merchant)
}

function isMissingRpcError(error: { code?: string; message?: string }) {
  if (error.code === "PGRST202") {
    return true
  }

  return (
    typeof error.message === "string" &&
    error.message.includes("Could not find the function")
  )
}

function parseMerchantDashboardMetrics(
  data: unknown,
  merchant: MerchantDashboardMerchant
) {
  const row = first(Array.isArray(data) ? data : data ? [data] : [])

  if (!row) return null

  if (!isRecord(row)) {
    throw new Error("Unable to load dashboard metrics: invalid RPC response")
  }

  const members = parseCount(row["members"])
  const newMembers = parseCount(row["new_members"])
  const stampsIssued = parseCount(row["stamps_issued"])
  const repeatCustomers = parseCount(row["repeat_customers"])
  const rewardsRedeemed = parseCount(row["rewards_redeemed"])
  const qrDownloads = parseCount(row["qr_downloads"])

  if (
    members === null ||
    newMembers === null ||
    stampsIssued === null ||
    repeatCustomers === null ||
    rewardsRedeemed === null ||
    qrDownloads === null
  ) {
    throw new Error("Unable to load dashboard metrics: invalid RPC response")
  }

  const billingStatus =
    typeof row["billing_status"] === "string"
      ? row["billing_status"]
      : merchant.status

  return {
    metrics: {
      members,
      newMembers,
      stampsIssued,
      repeatCustomers,
      rewardsRedeemed,
      qrDownloads,
    },
    billingStatus,
  }
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

async function countMembersBefore(merchantId: string, before: string) {
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

function first<T>(value: T | T[] | null | undefined) {
  if (!value) return undefined
  return Array.isArray(value) ? value[0] : value
}

function parseCount(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string" && /^\d+$/.test(value)) {
    return Number(value)
  }

  return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

async function loadMerchantDashboardTrends(
  merchantId: string
): Promise<MerchantDashboardTrends> {
  const { currentStart, previousStart, previousEnd } = weekComparisonBounds()
  const [
    newMembersCurrent,
    newMembersPrevious,
    stampsCurrent,
    stampsPrevious,
    rewardsCurrent,
    rewardsPrevious,
    qrDownloadsCurrent,
    qrDownloadsPrevious,
  ] = await Promise.all([
    countNewMembers(merchantId, currentStart),
    countNewMembersBetween(merchantId, previousStart, previousEnd),
    countStampsIssuedBetween(merchantId, currentStart),
    countStampsIssuedBetween(merchantId, previousStart, previousEnd),
    countRewardsRedeemedBetween(merchantId, currentStart),
    countRewardsRedeemedBetween(merchantId, previousStart, previousEnd),
    countQrDownloadsBetween(merchantId, currentStart),
    countQrDownloadsBetween(merchantId, previousStart, previousEnd),
  ])

  return buildMerchantDashboardTrends({
    newMembers: {
      current: newMembersCurrent,
      previous: newMembersPrevious,
    },
    stamps: { current: stampsCurrent, previous: stampsPrevious },
    rewards: { current: rewardsCurrent, previous: rewardsPrevious },
    qrDownloads: {
      current: qrDownloadsCurrent,
      previous: qrDownloadsPrevious,
    },
  })
}

function weekComparisonBounds() {
  const currentStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const previousStart = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)

  return {
    currentStart: currentStart.toISOString(),
    previousStart: previousStart.toISOString(),
    previousEnd: currentStart.toISOString(),
  }
}

async function countNewMembersBetween(
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

async function countStampsIssuedBetween(
  merchantId: string,
  from: string,
  to?: string
) {
  const supabase = createSupabaseServiceRoleClient()
  let query = supabase
    .from("stamp_events")
    .select("*", { count: "exact", head: true })
    .eq("merchant_id", merchantId)
    .eq("event_type", "earned")
    .gte("created_at", from)

  if (to) {
    query = query.lt("created_at", to)
  }

  const { count, error } = await query

  if (error) {
    throw new Error(`Unable to count stamps issued: ${error.message}`)
  }

  return count ?? 0
}

async function countRewardsRedeemedBetween(
  merchantId: string,
  from: string,
  to?: string
) {
  const supabase = createSupabaseServiceRoleClient()
  let query = supabase
    .from("reward_events")
    .select("*", { count: "exact", head: true })
    .eq("merchant_id", merchantId)
    .eq("status", "redeemed")
    .gte("created_at", from)

  if (to) {
    query = query.lt("created_at", to)
  }

  const { count, error } = await query

  if (error) {
    throw new Error(`Unable to count rewards redeemed: ${error.message}`)
  }

  return count ?? 0
}

async function countQrDownloadsBetween(
  merchantId: string,
  from: string,
  to?: string
) {
  const supabase = createSupabaseServiceRoleClient()
  let query = supabase
    .from("product_events")
    .select("*", { count: "exact", head: true })
    .eq("merchant_id", merchantId)
    .eq("event_name", "qr_downloaded")
    .gte("created_at", from)

  if (to) {
    query = query.lt("created_at", to)
  }

  const { count, error } = await query

  if (error) {
    throw new Error(`Unable to count QR downloads: ${error.message}`)
  }

  return count ?? 0
}
