import "server-only"

import {
  formatAdminBillingStatus,
  maskStripeOperationalId,
  type AdminBillingStatusTone,
} from "@/lib/admin/billing-redaction"
import { createAdminServiceRoleClient } from "@/lib/admin/service-role"

export type AdminBillingRecord = {
  readonly id: string
  readonly merchantName: string
  readonly merchantEmail: string
  readonly plan: string
  readonly statusLabel: string
  readonly statusTone: AdminBillingStatusTone
  readonly currentPeriodEnd: string | null
  readonly updatedAt: string | null
  readonly stripeCustomerRef: string
  readonly stripeSubscriptionRef: string
}

type AdminBillingRawMerchant = {
  readonly business_name: string | null
  readonly email: string | null
}

type AdminBillingRawRecord = {
  readonly id: string
  readonly plan: string | null
  readonly status: string | null
  readonly stripe_customer_id: string | null
  readonly stripe_subscription_id: string | null
  readonly current_period_end: string | null
  readonly updated_at: string | null
  readonly merchants:
    | AdminBillingRawMerchant
    | readonly AdminBillingRawMerchant[]
    | null
}

export async function getAdminBillingRecords(): Promise<AdminBillingRecord[]> {
  const supabase = await createAdminServiceRoleClient()
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

  return (data ?? []).map(toAdminBillingRecord)
}

function toAdminBillingRecord(row: AdminBillingRawRecord): AdminBillingRecord {
  const merchant = firstBillingMerchant(row.merchants)
  const status = formatAdminBillingStatus(row.status)

  return {
    id: row.id,
    merchantName: merchant?.business_name ?? "Merchant",
    merchantEmail: merchant?.email ?? "No merchant email",
    plan: row.plan ?? "No plan",
    statusLabel: status.label,
    statusTone: status.tone,
    currentPeriodEnd: row.current_period_end,
    updatedAt: row.updated_at,
    stripeCustomerRef: maskStripeOperationalId(row.stripe_customer_id),
    stripeSubscriptionRef: maskStripeOperationalId(row.stripe_subscription_id),
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
