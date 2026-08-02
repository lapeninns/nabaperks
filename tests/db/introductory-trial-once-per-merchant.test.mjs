import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { after, test } from "node:test"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"
import { createRewardPoolFixture } from "./helpers/reward-pool-fixture.mjs"

/**
 * The 28-day introductory trial is once per merchant.
 *
 * Cancel-and-restart is intentionally supported, so current subscription status
 * cannot be the eligibility test — 'cancelled' is exactly the state a returning
 * merchant is in. Only a durable ledger works, and the decision must be frozen
 * onto the attempt because Stripe rejects a conflicting body for an already-used
 * idempotency key.
 */

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(async () => {
  await closeDb()
})

test(
  "a first-time merchant binds the introductory trial",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const merchantId = (await createRewardPoolFixture(tx)).merchantId
      const bound = await claimAndBind(tx, merchantId)

      assert.equal(bound.bind_status, "bound")
      assert.equal(bound.trial_policy, "introductory_28_day")
    })
  }
)

test(
  "a merchant who already used the trial binds not_eligible on restart",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const merchantId = (await createRewardPoolFixture(tx)).merchantId
      await seedBillingCustomer(tx, merchantId, "cancelled")

      const consumed = await consumeTrial(tx, merchantId)
      assert.equal(consumed, true)

      const bound = await claimAndBind(tx, merchantId)
      assert.equal(
        bound.trial_policy,
        "not_eligible",
        "cancel-and-restart must not mint another 28 free days"
      )
    })
  }
)

test(
  "a cancelled subscription still records the trial as consumed",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const merchantId = (await createRewardPoolFixture(tx)).merchantId
      // The cancellation sighting is the exact case this exists for, so
      // consumption is deliberately NOT guarded on an active status.
      await seedBillingCustomer(tx, merchantId, "cancelled")

      assert.equal(await consumeTrial(tx, merchantId), true)

      const [row] = await tx`
        select introductory_trial_status, introductory_trial_consumed_at
        from public.billing_customers where merchant_id = ${merchantId}::uuid`
      assert.equal(row.introductory_trial_status, "consumed")
      assert.ok(row.introductory_trial_consumed_at)
    })
  }
)

test(
  "consumption is idempotent and keeps the earliest evidence",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const merchantId = (await createRewardPoolFixture(tx)).merchantId
      await seedBillingCustomer(tx, merchantId, "trialing")

      assert.equal(await consumeTrial(tx, merchantId), true)
      const [first] = await tx`
      select introductory_trial_consumed_at as at from public.billing_customers
      where merchant_id = ${merchantId}::uuid`

      assert.equal(
        await consumeTrial(tx, merchantId),
        false,
        "a second sighting is a no-op"
      )
      const [second] = await tx`
      select introductory_trial_consumed_at as at from public.billing_customers
      where merchant_id = ${merchantId}::uuid`

      assert.deepEqual(
        second.at,
        first.at,
        "the first evidence timestamp stands"
      )
    })
  }
)

test(
  "rebinding an already-bound attempt returns the frozen policy",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const merchantId = (await createRewardPoolFixture(tx)).merchantId
      const first = await claimAndBind(tx, merchantId)

      // An idempotent retry must rebuild the same Stripe request body, so the
      // policy has to come from the attempt, not be recomputed.
      await consumeTrial(tx, merchantId)
      const again = await bind(tx, merchantId, first.attemptId, first.leaseId)

      assert.equal(again.bind_status, "existing")
      assert.equal(
        again.trial_policy,
        first.trial_policy,
        "eligibility is frozen at bind time"
      )
    })
  }
)

async function seedBillingCustomer(tx, merchantId, status) {
  await tx`
    insert into public.billing_customers
      (merchant_id, stripe_customer_id, stripe_subscription_id, plan, status)
    values
      (${merchantId}::uuid, ${`cus_${randomUUID().slice(0, 8)}`},
       ${`sub_${randomUUID().slice(0, 8)}`}, 'growth', ${status})
    on conflict (merchant_id) do update set status = excluded.status`
}

async function consumeTrial(tx, merchantId) {
  const [row] = await tx`
    select public.consume_merchant_introductory_trial(${merchantId}::uuid) as ok`
  return row.ok
}

async function claimAndBind(tx, merchantId) {
  const [claim] = await tx`
    select * from public.claim_billing_checkout_attempt(
      ${merchantId}::uuid, 'month', 'price_month_49',
      'https://x.test/ok', 'https://x.test/cancel',
      ${new Date(Date.now() + 3_600_000).toISOString()}::timestamptz, null)`

  const bound = await bind(
    tx,
    merchantId,
    claim.attempt_id,
    claim.worker_lease_id
  )
  return {
    ...bound,
    attemptId: claim.attempt_id,
    leaseId: claim.worker_lease_id,
  }
}

async function bind(tx, merchantId, attemptId, leaseId) {
  const [row] = await tx`
    select * from public.bind_billing_checkout_offer(
      ${merchantId}::uuid, ${attemptId}::uuid, ${leaseId}::uuid,
      'price_launch_29999')`
  return row
}
