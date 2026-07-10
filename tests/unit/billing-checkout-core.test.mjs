import assert from "node:assert/strict"
import { test } from "node:test"

import {
  buildBillingCheckoutReturnUrls,
  classifyCheckoutEligibility,
  classifyCheckoutReturnSession,
  mapProviderSubscriptionSnapshot,
  resolveBillingAppOrigin,
} from "@/lib/merchant/billing-checkout-core"

test("production billing returns always use the configured canonical origin", () => {
  assert.equal(
    resolveBillingAppOrigin({
      environment: "production",
      configuredOrigin: "https://app.nabaperks.com/",
      requestOrigin: "http://localhost:4317",
    }),
    "https://app.nabaperks.com"
  )
})

test("development billing returns may follow a validated loopback request origin", () => {
  assert.equal(
    resolveBillingAppOrigin({
      environment: "development",
      configuredOrigin: "http://localhost:3000",
      requestOrigin: "http://localhost:4317",
    }),
    "http://localhost:4317"
  )
  assert.equal(
    resolveBillingAppOrigin({
      environment: "development",
      configuredOrigin: "http://localhost:3000",
      requestOrigin: "http://127.0.0.1:4318",
    }),
    "http://127.0.0.1:4318"
  )
})

test("development billing returns reject non-loopback and malformed request origins", () => {
  for (const requestOrigin of [
    "https://attacker.example",
    "http://localhost.attacker.example:4317",
    "http://localhost:4317/forged",
    "not-an-origin",
  ]) {
    assert.equal(
      resolveBillingAppOrigin({
        environment: "development",
        configuredOrigin: "http://localhost:3000",
        requestOrigin,
      }),
      "http://localhost:3000"
    )
  }
})

test("checkout return URLs use an allowlisted path and a literal Session placeholder", () => {
  assert.deepEqual(
    buildBillingCheckoutReturnUrls({
      environment: "development",
      configuredOrigin: "http://localhost:3000",
      requestOrigin: "http://localhost:4317",
      returnBase: "/app/launch?tab=billing",
    }),
    {
      successUrl:
        "http://localhost:4317/app/launch?tab=billing&checkout=success&session_id={CHECKOUT_SESSION_ID}",
      cancelUrl:
        "http://localhost:4317/app/launch?tab=billing&checkout=cancelled",
    }
  )

  assert.deepEqual(
    buildBillingCheckoutReturnUrls({
      environment: "development",
      configuredOrigin: "http://localhost:3000",
      requestOrigin: "http://localhost:4317",
      returnBase: "//attacker.example",
    }),
    {
      successUrl:
        "http://localhost:4317/app/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}",
      cancelUrl: "http://localhost:4317/app/billing?checkout=cancelled",
    }
  )
})

test("only absent or terminally restartable billing can start Checkout", () => {
  assert.deepEqual(classifyCheckoutEligibility(null), {
    allowed: true,
    reason: "absent",
    next: "checkout",
  })
  assert.deepEqual(classifyCheckoutEligibility("cancelled"), {
    allowed: true,
    reason: "cancelled",
    next: "checkout",
  })
  assert.deepEqual(classifyCheckoutEligibility("incomplete_expired"), {
    allowed: true,
    reason: "incomplete_expired",
    next: "checkout",
  })
})

test("live, recoverable, and unknown suspended billing blocks duplicate Checkout", () => {
  for (const status of [
    "trialing",
    "active",
    "past_due",
    "incomplete",
    "paused",
    "unpaid",
    "suspended",
    "future_provider_status",
  ]) {
    assert.deepEqual(classifyCheckoutEligibility(status), {
      allowed: false,
      reason: "existing_subscription",
      next: "manage",
      status,
    })
  }
})

const ownedSession = {
  id: "cs_owned",
  mode: "subscription",
  status: "complete",
  payment_status: "no_payment_required",
  customer: "cus_owned",
  subscription: "sub_owned",
  metadata: { merchant_id: "merchant_owned" },
}

const ownedSessionInput = {
  requestedSessionId: "cs_owned",
  recordedSessionId: "cs_owned",
  expectedMerchantId: "merchant_owned",
  expectedCustomerId: "cus_owned",
  session: ownedSession,
}

test("a missing Checkout Session id is classified without claiming success", () => {
  assert.deepEqual(
    classifyCheckoutReturnSession({
      ...ownedSessionInput,
      requestedSessionId: null,
      session: null,
    }),
    { kind: "missing", reason: "missing_session" }
  )
})

