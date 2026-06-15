import "server-only"

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

const requiredPaidLaunchEvents = [
  "merchant_signed_up",
  "loyalty_card_created",
  "qr_created",
  "qr_downloaded",
  "customer_joined",
  "stamp_issued",
  "reward_redeemed",
] as const

export async function countRows(table: "merchants") {
  const supabase = createSupabaseServiceRoleClient()
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true })

  if (error) {
    throw new Error(`Unable to count ${table}: ${error.message}`)
  }

  return count ?? 0
}

export async function countMembershipsWithSecondStamp() {
  const supabase = createSupabaseServiceRoleClient()
  const { count, error } = await supabase
    .from("customer_memberships")
    .select("*", { count: "exact", head: true })
    .gte("total_stamps_earned", 2)

  if (error) {
    throw new Error(`Unable to count repeat customers: ${error.message}`)
  }

  return count ?? 0
}

export async function countBillingStatuses(statuses: readonly string[]) {
  const supabase = createSupabaseServiceRoleClient()
  const { count, error } = await supabase
    .from("billing_customers")
    .select("*", { count: "exact", head: true })
    .in("status", statuses)

  if (error) {
    throw new Error(`Unable to count billing statuses: ${error.message}`)
  }

  return count ?? 0
}

export async function countPaidLaunchProofMerchants() {
  const supabase = createSupabaseServiceRoleClient()
  const { data: billingRows, error: billingError } = await supabase
    .from("billing_customers")
    .select("merchant_id")
    .eq("status", "active")

  if (billingError) {
    throw new Error(
      `Unable to load paid pilot merchants: ${billingError.message}`
    )
  }

  const merchantIds = Array.from(
    new Set(
      (billingRows ?? [])
        .map((row) => row.merchant_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    )
  )

  if (!merchantIds.length) {
    return 0
  }

  const { data: eventRows, error: eventError } = await supabase
    .from("product_events")
    .select("merchant_id,event_name")
    .in("merchant_id", merchantIds)
    .in("event_name", requiredPaidLaunchEvents)

  if (eventError) {
    throw new Error(
      `Unable to load paid pilot launch events: ${eventError.message}`
    )
  }

  const eventsByMerchant = new Map<string, Set<string>>()

  for (const row of eventRows ?? []) {
    if (
      typeof row.merchant_id !== "string" ||
      typeof row.event_name !== "string"
    ) {
      continue
    }

    const events = eventsByMerchant.get(row.merchant_id) ?? new Set<string>()
    events.add(row.event_name)
    eventsByMerchant.set(row.merchant_id, events)
  }

  return merchantIds.filter((merchantId) => {
    const events = eventsByMerchant.get(merchantId)
    return requiredPaidLaunchEvents.every((eventName) => events?.has(eventName))
  }).length
}

export async function countAuditActions(actions: readonly string[]) {
  const supabase = createSupabaseServiceRoleClient()
  const { count, error } = await supabase
    .from("audit_logs")
    .select("*", { count: "exact", head: true })
    .in("action", actions)

  if (error) {
    throw new Error(`Unable to count audit actions: ${error.message}`)
  }

  return count ?? 0
}
