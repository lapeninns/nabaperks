import { isCheckoutContractVersion } from "@/lib/stripe/checkout-contracts"
import type {
  BillingCheckoutAttempt,
  BillingInterval,
} from "@/lib/stripe/checkout-contracts"

export type CheckoutAttemptRpcRow = {
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

export function mapCheckoutAttemptRow(
  row: CheckoutAttemptRpcRow
): BillingCheckoutAttempt {
  return {
    claimStatus: row.claim_status ?? row.rotation_status ?? "conflict",
    merchantId: row.merchant_id ?? null,
    attemptId: row.attempt_id,
    billingInterval: row.billing_interval,
    stripePriceId: row.stripe_price_id,
    successUrl: row.success_url,
    cancelUrl: row.cancel_url,
    attemptExpiresAt: row.attempt_expires_at,
    checkoutContractVersion: null,
    stripeCustomerId: row.stripe_customer_id,
    stripeCheckoutSessionId: row.stripe_checkout_session_id ?? null,
    stripeCheckoutSessionUrl: row.stripe_checkout_session_url ?? null,
    stripeCheckoutSessionExpiresAt:
      row.stripe_checkout_session_expires_at ?? null,
    workerLeaseId: row.worker_lease_id,
    workerLeaseExpiresAt: row.worker_lease_expires_at,
  }
}

export function bindCheckoutContractVersion(
  attempt: BillingCheckoutAttempt,
  value: unknown
): BillingCheckoutAttempt {
  if (!attempt.attemptId) return attempt
  if (!isCheckoutContractVersion(value)) {
    throw new Error("Checkout contract version lookup failed")
  }
  return { ...attempt, checkoutContractVersion: value }
}
