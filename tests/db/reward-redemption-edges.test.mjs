import { after, test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"
import { grantRewardEmailAssurance } from "./helpers/reward-email-assurance.mjs"

/**
 * MS-customer-redeem (edges) — live-DB tier.
 *
 * The single-use happy path is covered elsewhere; these prove the redemption
 * guards that protect the cycle ledger and tenant boundary:
 *   - a double redeem is IDEMPOTENT — it never advances the cycle twice,
 *   - scan-token minting is customer-owned and refuses unavailable rewards,
 *   - an EXPIRED scan token is refused at collect time,
 *   - a token can only be collected by the merchant it belongs to.
 *
 * Each manufactures a single ready reward inside a rolled-back transaction.
 */

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(async () => {
  await closeDb()
})

const PICK = /* sql */ `
  select cm.id as membership_id, cm.customer_id, cm.merchant_id,
         lc.id as loyalty_card_id, lc.stamps_required
  from public.customer_memberships cm
  join public.merchants mer on mer.id = cm.merchant_id
  join public.loyalty_cards lc on lc.merchant_id = cm.merchant_id and lc.is_active
  where mer.status in ('trial', 'active')
    and (mer.requires_billing = false
         or exists (select 1 from public.billing_customers bc
                    where bc.merchant_id = mer.id and bc.status in ('trialing', 'active')))
  order by cm.created_at
  limit 1`

// Manufacture a redeemable reward for the picked membership and return its id.
async function readyReward(tx, m) {
  await tx`update public.customer_memberships
           set current_stamp_count = ${m.stamps_required} where id = ${m.membership_id}`
  await tx`update public.customers
           set full_name = 'Redeem Tester', date_of_birth = '1990-01-01', email_verified_at = now()
           where id = ${m.customer_id}`
  const [reward] = await tx`
    insert into public.reward_events
      (merchant_id, customer_id, membership_id, loyalty_card_id, status,
       reward_name, reward_terms, redeemable_from, metadata, created_at, updated_at)
    values (${m.merchant_id}, ${m.customer_id}, ${m.membership_id}, ${m.loyalty_card_id},
            'unlocked', 'Edge reward', 'terms',
            (now() at time zone 'Europe/London')::date, '{}'::jsonb, now(), now())
    returning id`
  return reward.id
}

async function assertMintRejected(tx, rewardId, customerId, pattern, message) {
  let rejected = false
  try {
    await tx.savepoint(async () => {
      await tx`
        select scan_token from public.create_reward_scan_token(
          ${rewardId}::uuid,
          ${customerId}::uuid
        )`
    })
  } catch (error) {
    rejected = pattern.test(String(error.message))
  }

  assert.ok(rejected, message)
}

test(
  "a double redeem is idempotent and never advances the cycle twice",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [m] = await tx.unsafe(PICK)
      assert.ok(m, "a billing-eligible seeded membership exists")
      const rewardId = await readyReward(tx, m)
      await grantRewardEmailAssurance(tx, rewardId, m.customer_id)
      // Capture the baseline — a seeded membership may carry prior redemptions, so
      // idempotency is asserted on DELTAS, not absolute values.
      const before = (
        await tx`
      select active_cycle_number, total_rewards_redeemed
      from public.customer_memberships where id = ${m.membership_id}`
      )[0]

      // First redeem advances the cycle by exactly one.
      await tx`select * from public.redeem_self_service_reward(
      ${rewardId}::uuid, ${m.customer_id}::uuid, null, null)`
      const afterFirst = (
        await tx`
      select active_cycle_number, total_rewards_redeemed
      from public.customer_memberships where id = ${m.membership_id}`
      )[0]
      assert.equal(
        afterFirst.active_cycle_number,
        before.active_cycle_number + 1,
        "cycle advances once"
      )
      assert.equal(
        afterFirst.total_rewards_redeemed,
        before.total_rewards_redeemed + 1,
        "exactly one redemption is recorded"
      )

      // Second redeem of the SAME reward is a no-op read-back — no double advance.
      await tx`select * from public.redeem_self_service_reward(
      ${rewardId}::uuid, ${m.customer_id}::uuid, null, null)`
      const afterSecond = (
        await tx`
      select active_cycle_number, total_rewards_redeemed
      from public.customer_memberships where id = ${m.membership_id}`
      )[0]
      assert.equal(
        afterSecond.active_cycle_number,
        afterFirst.active_cycle_number,
        "cycle does NOT advance again"
      )
      assert.equal(
        afterSecond.total_rewards_redeemed,
        afterFirst.total_rewards_redeemed,
        "redemption count does NOT double"
      )
    })
  }
)

