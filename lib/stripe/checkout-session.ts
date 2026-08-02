import "server-only"

import { getActiveSeasonalOffer } from "@/lib/marketing/seasonal-offer"
import { CHECKOUT_CONTRACT_VERSION } from "@/lib/stripe/checkout-contracts"
import type {
  BillingCheckoutAttempt,
  BillingCheckoutDependencies,
  BillingInterval,
  CheckoutContractVersion,
  PilotMetadata,
  PrepareBillingCheckoutInput,
  StripeCheckoutSessionLike,
} from "@/lib/stripe/checkout-contracts"

export const CHECKOUT_ATTEMPT_LIFETIME_MS = 24 * 60 * 60 * 1_000
const CHECKOUT_SESSION_EXPIRY_MARGIN_MS = 60 * 60 * 1_000

export function addMilliseconds(date: Date, milliseconds: number): string {
  return new Date(date.getTime() + milliseconds).toISOString()
}

export function checkoutPriceId(
  input: PrepareBillingCheckoutInput
): string | null {
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
  checkoutContractVersion: CheckoutContractVersion
  workerLeaseId: string
} {
  return Boolean(
    attempt.attemptId &&
    attempt.billingInterval &&
    attempt.stripePriceId &&
    attempt.successUrl &&
    attempt.cancelUrl &&
    attempt.attemptExpiresAt &&
    attempt.checkoutContractVersion &&
    attempt.workerLeaseId
  )
}

export function isOpenCheckoutSession(
  session: StripeCheckoutSessionLike
): boolean {
  return session.status === "open"
}

export function checkoutSessionUrl(
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
  const expiresAt = session.expires_at
  return typeof expiresAt === "number" &&
    Number.isSafeInteger(expiresAt) &&
    expiresAt > 0
    ? new Date(expiresAt * 1_000).toISOString()
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
    // The database fence recovers even when explicit release is unavailable.
  }
}

export async function materializeCheckoutSession(
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
          params: { metadata: { merchant_id: input.merchant.id } },
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
    const usesDeliveryAnchoredContract =
      attempt.checkoutContractVersion === CHECKOUT_CONTRACT_VERSION.current
    const pilotMetadata: Partial<PilotMetadata> = usesDeliveryAnchoredContract
      ? {
          pilot_anchor: "confirmed_delivery",
          fulfilment_allowance_days: "14",
          usable_pilot_days: "28",
        }
      : {}
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
          trial_period_days: usesDeliveryAnchoredContract ? 42 : 28,
          metadata: {
            merchant_id: input.merchant.id,
            plan: "growth",
            billing_cadence: cadence,
            launch_fee_policy: offer.launchFeePolicy,
            ...pilotMetadata,
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
          ...pilotMetadata,
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
