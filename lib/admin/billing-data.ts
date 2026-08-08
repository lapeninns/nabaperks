import "server-only"

import {
  formatAdminBillingStatus,
  maskStripeOperationalId,
  type AdminBillingStatusTone,
} from "@/lib/admin/billing-redaction"
import { createAdminServiceRoleClient } from "@/lib/admin/service-role"

export type AdminBillingRecord = {
  readonly id: string
  readonly merchantId: string
  readonly merchantName: string
  readonly merchantEmail: string
  readonly plan: string
  readonly statusLabel: string
  readonly statusTone: AdminBillingStatusTone
  readonly currentPeriodEnd: string | null
  readonly updatedAt: string | null
  readonly stripeCustomerRef: string
  readonly stripeSubscriptionRef: string
  readonly fulfilmentStatus:
    "not_started" | "awaiting_dispatch" | "dispatched" | "delivered"
  readonly dispatchedAt: string | null
  readonly deliveredAt: string | null
  readonly pilotStartsAt: string | null
  readonly basePilotEndsAt: string | null
  readonly desiredStripeTrialEnd: string | null
  readonly confirmedStripeTrialEnd: string | null
  readonly syncStatus: string
  readonly operationsReviewRequired: boolean
}

type AdminBillingRawMerchant = {
  readonly business_name: string | null
  readonly email: string | null
}

type AdminBillingRawRecord = {
  readonly id: string
  readonly merchant_id: string
  readonly plan: string | null
  readonly status: string | null
  readonly stripe_customer_id: string | null
  readonly stripe_subscription_id: string | null
  readonly current_period_end: string | null
  readonly updated_at: string | null
  readonly merchants:
    AdminBillingRawMerchant | readonly AdminBillingRawMerchant[] | null
}

type AdminFulfilmentRawRecord = {
  readonly merchant_id: string
  readonly fulfilment_status: Exclude<
    AdminBillingRecord["fulfilmentStatus"],
    "not_started"
  >
  readonly dispatched_at: string | null
  readonly delivered_at: string | null
  readonly pilot_starts_at: string | null
  readonly base_pilot_ends_at: string | null
  readonly desired_stripe_trial_end: string | null
  readonly confirmed_stripe_trial_end: string | null
  readonly sync_status: string
  readonly operations_review_required: boolean
}

/** Newest-first window. Named so a truncation notice cannot drift from it. */
export const BILLING_RECORD_LIMIT = 100

/**
 * Total billing rows before the window.
 *
 * A separate head-only query rather than a `count` on the readback, because
 * `admin-service-role-guards` pins `getAdminBillingRecords`'s early
 * `return []` guard and therefore its array return shape. Head-only means no
 * rows cross the wire — the same pattern `getAdminFraudQueueCounts` uses.
 */
export async function getAdminBillingRecordTotal(): Promise<number> {
  const supabase = await createAdminServiceRoleClient()
  const { count } = await supabase
    .from("billing_customers")
    .select("*", { count: "exact", head: true })

  return count ?? 0
}

export async function getAdminBillingRecords(): Promise<AdminBillingRecord[]> {
  const supabase = await createAdminServiceRoleClient()
  const billingResult = await supabase
    .from("billing_customers")
    .select(
      "id, merchant_id, plan, status, stripe_customer_id, stripe_subscription_id, current_period_end, updated_at, merchants(business_name, email)"
    )
    .order("updated_at", { ascending: false })
    .limit(BILLING_RECORD_LIMIT)
  if (billingResult.error) throw new Error("Unable to load billing records")

  const billingRows = billingResult.data ?? []
  const merchantIds = billingRows.map((row) => row.merchant_id)
  if (merchantIds.length === 0) return []

  const fulfilmentResult = await supabase
    .from("merchant_launch_fulfilments")
    .select(
      "merchant_id, fulfilment_status, dispatched_at, delivered_at, pilot_starts_at, base_pilot_ends_at, desired_stripe_trial_end, confirmed_stripe_trial_end, sync_status, operations_review_required"
    )
    .in("merchant_id", merchantIds)
  if (fulfilmentResult.error) {
    throw new Error("Unable to load fulfilment records")
  }

  const fulfilments = new Map<string, AdminFulfilmentRawRecord>(
    (fulfilmentResult.data ?? []).map((row) => [row.merchant_id, row])
  )
  return billingRows.map((row) =>
    toAdminBillingRecord(row, fulfilments.get(row.merchant_id))
  )
}

function toAdminBillingRecord(
  row: AdminBillingRawRecord,
  fulfilment?: AdminFulfilmentRawRecord
): AdminBillingRecord {
  const merchant = firstBillingMerchant(row.merchants)
  const status = formatAdminBillingStatus(row.status)

  return {
    id: row.id,
    merchantId: row.merchant_id,
    merchantName: merchant?.business_name ?? "Merchant",
    merchantEmail: merchant?.email ?? "No merchant email",
    plan: row.plan ?? "No plan",
    statusLabel: status.label,
    statusTone: status.tone,
    currentPeriodEnd: row.current_period_end,
    updatedAt: row.updated_at,
    stripeCustomerRef: maskStripeOperationalId(row.stripe_customer_id),
    stripeSubscriptionRef: maskStripeOperationalId(row.stripe_subscription_id),
    fulfilmentStatus: fulfilment?.fulfilment_status ?? "not_started",
    dispatchedAt: fulfilment?.dispatched_at ?? null,
    deliveredAt: fulfilment?.delivered_at ?? null,
    pilotStartsAt: fulfilment?.pilot_starts_at ?? null,
    basePilotEndsAt: fulfilment?.base_pilot_ends_at ?? null,
    desiredStripeTrialEnd: fulfilment?.desired_stripe_trial_end ?? null,
    confirmedStripeTrialEnd: fulfilment?.confirmed_stripe_trial_end ?? null,
    syncStatus: fulfilment?.sync_status ?? "not_started",
    operationsReviewRequired: fulfilment?.operations_review_required ?? false,
  }
}

function firstBillingMerchant(
  value:
    | AdminBillingRawMerchant
    | readonly AdminBillingRawMerchant[]
    | null
    | undefined
) {
  if (!value) return undefined
  return Array.isArray(value) ? value[0] : value
}
