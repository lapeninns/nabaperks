import "server-only"

import type Stripe from "stripe"

import {
  mapProviderSubscriptionSnapshot,
  providerId,
  type AuthoritativeBillingSnapshot,
} from "@/lib/merchant/billing-checkout-core"

export type BillingStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "cancelled"
  | "suspended"

export type StripeBillingOwnership = {
  merchantId: string
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
}

export type StripeSubscriptionResolutionInput = {
  subscription: Stripe.Subscription
  expectedSubscriptionId: string
  merchantIdHint?: string | null
  customerIdHint?: string | null
}

export type SubscriptionApplyResult = "applied" | "stale"

export function stripeId(
  value: string | { id?: string | null } | null | undefined
) {
  return providerId(value)
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

/** Convert the hydrated Stripe object into the complete durable billing shape. */
export function mapStripeSubscriptionSnapshot(
  subscription: Stripe.Subscription
): AuthoritativeBillingSnapshot {
  return mapProviderSubscriptionSnapshot({
    id: subscription.id,
    created: subscription.created,
    status: subscription.status,
    customer: subscription.customer,
    items: {
      data: subscription.items.data.map((item) => ({
        current_period_end: item.current_period_end,
        price: {
          id: item.price.id,
          recurring: item.price.recurring
            ? { interval: item.price.recurring.interval }
            : null,
          unit_amount: item.price.unit_amount,
          currency: item.price.currency,
        },
      })),
    },
    cancel_at_period_end: subscription.cancel_at_period_end,
    cancel_at: subscription.cancel_at,
  })
}

/**
 * Resolve the merchant through durable ownership where it exists. Provider
 * metadata may bootstrap the first billing row, but can never contradict an
 * existing merchant/customer/subscription mapping.
 */
export async function resolveStripeSubscriptionMerchant({
  subscription,
  expectedSubscriptionId,
  merchantIdHint,
  customerIdHint,
}: StripeSubscriptionResolutionInput): Promise<StripeBillingOwnership> {
  const snapshot = mapStripeSubscriptionSnapshot(subscription)
  const metadataMerchantId = normalizeMerchantId(
    subscription.metadata?.merchant_id
  )
  const normalizedMerchantHint = normalizeMerchantId(merchantIdHint)

  if (subscription.id !== expectedSubscriptionId) {
    throw new Error("Stripe Subscription identity does not match the event")
  }

  if (customerIdHint && snapshot.stripe_customer_id !== customerIdHint) {
    throw new Error("Stripe Subscription customer does not match the event")
  }

  if (
    normalizedMerchantHint &&
    metadataMerchantId &&
    normalizedMerchantHint !== metadataMerchantId
  ) {
    throw new Error("Stripe Subscription merchant metadata does not match")
  }

  const merchantCandidate = normalizedMerchantHint ?? metadataMerchantId
  const ownership = await loadStripeBillingOwnership({
    merchantId: merchantCandidate,
    stripeSubscriptionId: subscription.id,
    stripeCustomerId: snapshot.stripe_customer_id,
  })

  if (!ownership) {
    if (!metadataMerchantId) {
      throw new Error("Stripe Subscription has no durable merchant ownership")
    }

    return {
      merchantId: metadataMerchantId,
      stripeCustomerId: snapshot.stripe_customer_id,
      stripeSubscriptionId: null,
    }
  }

  if (merchantCandidate && ownership.merchantId !== merchantCandidate) {
    throw new Error("Stripe Subscription merchant ownership does not match")
  }

  if (
    ownership.stripeCustomerId &&
    ownership.stripeCustomerId !== snapshot.stripe_customer_id
  ) {
    throw new Error("Stripe Subscription customer ownership does not match")
  }

  if (
    ownership.stripeSubscriptionId &&
    ownership.stripeSubscriptionId !== subscription.id &&
    (!metadataMerchantId ||
      metadataMerchantId !== ownership.merchantId ||
      ownership.stripeCustomerId !== snapshot.stripe_customer_id)
  ) {
    throw new Error("Stripe Subscription id ownership does not match")
  }

  return ownership
}

export async function applyStripeSubscriptionEvent({
  eventId,
  leaseId,
  merchantId,
  snapshot,
  entitlementStatus,
}: {
  eventId: string
  leaseId: string
  merchantId: string
  snapshot: AuthoritativeBillingSnapshot
  entitlementStatus: BillingStatus
}): Promise<SubscriptionApplyResult> {
  const { createSupabaseServiceRoleClient } =
    await import("@/lib/supabase/server")
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc(
    "apply_stripe_subscription_event",
    subscriptionRpcArguments(snapshot, entitlementStatus, {
      p_stripe_event_id: eventId,
      p_lease_id: leaseId,
      p_merchant_id: merchantId,
    })
  )

  if (error) {
    throw new Error(
      `Unable to apply Stripe subscription event: ${error.message}`
    )
  }

  return parseApplyResult(data)
}

export async function applyCurrentStripeSubscription({
  merchantId,
  snapshot,
  entitlementStatus,
  expectedBillingUpdatedAt,
}: {
  merchantId: string
  snapshot: AuthoritativeBillingSnapshot
  entitlementStatus: BillingStatus
  expectedBillingUpdatedAt: string | null
}): Promise<SubscriptionApplyResult> {
  const { createSupabaseServiceRoleClient } =
    await import("@/lib/supabase/server")
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc(
    "apply_current_stripe_subscription",
    subscriptionRpcArguments(snapshot, entitlementStatus, {
      p_merchant_id: merchantId,
      p_expected_updated_at: expectedBillingUpdatedAt,
    })
  )

  if (error) {
    throw new Error(
      `Unable to apply current Stripe subscription: ${error.message}`
    )
  }

  return parseApplyResult(data)
}

/**
 * Best-effort reconciliation is deliberately limited to the exact known
 * Subscription. Broad email/customer searches are not ownership proof.
 */
export async function syncMerchantBillingFromStripe(merchantId: string) {
  const { createSupabaseServiceRoleClient } =
    await import("@/lib/supabase/server")
  const { getStripe } = await import("@/lib/stripe/server")
  const supabase = createSupabaseServiceRoleClient()
  const stripe = getStripe()
  const { data: billing, error } = await supabase
    .from("billing_customers")
    .select("stripe_subscription_id, updated_at")
    .eq("merchant_id", merchantId)
    .maybeSingle()

  if (error) {
    throw new Error(`Unable to load merchant billing row: ${error.message}`)
  }

  if (!billing?.stripe_subscription_id) return null

  const subscription = await stripe.subscriptions.retrieve(
    billing.stripe_subscription_id
  )
  return syncStripeSubscription({
    subscription,
    merchantId,
    expectedBillingUpdatedAt: billing.updated_at,
  })
}

export async function syncStripeSubscription({
  subscription,
  merchantId,
  expectedBillingUpdatedAt,
}: {
  subscription: Stripe.Subscription
  merchantId?: string | null
  expectedBillingUpdatedAt: string | null
}) {
  const ownership = await resolveStripeSubscriptionMerchant({
    subscription,
    expectedSubscriptionId: subscription.id,
    merchantIdHint: merchantId,
  })
  const status = mapStripeSubscriptionStatus(subscription.status)
  const applyStatus = await applyCurrentStripeSubscription({
    merchantId: ownership.merchantId,
    snapshot: mapStripeSubscriptionSnapshot(subscription),
    entitlementStatus: status,
    expectedBillingUpdatedAt,
  })

  return { merchantId: ownership.merchantId, status, applyStatus }
}

async function loadStripeBillingOwnership({
  merchantId,
  stripeSubscriptionId,
  stripeCustomerId,
}: {
  merchantId: string | null
  stripeSubscriptionId: string
  stripeCustomerId: string
}): Promise<StripeBillingOwnership | null> {
  const { createSupabaseServiceRoleClient } =
    await import("@/lib/supabase/server")
  const supabase = createSupabaseServiceRoleClient()
  const columns =
    "merchant_id, stripe_customer_id, stripe_subscription_id" as const

  for (const [column, value] of [
    ["merchant_id", merchantId],
    ["stripe_subscription_id", stripeSubscriptionId],
    ["stripe_customer_id", stripeCustomerId],
  ] as const) {
    if (!value) continue

    const { data, error } = await supabase
      .from("billing_customers")
      .select(columns)
      .eq(column, value)
      .limit(1)
      .maybeSingle()

    if (error) {
      throw new Error(
        `Unable to resolve Stripe billing ownership: ${error.message}`
      )
    }

    if (data) {
      return {
        merchantId: data.merchant_id,
        stripeCustomerId: data.stripe_customer_id,
        stripeSubscriptionId: data.stripe_subscription_id,
      }
    }
  }

  return null
}

function subscriptionRpcArguments(
  snapshot: AuthoritativeBillingSnapshot,
  entitlementStatus: BillingStatus,
  identity: Record<string, string | null>
) {
  return {
    ...identity,
    p_stripe_customer_id: snapshot.stripe_customer_id,
    p_stripe_subscription_id: snapshot.stripe_subscription_id,
    p_stripe_subscription_status: snapshot.stripe_subscription_status,
    p_stripe_subscription_created_at: snapshot.stripe_subscription_created_at,
    p_stripe_price_id: snapshot.stripe_price_id,
    p_billing_interval: snapshot.billing_interval,
    p_unit_amount: snapshot.unit_amount,
    p_currency: snapshot.currency,
    p_current_period_end: snapshot.current_period_end,
    p_cancel_at_period_end: snapshot.cancel_at_period_end,
    p_cancel_at: snapshot.cancel_at,
    p_entitlement_status: entitlementStatus,
  }
}

function parseApplyResult(value: unknown): SubscriptionApplyResult {
  if (value === "applied" || value === "stale") return value
  throw new Error("Stripe subscription apply returned an invalid result")
}

function normalizeMerchantId(value: string | null | undefined) {
  const normalized = value?.trim() || null

  if (
    normalized &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      normalized
    )
  ) {
    throw new Error("Stripe Subscription merchant metadata is invalid")
  }

  return normalized
}
