import assert from "node:assert/strict"
import test from "node:test"

import {
  confirmBillingCheckoutReturn,
  prepareBillingCheckout,
  reconcileBillingPortalReturn,
} from "@/lib/stripe/checkout"

const NOW = new Date("2026-07-10T12:00:00.000Z")
const ATTEMPT_EXPIRY = "2026-07-11T12:00:00.000Z"
const SESSION_EXPIRY = "2026-07-11T11:00:00.000Z"
const BILLING_UPDATED_AT = "2026-07-10T11:59:00.000Z"

const merchant = {
  id: "merchant_owned",
  email: "owner@example.test",
  businessName: "Owned Venue",
}

const input = {
  merchant,
  interval: "month",
  returnBase: "/app/launch?tab=billing",
  environment: "development",
  configuredOrigin: "http://localhost:3000",
  requestOrigin: "http://localhost:4317",
  monthlyPriceId: "price_month",
  annualPriceId: "price_year",
}

function attempt(overrides = {}) {
  return {
    claimStatus: "claimed",
    merchantId: merchant.id,
    attemptId: "10000000-0000-4000-8000-000000000001",
    billingInterval: "month",
    stripePriceId: "price_month",
    successUrl:
      "http://localhost:4317/app/launch?tab=billing&checkout=success&session_id={CHECKOUT_SESSION_ID}",
    cancelUrl:
      "http://localhost:4317/app/launch?tab=billing&checkout=cancelled",
    attemptExpiresAt: ATTEMPT_EXPIRY,
    stripeCustomerId: null,
    stripeCheckoutSessionId: null,
    stripeCheckoutSessionUrl: null,
    stripeCheckoutSessionExpiresAt: null,
    workerLeaseId: "20000000-0000-4000-8000-000000000001",
    workerLeaseExpiresAt: "2026-07-10T12:05:00.000Z",
    ...overrides,
  }
}

function subscription(overrides = {}) {
  return {
    id: "sub_owned",
    created: 1_752_067_200,
    status: "trialing",
    customer: "cus_owned",
    metadata: { merchant_id: merchant.id },
    items: {
      data: [
        {
          current_period_end: 1_754_659_200,
          price: {
            id: "price_month",
            recurring: { interval: "month" },
            unit_amount: 4_900,
            currency: "gbp",
          },
        },
      ],
    },
    cancel_at_period_end: false,
    cancel_at: null,
    ...overrides,
  }
}

function dependencies(overrides = {}) {
  return {
    now: () => NOW,
    claimAttempt: async () => attempt(),
    bindCustomer: async () => true,
    finalizeSession: async () => true,
    releaseAttempt: async () => true,
    rotateAttempt: async () => ({
      ...attempt(),
      claimStatus: "claimed",
    }),
    findCustomer: async () => null,
    createCustomer: async () => ({ id: "cus_owned" }),
    createCheckoutSession: async () => ({
      id: "cs_owned",
      url: "https://checkout.stripe.test/cs_owned",
      status: "open",
      expires_at: Math.floor(new Date(SESSION_EXPIRY).getTime() / 1_000),
      customer: "cus_owned",
      subscription: null,
      metadata: { merchant_id: merchant.id },
      mode: "subscription",
    }),
    retrieveCheckoutSession: async () => ({
      id: "cs_owned",
      url: "https://checkout.stripe.test/cs_owned",
      status: "complete",
      payment_status: "no_payment_required",
      expires_at: Math.floor(new Date(SESSION_EXPIRY).getTime() / 1_000),
      customer: "cus_owned",
      subscription: "sub_owned",
      metadata: { merchant_id: merchant.id },
      mode: "subscription",
    }),
    expireCheckoutSession: async () => ({ id: "cs_owned", status: "expired" }),
    retrieveSubscription: async () => subscription(),
    loadCheckoutOwnership: async () => ({
      recordedSessionId: "cs_owned",
      stripeCustomerId: "cus_owned",
      stripeSubscriptionId: null,
      billingUpdatedAt: null,
    }),
    applyCurrentSubscription: async () => "applied",
    ...overrides,
  }
}

