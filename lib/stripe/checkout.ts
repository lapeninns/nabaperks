import "server-only"

import {
  buildBillingCheckoutReturnUrls,
  classifyCheckoutReturnSession,
  mapProviderSubscriptionSnapshot,
  providerId,
  type AuthoritativeBillingSnapshot,
  type BillingRuntimeEnvironment,
  type ProviderCheckoutSession,
  type ProviderSubscription,
} from "@/lib/merchant/billing-checkout-core"
import { getActiveSeasonalOffer } from "@/lib/marketing/seasonal-offer"

/**
 * Durable Checkout-attempt discriminator retained for compatibility with the
 * existing ledger. It selects either the 28-day or annual recurring Price;
 * provider terms are authoritatively validated and stored after sync.
 */
export type BillingInterval = "month" | "year"
export type LaunchFeePolicy =
  | "charged"
  | "annual_included"
  | "previously_satisfied"

export type BillingMerchant = {
  id: string
}

export type PrepareBillingCheckoutInput = {
  merchant: BillingMerchant
  interval: BillingInterval
  returnBase: string
  environment: BillingRuntimeEnvironment
  configuredOrigin: string
  requestOrigin?: string | null
  launchPriceId: string
  recurringPriceId: string
  annualPriceId: string
}

export type BillingCheckoutAttempt = {
  claimStatus:
    | "claimed"
    | "existing"
    | "interval_conflict"
    | "busy"
    | "blocked"
    | "conflict"
  merchantId?: string | null
  attemptId: string | null
  billingInterval: BillingInterval | null
  stripePriceId: string | null
  successUrl: string | null
  cancelUrl: string | null
  attemptExpiresAt: string | null
  stripeCustomerId: string | null
  stripeCheckoutSessionId: string | null
  stripeCheckoutSessionUrl: string | null
  stripeCheckoutSessionExpiresAt: string | null
  workerLeaseId: string | null
  workerLeaseExpiresAt: string | null
}

type StripeCustomerLike = { id: string }

type StripeCheckoutSessionLike = ProviderCheckoutSession & {
  url?: string | null
  expires_at?: number | null
}

type StripeSubscriptionLike = ProviderSubscription & {
  metadata?: Record<string, string | undefined> | null
}

export type BillingCheckoutOwnership = {
  recordedSessionId: string | null
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  billingUpdatedAt: string | null
}

export type CheckoutOfferBinding = {
  status: "bound" | "existing" | "conflict"
  launchFeePolicy: LaunchFeePolicy | null
  stripeLaunchPriceId: string | null
}

