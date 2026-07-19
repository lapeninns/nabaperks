import { after, test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"
import { createRewardPoolFixture } from "./helpers/reward-pool-fixture.mjs"

/**
 * rewards issued source rails — read-path (merchant scan) gate parity.
 *
 * The merchant's read path get_reward_scan_context must agree with the
 * mint/redeem gates: skip the stamp threshold for issued rewards (R-3), and
 * block an under-18 or profile-incomplete customer (R-5/R-6). The 18+ block is
 * the parity fix — the read path was missing it while mint/redeem enforced it.
 */

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(async () => {
  await closeDb()
})

async function insertReward(tx, fixture, opts = {}) {
  const id = opts.id ?? randomUUID()
  const source = opts.source ?? "stamp_cycle"
  const birthdayYear = opts.birthdayYear ?? null
  await tx`
    insert into public.reward_events (
      id, merchant_id, customer_id, membership_id, loyalty_card_id,
      status, source, birthday_year, reward_name, reward_terms,
      redeemable_from, cycle_number, created_at, updated_at)
    values (
      ${id}::uuid, ${fixture.merchantId}::uuid, ${fixture.customerId}::uuid,
      ${fixture.membershipId}::uuid, ${fixture.cardId}::uuid,
      'unlocked', ${source}, ${birthdayYear}, ${opts.rewardName ?? "Test reward"},
      'Subject to availability.', public.uk_business_date(now()), null, now(), now())`
  return id
}

/** Insert a scan token directly, bypassing the mint gates (the read path must
 *  still block a token whose customer became ineligible). */
async function insertScanToken(tx, fixture, rewardId) {
  const [row] = await tx`
    insert into public.reward_scan_tokens (
      reward_event_id, merchant_id, customer_id, membership_id)
    values (
      ${rewardId}::uuid, ${fixture.merchantId}::uuid,
      ${fixture.customerId}::uuid, ${fixture.membershipId}::uuid)
    returning id`
  return row.id
}

test(
  "R-3: get_reward_scan_context returns 'ready' for an issued reward below the stamp threshold",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await createRewardPoolFixture(tx)
      await tx`
        update public.customer_memberships
        set current_stamp_count = 0
        where id = ${fixture.membershipId}::uuid`
      const rewardId = await insertReward(tx, fixture, {
        source: "birthday_month",
        birthdayYear: 2026,
      })
      const [minted] = await tx`
        select scan_token from public.create_reward_scan_token(
          ${rewardId}::uuid, ${fixture.customerId}::uuid)`
      const [ctx] = await tx`
        select scan_status, blocked_reason from public.get_reward_scan_context(
          ${minted.scan_token}::uuid, ${fixture.merchantId}::uuid)`
      assert.equal(
        ctx.scan_status,
        "ready",
        "an issued reward reads back as ready"
      )
    })
  }
)

test(
  "R-3 control: get_reward_scan_context blocks a stamp_cycle reward below the threshold",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await createRewardPoolFixture(tx)
      await tx`
        update public.customer_memberships
        set current_stamp_count = 0
        where id = ${fixture.membershipId}::uuid`
      const rewardId = await insertReward(tx, fixture, {
        source: "stamp_cycle",
      })
      const tokenId = await insertScanToken(tx, fixture, rewardId)
      const [ctx] = await tx`
        select scan_status, blocked_reason from public.get_reward_scan_context(
          ${tokenId}::uuid, ${fixture.merchantId}::uuid)`
      assert.equal(ctx.scan_status, "blocked")
      assert.match(ctx.blocked_reason, /stamps/i)
    })
  }
)

test(
  "R-6: get_reward_scan_context blocks an under-18 customer (parity fix)",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await createRewardPoolFixture(tx)
      // Full card + complete profile, so stamps/profile are not the blocker.
      await tx`
        update public.customer_memberships
        set current_stamp_count = 3
        where id = ${fixture.membershipId}::uuid`
      await tx`
        update public.customers
        set date_of_birth = (now() - interval '12 years')::date
        where id = ${fixture.customerId}::uuid`
      const rewardId = await insertReward(tx, fixture, {
        source: "stamp_cycle",
      })
      const tokenId = await insertScanToken(tx, fixture, rewardId)
      const [ctx] = await tx`
        select scan_status, blocked_reason from public.get_reward_scan_context(
          ${tokenId}::uuid, ${fixture.merchantId}::uuid)`
      assert.equal(ctx.scan_status, "blocked")
      assert.match(ctx.blocked_reason, /18 or over/i)
    })
  }
)

test(
  "R-5: get_reward_scan_context blocks a profile-incomplete customer for an issued reward",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await createRewardPoolFixture(tx)
      await tx`
        update public.customer_memberships
        set current_stamp_count = 0
        where id = ${fixture.membershipId}::uuid`
      await tx`
        update public.customers
        set full_name = null
        where id = ${fixture.customerId}::uuid`
      const rewardId = await insertReward(tx, fixture, {
        source: "birthday_month",
        birthdayYear: 2026,
      })
      const tokenId = await insertScanToken(tx, fixture, rewardId)
      const [ctx] = await tx`
        select scan_status, blocked_reason from public.get_reward_scan_context(
          ${tokenId}::uuid, ${fixture.merchantId}::uuid)`
      assert.equal(ctx.scan_status, "blocked")
      assert.match(ctx.blocked_reason, /profile/i)
    })
  }
)
