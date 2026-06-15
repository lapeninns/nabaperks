import "server-only"

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export type MerchantDashboardMerchant = {
  id: string
  business_name: string
  status: string
  average_order_value_pence: number
  estimated_gross_margin_bps: number
  reward_cost_pence: number
}

export async function getMerchantDashboardData(
  merchant: MerchantDashboardMerchant
) {
  const rpcResult = await getMerchantDashboardMetrics(merchant)

  if (rpcResult) {
    return rpcResult
  }

  return getMerchantDashboardDataByQuery(merchant)
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
      estimatedRepeatRevenuePence:
        repeatCustomers * merchant.average_order_value_pence,
    },
    billingStatus,
  }
}

async function getMerchantDashboardMetrics(merchant: MerchantDashboardMerchant) {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc(
    "get_merchant_dashboard_metrics",
    { target_merchant_id: merchant.id }
  )

  if (error) {
    throw new Error(`Unable to load dashboard metrics: ${error.message}`)
  }

  return parseMerchantDashboardMetrics(data, merchant)
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
      estimatedRepeatRevenuePence:
        repeatCustomers * merchant.average_order_value_pence,
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
