import assert from "node:assert/strict"
import test from "node:test"

import {
  observeMerchantBillingCheckoutPreparationWith,
  scheduleMerchantBillingCheckoutReturnedWith,
  scheduleMerchantBillingCheckoutStartedWith,
  scheduleMerchantBillingReachedForLaunchWith,
  scheduleMerchantBillingReachedWith,
} from "@/lib/analytics/merchant-billing-events-core"
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
  launchPriceId: "price_launch_29999",
  recurringPriceId: "price_28_day",
  annualPriceId: "price_annual_69990",
}

function attempt(overrides = {}) {
  return {
    claimStatus: "claimed",
    merchantId: merchant.id,
    attemptId: "10000000-0000-4000-8000-000000000001",
    billingInterval: "month",
    stripePriceId: "price_28_day",
    successUrl:
      "http://localhost:4317/app/launch?tab=billing&checkout=success&session_id={CHECKOUT_SESSION_ID}",
    cancelUrl:
      "http://localhost:4317/app/launch?tab=billing&checkout=cancelled",
    attemptExpiresAt: ATTEMPT_EXPIRY,
    checkoutContractVersion: "delivery_anchored_42_day",
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
    metadata: {
      merchant_id: merchant.id,
      launch_fee_policy: "charged",
    },
    items: {
      data: [
        {
          current_period_end: 1_754_659_200,
          price: {
            id: "price_28_day",
            recurring: { interval: "day", interval_count: 28 },
            unit_amount: 6_999,
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
    bindOffer: async () => ({
      status: "bound",
      launchFeePolicy: "charged",
      stripeLaunchPriceId: "price_launch_29999",
    }),
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
      payment_status: "paid",
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
    satisfyLaunchFee: async () => true,
    hasSatisfiedLaunchFee: async () => true,
    ...overrides,
  }
}

test("billing milestone adapters emit only fixed payloads and fail open", () => {
  const events = []
  const schedule = (event) => events.push(event)

  scheduleMerchantBillingReachedWith(merchant.id, schedule)
  scheduleMerchantBillingCheckoutStartedWith(merchant.id, schedule)
  scheduleMerchantBillingCheckoutReturnedWith(merchant.id, schedule)

  assert.deepEqual(events, [
    {
      merchantId: merchant.id,
      eventName: "merchant_billing_reached",
      idempotencyKey: "first-entry",
      source: "merchant_billing",
    },
    {
      merchantId: merchant.id,
      eventName: "merchant_billing_checkout_started",
      idempotencyKey: "first-session-ready",
      source: "stripe_checkout",
    },
    {
      merchantId: merchant.id,
      eventName: "merchant_billing_checkout_returned",
      idempotencyKey: "first-verified-return",
      source: "stripe_checkout",
    },
  ])

  for (const observe of [
    scheduleMerchantBillingReachedWith,
    scheduleMerchantBillingCheckoutStartedWith,
    scheduleMerchantBillingCheckoutReturnedWith,
  ]) {
    assert.doesNotThrow(() =>
      observe(merchant.id, () => {
        throw new Error("scheduler unavailable")
      })
    )
  }
})

test("launch billing reach observes only the exact authoritative gate and fails open", () => {
  const events = []
  const schedule = (event) => events.push(event)

  for (const launch of [
    { activeTab: "card", needsBilling: true },
    { activeTab: "billing", needsBilling: false },
    { activeTab: "qr", needsBilling: false },
  ]) {
    scheduleMerchantBillingReachedForLaunchWith(
      { merchantId: merchant.id, ...launch },
      schedule
    )
  }
  assert.deepEqual(events, [])

  scheduleMerchantBillingReachedForLaunchWith(
    { merchantId: merchant.id, activeTab: "billing", needsBilling: true },
    schedule
  )
  assert.deepEqual(events, [
    {
      merchantId: merchant.id,
      eventName: "merchant_billing_reached",
      idempotencyKey: "first-entry",
      source: "merchant_billing",
    },
  ])

  assert.doesNotThrow(() =>
    scheduleMerchantBillingReachedForLaunchWith(
      { merchantId: merchant.id, activeTab: "billing", needsBilling: true },
      () => {
        throw new Error("analytics unavailable")
      }
    )
  )
})

test("Checkout preparation observation preserves redirect, error, and throw outcomes", async () => {
  const events = []
  const schedule = (event) => events.push(event)
  const errorResult = { status: "error", message: "safe retry" }

  const observedError = await observeMerchantBillingCheckoutPreparationWith(
    merchant.id,
    async () => errorResult,
    schedule
  )
  assert.equal(observedError, errorResult)
  assert.deepEqual(events, [])

  const invalidRedirect = { status: "redirect", url: "" }
  assert.equal(
    await observeMerchantBillingCheckoutPreparationWith(
      merchant.id,
      async () => invalidRedirect,
      schedule
    ),
    invalidRedirect
  )
  assert.deepEqual(events, [])

  const redirectResult = {
    status: "redirect",
    url: "https://checkout.stripe.test/cs_owned",
  }
  const observedRedirect = await observeMerchantBillingCheckoutPreparationWith(
    merchant.id,
    async () => redirectResult,
    schedule
  )
  assert.equal(observedRedirect, redirectResult)
  assert.deepEqual(events, [
    {
      merchantId: merchant.id,
      eventName: "merchant_billing_checkout_started",
      idempotencyKey: "first-session-ready",
      source: "stripe_checkout",
    },
  ])

  assert.equal(
    await observeMerchantBillingCheckoutPreparationWith(
      merchant.id,
      async () => redirectResult,
      () => {
        throw new Error("analytics unavailable")
      }
    ),
    redirectResult
  )

  const preparationError = new Error("preparation failed")
  await assert.rejects(
    observeMerchantBillingCheckoutPreparationWith(
      merchant.id,
      async () => {
        throw preparationError
      },
      schedule
    ),
    (error) => error === preparationError
  )
  assert.equal(events.length, 1)
})

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
          { price: "price_28_day", quantity: 1 },
          { price: "price_launch_29999", quantity: 1 },
        ])
        assert.equal(params.subscription_data.trial_period_days, 42)
        assert.equal(
          params.subscription_data.metadata.billing_cadence,
          "28_days"
        )
        assert.equal(
          params.subscription_data.metadata.launch_fee_policy,
          "charged"
        )
        assert.equal(params.metadata.merchant_id, merchant.id)
        assert.equal(params.metadata.attempt_id, attempt().attemptId)
        assert.equal(params.metadata.pilot_anchor, "confirmed_delivery")
        assert.equal(params.metadata.fulfilment_allowance_days, "14")
        assert.equal(params.metadata.usable_pilot_days, "28")
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

test("a legacy ambiguous attempt replays the original 28-day provider contract", async () => {
  const result = await prepareBillingCheckout(
    input,
    dependencies({
      claimAttempt: async () =>
        attempt({
          checkoutContractVersion: "legacy_28_day",
          stripeCustomerId: "cus_owned",
        }),
      createCheckoutSession: async ({ params, idempotencyKey }) => {
        assert.equal(
          idempotencyKey,
          "billing-checkout:10000000-0000-4000-8000-000000000001"
        )
        assert.equal(params.subscription_data.trial_period_days, 28)
        assert.equal("pilot_anchor" in params.subscription_data.metadata, false)
        assert.equal("pilot_anchor" in params.metadata, false)
        return {
          id: "cs_legacy",
          url: "https://checkout.stripe.test/cs_legacy",
          status: "open",
          expires_at: params.expires_at,
        }
      },
    })
  )

  assert.deepEqual(result, {
    status: "redirect",
    url: "https://checkout.stripe.test/cs_legacy",
  })
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

test("a stale annual attempt rotates safely when 28-day billing is selected", async () => {
  const order = []
  const result = await prepareBillingCheckout(
    input,
    dependencies({
      claimAttempt: async () =>
        attempt({
          claimStatus: "interval_conflict",
          stripeCustomerId: "cus_owned",
          billingInterval: "year",
          stripePriceId: "price_year",
          stripeCheckoutSessionId: "cs_year",
          stripeCheckoutSessionUrl: "https://checkout.stripe.test/cs_year",
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
        assert.equal(value.billingInterval, "month")
        assert.equal(value.stripePriceId, "price_28_day")
        return attempt({
          claimStatus: "claimed",
          attemptId: "10000000-0000-4000-8000-000000000002",
          billingInterval: "month",
          stripePriceId: "price_28_day",
          stripeCustomerId: "cus_owned",
        })
      },
      createCheckoutSession: async ({ params, idempotencyKey }) => {
        order.push("create:28-day")
        assert.deepEqual(params.line_items, [
          { price: "price_28_day", quantity: 1 },
          { price: "price_launch_29999", quantity: 1 },
        ])
        assert.equal(params.subscription_data.trial_period_days, 42)
        assert.equal(params.metadata.billing_cadence, "28_days")
        assert.equal(
          idempotencyKey,
          "billing-checkout:10000000-0000-4000-8000-000000000002"
        )
        return {
          id: "cs_28_day",
          url: "https://checkout.stripe.test/cs_28_day",
          status: "open",
          expires_at: Math.floor(new Date(SESSION_EXPIRY).getTime() / 1_000),
        }
      },
      bindOffer: async () => ({
        status: "bound",
        launchFeePolicy: "charged",
        stripeLaunchPriceId: "price_launch_29999",
      }),
    })
  )

  assert.deepEqual(result, {
    status: "redirect",
    url: "https://checkout.stripe.test/cs_28_day",
  })
  assert.deepEqual(order, [
    "retrieve:cs_year",
    "expire:cs_year",
    "rotate:cs_year",
    "create:28-day",
  ])
})

test("annual Checkout uses the annual Price, the launch fee and the same pilot", async () => {
  const annualInput = { ...input, interval: "year" }
  const result = await prepareBillingCheckout(
    annualInput,
    dependencies({
      claimAttempt: async (value) => {
        assert.equal(value.billingInterval, "year")
        assert.equal(value.stripePriceId, "price_annual_69990")
        return attempt({
          billingInterval: "year",
          stripePriceId: "price_annual_69990",
        })
      },
      createCheckoutSession: async ({ params }) => {
        assert.deepEqual(params.line_items, [
          { price: "price_annual_69990", quantity: 1 },
          { price: "price_launch_29999", quantity: 1 },
        ])
        assert.equal(params.subscription_data.trial_period_days, 42)
        assert.equal(
          params.subscription_data.metadata.billing_cadence,
          "annual"
        )
        assert.equal(params.metadata.billing_cadence, "annual")
        return {
          id: "cs_annual",
          url: "https://checkout.stripe.test/cs_annual",
          status: "open",
          expires_at: Math.floor(new Date(SESSION_EXPIRY).getTime() / 1_000),
        }
      },
    })
  )

  assert.deepEqual(result, {
    status: "redirect",
    url: "https://checkout.stripe.test/cs_annual",
  })
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
  const verifiedReturns = []
  const options = {
    onVerifiedReturn: (value) => verifiedReturns.push(value),
  }
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
      deps,
      options
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
      }),
      options
    ),
    { kind: "rejected", reason: "foreign_session" }
  )
  assert.equal(applies, 0)
  assert.deepEqual(verifiedReturns, [])
})

test("an owned completed trial applies only its exact current Subscription", async () => {
  let applied = null
  const verifiedReturns = []
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
        assert.deepEqual(verifiedReturns, [{ merchantId: merchant.id }])
        applied = value
        return "applied"
      },
    }),
    {
      onVerifiedReturn: (value) => verifiedReturns.push(value),
    }
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
  assert.deepEqual(verifiedReturns, [{ merchantId: merchant.id }])
})

