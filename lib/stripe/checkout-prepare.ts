import "server-only"

import { buildBillingCheckoutReturnUrls } from "@/lib/merchant/billing-checkout-core"
import type {
  BillingCheckoutAttempt,
  BillingCheckoutDependencies,
  PrepareBillingCheckoutInput,
  PrepareBillingCheckoutResult,
  StripeCheckoutSessionLike,
} from "@/lib/stripe/checkout-contracts"
import {
  addMilliseconds,
  CHECKOUT_ATTEMPT_LIFETIME_MS,
  checkoutPriceId,
  checkoutSessionUrl,
  isOpenCheckoutSession,
  materializeCheckoutSession,
} from "@/lib/stripe/checkout-session"

const SAFE_CHECKOUT_ERROR =
  "Billing was not confirmed. Please try again — it is safe to retry."
const ACTIVE_BILLING_ERROR =
  "This venue already has billing. Refresh the page or manage it in Stripe."

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
  if (priorSession.status === "complete") return null

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
