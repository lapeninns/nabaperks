import assert from "node:assert/strict"
import test from "node:test"

import {
  StripeWebhookProcessingError,
  handleStripeWebhookRequest,
  processStripeWebhookEvent,
} from "@/lib/stripe/webhook-events"

const LEASE_ID = "20000000-0000-4000-8000-000000000001"
const MERCHANT_ID = "10000000-0000-4000-8000-000000000001"

function subscription(overrides = {}) {
  return {
    id: "sub_owned",
    created: 1_783_684_800,
    status: "trialing",
    customer: "cus_owned",
    metadata: { merchant_id: MERCHANT_ID },
    items: {
      data: [
        {
          current_period_end: 1_786_363_200,
          price: {
            id: "price_year_490",
            recurring: { interval: "year" },
            unit_amount: 49_000,
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

function event(type, object, overrides = {}) {
  return {
    id: "evt_owned",
    type,
    livemode: false,
    created: 1_783_684_860,
    data: { object },
    ...overrides,
  }
}

function processorDependencies(overrides = {}) {
  return {
    retrieveSubscription: async () => subscription(),
    resolveSubscriptionMerchant: async () => ({
      merchantId: MERCHANT_ID,
      stripeCustomerId: "cus_owned",
      stripeSubscriptionId: null,
    }),
    applySubscriptionEvent: async () => "applied",
    completeEvent: async () => true,
    ...overrides,
  }
}

function signedRequest() {
  return new Request("http://localhost/api/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": "signed" },
    body: "raw-body",
  })
}

function routeDependencies(overrides = {}) {
  return {
    constructEvent: () =>
      event("customer.subscription.updated", subscription()),
    claimEvent: async () => ({
      status: "claimed",
      leaseId: LEASE_ID,
      leaseExpiresAt: "2026-07-10T12:05:00.000Z",
      attemptCount: 1,
    }),
    processEvent: async () => ({
      status: "completed",
      merchantId: null,
      productEvents: [],
    }),
    failEvent: async () => true,
    scheduleAppliedSideEffects: () => {},
    ...overrides,
  }
}

test("a processed delivery is acknowledged without processing it again", async () => {
  let processCalls = 0
  const response = await handleStripeWebhookRequest(
    signedRequest(),
    routeDependencies({
      claimEvent: async () => ({
        status: "processed",
        attemptCount: 1,
      }),
      processEvent: async () => {
        processCalls += 1
        throw new Error("must not process")
      },
    })
  )

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { received: true, duplicate: true })
  assert.equal(processCalls, 0)
})

test("a live webhook lease returns retryable 503 instead of false success", async () => {
  let processCalls = 0
  const response = await handleStripeWebhookRequest(
    signedRequest(),
    routeDependencies({
      claimEvent: async () => ({ status: "busy", attemptCount: 1 }),
      processEvent: async () => {
        processCalls += 1
        throw new Error("must not process")
      },
    })
  )

  assert.equal(response.status, 503)
  assert.equal(response.headers.get("retry-after"), "5")
  assert.deepEqual(await response.json(), {
    error: "Stripe webhook is already being processed",
  })
  assert.equal(processCalls, 0)
})

test("missing or invalid signatures are rejected before claim", async () => {
  let claims = 0
  const missing = await handleStripeWebhookRequest(
    new Request("http://localhost/api/stripe/webhook", {
      method: "POST",
      body: "raw-body",
    }),
    routeDependencies({
      claimEvent: async () => {
        claims += 1
        throw new Error("must not claim")
      },
    })
  )

  const invalid = await handleStripeWebhookRequest(
    signedRequest(),
    routeDependencies({
      constructEvent: () => {
        throw new Error("invalid signature")
      },
      claimEvent: async () => {
        claims += 1
        throw new Error("must not claim")
      },
    })
  )

  assert.equal(missing.status, 400)
  assert.equal(invalid.status, 400)
  assert.equal(claims, 0)
})

test("a missing signature is rejected without consuming the request body", async () => {
  let bodyRead = false
  const request = {
    headers: new Headers(),
    get body() {
      bodyRead = true
      throw new Error("body must not be read")
    },
  }

  const response = await handleStripeWebhookRequest(
    request,
    routeDependencies()
  )

  assert.equal(response.status, 400)
  assert.equal(bodyRead, false)
})

test("oversized Stripe webhook bodies are rejected before verification", async () => {
  let verifies = 0
  const response = await handleStripeWebhookRequest(
    new Request("http://localhost/api/stripe/webhook", {
      method: "POST",
      headers: {
        "stripe-signature": "signed",
        "content-length": "1048577",
      },
      body: "small-body",
    }),
    routeDependencies({
      constructEvent: () => {
        verifies += 1
        throw new Error("must not verify")
      },
    })
  )

  assert.equal(response.status, 413)
  assert.equal(verifies, 0)
})

test("Checkout completion hydrates and atomically applies the exact current Subscription", async () => {
  let retrievedId = null
  let applied = null
  let completed = 0
  const checkoutEvent = event("checkout.session.completed", {
    id: "cs_owned",
    mode: "subscription",
    customer: "cus_owned",
    subscription: "sub_owned",
    metadata: { merchant_id: MERCHANT_ID },
  })

  const result = await processStripeWebhookEvent(
    { event: checkoutEvent, leaseId: LEASE_ID },
    processorDependencies({
      retrieveSubscription: async (subscriptionId) => {
        retrievedId = subscriptionId
        return subscription()
      },
      applySubscriptionEvent: async (value) => {
        applied = value
        return "applied"
      },
      completeEvent: async () => {
        completed += 1
        return true
      },
    })
  )

  assert.equal(retrievedId, "sub_owned")
  assert.equal(completed, 0, "the apply RPC owns completion atomically")
  assert.equal(applied.eventId, "evt_owned")
  assert.equal(applied.leaseId, LEASE_ID)
  assert.equal(applied.merchantId, MERCHANT_ID)
  assert.deepEqual(applied.snapshot, {
    stripe_customer_id: "cus_owned",
    stripe_subscription_id: "sub_owned",
    stripe_subscription_status: "trialing",
    stripe_subscription_created_at: "2026-07-10T12:00:00.000Z",
    stripe_price_id: "price_year_490",
    billing_interval: "year",
    unit_amount: 49_000,
    currency: "gbp",
    current_period_end: "2026-08-10T12:00:00.000Z",
    cancel_at_period_end: false,
    cancel_at: null,
  })
  assert.deepEqual(result, {
    status: "applied",
    merchantId: MERCHANT_ID,
    productEvents: [
      {
        eventName: "subscription_started",
        merchantId: MERCHANT_ID,
        actorType: "system",
        metadata: {
          stripe_subscription_id: "sub_owned",
          billing_status: "trialing",
        },
      },
    ],
  })
})

test("a stale event is completed but emits no revalidation or analytics intent", async () => {
  const result = await processStripeWebhookEvent(
    {
      event: event("customer.subscription.updated", subscription()),
      leaseId: LEASE_ID,
    },
    processorDependencies({ applySubscriptionEvent: async () => "stale" })
  )

  assert.deepEqual(result, {
    status: "stale",
    merchantId: null,
    productEvents: [],
  })
})

test("an applied cancellation preserves the existing product event contract", async () => {
  const cancelled = subscription({
    status: "canceled",
    cancel_at_period_end: false,
  })
  const result = await processStripeWebhookEvent(
    {
      event: event("customer.subscription.deleted", cancelled),
      leaseId: LEASE_ID,
    },
    processorDependencies({ retrieveSubscription: async () => cancelled })
  )

  assert.deepEqual(result, {
    status: "applied",
    merchantId: MERCHANT_ID,
    productEvents: [
      {
        eventName: "subscription_cancelled",
        merchantId: MERCHANT_ID,
        actorType: "system",
        metadata: { stripe_subscription_id: "sub_owned" },
      },
    ],
  })
})

test("customer.subscription lifecycle variants hydrate current state", async () => {
  const paused = subscription({ status: "paused" })
  let applied = null
  const result = await processStripeWebhookEvent(
    {
      event: event("customer.subscription.paused", paused),
      leaseId: LEASE_ID,
    },
    processorDependencies({
      retrieveSubscription: async () => paused,
      applySubscriptionEvent: async (value) => {
        applied = value
        return "applied"
      },
    })
  )

  assert.equal(applied.snapshot.stripe_subscription_status, "paused")
  assert.equal(applied.entitlementStatus, "suspended")
  assert.deepEqual(result, {
    status: "applied",
    merchantId: MERCHANT_ID,
    productEvents: [],
  })
})

test("invoice.payment_failed hydrates current provider state instead of patching past_due", async () => {
  let applied = null
  const result = await processStripeWebhookEvent(
    {
      event: event("invoice.payment_failed", {
        id: "in_failed",
        customer: "cus_owned",
        parent: {
          subscription_details: { subscription: "sub_owned" },
        },
      }),
      leaseId: LEASE_ID,
    },
    processorDependencies({
      retrieveSubscription: async () => subscription({ status: "active" }),
      applySubscriptionEvent: async (value) => {
        applied = value
        return "applied"
      },
    })
  )

  assert.equal(applied.snapshot.stripe_subscription_status, "active")
  assert.equal(applied.entitlementStatus, "active")
  assert.deepEqual(result, {
    status: "applied",
    merchantId: MERCHANT_ID,
    productEvents: [],
  })
})

test("customer and Subscription ownership mismatches fail before billing mutation", async () => {
  let applies = 0

  await assert.rejects(
    processStripeWebhookEvent(
      {
        event: event("checkout.session.completed", {
          id: "cs_owned",
          mode: "subscription",
          customer: "cus_foreign",
          subscription: "sub_owned",
          metadata: { merchant_id: MERCHANT_ID },
        }),
        leaseId: LEASE_ID,
      },
      processorDependencies({
        applySubscriptionEvent: async () => {
          applies += 1
          return "applied"
        },
      })
    ),
    (error) =>
      error instanceof StripeWebhookProcessingError &&
      error.code === "ownership_mismatch"
  )

  assert.equal(applies, 0)
})

test("irrelevant signed events complete the exact lease without provider reads", async () => {
  let completed = null
  let providerReads = 0
  const result = await processStripeWebhookEvent(
    {
      event: event("customer.created", { id: "cus_owned" }),
      leaseId: LEASE_ID,
    },
    processorDependencies({
      retrieveSubscription: async () => {
        providerReads += 1
        throw new Error("must not retrieve")
      },
      completeEvent: async (value) => {
        completed = value
        return true
      },
    })
  )

  assert.deepEqual(completed, { eventId: "evt_owned", leaseId: LEASE_ID })
  assert.equal(providerReads, 0)
  assert.deepEqual(result, {
    status: "completed",
    merchantId: null,
    productEvents: [],
  })
})

test("an irrelevant event cannot be acknowledged after losing its lease", async () => {
  await assert.rejects(
    processStripeWebhookEvent(
      {
        event: event("customer.created", { id: "cus_owned" }),
        leaseId: LEASE_ID,
      },
      processorDependencies({ completeEvent: async () => false })
    ),
    (error) =>
      error instanceof StripeWebhookProcessingError &&
      error.code === "lease_lost"
  )
})

test("processing failure releases only the claimed lease with a safe error code", async () => {
  let failed = null
  let sideEffects = 0
  const response = await handleStripeWebhookRequest(
    signedRequest(),
    routeDependencies({
      processEvent: async () => {
        throw new StripeWebhookProcessingError("ownership_mismatch")
      },
      failEvent: async (value) => {
        failed = value
        return true
      },
      scheduleAppliedSideEffects: () => {
        sideEffects += 1
      },
    })
  )

  assert.equal(response.status, 500)
  assert.deepEqual(await response.json(), {
    error: "Stripe webhook processing failed",
  })
  assert.deepEqual(failed, {
    eventId: "evt_owned",
    leaseId: LEASE_ID,
    errorCode: "ownership_mismatch",
  })
  assert.equal(sideEffects, 0)
})

test("raw provider failures are reduced to a non-sensitive ledger code", async () => {
  let failed = null
  const response = await handleStripeWebhookRequest(
    signedRequest(),
    routeDependencies({
      processEvent: async () => {
        throw new Error("sk_test_secret provider timeout")
      },
      failEvent: async (value) => {
        failed = value
        return true
      },
    })
  )

  assert.equal(response.status, 500)
  assert.equal(failed.errorCode, "processing_failed")
  assert.doesNotMatch(JSON.stringify(await response.json()), /sk_test|timeout/)
})

test("applied-only side effects run after durable processing", async () => {
  const scheduled = []
  const applied = await handleStripeWebhookRequest(
    signedRequest(),
    routeDependencies({
      processEvent: async () => ({
        status: "applied",
        merchantId: MERCHANT_ID,
        productEvents: [],
      }),
      scheduleAppliedSideEffects: (result) => scheduled.push(result),
    })
  )

  const stale = await handleStripeWebhookRequest(
    signedRequest(),
    routeDependencies({
      processEvent: async () => ({
        status: "stale",
        merchantId: null,
        productEvents: [],
      }),
      scheduleAppliedSideEffects: (result) => scheduled.push(result),
    })
  )

  assert.equal(applied.status, 200)
  assert.equal(stale.status, 200)
  assert.equal(scheduled.length, 1)
  assert.equal(scheduled[0].status, "applied")
})