test("a first Checkout return refreshes the CAS after launch-fee satisfaction", async () => {
  let ownershipReads = 0
  let applied = null
  const result = await confirmBillingCheckoutReturn(
    { merchantId: merchant.id, sessionId: "cs_owned" },
    dependencies({
      loadCheckoutOwnership: async () => {
        ownershipReads += 1
        return {
          recordedSessionId: "cs_owned",
          stripeCustomerId: "cus_owned",
          stripeSubscriptionId: null,
          billingUpdatedAt: ownershipReads === 1 ? null : BILLING_UPDATED_AT,
        }
      },
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
  assert.equal(ownershipReads, 2)
  assert.equal(applied.expectedBillingUpdatedAt, BILLING_UPDATED_AT)
})

test("a legacy unfinished checkout cannot bypass the launch fee policy", async () => {
  let applies = 0
  const result = await confirmBillingCheckoutReturn(
    { merchantId: merchant.id, sessionId: "cs_owned" },
    dependencies({
      retrieveSubscription: async () =>
        subscription({ metadata: { merchant_id: merchant.id } }),
      hasSatisfiedLaunchFee: async () => false,
      applyCurrentSubscription: async () => {
        applies += 1
        return "applied"
      },
    })
  )

  assert.deepEqual(result, { kind: "catching_up" })
  assert.equal(applies, 0)
})

test("a 28-day Checkout return cannot activate until its launch charge is paid", async () => {
  let applies = 0
  const result = await confirmBillingCheckoutReturn(
    { merchantId: merchant.id, sessionId: "cs_owned" },
    dependencies({
      retrieveCheckoutSession: async () => ({
        id: "cs_owned",
        mode: "subscription",
        status: "complete",
        payment_status: "no_payment_required",
        customer: "cus_owned",
        subscription: "sub_owned",
        metadata: { merchant_id: merchant.id },
      }),
      hasSatisfiedLaunchFee: async () => false,
      applyCurrentSubscription: async () => {
        applies += 1
        return "applied"
      },
    })
  )

  assert.deepEqual(result, { kind: "catching_up" })
  assert.equal(applies, 0)
})

test("provider or database ambiguity returns catching-up rather than success", async () => {
  let verifiedReturns = 0
  const result = await confirmBillingCheckoutReturn(
    { merchantId: merchant.id, sessionId: "cs_owned" },
    dependencies({
      applyCurrentSubscription: async () => {
        throw new Error("database unavailable")
      },
    }),
    {
      onVerifiedReturn: () => {
        verifiedReturns += 1
      },
    }
  )

  assert.deepEqual(result, { kind: "catching_up" })
  assert.equal(verifiedReturns, 1)
})

test("a Subscription with foreign metadata cannot mutate merchant billing", async () => {
  let applies = 0
  let verifiedReturns = 0
  const result = await confirmBillingCheckoutReturn(
    { merchantId: merchant.id, sessionId: "cs_owned" },
    dependencies({
      retrieveSubscription: async () =>
        subscription({ metadata: { merchant_id: "merchant_other" } }),
      applyCurrentSubscription: async () => {
        applies += 1
        return "applied"
      },
    }),
    {
      onVerifiedReturn: () => {
        verifiedReturns += 1
      },
    }
  )

  assert.deepEqual(result, {
    kind: "rejected",
    reason: "customer_mismatch",
  })
  assert.equal(applies, 0)
  assert.equal(verifiedReturns, 0)
})

test("a stale current sync never renders confirmed success", async () => {
  let verifiedReturns = 0
  const result = await confirmBillingCheckoutReturn(
    { merchantId: merchant.id, sessionId: "cs_owned" },
    dependencies({
      applyCurrentSubscription: async () => "stale",
    }),
    {
      onVerifiedReturn: () => {
        verifiedReturns += 1
      },
    }
  )

  assert.deepEqual(result, { kind: "catching_up" })
  assert.equal(verifiedReturns, 1)
})

test("a throwing verified-return observer cannot change billing apply or success", async () => {
  let applies = 0
  let observerCalls = 0
  const result = await confirmBillingCheckoutReturn(
    { merchantId: merchant.id, sessionId: "cs_owned" },
    dependencies({
      applyCurrentSubscription: async () => {
        applies += 1
        return "applied"
      },
    }),
    {
      onVerifiedReturn: () => {
        observerCalls += 1
        throw new Error("analytics unavailable")
      },
    }
  )

  assert.deepEqual(result, {
    kind: "confirmed",
    source: "checkout",
    status: "trialing",
  })
  assert.equal(applies, 1)
  assert.equal(observerCalls, 1)
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
