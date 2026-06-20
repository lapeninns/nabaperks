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
  const rpcResult = await getMerchantDashboardMetrics(merchant)
  const dashboard =
    rpcResult ?? (await getMerchantDashboardDataByQuery(merchant))
  const trends = await loadMerchantDashboardTrends(merchant.id)

  return {
    ...dashboard,
    trends,
  }
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
