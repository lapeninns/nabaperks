import "server-only"

import Stripe from "stripe"

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"
import { getStripe } from "@/lib/stripe/server"

const BILLING_SUBSCRIPTION_STATUSES = new Set<Stripe.Subscription.Status>([
  "trialing",
  "active",
  "past_due",
])

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

export function stripeInvoiceSubscriptionId(invoice: Stripe.Invoice) {
  const directSubscription = (
    invoice as Stripe.Invoice & {
      subscription?: string | Stripe.Subscription | null
    }
  ).subscription

  return (
    stripeId(directSubscription) ??
    stripeId(invoice.parent?.subscription_details?.subscription)
  )
}

/**
 * Best-effort billing sync after Stripe Checkout returns. Webhooks remain the
 * source of truth, but this closes the gap when the endpoint is missing or slow.
 */
export async function syncMerchantBillingFromStripe(merchantId: string) {
  const supabase = createSupabaseServiceRoleClient()
  const stripe = getStripe()

  const { data: billing, error: billingError } = await supabase
    .from("billing_customers")
    .select("stripe_customer_id, stripe_subscription_id")
    .eq("merchant_id", merchantId)
    .maybeSingle()

  if (billingError) {
    throw new Error(`Unable to load merchant billing row: ${billingError.message}`)
  }

  if (billing?.stripe_subscription_id) {
    const subscription = await stripe.subscriptions.retrieve(
      billing.stripe_subscription_id
    )
    return syncStripeSubscription({ subscription, merchantId })
  }

  const { data: merchant, error: merchantError } = await supabase
    .from("merchants")
    .select("email")
    .eq("id", merchantId)
    .single()

  if (merchantError) {
    throw new Error(`Unable to load merchant profile: ${merchantError.message}`)
  }

  const customers = new Map<string, Stripe.Customer>()

  const byMetadata = await stripe.customers.search({
    query: `metadata['merchant_id']:'${merchantId}'`,
  })
  for (const customer of byMetadata.data) {
    customers.set(customer.id, customer)
  }

  if (merchant.email) {
    const byEmail = await stripe.customers.list({
      email: merchant.email,
      limit: 20,
    })
    for (const customer of byEmail.data) {
      if (
        !customer.metadata?.merchant_id ||
        customer.metadata.merchant_id === merchantId
      ) {
        customers.set(customer.id, customer)
      }
    }
  }

  if (billing?.stripe_customer_id) {
    const customer = await stripe.customers.retrieve(billing.stripe_customer_id)
    if (!customer.deleted) {
      customers.set(customer.id, customer)
    }
  }

  for (const customer of customers.values()) {
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: "all",
      limit: 10,
    })

    const subscription =
      subscriptions.data.find((entry) =>
        BILLING_SUBSCRIPTION_STATUSES.has(entry.status)
      ) ?? subscriptions.data[0]

    if (subscription) {
      return syncStripeSubscription({ subscription, merchantId })
    }
  }

  return null
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

  if (result.data?.merchant_id) {
    return result.data.merchant_id
  }

  if (customerId) {
    const stripe = getStripe()
    const customer = await stripe.customers.retrieve(customerId)
    if (!customer.deleted && customer.metadata?.merchant_id) {
      return customer.metadata.merchant_id
    }
  }

  return null
}