test("an existing open attempt resumes its exact Checkout Session without writes", async () => {
  let createCalls = 0
  const result = await prepareBillingCheckout(
    input,
    dependencies({
      claimAttempt: async () =>
        attempt({
          claimStatus: "existing",
          stripeCustomerId: "cus_owned",
          stripeCheckoutSessionId: "cs_owned",
          stripeCheckoutSessionUrl: "https://checkout.stripe.test/cs_owned",
          stripeCheckoutSessionExpiresAt: SESSION_EXPIRY,
          workerLeaseId: null,
          workerLeaseExpiresAt: null,
        }),
      retrieveCheckoutSession: async () => ({
        id: "cs_owned",
        status: "open",
        url: "https://checkout.stripe.test/cs_owned",
      }),
      createCheckoutSession: async () => {
        createCalls += 1
        throw new Error("must not create")
      },
    })
  )

  assert.deepEqual(result, {
    status: "redirect",
    url: "https://checkout.stripe.test/cs_owned",
  })
  assert.equal(createCalls, 0)
})

test("a fresh attempt creates one customer and one exact idempotent Session", async () => {
  const calls = { bind: 0, finalize: 0 }

  const result = await prepareBillingCheckout(
    input,
    dependencies({
      createCustomer: async ({ params, idempotencyKey }) => {
        assert.deepEqual(params, {
          metadata: { merchant_id: merchant.id },
        })
        assert.equal(idempotencyKey, `billing-customer:${merchant.id}:v1`)
        return { id: "cus_owned" }
      },
      bindCustomer: async (binding) => {
        calls.bind += 1
        assert.equal(binding.stripeCustomerId, "cus_owned")
        return true
      },
      createCheckoutSession: async ({ params, idempotencyKey }) => {
        assert.equal(
          idempotencyKey,
          "billing-checkout:10000000-0000-4000-8000-000000000001"
        )
        assert.equal(params.customer, "cus_owned")
        assert.deepEqual(params.line_items, [
          { price: "price_month", quantity: 1 },
        ])
        assert.equal(params.subscription_data.trial_period_days, 30)
        assert.equal(params.metadata.merchant_id, merchant.id)
        assert.equal(params.metadata.attempt_id, attempt().attemptId)
        assert.equal(params.success_url, attempt().successUrl)
        assert.equal("payment_method_types" in params, false)
        return {
          id: "cs_owned",
          url: "https://checkout.stripe.test/cs_owned",
          status: "open",
          expires_at: Math.floor(new Date(SESSION_EXPIRY).getTime() / 1_000),
        }
      },
      finalizeSession: async (session) => {
        calls.finalize += 1
        assert.equal(session.stripeCheckoutSessionId, "cs_owned")
        return true
      },
    })
  )

  assert.deepEqual(result, {
    status: "redirect",
    url: "https://checkout.stripe.test/cs_owned",
  })
  assert.deepEqual(calls, { bind: 1, finalize: 1 })
})

test("an ambiguous retry replays the attempt's deterministic Session expiry", async () => {
  let expiresAt = null
  const result = await prepareBillingCheckout(
    input,
    dependencies({
      now: () => new Date("2026-07-10T18:00:00.000Z"),
      claimAttempt: async () => attempt({ stripeCustomerId: "cus_owned" }),
      createCheckoutSession: async ({ params }) => {
        expiresAt = params.expires_at
        return {
          id: "cs_owned",
          url: "https://checkout.stripe.test/cs_owned",
          status: "open",
          expires_at: params.expires_at,
        }
      },
    })
  )

  assert.equal(
    expiresAt,
    Math.floor(new Date(SESSION_EXPIRY).getTime() / 1_000),
    "retries must not change Stripe's idempotent request parameters"
  )
  assert.equal(result.status, "redirect")
})

