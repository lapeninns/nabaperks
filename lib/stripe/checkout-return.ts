import "server-only"

import {
  classifyCheckoutReturnSession,
  mapProviderSubscriptionSnapshot,
  providerId,
} from "@/lib/merchant/billing-checkout-core"
import type {
  BillingCheckoutDependencies,
  BillingCheckoutReturnObservers,
  BillingEntitlementStatus,
  BillingReturnOutcome,
  StripeSubscriptionLike,
} from "@/lib/stripe/checkout-contracts"

function mapEntitlementStatus(status: string): BillingEntitlementStatus {
  if (status === "trialing") return "trialing"
  if (status === "active") return "active"
  if (status === "past_due") return "past_due"
  if (status === "canceled") return "cancelled"
  return "suspended"
}

function subscriptionMatchesMerchant(
  subscription: StripeSubscriptionLike,
  merchantId: string,
  customerId: string,
  subscriptionId: string
): boolean {
  return (
    subscription.id === subscriptionId &&
    providerId(subscription.customer) === customerId &&
    subscription.metadata?.merchant_id === merchantId
  )
}

async function satisfyLaunchFeeFromSubscription(
  subscription: StripeSubscriptionLike,
  merchantId: string,
  deps: BillingCheckoutDependencies,
  launchChargePaid: boolean
): Promise<void> {
  if (
    subscription.status !== "trialing" &&
    subscription.status !== "active" &&
    subscription.status !== "past_due"
  ) {
    return
  }

  const policy = subscription.metadata?.launch_fee_policy
  if (policy === "charged" && !launchChargePaid) {
    const alreadySatisfied = await deps.hasSatisfiedLaunchFee(merchantId)
    if (!alreadySatisfied) {
      throw new Error("The launch fee payment is not verified")
    }
    return
  }

  if (policy !== "charged" && policy !== "annual_included") {
    const alreadySatisfied = await deps.hasSatisfiedLaunchFee(merchantId)
    if (!alreadySatisfied) {
      throw new Error("Subscription is missing its launch fee policy")
    }
    return
  }

  const stripeCustomerId = providerId(subscription.customer)
  if (!stripeCustomerId) throw new Error("Subscription customer is missing")

  const satisfied = await deps.satisfyLaunchFee({
    merchantId,
    stripeCustomerId,
    stripeSubscriptionId: subscription.id,
    policy,
  })
  if (!satisfied) throw new Error("Launch fee satisfaction was not recorded")
}

export async function confirmBillingCheckoutReturn(
  input: { merchantId: string; sessionId: string | null | undefined },
  deps: BillingCheckoutDependencies,
  observers: BillingCheckoutReturnObservers = {}
): Promise<BillingReturnOutcome> {
  if (!input.sessionId) return { kind: "missing_session" }

  try {
    const ownership = await deps.loadCheckoutOwnership(input.merchantId)
    if (!ownership.stripeCustomerId) {
      return { kind: "rejected", reason: "foreign_session" }
    }

    const session = await deps.retrieveCheckoutSession(input.sessionId)
    const classification = classifyCheckoutReturnSession({
      requestedSessionId: input.sessionId,
      recordedSessionId: ownership.recordedSessionId,
      expectedSubscriptionId: ownership.stripeSubscriptionId,
      expectedMerchantId: input.merchantId,
      expectedCustomerId: ownership.stripeCustomerId,
      session,
    })
    if (classification.kind === "missing") {
      return { kind: "missing_session" }
    }
    if (classification.kind === "rejected") {
      return { kind: "rejected", reason: classification.reason }
    }

    const subscription = await deps.retrieveSubscription(
      classification.subscriptionId
    )
    if (
      !subscriptionMatchesMerchant(
        subscription,
        input.merchantId,
        classification.customerId,
        classification.subscriptionId
      )
    ) {
      return { kind: "rejected", reason: "customer_mismatch" }
    }

    const snapshot = mapProviderSubscriptionSnapshot(subscription)
    const entitlementStatus = mapEntitlementStatus(subscription.status)
    await satisfyLaunchFeeFromSubscription(
      subscription,
      input.merchantId,
      deps,
      session?.payment_status === "paid"
    )
    const applyOwnership = await deps.loadCheckoutOwnership(input.merchantId)

    try {
      observers.onVerifiedReturn?.({ merchantId: input.merchantId })
    } catch {
      // Analytics observation must never change a verified billing outcome.
    }

    const applied = await deps.applyCurrentSubscription({
      merchantId: input.merchantId,
      snapshot,
      entitlementStatus,
      expectedBillingUpdatedAt: applyOwnership.billingUpdatedAt,
    })
    return applied === "applied"
      ? {
          kind: "confirmed",
          source: "checkout",
          status: subscription.status,
        }
      : { kind: "catching_up" }
  } catch {
    return { kind: "catching_up" }
  }
}

export async function reconcileBillingPortalReturn(
  input: { merchantId: string },
  deps: BillingCheckoutDependencies
): Promise<BillingReturnOutcome> {
  try {
    const ownership = await deps.loadCheckoutOwnership(input.merchantId)
    if (!ownership.stripeCustomerId || !ownership.stripeSubscriptionId) {
      return { kind: "portal_missing" }
    }

    const subscription = await deps.retrieveSubscription(
      ownership.stripeSubscriptionId
    )
    if (
      !subscriptionMatchesMerchant(
        subscription,
        input.merchantId,
        ownership.stripeCustomerId,
        ownership.stripeSubscriptionId
      )
    ) {
      return { kind: "catching_up" }
    }

    const snapshot = mapProviderSubscriptionSnapshot(subscription)
    await satisfyLaunchFeeFromSubscription(
      subscription,
      input.merchantId,
      deps,
      false
    )
    const applied = await deps.applyCurrentSubscription({
      merchantId: input.merchantId,
      snapshot,
      entitlementStatus: mapEntitlementStatus(subscription.status),
      expectedBillingUpdatedAt: ownership.billingUpdatedAt,
    })
    return applied === "applied"
      ? {
          kind: "confirmed",
          source: "portal",
          status: subscription.status,
        }
      : { kind: "catching_up" }
  } catch {
    return { kind: "catching_up" }
  }
}
