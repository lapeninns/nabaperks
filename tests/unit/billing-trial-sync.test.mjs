import assert from "node:assert/strict"
import test from "node:test"

import {
  processBillingTrialSyncClaim,
  runBillingTrialSyncWith,
} from "@/lib/stripe/trial-sync"

const claim = {
  fulfilmentId: "10000000-0000-4000-8000-000000000001",
  merchantId: "20000000-0000-4000-8000-000000000002",
  stripeSubscriptionId: "sub_owned",
  providerStatus: "trialing",
  desiredTrialEnd: "2026-09-12T12:00:00.000Z",
  leaseId: "30000000-0000-4000-8000-000000000003",
  syncReason: "delivery_confirmed",
}

const subscription = {
  id: "sub_owned",
  status: "trialing",
  trial_end: 1_789_214_400,
  metadata: { merchant_id: claim.merchantId },
}

function dependencies(overrides = {}) {
  return {
    claim: async () => null,
    retrieveSubscription: async () => subscription,
    updateSubscription: async (_id, params) => ({
      ...subscription,
      trial_end: params.trial_end,
    }),
    confirm: async () => true,
    fail: async () => true,
    ...overrides,
  }
}

test("Given a claimed owned trial When Stripe is updated Then the exact trial end is read back and confirmed", async () => {
  let updated = null
  let confirmed = null
  const result = await processBillingTrialSyncClaim(
    claim,
    dependencies({
      updateSubscription: async (subscriptionId, params) => {
        updated = { subscriptionId, params }
        return { ...subscription, trial_end: params.trial_end }
      },
      confirm: async (input) => {
        confirmed = input
        return true
      },
    })
  )

  assert.deepEqual(updated, {
    subscriptionId: "sub_owned",
    params: {
      trial_end: Math.floor(new Date(claim.desiredTrialEnd).getTime() / 1_000),
      proration_behavior: "none",
    },
  })
  assert.deepEqual(confirmed, {
    fulfilmentId: claim.fulfilmentId,
    leaseId: claim.leaseId,
    stripeSubscriptionId: claim.stripeSubscriptionId,
    confirmedTrialEnd: claim.desiredTrialEnd,
  })
  assert.deepEqual(result, { status: "synchronised" })
})

test("Given Stripe update is unavailable When a claim runs Then a safe retry code is recorded without confirmation", async () => {
  let failed = null
  let confirmCalls = 0
  const result = await processBillingTrialSyncClaim(
    claim,
    dependencies({
      updateSubscription: async () => {
        throw new Error("sk_live_secret provider outage")
      },
      confirm: async () => {
        confirmCalls += 1
        return true
      },
      fail: async (input) => {
        failed = input
        return true
      },
    })
  )

  assert.equal(confirmCalls, 0)
  assert.equal(failed.errorCode, "stripe_update_failed")
  assert.doesNotMatch(JSON.stringify(failed), /sk_live|provider outage/)
  assert.deepEqual(result, {
    status: "failed",
    errorCode: "stripe_update_failed",
  })
})

test("Given the provider trial ended or ownership changed When synchronising Then no Stripe mutation is attempted", async () => {
  for (const [provider, expectedCode] of [
    [{ ...subscription, status: "active" }, "subscription_not_trialing"],
    [
      { ...subscription, metadata: { merchant_id: "merchant_foreign" } },
      "ownership_mismatch",
    ],
  ]) {
    let updateCalls = 0
    let errorCode = null
    const result = await processBillingTrialSyncClaim(
      claim,
      dependencies({
        retrieveSubscription: async () => provider,
        updateSubscription: async () => {
          updateCalls += 1
          return provider
        },
        fail: async (input) => {
          errorCode = input.errorCode
          return true
        },
      })
    )
    assert.equal(updateCalls, 0)
    assert.equal(errorCode, expectedCode)
    assert.equal(result.status, "failed")
  }
})

test("Given bounded queued work When the cron runner drains it Then it stops after idle and reports safe totals", async () => {
  const queue = [claim, { ...claim, fulfilmentId: "fulfilment_two" }, null]
  const result = await runBillingTrialSyncWith(
    dependencies({ claim: async () => queue.shift() }),
    10
  )

  assert.deepEqual(result, { claimed: 2, synchronised: 2, failed: 0 })
})