test("provider failure releases only its fenced attempt and returns safe retry copy", async () => {
  let released = null
  const result = await prepareBillingCheckout(
    input,
    dependencies({
      createCheckoutSession: async () => {
        throw new Error("sk_test_secret raw provider failure")
      },
      releaseAttempt: async (value) => {
        released = value
        return true
      },
    })
  )

  assert.equal(result.status, "error")
  assert.match(result.message, /not confirmed|try again/i)
  assert.doesNotMatch(result.message, /sk_test|provider failure/)
  assert.equal(released.attemptId, attempt().attemptId)
  assert.equal(released.workerLeaseId, attempt().workerLeaseId)
})

test("an interval switch expires the exact open Session before fenced rotation", async () => {
  const order = []
  const result = await prepareBillingCheckout(
    { ...input, interval: "year" },
    dependencies({
      claimAttempt: async () =>
        attempt({
          claimStatus: "interval_conflict",
          stripeCustomerId: "cus_owned",
          stripeCheckoutSessionId: "cs_month",
          stripeCheckoutSessionUrl: "https://checkout.stripe.test/cs_month",
          workerLeaseId: null,
          workerLeaseExpiresAt: null,
        }),
      retrieveCheckoutSession: async (sessionId) => {
        order.push(`retrieve:${sessionId}`)
        return {
          id: sessionId,
          status: "open",
          url: `https://checkout.stripe.test/${sessionId}`,
        }
      },
      expireCheckoutSession: async (sessionId) => {
        order.push(`expire:${sessionId}`)
        return { id: sessionId, status: "expired" }
      },
      rotateAttempt: async (value) => {
        order.push(`rotate:${value.expectedSessionId}`)
        assert.equal(value.expectedAttemptId, attempt().attemptId)
        assert.equal(value.billingInterval, "year")
        assert.equal(value.stripePriceId, "price_year")
        return attempt({
          claimStatus: "claimed",
          attemptId: "10000000-0000-4000-8000-000000000002",
          billingInterval: "year",
          stripePriceId: "price_year",
          stripeCustomerId: "cus_owned",
        })
      },
      createCheckoutSession: async ({ params, idempotencyKey }) => {
        order.push("create:year")
        assert.equal(params.line_items[0].price, "price_year")
        assert.equal(params.metadata.interval, "year")
        assert.equal(
          idempotencyKey,
          "billing-checkout:10000000-0000-4000-8000-000000000002"
        )
        return {
          id: "cs_year",
          url: "https://checkout.stripe.test/cs_year",
          status: "open",
          expires_at: Math.floor(new Date(SESSION_EXPIRY).getTime() / 1_000),
        }
      },
    })
  )

  assert.deepEqual(result, {
    status: "redirect",
    url: "https://checkout.stripe.test/cs_year",
  })
  assert.deepEqual(order, [
    "retrieve:cs_month",
    "expire:cs_month",
    "rotate:cs_month",
    "create:year",
  ])
})

test("a durable non-restartable billing state creates no provider object", async () => {
  let providerWrites = 0
  const result = await prepareBillingCheckout(
    input,
    dependencies({
      claimAttempt: async () =>
        attempt({
          claimStatus: "blocked",
          attemptId: null,
          billingInterval: null,
          stripePriceId: null,
          successUrl: null,
          cancelUrl: null,
          attemptExpiresAt: null,
          workerLeaseId: null,
        }),
      createCustomer: async () => {
        providerWrites += 1
        return { id: "cus_forbidden" }
      },
      createCheckoutSession: async () => {
        providerWrites += 1
        return { id: "cs_forbidden" }
      },
    })
  )

  assert.equal(result.status, "error")
  assert.match(result.message, /already has billing|manage/i)
  assert.equal(providerWrites, 0)
})

