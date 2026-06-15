import "server-only"

import { getProductEventCounts } from "@/lib/analytics/funnels"
import {
  countAuditActions,
  countBillingStatuses,
  countMembershipsWithSecondStamp,
  countPaidLaunchProofMerchants,
  countRows,
} from "@/lib/admin/pilot-report-sources"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

const pilotProductEventNames = [
  "merchant_signed_up",
  "loyalty_card_created",
  "qr_created",
  "qr_downloaded",
  "qr_scanned",
  "customer_joined",
  "stamp_issued",
  "reward_unlocked",
  "reward_redeemed",
] as const

export async function getAdminPilotReport() {
  const [
    eventCounts,
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
    getProductEventCounts(pilotProductEventNames),
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

  const merchantSignedUp = eventCounts["merchant_signed_up"] ?? 0
  const cardCreated = eventCounts["loyalty_card_created"] ?? 0
  const qrCreated = eventCounts["qr_created"] ?? 0
  const qrDownloaded = eventCounts["qr_downloaded"] ?? 0
  const qrScanned = eventCounts["qr_scanned"] ?? 0
  const customerJoined = eventCounts["customer_joined"] ?? 0
  const stampIssued = eventCounts["stamp_issued"] ?? 0
  const rewardUnlocked = eventCounts["reward_unlocked"] ?? 0
  const rewardRedeemed = eventCounts["reward_redeemed"] ?? 0
  const scanToJoin = percentage(customerJoined, qrScanned)
  const secondStampRate = percentage(secondStampCustomers, customerJoined)
  const paidConversion = percentage(
    activeBilling,
    trialingBilling + activeBilling + cancelledBilling
  )

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
      metric(
        "Cards created",
        cardCreated,
        "product_events",
        "1 per pilot merchant"
      ),
      metric(
        "QR codes created",
        qrCreated,
        "product_events",
        "1 per pilot merchant"
      ),
      metric(
        "QR downloads",
        qrDownloaded,
        "product_events",
        "Poster/till/sticker proof"
      ),
      metric("QR scans", qrScanned, "product_events", "Readback only"),
      metric(
        "Customer joins",
        customerJoined,
        "product_events",
        "Scan-to-join 40%+"
      ),
      metric(
        "Scan-to-join rate",
        `${scanToJoin}%`,
        "derived from product_events",
        "40%+"
      ),
      metric("Stamps issued", stampIssued, "product_events", "Readback only"),
      metric(
        "Second-stamp customers",
        secondStampCustomers,
        "customer_memberships",
        "First-to-second 25%+"
      ),
      metric(
        "First-to-second stamp rate",
        `${secondStampRate}%`,
        "derived from product_events and memberships",
        "25%+"
      ),
      metric(
        "Rewards unlocked",
        rewardUnlocked,
        "product_events",
        "Readback only"
      ),
      metric(
        "Rewards redeemed",
        rewardRedeemed,
        "product_events",
        "Low dispute rate"
      ),
      metric(
        "Trialing subscriptions",
        trialingBilling,
        "billing_customers",
        "Readback only"
      ),
      metric(
        "Paid subscriptions",
        activeBilling,
        "billing_customers",
        "Trial-to-paid 40-60%"
      ),
      metric(
        "Trial-to-paid rate",
        `${paidConversion}%`,
        "derived from billing_customers",
        "40-60%"
      ),
      metric(
        "Paid launch proof merchants",
        paidLaunchProofMerchants,
        "billing_customers + product_events",
        "At least 1 test merchant"
      ),
      metric("Support actions", supportActions, "audit_logs", "<2 per merchant/month"),
      metric(
        "Cancellation notes",
        cancellationNotes,
        "audit_logs/interview notes",
        "Reasons captured"
      ),
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
