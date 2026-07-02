import "server-only"

import {
  buildDayBuckets,
  bucketize,
  DASHBOARD_SERIES_DAYS,
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
  selectRewardRowsForCards,
} from "@/lib/merchant/dashboard-counts"
import {
  countNewMembersBetween,
  countQrDownloadsBetween,
  countRewardsRedeemedBetween,
  countStampsIssuedBetween,
  weekComparisonBounds,
} from "@/lib/merchant/dashboard-period-counts"
import { loadLocationScopeIds } from "@/lib/merchant/dashboard-scope-ids"
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

export type MerchantDashboardQueryScope = {
  readonly locationId?: string
}

export async function getMerchantDashboardDataByQuery(
  merchant: MerchantDashboardMerchant,
  scope: MerchantDashboardQueryScope = {}
) {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const locationIds = scope.locationId
    ? await loadLocationScopeIds(merchant.id, scope.locationId)
    : null
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
    countStampsIssued(merchant.id, scope.locationId),
    countRepeatCustomers(merchant.id),
    countRewardsRedeemed(merchant.id, locationIds?.cardIds),
    countQrDownloads(merchant.id, locationIds?.qrCodeIds),
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
  merchantId: string,
  scope: MerchantDashboardQueryScope = {}
): Promise<MerchantDashboardSeries> {
  const buckets = buildDayBuckets(DASHBOARD_SERIES_DAYS)
  const sinceIso = buckets[0]?.iso ?? new Date().toISOString()
  const supabase = createSupabaseServiceRoleClient()
  const locationIds = scope.locationId
    ? await loadLocationScopeIds(merchantId, scope.locationId)
    : null

  let stampQuery = supabase
    .from("stamp_events")
    .select("created_at")
    .eq("merchant_id", merchantId)
    .eq("event_type", "earned")
    .gte("created_at", sinceIso)

  if (scope.locationId) {
    stampQuery = stampQuery.eq("location_id", scope.locationId)
  }

  const rewardRowsPromise = locationIds
    ? selectRewardRowsForCards(merchantId, locationIds.cardIds, sinceIso)
    : supabase
        .from("reward_events")
        .select("created_at")
        .eq("merchant_id", merchantId)
        .eq("status", "redeemed")
        .gte("created_at", sinceIso)

  const [joinRows, stampRows, rewardRows, baselineMembers] = await Promise.all([
    supabase
      .from("customer_memberships")
      .select("created_at")
      .eq("merchant_id", merchantId)
      .gte("created_at", sinceIso),
    stampQuery,
    rewardRowsPromise,
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
  merchantId: string,
  scope: MerchantDashboardQueryScope = {}
): Promise<MerchantDashboardTrends> {
  const { currentStart, previousStart, previousEnd } = weekComparisonBounds()
  const locationIds = scope.locationId
    ? await loadLocationScopeIds(merchantId, scope.locationId)
    : null
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
    countStampsIssuedBetween(merchantId, currentStart, scope.locationId),
    countStampsIssuedBetween(
      merchantId,
      previousStart,
      scope.locationId,
      previousEnd
    ),
    countRewardsRedeemedBetween(merchantId, currentStart, locationIds?.cardIds),
    countRewardsRedeemedBetween(
      merchantId,
      previousStart,
      locationIds?.cardIds,
      previousEnd
    ),
    countQrDownloadsBetween(merchantId, currentStart, locationIds?.qrCodeIds),
    countQrDownloadsBetween(
      merchantId,
      previousStart,
      locationIds?.qrCodeIds,
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
