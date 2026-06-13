import "server-only"

import Stripe from "stripe"

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export type BillingStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "cancelled"
  | "suspended"

export function stripeId(value: string | { id: string } | null | undefined) {
  if (!value) return null
  return typeof value === "string" ? value : value.id
}

export function mapStripeSubscriptionStatus(
  status: Stripe.Subscription.Status
): BillingStatus {
  if (status === "trialing") return "trialing"
  if (status === "active") return "active"
  if (status === "past_due") return "past_due"
  if (status === "canceled") return "cancelled"
  return "suspended"
}

export function subscriptionPeriodEnd(subscription: Stripe.Subscription) {
  const periodEnd = subscription.items.data[0]?.current_period_end

  if (!periodEnd) return null

  return new Date(periodEnd * 1000).toISOString()
}

export async function syncStripeSubscription({
  subscription,
  merchantId,
}: {
  subscription: Stripe.Subscription
  merchantId?: string | null
}) {
  const supabase = createSupabaseServiceRoleClient()
  const stripeCustomerId = stripeId(subscription.customer)
  const resolvedMerchantId =
    merchantId ??
    subscription.metadata?.merchant_id ??
    (await findMerchantIdForSubscription(subscription.id, stripeCustomerId))

  if (!resolvedMerchantId || !stripeCustomerId) {
    throw new Error("Stripe subscription is missing merchant or customer mapping")
  }

  const status = mapStripeSubscriptionStatus(subscription.status)
  const { error } = await supabase.from("billing_customers").upsert(
    {
      merchant_id: resolvedMerchantId,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: subscription.id,
      plan: "growth",
      status,
      current_period_end: subscriptionPeriodEnd(subscription),
    },
    { onConflict: "merchant_id" }
  )

  if (error) {
    throw new Error(`Unable to sync billing state: ${error.message}`)
  }

  return { merchantId: resolvedMerchantId, status }
}

export async function setBillingStatusForSubscription({
  subscriptionId,
  status,
}: {
  subscriptionId: string
  status: BillingStatus
}) {
  const supabase = createSupabaseServiceRoleClient()
  const { error } = await supabase
    .from("billing_customers")
    .update({ status })
    .eq("stripe_subscription_id", subscriptionId)

  if (error) {
    throw new Error(`Unable to update billing status: ${error.message}`)
  }
}

async function findMerchantIdForSubscription(
  subscriptionId: string,
  customerId: string | null
) {
  const supabase = createSupabaseServiceRoleClient()
  let query = supabase
    .from("billing_customers")
    .select("merchant_id")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle()

  let result = await query

  if (!result.data && customerId) {
    query = supabase
      .from("billing_customers")
      .select("merchant_id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle()
    result = await query
  }

  if (result.error) {
    throw new Error(`Unable to resolve merchant billing record: ${result.error.message}`)
  }

  return result.data?.merchant_id ?? null
}
