import { after, test } from "node:test"
import assert from "node:assert/strict"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"
import { grantRewardEmailAssurance } from "./helpers/reward-email-assurance.mjs"

/**
 * customer redeem + merchant scan pos — live-DB invariant tier.
 *
 * Proves the single-use scan-token invariant end to end: a ready reward mints a
 * token (R-1), the merchant collects it exactly once, and a second collection
 * does not re-consume it (R-4). Manufactures the ready reward
 * inside a rolled-back transaction so nothing persists.
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
    and (
      mer.requires_billing = false
      or exists (
        select 1 from public.billing_customers bc
        where bc.merchant_id = mer.id and bc.status in ('trialing', 'active')
      )
    )
  order by cm.created_at
  limit 1`

test(
  "R-1/R-4: a reward scan token can be collected exactly once",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [m] = await tx.unsafe(PICK)
      assert.ok(m, "a billing-eligible seeded membership exists")

      // Make the reward genuinely redeemable: full card + complete profile.
      await tx`
        update public.customer_memberships
        set current_stamp_count = ${m.stamps_required}
        where id = ${m.membership_id}`
      // Keep the customer's existing contact (a null email would violate
      // customers_contact_present); satisfy the profile gate by marking the
      // email verified so the "email present but unverified" clause is false.
      await tx`
        update public.customers
        set full_name = 'E2E Tester', date_of_birth = '1990-01-01',
            email_verified_at = now()
        where id = ${m.customer_id}`

      const [reward] = await tx`
        insert into public.reward_events (
          merchant_id, customer_id, membership_id, loyalty_card_id,
          status, reward_name, reward_terms, metadata, created_at, updated_at)
        values (
          ${m.merchant_id}, ${m.customer_id}, ${m.membership_id}, ${m.loyalty_card_id},
          'unlocked', 'E2E test reward', 'E2E test terms', '{}'::jsonb, now(), now())
        returning id`
      assert.ok(reward?.id, "manufactured an unlocked reward event")
      await grantRewardEmailAssurance(tx, reward.id, m.customer_id)

      // R-1: minting yields a live, unconsumed token.
      const [minted] = await tx`
        select * from public.create_reward_scan_token(
          ${reward.id}::uuid, ${m.customer_id}::uuid)`
      const token = minted?.scan_token
      assert.ok(token, "a scan token is minted")

      const [fresh] = await tx`
        select consumed_at, expires_at from public.reward_scan_tokens where id = ${token}`
      assert.equal(
        fresh.consumed_at,
        null,
        "freshly minted token is unconsumed"
      )
      assert.ok(
        new Date(fresh.expires_at).getTime() > Date.now(),
        "token expires in the future"
      )

      // The merchant collects the token once, leaving it consumed and redeemed.
      await tx`
        select * from public.collect_reward_scan_token(
          ${token}::uuid, ${m.merchant_id}::uuid)`
      const [afterFirst] = await tx`
        select consumed_at from public.reward_scan_tokens where id = ${token}`
      assert.notEqual(
        afterFirst.consumed_at,
        null,
        "token consumed after first collect"
      )
      const [rewardAfter] = await tx`
        select status from public.reward_events where id = ${reward.id}`
      assert.equal(
        rewardAfter.status,
        "redeemed",
        "reward is redeemed after collection"
      )

      // R-4: a second collection must not re-consume the token.
      let secondRejected = false
      try {
        await tx.savepoint(async (sp) => {
          await sp`
            select * from public.collect_reward_scan_token(
              ${token}::uuid, ${m.merchant_id}::uuid)`
        })
      } catch {
        secondRejected = true
      }
      const [afterSecond] = await tx`
        select consumed_at from public.reward_scan_tokens where id = ${token}`
      assert.ok(
        secondRejected ||
          afterSecond.consumed_at?.getTime?.() ===
            afterFirst.consumed_at?.getTime?.(),
        "second collection does not re-consume the token (single-use)"
      )
    })
  }
)
