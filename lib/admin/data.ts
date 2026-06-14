import "server-only"

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

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

export async function getAdminPilotReport() {
  const [
    merchantSignedUp,
    cardCreated,
    qrCreated,
    qrDownloaded,
    qrScanned,
    customerJoined,
    stampIssued,
    rewardUnlocked,
    rewardRedeemed,
    secondStampCustomers,
    merchants,
    trialingBilling,
    activeBilling,
    cancelledBilling,
    supportActions,
    cancellationNotes,
    launchSelfServiceProof,
    paidLaunchProofMerchants,
  ] = await Promise.all([
    countProductEvents("merchant_signed_up"),
    countProductEvents("loyalty_card_created"),
    countProductEvents("qr_created"),
    countProductEvents("qr_downloaded"),
    countProductEvents("qr_scanned"),
    countProductEvents("customer_joined"),
    countProductEvents("stamp_issued"),
    countProductEvents("reward_unlocked"),
    countProductEvents("reward_redeemed"),
    countMembershipsWithSecondStamp(),
    countRows("merchants"),
    countBillingStatuses(["trialing"]),
    countBillingStatuses(["active"]),
    countBillingStatuses(["cancelled", "past_due", "suspended"]),
    countAuditActions([
      "data_request_logged",
      "reward_cancelled",
      "stamp_adjusted",
      "qr_disabled",
      "qr_regenerated",
      "consent_opt_out_recorded",
    ]),
    countAuditActions(["merchant_cancel_reason_recorded"]),
    countAuditActions(["launch_self_service_checked"]),
    countPaidLaunchProofMerchants(),
  ])

  const scanToJoin = percentage(customerJoined, qrScanned)
  const secondStampRate = percentage(secondStampCustomers, customerJoined)
  const paidConversion = percentage(activeBilling, trialingBilling + activeBilling + cancelledBilling)

  return {
    checklist: [
      {
        item: "Pilot size",
        target: "10-20 merchants",
        value: merchants,
        source: "merchants table",
      },
      {
        item: "Launch offer",
        target: "30 days free, then GBP 29/mo",
        value: "Configured in pricing and billing state",
        source: "app pricing and billing_customers",
      },
      {
        item: "Pilot window",
        target: "60-90 days",
        value: "Tracked by merchant signup and billing dates",
        source: "merchants.created_at",
      },
      {
        item: "Self-service launch proof",
        target: "QR and venue checks complete",
        value: launchSelfServiceProof,
        source: "audit_logs.launch_self_service_checked",
      },
    ],
    metrics: [
      metric("Merchant signups", merchantSignedUp, "product_events", "10-20"),
      metric("Cards created", cardCreated, "product_events", "1 per pilot merchant"),
      metric("QR codes created", qrCreated, "product_events", "1 per pilot merchant"),
      metric("QR downloads", qrDownloaded, "product_events", "Poster/till/sticker proof"),
      metric("QR scans", qrScanned, "product_events", "Readback only"),
      metric("Customer joins", customerJoined, "product_events", "Scan-to-join 40%+"),
      metric("Scan-to-join rate", `${scanToJoin}%`, "derived from product_events", "40%+"),
      metric("Stamps issued", stampIssued, "product_events", "Readback only"),
      metric("Second-stamp customers", secondStampCustomers, "customer_memberships", "First-to-second 25%+"),
      metric("First-to-second stamp rate", `${secondStampRate}%`, "derived from product_events and memberships", "25%+"),
      metric("Rewards unlocked", rewardUnlocked, "product_events", "Readback only"),
      metric("Rewards redeemed", rewardRedeemed, "product_events", "Low dispute rate"),
      metric("Trialing subscriptions", trialingBilling, "billing_customers", "Readback only"),
      metric("Paid subscriptions", activeBilling, "billing_customers", "Trial-to-paid 40-60%"),
      metric("Trial-to-paid rate", `${paidConversion}%`, "derived from billing_customers", "40-60%"),
      metric("Paid launch proof merchants", paidLaunchProofMerchants, "billing_customers + product_events", "At least 1 test merchant"),
      metric("Support actions", supportActions, "audit_logs", "<2 per merchant/month"),
      metric("Cancellation notes", cancellationNotes, "audit_logs/interview notes", "Reasons captured"),
    ],
  }
}

export async function getAdminPilotMerchants() {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("merchants")
    .select(
      "id, business_name, business_slug, email, status, created_at, billing_customers(status, plan, current_period_end)"
    )
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) {
    throw new Error(`Unable to load pilot merchants: ${error.message}`)
  }

  return data ?? []
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

async function countProductEvents(eventName: string) {
  const supabase = createSupabaseServiceRoleClient()
  const { count, error } = await supabase
    .from("product_events")
    .select("*", { count: "exact", head: true })
    .eq("event_name", eventName)

  if (error) {
    throw new Error(`Unable to count ${eventName}: ${error.message}`)
  }

  return count ?? 0
}

async function countMembershipsWithSecondStamp() {
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

async function countBillingStatuses(statuses: string[]) {
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

const requiredPaidLaunchEvents = [
  "merchant_signed_up",
  "loyalty_card_created",
  "qr_created",
  "qr_downloaded",
  "customer_joined",
  "stamp_issued",
  "reward_redeemed",
]

async function countPaidLaunchProofMerchants() {
  const supabase = createSupabaseServiceRoleClient()
  const { data: billingRows, error: billingError } = await supabase
    .from("billing_customers")
    .select("merchant_id")
    .eq("status", "active")

  if (billingError) {
    throw new Error(`Unable to load paid pilot merchants: ${billingError.message}`)
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
    throw new Error(`Unable to load paid pilot launch events: ${eventError.message}`)
  }

  const eventsByMerchant = new Map<string, Set<string>>()

  for (const row of eventRows ?? []) {
    if (typeof row.merchant_id !== "string" || typeof row.event_name !== "string") {
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

async function countAuditActions(actions: string[]) {
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

function metric(
  label: string,
  value: number | string,
  source: string,
  target: string
) {
  return { label, value, source, target }
}

function percentage(numerator: number, denominator: number) {
  if (!denominator) return 0
  return Math.round((numerator / denominator) * 100)
}