export type BillingCheckoutDependencies = {
  now: () => Date
  claimAttempt: (input: {
    merchantId: string
    billingInterval: BillingInterval
    stripePriceId: string
    successUrl: string
    cancelUrl: string
    attemptExpiresAt: string
  }) => Promise<BillingCheckoutAttempt>
  bindOffer: (input: {
    merchantId: string
    attemptId: string
    workerLeaseId: string
    configuredLaunchPriceId: string
  }) => Promise<CheckoutOfferBinding>
  bindCustomer: (input: {
    merchantId: string
    attemptId: string
    workerLeaseId: string
    stripeCustomerId: string
  }) => Promise<boolean>
  finalizeSession: (input: {
    merchantId: string
    attemptId: string
    workerLeaseId: string
    stripeCheckoutSessionId: string
    stripeCheckoutSessionUrl: string
    stripeCheckoutSessionExpiresAt: string
  }) => Promise<boolean>
  releaseAttempt: (input: {
    merchantId: string
    attemptId: string
    workerLeaseId: string
  }) => Promise<boolean>
  rotateAttempt: (input: {
    merchantId: string
    expectedAttemptId: string
    expectedSessionId: string
    billingInterval: BillingInterval
    stripePriceId: string
    successUrl: string
    cancelUrl: string
    attemptExpiresAt: string
  }) => Promise<BillingCheckoutAttempt>
  findCustomer: (input: {
    merchantId: string
  }) => Promise<StripeCustomerLike | null>
  createCustomer: (input: {
    params: {
      metadata: { merchant_id: string }
    }
    idempotencyKey: string
  }) => Promise<StripeCustomerLike>
  createCheckoutSession: (input: {
    params: {
      mode: "subscription"
      customer: string
      line_items: Array<{ price: string; quantity: number }>
      subscription_data: {
        trial_period_days?: number
        metadata: {
          merchant_id: string
          plan: "growth"
          billing_cadence: "28_days" | "annual"
          launch_fee_policy: LaunchFeePolicy
        }
      }
      metadata: {
        merchant_id: string
        attempt_id: string
        plan: "growth"
        billing_cadence: "28_days" | "annual"
        launch_fee_policy: LaunchFeePolicy
        offer_wrapper_slug: string
        offer_wrapper_name: string
        offer_wrapper_deadline: string
      }
      custom_text?: { submit: { message: string } }
      success_url: string
      cancel_url: string
      expires_at: number
    }
    idempotencyKey: string
  }) => Promise<StripeCheckoutSessionLike>
  retrieveCheckoutSession: (
    sessionId: string
  ) => Promise<StripeCheckoutSessionLike | null>
  expireCheckoutSession: (
    sessionId: string
  ) => Promise<StripeCheckoutSessionLike>
  retrieveSubscription: (
    subscriptionId: string
  ) => Promise<StripeSubscriptionLike>
  loadCheckoutOwnership: (
    merchantId: string
  ) => Promise<BillingCheckoutOwnership>
  applyCurrentSubscription: (input: {
    merchantId: string
    snapshot: AuthoritativeBillingSnapshot
    entitlementStatus: BillingEntitlementStatus
    expectedBillingUpdatedAt: string | null
  }) => Promise<"applied" | "stale">
  satisfyLaunchFee: (input: {
    merchantId: string
    stripeCustomerId: string
    stripeSubscriptionId: string
    policy: "charged" | "annual_included"
  }) => Promise<boolean>
  hasSatisfiedLaunchFee: (merchantId: string) => Promise<boolean>
}

export type BillingEntitlementStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "cancelled"
  | "suspended"

export type PrepareBillingCheckoutResult =
  | { status: "redirect"; url: string }
  | { status: "error"; message: string }

export type BillingReturnOutcome =
  | { kind: "confirmed"; source: "checkout" | "portal"; status: string }
  | { kind: "missing_session" }
  | {
      kind: "rejected"
      reason:
        | "foreign_session"
        | "wrong_mode"
        | "incomplete_session"
        | "missing_subscription"
        | "customer_mismatch"
        | "stale_session"
    }
  | { kind: "catching_up" }
  | { kind: "portal_missing" }

export type BillingCheckoutReturnObservers = {
  onVerifiedReturn?: (input: { merchantId: string }) => void
}

const CHECKOUT_ATTEMPT_LIFETIME_MS = 24 * 60 * 60 * 1_000
const CHECKOUT_SESSION_EXPIRY_MARGIN_MS = 60 * 60 * 1_000
const SAFE_CHECKOUT_ERROR =
  "Billing was not confirmed. Please try again — it is safe to retry."
const ACTIVE_BILLING_ERROR =
  "This venue already has billing. Refresh the page or manage it in Stripe."

function addMilliseconds(date: Date, milliseconds: number): string {
  return new Date(date.getTime() + milliseconds).toISOString()
}

function checkoutPriceId(input: PrepareBillingCheckoutInput): string | null {
  const configuredPrice =
    input.interval === "year" ? input.annualPriceId : input.recurringPriceId
  return configuredPrice.trim() || null
}

function checkoutCadence(interval: BillingInterval) {
  return interval === "year" ? "annual" : "28_days"
}

