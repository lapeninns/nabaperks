import "server-only"

import { firstOf, getCurrentCustomer } from "@/lib/customer/identity"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export type JoinFirstStampResolution = "rescan" | "retry" | "venue_action"

export type JoinFirstStampRecovery = {
  readonly resolution: JoinFirstStampResolution
  readonly retryUntil: string | null
  readonly merchantId: string
}

export type JoinFirstStampRetryOutcome =
  | "already_issued"
  | "expired"
  | "issued"
  | "not_found"
  | "pending"
  | "rescan_required"
  | "venue_action_required"

export async function getJoinFirstStampRecovery(
  membershipId: string
): Promise<JoinFirstStampRecovery | null> {
  const customer = await getCurrentCustomer()
  if (!customer) return null

  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("customer_join_stamp_recoveries")
    .select("resolution, retry_until, status, merchant_id")
    .eq("membership_id", membershipId)
    .eq("customer_id", customer.id)
    .in("status", ["pending", "expired"])
    .maybeSingle()

  if (error) {
    throw new Error(`Unable to load first-stamp recovery: ${error.message}`)
  }
  return parseRecovery(data)
}

export async function retryJoinFirstStampRecovery(
  membershipId: string
): Promise<JoinFirstStampRetryOutcome> {
  const customer = await getCurrentCustomer()
  if (!customer) return "not_found"

  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc(
    "retry_customer_join_first_stamp",
    {
      p_membership_id: membershipId,
      p_customer_id: customer.id,
    }
  )
  if (error) {
    throw new Error(`Unable to retry first stamp: ${error.message}`)
  }

  return parseRetryOutcome(firstOf(data)?.outcome)
}

function parseRecovery(value: unknown): JoinFirstStampRecovery | null {
  if (!isRecord(value)) return null
  if (value.status === "expired") {
    const merchantId = stringField(value.merchant_id)
    return merchantId
      ? { resolution: "venue_action", retryUntil: null, merchantId }
      : null
  }
  if (value.status !== "pending") return null
  const resolution = parseResolution(value.resolution)
  if (!resolution) return null
  const retryUntil =
    typeof value.retry_until === "string" ? value.retry_until : null
  if (resolution === "retry" && !retryUntil) return null
  const merchantId = stringField(value.merchant_id)
  return merchantId ? { resolution, retryUntil, merchantId } : null
}

function parseResolution(value: unknown): JoinFirstStampResolution | null {
  if (value === "rescan" || value === "retry" || value === "venue_action") {
    return value
  }
  return null
}

function parseRetryOutcome(value: unknown): JoinFirstStampRetryOutcome {
  switch (value) {
    case "already_issued":
    case "expired":
    case "issued":
    case "pending":
    case "rescan_required":
    case "venue_action_required":
      return value
    case "not_found":
    default:
      return "not_found"
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function stringField(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null
}
