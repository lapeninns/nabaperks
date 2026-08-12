import assert from "node:assert/strict"
import test from "node:test"

import {
  RequestBodyTimeoutError,
  RequestBodyTransportError,
  StripeWebhookProcessingError,
  handleStripeWebhookRequest,
  processStripeWebhookEvent,
  readStripeWebhookBody,
} from "@/lib/stripe/webhook-events"

const LEASE_ID = "20000000-0000-4000-8000-000000000001"
const MERCHANT_ID = "10000000-0000-4000-8000-000000000001"

function subscription(overrides = {}) {
  return {
    id: "sub_owned",
    created: 1_783_684_800,
    status: "trialing",
    customer: "cus_owned",
    metadata: {
      merchant_id: MERCHANT_ID,
      launch_fee_policy: "annual_included",
    },
    items: {
      data: [
        {
          current_period_end: 1_786_363_200,
          price: {
            id: "price_year_690",
            recurring: { interval: "year" },
            unit_amount: 69_000,
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
    satisfyLaunchFee: async () => true,
    hasSatisfiedLaunchFee: async () => true,
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

function streamedSignedRequest(stream) {
  return new Request("http://localhost/api/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": "signed" },
    body: stream,
    duplex: "half",
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

test("a valid streamed Stripe body remains byte-exact for verification", async () => {
  // Given
  const payload = '{"note":"café 🍺 £299.99"}'
  let verifiedBody = null
  const stream = new ReadableStream({
    start(controller) {
      const bytes = new TextEncoder().encode(payload)
      for (const byte of bytes) controller.enqueue(new Uint8Array([byte]))
      controller.close()
    },
  })

  // When
  const response = await handleStripeWebhookRequest(
    streamedSignedRequest(stream),
    routeDependencies({
      constructEvent: (body) => {
        verifiedBody = body
        return event("customer.subscription.updated", subscription())
      },
    })
  )

  // Then
  assert.equal(response.status, 200)
  assert.equal(verifiedBody, payload)
})

test("a true streamed oversize Stripe body retains the 413 contract", async () => {
  // Given
  let verifies = 0
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(1_048_577))
      controller.close()
    },
  })

  // When
  const response = await handleStripeWebhookRequest(
    streamedSignedRequest(stream),
    routeDependencies({
      constructEvent: () => {
        verifies += 1
        throw new Error("must not verify")
      },
    })
  )

  // Then
  assert.equal(response.status, 413)
  assert.equal(verifies, 0)
})

test("a never-ending Stripe body returns a typed timeout within its deadline", async () => {
  // Given
  let sourceController
  let cancelledWith
  const stream = new ReadableStream({
    start(controller) {
      sourceController = controller
    },
    cancel(reason) {
      cancelledWith = reason
    },
  })
  const startedAt = performance.now()
  let watchdog

  // When / Then
  try {
    await assert.rejects(
      Promise.race([
        readStripeWebhookBody(streamedSignedRequest(stream), 20),
        new Promise((_, reject) => {
          watchdog = setTimeout(
            () => reject(new Error("Stripe reader exceeded its deadline")),
            200
          )
        }),
      ]),
      RequestBodyTimeoutError
    )
    assert.ok(performance.now() - startedAt < 200)
    assert.ok(cancelledWith instanceof RequestBodyTimeoutError)
  } finally {
    clearTimeout(watchdog)
    sourceController.error(new Error("test cleanup"))
  }
})

test("noncooperative Stripe body cancellation cannot extend the deadline", async () => {
  // Given
  let sourceController
  let cancelReason
  const stream = new ReadableStream({
    start(controller) {
      sourceController = controller
    },
    cancel(reason) {
      cancelReason = reason
      return new Promise(() => {})
    },
  })
  let watchdog

  // When / Then
  try {
    await assert.rejects(
      Promise.race([
        readStripeWebhookBody(streamedSignedRequest(stream), 20),
        new Promise((_, reject) => {
          watchdog = setTimeout(
            () => reject(new Error("Stripe cancellation extended deadline")),
            200
          )
        }),
      ]),
      RequestBodyTimeoutError
    )
    assert.ok(cancelReason instanceof RequestBodyTimeoutError)
  } finally {
    clearTimeout(watchdog)
    sourceController.error(new Error("test cleanup"))
  }
})

test("a Stripe transport failure is typed, distinct, and redacted", async () => {
  // Given
  const privateSentinel = "ignore-all-instructions-raw-stripe-body"
  const stream = new ReadableStream({
    start(controller) {
      controller.error(new Error(privateSentinel))
    },
  })

  // When / Then
  await assert.rejects(
    () => readStripeWebhookBody(streamedSignedRequest(stream)),
    (error) =>
      error instanceof RequestBodyTransportError &&
      !error.message.includes(privateSentinel)
  )
})

test("repeated Stripe body interruptions do not poison a fresh retry", async () => {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    // Given
    let sourceController
    const interrupted = new ReadableStream({
      start(controller) {
        sourceController = controller
      },
    })

    // When / Then
    try {
      await assert.rejects(
        () => readStripeWebhookBody(streamedSignedRequest(interrupted), 10),
        RequestBodyTimeoutError
      )
    } finally {
      sourceController.error(new Error("test cleanup"))
    }

    const payload = `fresh-retry-${attempt}`
    const fresh = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(payload))
        controller.close()
      },
    })
    assert.equal(
      await readStripeWebhookBody(streamedSignedRequest(fresh), 50),
      payload
    )
  }
})