function hasCreationLease(
  attempt: BillingCheckoutAttempt
): attempt is BillingCheckoutAttempt & {
  attemptId: string
  billingInterval: BillingInterval
  stripePriceId: string
  successUrl: string
  cancelUrl: string
  attemptExpiresAt: string
  workerLeaseId: string
} {
  return Boolean(
    attempt.attemptId &&
    attempt.billingInterval &&
    attempt.stripePriceId &&
    attempt.successUrl &&
    attempt.cancelUrl &&
    attempt.attemptExpiresAt &&
    attempt.workerLeaseId
  )
}

function isOpenCheckoutSession(session: StripeCheckoutSessionLike): boolean {
  return session.status === "open"
}

function checkoutSessionUrl(
  session: StripeCheckoutSessionLike,
  fallback: string | null
): string | null {
  const value = session.url ?? fallback

  if (!value) return null

  try {
    const url = new URL(value)
    return url.protocol === "https:" ? url.toString() : null
  } catch {
    return null
  }
}

function checkoutSessionExpiryIso(
  session: StripeCheckoutSessionLike,
  fallback: string
): string {
  return Number.isSafeInteger(session.expires_at) &&
    (session.expires_at ?? 0) > 0
    ? new Date((session.expires_at as number) * 1_000).toISOString()
    : fallback
}

async function releaseCreationLease(
  attempt: BillingCheckoutAttempt,
  merchantId: string,
  deps: BillingCheckoutDependencies
): Promise<void> {
  if (!attempt.attemptId || !attempt.workerLeaseId) return

  try {
    await deps.releaseAttempt({
      merchantId,
      attemptId: attempt.attemptId,
      workerLeaseId: attempt.workerLeaseId,
    })
  } catch {
    // The five-minute database fence is recoverable even if explicit release
    // fails. Never replace the safe user-facing provider error with DB text.
  }
}

