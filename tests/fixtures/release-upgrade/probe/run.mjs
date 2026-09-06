import assert from "node:assert/strict"
import { withDisposableTransaction } from "./database-adapter.mjs"
import {
  applyCurrentStripeSubscription,
  mapStripeSubscriptionStatus,
} from "@/lib/stripe/billing"
import {
  claimStripeWebhookEvent,
  failStripeWebhookEvent,
  completeStripeWebhookEvent,
} from "@/lib/stripe/webhook-events"
import { createRewardScanToken } from "@/lib/customer/reward-scan-token"
import { loyaltyAvailability } from "@/lib/customer/availability"

const counts = { billing: 0, loyalty: 0, webhook: 0 }
function equal(contract, actual, expected) {
  assert.deepEqual(actual, expected)
  counts[contract]++
}
function ok(contract, value) {
  assert.ok(value)
  counts[contract]++
}
const MERCHANT = "ee100000-0000-4000-8000-000000000002"
const CUSTOMER = "ee500000-0000-4000-8000-000000000001"
const REWARD = "ee800000-0000-4000-8000-000000000001"

await withDisposableTransaction(async (tx) => {
  const [billing] =
    await tx`select * from public.billing_customers where merchant_id=${MERCHANT}::uuid`
  equal("billing", billing.status, "active")
  equal("billing", mapStripeSubscriptionStatus("past_due"), "past_due")
  const snapshot = {
    ...billing,
    stripe_subscription_status: "past_due",
    unit_amount: Number(billing.unit_amount),
  }
  equal(
    "billing",
    await applyCurrentStripeSubscription({
      merchantId: MERCHANT,
      snapshot,
      entitlementStatus: "past_due",
      expectedBillingUpdatedAt: billing.updated_at.toISOString(),
    }),
    "applied"
  )
  const [changed] =
    await tx`select status,stripe_subscription_status from public.billing_customers where merchant_id=${MERCHANT}::uuid`
  equal("billing", changed, {
    status: "past_due",
    stripe_subscription_status: "past_due",
  })
  equal(
    "billing",
    await applyCurrentStripeSubscription({
      merchantId: MERCHANT,
      snapshot,
      entitlementStatus: "past_due",
      expectedBillingUpdatedAt: "2000-01-01T00:00:00Z",
    }),
    "stale"
  )

  const [facts] =
    await tx`select m.status as merchant_status, lc.is_active, bc.status as billing_status, m.requires_billing from public.reward_events r join public.merchants m on m.id=r.merchant_id join public.loyalty_cards lc on lc.id=r.loyalty_card_id join public.billing_customers bc on bc.merchant_id=m.id where r.id=${REWARD}::uuid`
  equal(
    "loyalty",
    loyaltyAvailability({
      merchantStatus: facts.merchant_status,
      cardActive: facts.is_active,
      billingStatus: facts.billing_status,
      requiresBilling: facts.requires_billing,
    }).available,
    true
  )
  // Synthetic fixture completion only, inside the always-rolled-back transaction.
  await tx`update public.customers set full_name='Synthetic Upgrade Customer', date_of_birth='1990-01-01', email_verified_at=now() where id=${CUSTOMER}::uuid`
  await tx`update public.reward_events set redeemable_from=null, expires_at=now()+interval '1 day' where id=${REWARD}::uuid`
  const token = await createRewardScanToken({
    rewardId: REWARD,
    customerId: CUSTOMER,
  })
  ok("loyalty", /^[a-f0-9-]{36}$/.test(token.scanToken))
  const [stored] =
    await tx`select customer_id,reward_event_id,consumed_at from public.reward_scan_tokens where id=${token.scanToken}::uuid`
  equal("loyalty", stored, {
    customer_id: CUSTOMER,
    reward_event_id: REWARD,
    consumed_at: null,
  })
  await assert.rejects(
    createRewardScanToken({
      rewardId: REWARD,
      customerId: "ee500000-0000-4000-8000-000000000099",
    }),
    /ownership|not found/i
  )
  counts.loyalty++

  const event = {
    id: "evt_synthetic_upgrade_probe",
    type: "customer.subscription.updated",
    livemode: false,
    created: 1785542400,
  }
  const claim = await claimStripeWebhookEvent(event)
  equal("webhook", claim.status, "claimed")
  equal("webhook", claim.attemptCount, 1)
  equal("webhook", (await claimStripeWebhookEvent(event)).status, "busy")
  equal(
    "webhook",
    await failStripeWebhookEvent({
      eventId: event.id,
      leaseId: claim.leaseId,
      errorCode: "processing_failed",
    }),
    true
  )
  const retry = await claimStripeWebhookEvent(event)
  equal("webhook", retry.status, "claimed")
  equal("webhook", retry.attemptCount, 2)
  equal(
    "webhook",
    await completeStripeWebhookEvent({
      eventId: event.id,
      leaseId: retry.leaseId,
    }),
    true
  )
  equal("webhook", (await claimStripeWebhookEvent(event)).status, "processed")
})
assert.equal(process.env.UPGRADE_APP_REVISION, BUILD_REVISION)
console.log(
  JSON.stringify({
    revision: BUILD_REVISION,
    migrationDigest: process.env.UPGRADE_MIGRATION_DIGEST,
    challenge: process.env.UPGRADE_CHALLENGE,
    result: "success",
    checks: Object.entries(counts).map(([contract, assertions]) => ({
      contract,
      assertions,
    })),
    scope: "application-domain-functions-and-real-database-rpcs",
  })
)
