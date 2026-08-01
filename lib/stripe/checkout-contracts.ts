import type {
  AuthoritativeBillingSnapshot,
  BillingRuntimeEnvironment,
  ProviderCheckoutSession,
  ProviderSubscription,
} from "@/lib/merchant/billing-checkout-core"

export type BillingInterval = "month" | "year"
export type LaunchFeePolicy =
  "charged" | "annual_included" | "previously_satisfied"

export type BillingMerchant = { id: string }

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

export type StripeCustomerLike = { id: string }

export type StripeCheckoutSessionLike = ProviderCheckoutSession & {
  url?: string | null
  expires_at?: number | null
}

export type StripeSubscriptionLike = ProviderSubscription & {
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

export type PilotMetadata = {
  pilot_anchor: "confirmed_delivery"
  fulfilment_allowance_days: "14"
  usable_pilot_days: "28"
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
    params: { metadata: { merchant_id: string } }
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
        } & PilotMetadata
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
      } & PilotMetadata
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
  "trialing" | "active" | "past_due" | "cancelled" | "suspended"

export type PrepareBillingCheckoutResult =
  { status: "redirect"; url: string } | { status: "error"; message: string }

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