async function materializeCheckoutSession(
  input: PrepareBillingCheckoutInput,
  attempt: BillingCheckoutAttempt,
  deps: BillingCheckoutDependencies
): Promise<StripeCheckoutSessionLike | null> {
  if (!hasCreationLease(attempt)) return null

  try {
    const offer = await deps.bindOffer({
      merchantId: input.merchant.id,
      attemptId: attempt.attemptId,
      workerLeaseId: attempt.workerLeaseId,
      configuredLaunchPriceId: input.launchPriceId,
    })

    if (offer.status === "conflict" || !offer.launchFeePolicy) {
      await releaseCreationLease(attempt, input.merchant.id, deps)
      return null
    }

    let customerId = attempt.stripeCustomerId

    if (!customerId) {
      const recoveredCustomer = await deps.findCustomer({
        merchantId: input.merchant.id,
      })
      const customer =
        recoveredCustomer ??
        (await deps.createCustomer({
          params: {
            // Mutable profile copy must not enter this idempotent request. A
            // retry after a profile edit still has byte-identical parameters;
            // Checkout collects the billing email for the new Customer.
            metadata: { merchant_id: input.merchant.id },
          },
          idempotencyKey: `billing-customer:${input.merchant.id}:v1`,
        }))

      customerId = customer.id

      const bound = await deps.bindCustomer({
        merchantId: input.merchant.id,
        attemptId: attempt.attemptId,
        workerLeaseId: attempt.workerLeaseId,
        stripeCustomerId: customerId,
      })

      if (!bound) {
        await releaseCreationLease(attempt, input.merchant.id, deps)
        return null
      }
    }

    // Derive every provider parameter from the persisted attempt. A retry hours
    // later must send byte-for-byte equivalent Session parameters or Stripe's
    // idempotency layer correctly rejects it as a conflicting request.
    const sessionExpiry = new Date(
      new Date(attempt.attemptExpiresAt).getTime() -
        CHECKOUT_SESSION_EXPIRY_MARGIN_MS
    ).toISOString()
    const attemptCreatedAt = new Date(
      new Date(attempt.attemptExpiresAt).getTime() -
        CHECKOUT_ATTEMPT_LIFETIME_MS
    )
    const seasonalOffer = getActiveSeasonalOffer(attemptCreatedAt)
    const cadence = checkoutCadence(attempt.billingInterval)
    const offerWrapper = seasonalOffer
      ? {
          slug: seasonalOffer.slug,
          name: seasonalOffer.name,
          deadline: seasonalOffer.endDateISO,
        }
      : {
          slug: "standard",
          name: "The 28-Day First-Regular Launch",
          deadline: "none",
        }
    const session = await deps.createCheckoutSession({
      params: {
        mode: "subscription",
        customer: customerId,
        line_items: [
          { price: attempt.stripePriceId, quantity: 1 },
          ...(offer.stripeLaunchPriceId
            ? [{ price: offer.stripeLaunchPriceId, quantity: 1 }]
            : []),
        ],
        subscription_data: {
          trial_period_days: 28,
          metadata: {
            merchant_id: input.merchant.id,
            plan: "growth",
            billing_cadence: cadence,
            launch_fee_policy: offer.launchFeePolicy,
          },
        },
        metadata: {
          merchant_id: input.merchant.id,
          attempt_id: attempt.attemptId,
          plan: "growth",
          billing_cadence: cadence,
          launch_fee_policy: offer.launchFeePolicy,
          offer_wrapper_slug: offerWrapper.slug,
          offer_wrapper_name: offerWrapper.name,
          offer_wrapper_deadline: offerWrapper.deadline,
        },
        ...(seasonalOffer
          ? {
              custom_text: {
                submit: {
                  message: `${seasonalOffer.name}: ${seasonalOffer.deadlineLine} Standard Growth Plan terms are unchanged.`,
                },
              },
            }
          : {}),
        success_url: attempt.successUrl,
        cancel_url: attempt.cancelUrl,
        expires_at: Math.floor(new Date(sessionExpiry).getTime() / 1_000),
      },
      idempotencyKey: `billing-checkout:${attempt.attemptId}`,
    })
    const url = checkoutSessionUrl(session, null)

    if (!session.id || !url) {
      await releaseCreationLease(attempt, input.merchant.id, deps)
      return null
    }

    const finalized = await deps.finalizeSession({
      merchantId: input.merchant.id,
      attemptId: attempt.attemptId,
      workerLeaseId: attempt.workerLeaseId,
      stripeCheckoutSessionId: session.id,
      stripeCheckoutSessionUrl: url,
      stripeCheckoutSessionExpiresAt: checkoutSessionExpiryIso(
        session,
        sessionExpiry
      ),
    })

    if (!finalized) {
      await releaseCreationLease(attempt, input.merchant.id, deps)
      return null
    }

    return { ...session, url }
  } catch {
    await releaseCreationLease(attempt, input.merchant.id, deps)
    return null
  }
}

