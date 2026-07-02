import "server-only"

import {
  getMerchantDashboardDataByQuery,
  getMerchantDashboardSeriesByQuery,
  loadMerchantDashboardTrends,
  type MerchantDashboardSeries,
} from "@/lib/merchant/dashboard-query"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export type { MerchantDashboardSeries }

export type MerchantDashboardMerchant = {
  id: string
  business_name: string
  status: string
}

export async function getMerchantDashboardData(merchant: MerchantDashboardMerchant) {
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

export async function getMerchantDashboardSeries(
  merchantId: string
): Promise<MerchantDashboardSeries> {
  return getMerchantDashboardSeriesByQuery(merchantId)
}

async function getMerchantDashboardMetrics(merchant: MerchantDashboardMerchant) {
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

function isMissingRpcError(error: { readonly code?: string; readonly message?: string }) {
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