test("a Session outside the durable merchant attempt is rejected as foreign", () => {
  for (const input of [
    { ...ownedSessionInput, recordedSessionId: "cs_other" },
    {
      ...ownedSessionInput,
      session: { ...ownedSession, id: "cs_other" },
    },
    {
      ...ownedSessionInput,
      session: {
        ...ownedSession,
        metadata: { merchant_id: "merchant_other" },
      },
    },
  ]) {
    assert.deepEqual(classifyCheckoutReturnSession(input), {
      kind: "rejected",
      reason: "foreign_session",
    })
  }
})

test("wrong-mode, incomplete, subscription-less, and customer-mismatched Sessions are rejected exactly", () => {
  const cases = [
    [
      { ...ownedSessionInput, session: { ...ownedSession, mode: "payment" } },
      "wrong_mode",
    ],
    [
      { ...ownedSessionInput, session: { ...ownedSession, status: "open" } },
      "incomplete_session",
    ],
    [
      {
        ...ownedSessionInput,
        session: { ...ownedSession, subscription: null },
      },
      "missing_subscription",
    ],
    [
      {
        ...ownedSessionInput,
        session: { ...ownedSession, customer: "cus_other" },
      },
      "customer_mismatch",
    ],
  ]

  for (const [input, reason] of cases) {
    assert.deepEqual(classifyCheckoutReturnSession(input), {
      kind: "rejected",
      reason,
    })
  }
})

test("an owned completed trial Session is accepted without requiring payment", () => {
  assert.deepEqual(classifyCheckoutReturnSession(ownedSessionInput), {
    kind: "owned_completed",
    sessionId: "cs_owned",
    subscriptionId: "sub_owned",
    customerId: "cus_owned",
  })
})

test("a fast webhook can replace the cleared attempt as durable ownership proof", () => {
  assert.deepEqual(
    classifyCheckoutReturnSession({
      ...ownedSessionInput,
      recordedSessionId: null,
      expectedSubscriptionId: "sub_owned",
    }),
    {
      kind: "owned_completed",
      sessionId: "cs_owned",
      subscriptionId: "sub_owned",
      customerId: "cus_owned",
    }
  )

  assert.deepEqual(
    classifyCheckoutReturnSession({
      ...ownedSessionInput,
      recordedSessionId: null,
      expectedSubscriptionId: "sub_newer",
    }),
    { kind: "rejected", reason: "stale_session" }
  )
})

test("provider subscription terms map to one complete authoritative snapshot", () => {
  assert.deepEqual(
    mapProviderSubscriptionSnapshot({
      id: "sub_owned",
      created: 1_700_000_000,
      status: "trialing",
      customer: { id: "cus_owned" },
      items: {
        data: [
          {
            current_period_end: 1_700_086_400,
            price: {
              id: "price_month",
              recurring: { interval: "month" },
              unit_amount: 4_900,
              currency: "GBP",
            },
          },
        ],
      },
      cancel_at_period_end: false,
      cancel_at: null,
    }),
    {
      stripe_customer_id: "cus_owned",
      stripe_subscription_id: "sub_owned",
      stripe_subscription_status: "trialing",
      stripe_subscription_created_at: "2023-11-14T22:13:20.000Z",
      stripe_price_id: "price_month",
      billing_interval: "month",
      unit_amount: 4_900,
      currency: "gbp",
      current_period_end: "2023-11-15T22:13:20.000Z",
      cancel_at_period_end: false,
      cancel_at: null,
    }
  )
})

test("annual provider terms and scheduled cancellation remain exact", () => {
  const snapshot = mapProviderSubscriptionSnapshot({
    id: "sub_year",
    created: 1_700_000_000,
    status: "active",
    customer: "cus_owned",
    items: {
      data: [
        {
          current_period_end: 1_700_086_400,
          price: {
            id: "price_year",
            recurring: { interval: "year" },
            unit_amount: 49_000,
            currency: "gbp",
          },
        },
      ],
    },
    cancel_at_period_end: true,
    cancel_at: 1_700_086_400,
  })

  assert.equal(snapshot.billing_interval, "year")
  assert.equal(snapshot.unit_amount, 49_000)
  assert.equal(snapshot.cancel_at_period_end, true)
  assert.equal(snapshot.cancel_at, "2023-11-15T22:13:20.000Z")
})

test("period-end cancellation derives its exact date when Stripe omits cancel_at", () => {
  const snapshot = mapProviderSubscriptionSnapshot({
    id: "sub_period_end",
    created: 1_700_000_000,
    status: "active",
    customer: "cus_owned",
    items: {
      data: [
        {
          current_period_end: 1_700_086_400,
          price: {
            id: "price_month",
            recurring: { interval: "month" },
            unit_amount: 4_900,
            currency: "gbp",
          },
        },
      ],
    },
    cancel_at_period_end: true,
    cancel_at: null,
  })

  assert.equal(snapshot.cancel_at, snapshot.current_period_end)
})