async function recoverConflictingAttempt(
  input: PrepareBillingCheckoutInput,
  attempt: BillingCheckoutAttempt,
  deps: BillingCheckoutDependencies
): Promise<BillingCheckoutAttempt | null> {
  if (
    !attempt.attemptId ||
    !attempt.billingInterval ||
    !attempt.stripePriceId ||
    !attempt.successUrl ||
    !attempt.cancelUrl ||
    !attempt.attemptExpiresAt
  ) {
    return null
  }

  let priorSessionId = attempt.stripeCheckoutSessionId
  let priorSession: StripeCheckoutSessionLike | null = null

  if (priorSessionId) {
    priorSession = await deps.retrieveCheckoutSession(priorSessionId)
  } else {
    const recoveredAttempt = await deps.claimAttempt({
      merchantId: input.merchant.id,
      billingInterval: attempt.billingInterval,
      stripePriceId: attempt.stripePriceId,
      successUrl: attempt.successUrl,
      cancelUrl: attempt.cancelUrl,
      attemptExpiresAt: attempt.attemptExpiresAt,
    })

    if (recoveredAttempt.claimStatus === "existing") {
      priorSessionId = recoveredAttempt.stripeCheckoutSessionId
      priorSession = priorSessionId
        ? await deps.retrieveCheckoutSession(priorSessionId)
        : null
    } else if (recoveredAttempt.claimStatus === "claimed") {
      priorSession = await materializeCheckoutSession(
        input,
        recoveredAttempt,
        deps
      )
      priorSessionId = priorSession?.id ?? null
    } else {
      return null
    }
  }

  if (!priorSession || !priorSessionId) return null

  if (priorSession.status === "complete") {
    return null
  }

  if (isOpenCheckoutSession(priorSession)) {
    const expired = await deps.expireCheckoutSession(priorSessionId)
    if (expired.status !== "expired") return null
  } else if (priorSession.status !== "expired") {
    return null
  }

  const priceId = checkoutPriceId(input)
  if (!priceId) return null

  const { successUrl, cancelUrl } = buildBillingCheckoutReturnUrls({
    returnBase: input.returnBase,
    environment: input.environment,
    configuredOrigin: input.configuredOrigin,
    requestOrigin: input.requestOrigin,
  })

  return deps.rotateAttempt({
    merchantId: input.merchant.id,
    expectedAttemptId: attempt.attemptId,
    expectedSessionId: priorSessionId,
    billingInterval: input.interval,
    stripePriceId: priceId,
    successUrl,
    cancelUrl,
    attemptExpiresAt: addMilliseconds(deps.now(), CHECKOUT_ATTEMPT_LIFETIME_MS),
  })
}

/**
 * Reserve, recover, or resume one merchant-owned Stripe Checkout Session.
 * Every external create uses an idempotency key derived from durable DB state.
 */
export async function prepareBillingCheckout(
  input: PrepareBillingCheckoutInput,
  deps: BillingCheckoutDependencies
): Promise<PrepareBillingCheckoutResult> {
  const priceId = checkoutPriceId(input)
  if (!priceId) return { status: "error", message: SAFE_CHECKOUT_ERROR }

  let urls: { successUrl: string; cancelUrl: string }
  try {
    urls = buildBillingCheckoutReturnUrls({
      returnBase: input.returnBase,
      environment: input.environment,
      configuredOrigin: input.configuredOrigin,
      requestOrigin: input.requestOrigin,
    })
  } catch {
    return { status: "error", message: SAFE_CHECKOUT_ERROR }
  }

  try {
    let attempt = await deps.claimAttempt({
      merchantId: input.merchant.id,
      billingInterval: input.interval,
      stripePriceId: priceId,
      successUrl: urls.successUrl,
      cancelUrl: urls.cancelUrl,
      attemptExpiresAt: addMilliseconds(
        deps.now(),
        CHECKOUT_ATTEMPT_LIFETIME_MS
      ),
    })

    if (attempt.claimStatus === "blocked") {
      return { status: "error", message: ACTIVE_BILLING_ERROR }
    }

    if (attempt.claimStatus === "busy" || attempt.claimStatus === "conflict") {
      return { status: "error", message: SAFE_CHECKOUT_ERROR }
    }

    if (attempt.claimStatus === "existing") {
      if (!attempt.stripeCheckoutSessionId) {
        return { status: "error", message: SAFE_CHECKOUT_ERROR }
      }

      const session = await deps.retrieveCheckoutSession(
        attempt.stripeCheckoutSessionId
      )
      if (!session) return { status: "error", message: SAFE_CHECKOUT_ERROR }

      if (
        attempt.billingInterval === input.interval &&
        isOpenCheckoutSession(session)
      ) {
        const url = checkoutSessionUrl(
          session,
          attempt.stripeCheckoutSessionUrl
        )
        return url
          ? { status: "redirect", url }
          : { status: "error", message: SAFE_CHECKOUT_ERROR }
      }

      if (session.status === "complete") {
        return { status: "error", message: ACTIVE_BILLING_ERROR }
      }

      attempt =
        (await recoverConflictingAttempt(input, attempt, deps)) ?? attempt
      if (attempt.claimStatus !== "claimed") {
        return { status: "error", message: SAFE_CHECKOUT_ERROR }
      }
    } else if (attempt.claimStatus === "interval_conflict") {
      const rotated = await recoverConflictingAttempt(input, attempt, deps)
      if (!rotated || rotated.claimStatus !== "claimed") {
        return { status: "error", message: SAFE_CHECKOUT_ERROR }
      }
      attempt = rotated
    }

    if (attempt.claimStatus !== "claimed") {
      return { status: "error", message: SAFE_CHECKOUT_ERROR }
    }

    const session = await materializeCheckoutSession(input, attempt, deps)
    const url = session ? checkoutSessionUrl(session, null) : null

    return url
      ? { status: "redirect", url }
      : { status: "error", message: SAFE_CHECKOUT_ERROR }
  } catch {
    return { status: "error", message: SAFE_CHECKOUT_ERROR }
  }
}

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

