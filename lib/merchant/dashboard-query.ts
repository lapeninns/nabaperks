import "server-only"

import {
  buildDayBuckets,
  bucketize,
  mapSeriesRowsToBuckets,
  DASHBOARD_SERIES_DAYS,
  type DayBucket,
} from "@/lib/merchant/dashboard-buckets"
import {
  countMembersBefore,
  countNewMembers,
  countQrDownloads,
  countRepeatCustomers,
  countRewardsRedeemed,
  countRows,
  countStampsIssued,
  getBillingStatus,
} from "@/lib/merchant/dashboard-counts"
import {
  countNewMembersBetween,
  countQrDownloadsBetween,
  countRewardsRedeemedBetween,
  countStampsIssuedBetween,
  weekComparisonBounds,
} from "@/lib/merchant/dashboard-period-counts"
import {
  buildMerchantDashboardTrends,
  type MerchantDashboardTrends,
} from "@/lib/merchant/dashboard-trends"
import type { MerchantDashboardMerchant } from "@/lib/merchant/dashboard-metrics"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export type MerchantDashboardSeries = {
  readonly days: string[]
  readonly joins: number[]
  readonly stamps: number[]
  readonly rewards: number[]
  readonly members: number[]
}

export async function getMerchantDashboardDataByQuery(
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

export async function getMerchantDashboardSeriesByQuery(
  merchantId: string
): Promise<MerchantDashboardSeries> {
  const buckets = buildDayBuckets(DASHBOARD_SERIES_DAYS)

  // SQL-side aggregation is the primary path: PostgREST caps row responses
  // at 1,000, so the legacy row-fetch under-counts a busy venue's window.
  // The RPC returns one bounded row per London day instead.
  const rpcSeries = await getMerchantDashboardSeriesViaRpc(merchantId, buckets)
  if (rpcSeries) return rpcSeries

  return getMerchantDashboardSeriesByRowFetch(merchantId, buckets)
}

async function getMerchantDashboardSeriesViaRpc(
  merchantId: string,
  buckets: readonly DayBucket[]
): Promise<MerchantDashboardSeries | null> {
  const sinceIso = buckets[0]?.iso ?? new Date().toISOString()
  const supabase = createSupabaseServiceRoleClient()
  const [{ data, error }, baselineMembers] = await Promise.all([
    supabase.rpc("get_merchant_dashboard_series", {
      target_merchant_id: merchantId,
      p_days: buckets.length,
    }),
    countMembersBefore(merchantId, sinceIso),
  ])

  if (error) {
    // Deploy-before-migrate safety: fall back to the row-fetch path until
    // the aggregation RPC exists in this environment.
    if (isMissingSeriesRpcError(error)) return null
    throw new Error(`Unable to load dashboard series: ${error.message}`)
  }

  const { joins, stamps, rewards } = mapSeriesRowsToBuckets(
    Array.isArray(data) ? data : [],
    buckets
  )

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

function isMissingSeriesRpcError(error: {
  readonly code?: string
  readonly message?: string
}) {
  if (error.code === "PGRST202") return true
  return (
    typeof error.message === "string" &&
    error.message.includes("Could not find the function")
  )
}

async function getMerchantDashboardSeriesByRowFetch(
  merchantId: string,
  buckets: readonly DayBucket[]
): Promise<MerchantDashboardSeries> {
  const sinceIso = buckets[0]?.iso ?? new Date().toISOString()
  const supabase = createSupabaseServiceRoleClient()
  const stampQuery = supabase
    .from("stamp_events")
    .select("created_at")
    .eq("merchant_id", merchantId)
    .eq("event_type", "earned")
    .gte("created_at", sinceIso)

  const [joinRows, stampRows, rewardRows, baselineMembers] = await Promise.all([
    supabase
      .from("customer_memberships")
      .select("created_at")
      .eq("merchant_id", merchantId)
      .gte("created_at", sinceIso),
    stampQuery,
    supabase
      .from("reward_events")
      .select("created_at")
      .eq("merchant_id", merchantId)
      .eq("status", "redeemed")
      .gte("created_at", sinceIso),
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

export async function loadMerchantDashboardTrends(
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
    countStampsIssuedBetween(
      merchantId,
      previousStart,
      previousEnd
    ),
    countRewardsRedeemedBetween(merchantId, currentStart),
    countRewardsRedeemedBetween(
      merchantId,
      previousStart,
      previousEnd
    ),
    countQrDownloadsBetween(merchantId, currentStart),
    countQrDownloadsBetween(
      merchantId,
      previousStart,
      previousEnd
    ),
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
