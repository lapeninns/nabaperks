import "server-only"

import type {
  BillingCheckoutAttempt,
  BillingCheckoutDependencies,
  BillingInterval,
  CheckoutOfferBinding,
  LaunchFeePolicy,
} from "@/lib/stripe/checkout-contracts"

type RpcResult<T> = { data: T | null; error: { message: string } | null }

function requireRpcRow<T>(result: RpcResult<T[]>, operation: string): T {
  if (result.error || !result.data?.[0]) throw new Error(`${operation} failed`)
  return result.data[0]
}

function requireRpcScalar<T>(result: RpcResult<T>, operation: string): T {
  if (result.error || result.data == null)
    throw new Error(`${operation} failed`)
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