test("an expired scan token is refused at collect", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const [m] = await tx.unsafe(PICK)
    const rewardId = await readyReward(tx, m)
    await grantRewardEmailAssurance(tx, rewardId, m.customer_id)
    const [minted] = await tx`
      select scan_token from public.create_reward_scan_token(${rewardId}::uuid, ${m.customer_id}::uuid)`
    // Force the token into the past.
    await tx`update public.reward_scan_tokens
             set expires_at = now() - interval '1 hour' where id = ${minted.scan_token}`

    let rejected = false
    try {
      await tx.savepoint(async () => {
        await tx`select public.collect_reward_scan_token(
          ${minted.scan_token}::uuid, ${m.merchant_id}::uuid)`
      })
    } catch (error) {
      rejected = /expired/i.test(String(error.message))
    }
    assert.ok(rejected, "an expired token cannot be collected")
    const [{ status }] =
      await tx`select status from public.reward_events where id = ${rewardId}`
    assert.equal(
      status,
      "unlocked",
      "the reward is not consumed by an expired-token attempt"
    )
  })
})

test("scan-token minting requires reward ownership", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const [m] = await tx.unsafe(PICK)
    assert.ok(m, "a billing-eligible seeded membership exists")
    const rewardId = await readyReward(tx, m)

    await assertMintRejected(
      tx,
      rewardId,
      randomUUID(),
      /ownership required/i,
      "another customer cannot mint a scan token for this reward"
    )
  })
})

test(
  "scan-token minting refuses redeemed and not-ready rewards",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [m] = await tx.unsafe(PICK)
      assert.ok(m, "a billing-eligible seeded membership exists")

      const redeemedRewardId = await readyReward(tx, m)
      await grantRewardEmailAssurance(tx, redeemedRewardId, m.customer_id)
      await tx`
      update public.reward_events
      set status = 'redeemed', redeemed_at = now()
      where id = ${redeemedRewardId}`
      await assertMintRejected(
        tx,
        redeemedRewardId,
        m.customer_id,
        /already redeemed/i,
        "an already redeemed reward cannot mint a fresh scan token"
      )

      const cancelledRewardId = await readyReward(tx, m)
      await tx`
      update public.reward_events
      set status = 'cancelled',
          cancelled_reason = 'Cancelled by the venue (test fixture).'
      where id = ${cancelledRewardId}`
      await assertMintRejected(
        tx,
        cancelledRewardId,
        m.customer_id,
        /not ready to collect/i,
        "a non-unlocked reward cannot mint a scan token"
      )

      const underStampedRewardId = await readyReward(tx, m)
      await tx`
      update public.customer_memberships
      set current_stamp_count = ${m.stamps_required - 1}
      where id = ${m.membership_id}`
      await assertMintRejected(
        tx,
        underStampedRewardId,
        m.customer_id,
        /not ready to redeem/i,
        "a reward below the required stamp count cannot mint a scan token"
      )
    })
  }
)

