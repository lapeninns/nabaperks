import "server-only"

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export { getAdminPilotMerchants, getAdminPilotReport } from "./pilot-report"

export async function getAdminOverview() {
  const [merchants, customers, billingIssues, recentAudits] = await Promise.all([
    countRows("merchants"),
    countRows("customers"),
    countBillingIssues(),
    getAdminAuditLogs(6),
  ])

  return { merchants, customers, billingIssues, recentAudits }
}

export async function getAdminMerchants() {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("merchants")
    .select(
      "id, business_name, business_slug, email, status, created_at, billing_customers(status, plan, current_period_end)"
    )
    .order("created_at", { ascending: false })
    .limit(100)

  if (error) {
    throw new Error(`Unable to load merchants: ${error.message}`)
  }

  return data ?? []
}

export async function getAdminQrCodes() {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("qr_codes")
    .select("id, qr_id, is_active, destination_type, created_at, merchants(business_name)")
    .order("created_at", { ascending: false })
    .limit(100)

  if (error) {
    throw new Error(`Unable to load QR codes: ${error.message}`)
  }

  return data ?? []
}

export async function getAdminCustomers() {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("customer_memberships")
    .select(
      "id, current_stamp_count, total_stamps_earned, total_rewards_redeemed, created_at, customers(email, phone), merchants(business_name)"
    )
    .order("created_at", { ascending: false })
    .limit(100)

  if (error) {
    throw new Error(`Unable to load customer memberships: ${error.message}`)
  }

  return data ?? []
}

export async function getAdminPrivacySupportRows() {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("customer_memberships")
    .select(
      "id, merchant_id, customer_id, created_at, customers(email, phone), merchants(business_name)"
    )
    .order("created_at", { ascending: false })
    .limit(100)

  if (error) {
    throw new Error(`Unable to load privacy support rows: ${error.message}`)
  }

  return data ?? []
}

export async function getAdminConsentRecords() {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("consent_records")
    .select(
      "id, channel, consent_status, source, policy_version, created_at, metadata, customers(email, phone), merchants(business_name)"
    )
    .order("created_at", { ascending: false })
    .limit(100)

  if (error) {
    throw new Error(`Unable to load consent records: ${error.message}`)
  }

  return data ?? []
}

export async function getAdminRewards() {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("reward_events")
    .select(
      "id, status, cancelled_reason, created_at, redeemed_at, customers(email, phone), merchants(business_name), loyalty_cards(reward_name)"
    )
    .order("created_at", { ascending: false })
    .limit(100)

  if (error) {
    throw new Error(`Unable to load rewards: ${error.message}`)
  }

  return data ?? []
}

export async function getAdminBillingRecords() {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("billing_customers")
    .select(
      "id, plan, status, stripe_customer_id, stripe_subscription_id, current_period_end, updated_at, merchants(business_name, email)"
    )
    .order("updated_at", { ascending: false })
    .limit(100)

  if (error) {
    throw new Error(`Unable to load billing records: ${error.message}`)
  }

  return data ?? []
}

export async function getAdminFraudSignals() {
  const supabase = createSupabaseServiceRoleClient()
  const [
    { data: fraudFlags, error: flagsError },
    { data: failures, error: failureError },
  ] =
    await Promise.all([
      supabase
        .from("fraud_flags")
        .select(
          "id, signal, severity, status, metadata, created_at, merchants(business_name), customers(email, phone)"
        )
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("product_events")
        .select("id, event_name, created_at, metadata, merchants(business_name)")
        .eq("event_name", "reward_redemption_failed")
        .order("created_at", { ascending: false })
        .limit(100),
    ])

  if (flagsError) {
    throw new Error(`Unable to load fraud flags: ${flagsError.message}`)
  }

  if (failureError) {
    throw new Error(`Unable to load fraud events: ${failureError.message}`)
  }

  return {
    fraudFlags: fraudFlags ?? [],
    failures: failures ?? [],
  }
}

export async function getAdminAuditLogs(limit = 100) {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("audit_logs")
    .select(
      "id, actor_type, actor_id, action, target_table, target_id, metadata, created_at, merchants(business_name), customers(email, phone)"
    )
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(`Unable to load audit logs: ${error.message}`)
  }

  return data ?? []
}

async function countRows(table: "merchants" | "customers") {
  const supabase = createSupabaseServiceRoleClient()
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true })

  if (error) {
    throw new Error(`Unable to count ${table}: ${error.message}`)
  }

  return count ?? 0
}

async function countBillingIssues() {
  const supabase = createSupabaseServiceRoleClient()
  const { count, error } = await supabase
    .from("billing_customers")
    .select("*", { count: "exact", head: true })
    .in("status", ["past_due", "cancelled", "suspended"])

  if (error) {
    throw new Error(`Unable to count billing issues: ${error.message}`)
  }

  return count ?? 0
}