test("missing and foreign return ids perform no billing mutation", async () => {
  let providerReads = 0
  let applies = 0
  const deps = dependencies({
    retrieveCheckoutSession: async () => {
      providerReads += 1
      return null
    },
    applyCurrentSubscription: async () => {
      applies += 1
      return "applied"
    },
  })

  assert.deepEqual(
    await confirmBillingCheckoutReturn(
      { merchantId: merchant.id, sessionId: null },
      deps
    ),
    { kind: "missing_session" }
  )
  assert.equal(providerReads, 0)

  assert.deepEqual(
    await confirmBillingCheckoutReturn(
      { merchantId: merchant.id, sessionId: "cs_foreign" },
      dependencies({
        retrieveCheckoutSession: async () => ({
          id: "cs_foreign",
          mode: "subscription",
          status: "complete",
          customer: "cus_other",
          subscription: "sub_other",
          metadata: { merchant_id: "merchant_other" },
        }),
        applyCurrentSubscription: async () => {
          applies += 1
          return "applied"
        },
      })
    ),
    { kind: "rejected", reason: "foreign_session" }
  )
  assert.equal(applies, 0)
})

test("an owned completed trial applies only its exact current Subscription", async () => {
  let applied = null
  const result = await confirmBillingCheckoutReturn(
    { merchantId: merchant.id, sessionId: "cs_owned" },
    dependencies({
      loadCheckoutOwnership: async () => ({
        recordedSessionId: "cs_owned",
        stripeCustomerId: "cus_owned",
        stripeSubscriptionId: "sub_owned",
        billingUpdatedAt: BILLING_UPDATED_AT,
      }),
      applyCurrentSubscription: async (value) => {
        applied = value
        return "applied"
      },
    })
  )

  assert.deepEqual(result, {
    kind: "confirmed",
    source: "checkout",
    status: "trialing",
  })
  assert.equal(applied.merchantId, merchant.id)
  assert.equal(applied.snapshot.stripe_subscription_id, "sub_owned")
  assert.equal(applied.entitlementStatus, "trialing")
  assert.equal(applied.expectedBillingUpdatedAt, BILLING_UPDATED_AT)
})

test("provider or database ambiguity returns catching-up rather than success", async () => {
  const result = await confirmBillingCheckoutReturn(
    { merchantId: merchant.id, sessionId: "cs_owned" },
    dependencies({
      applyCurrentSubscription: async () => {
        throw new Error("database unavailable")
      },
    })
  )

  assert.deepEqual(result, { kind: "catching_up" })
})

test("a Subscription with foreign metadata cannot mutate merchant billing", async () => {
  let applies = 0
  const result = await confirmBillingCheckoutReturn(
    { merchantId: merchant.id, sessionId: "cs_owned" },
    dependencies({
      retrieveSubscription: async () =>
        subscription({ metadata: { merchant_id: "merchant_other" } }),
      applyCurrentSubscription: async () => {
        applies += 1
        return "applied"
      },
    })
  )

  assert.deepEqual(result, {
    kind: "rejected",
    reason: "customer_mismatch",
  })
  assert.equal(applies, 0)
})

test("a stale current sync never renders confirmed success", async () => {
  const result = await confirmBillingCheckoutReturn(
    { merchantId: merchant.id, sessionId: "cs_owned" },
    dependencies({
      applyCurrentSubscription: async () => "stale",
    })
  )

  assert.deepEqual(result, { kind: "catching_up" })
})

test("Portal reconciliation hydrates the known Subscription and preserves scheduled cancellation", async () => {
  let applied = null
  const result = await reconcileBillingPortalReturn(
    { merchantId: merchant.id },
    dependencies({
      retrieveSubscription: async () =>
        subscription({
          status: "active",
          cancel_at_period_end: true,
          cancel_at: 1_754_659_200,
        }),
      loadCheckoutOwnership: async () => ({
        recordedSessionId: null,
        stripeCustomerId: "cus_owned",
        stripeSubscriptionId: "sub_owned",
        billingUpdatedAt: BILLING_UPDATED_AT,
      }),
      applyCurrentSubscription: async (value) => {
        applied = value
        return "applied"
      },
    })
  )

  assert.deepEqual(result, {
    kind: "confirmed",
    source: "portal",
    status: "active",
  })
  assert.equal(applied.snapshot.cancel_at_period_end, true)
  assert.equal(applied.snapshot.cancel_at, "2025-08-08T13:20:00.000Z")
  assert.equal(applied.expectedBillingUpdatedAt, BILLING_UPDATED_AT)
})