test(
  "scan-token minting refuses future, availability-blocked, and incomplete-profile rewards",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [m] = await tx.unsafe(PICK)
      assert.ok(m, "a billing-eligible seeded membership exists")

      const futureRewardId = await readyReward(tx, m)
      await tx`
      update public.reward_events
      set redeemable_from = (now() at time zone 'Europe/London')::date + 1
      where id = ${futureRewardId}`
      await assertMintRejected(
        tx,
        futureRewardId,
        m.customer_id,
        /next UK business day/i,
        "a next-day-gated reward cannot mint a scan token early"
      )

      const blockedRewardId = await readyReward(tx, m)
      await tx`
      update public.merchants
      set requires_billing = true
      where id = ${m.merchant_id}`
      await tx`
      insert into public.billing_customers (
        merchant_id,
        stripe_customer_id,
        stripe_subscription_id,
        status
      )
      values (
        ${m.merchant_id},
        ${`cus_block_${String(m.merchant_id).slice(0, 8)}`},
        ${`sub_block_${String(m.merchant_id).slice(0, 8)}`},
        'cancelled'
      )
      on conflict (merchant_id) do update
      set status = 'cancelled', updated_at = now()`
      await assertMintRejected(
        tx,
        blockedRewardId,
        m.customer_id,
        /unavailable/i,
        "a billing-blocked loyalty programme cannot mint a scan token"
      )

      await tx`
      update public.merchants
      set requires_billing = false
      where id = ${m.merchant_id}`
      await tx`
      update public.billing_customers
      set status = 'active', updated_at = now()
      where merchant_id = ${m.merchant_id}`
      const incompleteProfileRewardId = await readyReward(tx, m)
      await tx`
      update public.customers
      set full_name = null
      where id = ${m.customer_id}`
      await assertMintRejected(
        tx,
        incompleteProfileRewardId,
        m.customer_id,
        /complete your profile/i,
        "an incomplete customer profile cannot mint a scan token"
      )
    })
  }
)

test(
  "an under-18 customer cannot mint or redeem (18+ age gate)",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [m] = await tx.unsafe(PICK)
      assert.ok(m, "a billing-eligible seeded membership exists")
      const rewardId = await readyReward(tx, m)

      // Make ONLY age the blocker: readyReward already set a name + verified email,
      // so the profile is otherwise complete — just push the DOB under 18.
      await tx`update public.customers
             set date_of_birth = ((now() at time zone 'Europe/London')::date - interval '10 years')
             where id = ${m.customer_id}`

      // Mint (customer-side) refuses to issue a collection token.
      await assertMintRejected(
        tx,
        rewardId,
        m.customer_id,
        /18 or over/i,
        "an under-18 customer cannot mint a scan token"
      )

      // Collect (merchant-side) refuses too, and the reward is NOT consumed.
      let rejected = false
      try {
        await tx.savepoint(async () => {
          await tx`select * from public.redeem_self_service_reward(
          ${rewardId}::uuid, ${m.customer_id}::uuid, null, null)`
        })
      } catch (error) {
        rejected = /18 or over/i.test(String(error.message))
      }
      assert.ok(rejected, "an under-18 customer cannot redeem")
      const [{ status }] =
        await tx`select status from public.reward_events where id = ${rewardId}`
      assert.equal(
        status,
        "unlocked",
        "the reward is not consumed by an under-age attempt"
      )
    })
  }
)

test(
  "a token can only be collected by the merchant it belongs to",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [m] = await tx.unsafe(PICK)
      const rewardId = await readyReward(tx, m)
      await grantRewardEmailAssurance(tx, rewardId, m.customer_id)
      const [minted] = await tx`
      select scan_token from public.create_reward_scan_token(${rewardId}::uuid, ${m.customer_id}::uuid)`
      const [other] = await tx`
      select id from public.merchants where id <> ${m.merchant_id} and status in ('trial', 'active') limit 1`
      assert.ok(
        other,
        "a second merchant exists to attempt cross-tenant collection"
      )

      let rejected = false
      try {
        await tx.savepoint(async () => {
          await tx`select public.collect_reward_scan_token(${minted.scan_token}::uuid, ${other.id}::uuid)`
        })
      } catch (error) {
        rejected = /different merchant|not found|belongs/i.test(
          String(error.message)
        )
      }
      assert.ok(
        rejected,
        "a foreign merchant cannot collect another venue's token"
      )
      const [{ consumed_at }] = await tx`
      select consumed_at from public.reward_scan_tokens where id = ${minted.scan_token}`
      assert.equal(
        consumed_at,
        null,
        "the token stays unconsumed after a cross-tenant attempt"
      )
    })
  }
)