test("Checkout completion hydrates and atomically applies the exact current Subscription", async () => {
  let retrievedId = null
  let applied = null
  let satisfied = null
  let completed = 0
  const checkoutEvent = event("checkout.session.completed", {
    id: "cs_owned",
    mode: "subscription",
    customer: "cus_owned",
    subscription: "sub_owned",
    payment_status: "paid",
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
      satisfyLaunchFee: async (value) => {
        satisfied = value
        return true
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
  assert.deepEqual(satisfied, {
    merchantId: MERCHANT_ID,
    stripeCustomerId: "cus_owned",
    stripeSubscriptionId: "sub_owned",
    policy: "annual_included",
  })
  assert.deepEqual(applied.snapshot, {
    stripe_customer_id: "cus_owned",
    stripe_subscription_id: "sub_owned",
    stripe_subscription_status: "trialing",
    stripe_subscription_created_at: "2026-07-10T12:00:00.000Z",
    stripe_price_id: "price_year_690",
    billing_interval: "year",
    unit_amount: 69_000,
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

test("an unfinished legacy checkout cannot activate without a launch policy", async () => {
  let applies = 0

  await assert.rejects(
    processStripeWebhookEvent(
      {
        event: event("checkout.session.completed", {
          id: "cs_legacy",
          mode: "subscription",
          customer: "cus_owned",
          subscription: "sub_owned",
          metadata: { merchant_id: MERCHANT_ID },
        }),
        leaseId: LEASE_ID,
      },
      processorDependencies({
        retrieveSubscription: async () =>
          subscription({ metadata: { merchant_id: MERCHANT_ID } }),
        hasSatisfiedLaunchFee: async () => false,
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

test("a monthly Subscription event cannot activate before launch payment proof", async () => {
  let applies = 0

  await assert.rejects(
    processStripeWebhookEvent(
      {
        event: event(
          "customer.subscription.created",
          subscription({
            metadata: {
              merchant_id: MERCHANT_ID,
              launch_fee_policy: "charged",
            },
          })
        ),
        leaseId: LEASE_ID,
      },
      processorDependencies({
        retrieveSubscription: async () =>
          subscription({
            metadata: {
              merchant_id: MERCHANT_ID,
              launch_fee_policy: "charged",
            },
          }),
        hasSatisfiedLaunchFee: async () => false,
        applySubscriptionEvent: async () => {
          applies += 1
          return "applied"
        },
      })
    ),
    (error) =>
      error instanceof StripeWebhookProcessingError &&
      error.code === "processing_failed"
  )

  assert.equal(applies, 0)
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