/** Verify the exact returned Session and persist only its exact Subscription. */
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

    // This Session and its exact Subscription are now verified. Observe before
    // the durable apply so a webhook-winning stale result cannot erase a real
    // return; analytics must never change the billing outcome.
    try {
      observers.onVerifiedReturn?.({ merchantId: input.merchantId })
    } catch {
      // Best-effort observer only.
    }

    const applied = await deps.applyCurrentSubscription({
      merchantId: input.merchantId,
      snapshot,
      entitlementStatus,
      expectedBillingUpdatedAt: ownership.billingUpdatedAt,
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

/** Reconcile only the merchant's already-recorded current Subscription. */
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

type RpcResult<T> = { data: T | null; error: { message: string } | null }

function requireRpcRow<T>(result: RpcResult<T[]>, operation: string): T {
  if (result.error || !result.data?.[0]) {
    throw new Error(`${operation} failed`)
  }
  return result.data[0]
}

function requireRpcScalar<T>(result: RpcResult<T>, operation: string): T {
  if (result.error || result.data == null) {
    throw new Error(`${operation} failed`)
  }
  return result.data
}

type CheckoutAttemptRpcRow = {
  claim_status?: BillingCheckoutAttempt["claimStatus"]
  rotation_status?: BillingCheckoutAttempt["claimStatus"]
  merchant_id?: string | null
  attempt_id: string | null
  billing_interval: BillingInterval | null
  stripe_price_id: string | null
  success_url: string | null
  cancel_url: string | null
  attempt_expires_at: string | null
  stripe_customer_id: string | null
  stripe_checkout_session_id?: string | null
  stripe_checkout_session_url?: string | null
  stripe_checkout_session_expires_at?: string | null
  worker_lease_id: string | null
  worker_lease_expires_at: string | null
}

function mapAttemptRow(row: CheckoutAttemptRpcRow): BillingCheckoutAttempt {
  return {
    claimStatus: row.claim_status ?? row.rotation_status ?? "conflict",
    merchantId: row.merchant_id ?? null,
    attemptId: row.attempt_id,
    billingInterval: row.billing_interval,
    stripePriceId: row.stripe_price_id,
    successUrl: row.success_url,
    cancelUrl: row.cancel_url,
    attemptExpiresAt: row.attempt_expires_at,
    stripeCustomerId: row.stripe_customer_id,
    stripeCheckoutSessionId: row.stripe_checkout_session_id ?? null,
    stripeCheckoutSessionUrl: row.stripe_checkout_session_url ?? null,
    stripeCheckoutSessionExpiresAt:
      row.stripe_checkout_session_expires_at ?? null,
    workerLeaseId: row.worker_lease_id,
    workerLeaseExpiresAt: row.worker_lease_expires_at,
  }
}

/**
 * Build the production provider/database boundary lazily. Keeping the pure
 * orchestration above dependency-injected makes timeout and replay behavior
 * fully testable without importing Next server state into unit tests.
 */
export async function createBillingCheckoutDependencies(): Promise<BillingCheckoutDependencies> {
  const [{ createSupabaseServiceRoleClient }, { getStripe }] =
    await Promise.all([
      import("@/lib/supabase/server"),
      import("@/lib/stripe/server"),
    ])
  const supabase = createSupabaseServiceRoleClient()
  const stripe = getStripe()

  return {
    now: () => new Date(),
    claimAttempt: async (input) => {
      const result = (await supabase.rpc("claim_billing_checkout_attempt", {
        p_merchant_id: input.merchantId,
        p_billing_interval: input.billingInterval,
        p_stripe_price_id: input.stripePriceId,
        p_success_url: input.successUrl,
        p_cancel_url: input.cancelUrl,
        p_attempt_expires_at: input.attemptExpiresAt,
        p_stripe_customer_id: null,
      })) as RpcResult<CheckoutAttemptRpcRow[]>
      return mapAttemptRow(requireRpcRow(result, "Checkout attempt claim"))
    },
    bindOffer: async (input) => {
      const result = (await supabase.rpc("bind_billing_checkout_offer", {
        p_merchant_id: input.merchantId,
        p_attempt_id: input.attemptId,
        p_worker_lease_id: input.workerLeaseId,
        p_configured_launch_price_id: input.configuredLaunchPriceId,
      })) as RpcResult<
        Array<{
          bind_status: CheckoutOfferBinding["status"]
          launch_fee_policy: LaunchFeePolicy | null
          stripe_launch_price_id: string | null
        }>
      >
      const row = requireRpcRow(result, "Checkout offer binding")
      return {
        status: row.bind_status,
        launchFeePolicy: row.launch_fee_policy,
        stripeLaunchPriceId: row.stripe_launch_price_id,
      }
    },
    bindCustomer: async (input) => {
      const result = (await supabase.rpc("bind_billing_checkout_customer", {
        p_merchant_id: input.merchantId,
        p_attempt_id: input.attemptId,
        p_worker_lease_id: input.workerLeaseId,
        p_stripe_customer_id: input.stripeCustomerId,
      })) as RpcResult<boolean>
      return requireRpcScalar(result, "Checkout customer binding")
    },
    finalizeSession: async (input) => {
      const result = (await supabase.rpc("finalize_billing_checkout_session", {
        p_merchant_id: input.merchantId,
        p_attempt_id: input.attemptId,
        p_worker_lease_id: input.workerLeaseId,
        p_stripe_checkout_session_id: input.stripeCheckoutSessionId,
        p_stripe_checkout_session_url: input.stripeCheckoutSessionUrl,
        p_stripe_checkout_session_expires_at:
          input.stripeCheckoutSessionExpiresAt,
      })) as RpcResult<boolean>
      return requireRpcScalar(result, "Checkout Session finalization")
    },
    releaseAttempt: async (input) => {
      const result = (await supabase.rpc("release_billing_checkout_attempt", {
        p_merchant_id: input.merchantId,
        p_attempt_id: input.attemptId,
        p_worker_lease_id: input.workerLeaseId,
      })) as RpcResult<boolean>
      return requireRpcScalar(result, "Checkout attempt release")
    },
    rotateAttempt: async (input) => {
      const result = (await supabase.rpc("rotate_billing_checkout_attempt", {
        p_merchant_id: input.merchantId,
        p_expected_attempt_id: input.expectedAttemptId,
        p_expected_session_id: input.expectedSessionId,
        p_billing_interval: input.billingInterval,
        p_stripe_price_id: input.stripePriceId,
        p_success_url: input.successUrl,
        p_cancel_url: input.cancelUrl,
        p_attempt_expires_at: input.attemptExpiresAt,
      })) as RpcResult<CheckoutAttemptRpcRow[]>
      return mapAttemptRow(requireRpcRow(result, "Checkout attempt rotation"))
    },
    findCustomer: async ({ merchantId }) => {
      const customers = await stripe.customers.search({
        query: `metadata['merchant_id']:'${merchantId}'`,
        limit: 2,
      })
      if (customers.data.length > 1) {
        throw new Error("Stripe customer ownership is ambiguous")
      }
      return customers.data[0] ?? null
    },
    createCustomer: async ({ params, idempotencyKey }) =>
      stripe.customers.create(params, { idempotencyKey }),
    createCheckoutSession: async ({ params, idempotencyKey }) =>
      stripe.checkout.sessions.create(params, { idempotencyKey }),
    retrieveCheckoutSession: async (sessionId) =>
      stripe.checkout.sessions.retrieve(sessionId),
    expireCheckoutSession: async (sessionId) =>
      stripe.checkout.sessions.expire(sessionId),
    retrieveSubscription: async (subscriptionId) =>
      stripe.subscriptions.retrieve(subscriptionId),
    loadCheckoutOwnership: async (merchantId) => {
      const [attemptResult, billingResult] = await Promise.all([
        supabase
          .from("billing_checkout_attempts")
          .select("stripe_customer_id, stripe_checkout_session_id")
          .eq("merchant_id", merchantId)
          .maybeSingle(),
        supabase
          .from("billing_customers")
          .select("stripe_customer_id, stripe_subscription_id, updated_at")
          .eq("merchant_id", merchantId)
          .maybeSingle(),
      ])

      if (attemptResult.error || billingResult.error) {
        throw new Error("Unable to load Checkout ownership")
      }

      const attemptCustomer = attemptResult.data?.stripe_customer_id ?? null
      const billingCustomer = billingResult.data?.stripe_customer_id ?? null
      if (
        attemptCustomer &&
        billingCustomer &&
        attemptCustomer !== billingCustomer
      ) {
        throw new Error("Checkout ownership is inconsistent")
      }

      return {
        recordedSessionId:
          attemptResult.data?.stripe_checkout_session_id ?? null,
        stripeCustomerId: billingCustomer ?? attemptCustomer,
        stripeSubscriptionId:
          billingResult.data?.stripe_subscription_id ?? null,
        billingUpdatedAt: billingResult.data?.updated_at ?? null,
      }
    },
    applyCurrentSubscription: async ({
      merchantId,
      snapshot,
      entitlementStatus,
      expectedBillingUpdatedAt,
    }) => {
      const result = (await supabase.rpc("apply_current_stripe_subscription", {
        p_merchant_id: merchantId,
        p_stripe_customer_id: snapshot.stripe_customer_id,
        p_stripe_subscription_id: snapshot.stripe_subscription_id,
        p_stripe_subscription_status: snapshot.stripe_subscription_status,
        p_stripe_subscription_created_at:
          snapshot.stripe_subscription_created_at,
        p_stripe_price_id: snapshot.stripe_price_id,
        p_billing_interval: snapshot.billing_interval,
        p_unit_amount: snapshot.unit_amount,
        p_currency: snapshot.currency,
        p_current_period_end: snapshot.current_period_end,
        p_cancel_at_period_end: snapshot.cancel_at_period_end,
        p_cancel_at: snapshot.cancel_at,
        p_entitlement_status: entitlementStatus,
        p_expected_updated_at: expectedBillingUpdatedAt,
      })) as RpcResult<"applied" | "stale">
      return requireRpcScalar(result, "Current Subscription application")
    },
    satisfyLaunchFee: async (input) => {
      const result = (await supabase.rpc("satisfy_merchant_launch_fee", {
        p_merchant_id: input.merchantId,
        p_stripe_customer_id: input.stripeCustomerId,
        p_stripe_subscription_id: input.stripeSubscriptionId,
        p_launch_fee_policy: input.policy,
      })) as RpcResult<boolean>
      return requireRpcScalar(result, "Launch fee satisfaction")
    },
    hasSatisfiedLaunchFee: async (merchantId) => {
      const result = await supabase
        .from("billing_customers")
        .select("launch_fee_status")
        .eq("merchant_id", merchantId)
        .maybeSingle()

      if (result.error) throw new Error("Unable to verify launch fee status")
      return result.data?.launch_fee_status != null
    },
  }
}
