import { after, test } from "node:test"
import assert from "node:assert/strict"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"
import {
  createRewardPoolFixture,
  insertIssuedRewardEvent,
} from "./helpers/reward-pool-fixture.mjs"

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(async () => {
  await closeDb()
})

test(
  "billing grace elapsed merchants cannot mint reward scan tokens and the reward remains unclaimed",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await createRewardPoolFixture(tx)
      await insertIssuedRewardEvent(tx, fixture, null, "Billing moat reward")
      await tx`
      update public.reward_events
      set created_at = now() - interval '40 days',
          redeemable_from = public.uk_business_date(now() - interval '40 days'),
          available_from = now() - interval '39 days',
          expires_at = now() + interval '20 days'
      where id = ${fixture.rewardEventId}::uuid`
      await tx`
      update public.merchants
      set requires_billing = true
      where id = ${fixture.merchantId}::uuid`
      await tx`
      insert into public.billing_customers (
        merchant_id,
        stripe_customer_id,
        stripe_subscription_id,
        status,
        stripe_state_event_created_at,
        stripe_state_event_id
      )
      values (
        ${fixture.merchantId}::uuid,
        ${`cus_moat_${fixture.merchantId.slice(0, 8)}`},
        ${`sub_moat_${fixture.merchantId.slice(0, 8)}`},
        'cancelled',
        now() - interval '31 days',
        ${`evt_moat_${fixture.merchantId.slice(0, 8)}`}
      )`

      let rejection = ""
      try {
        await tx.savepoint(async (sp) => {
          await sp`
          select scan_token
          from public.create_reward_scan_token(
            ${fixture.rewardEventId}::uuid,
            ${fixture.customerId}::uuid
          )`
        })
      } catch (error) {
        rejection = String(error.message)
      }

      assert.match(rejection, /expired|venue_paused|unavailable/i)

      const [reward] = await tx`
      select status
      from public.reward_events
      where id = ${fixture.rewardEventId}::uuid`
      const [{ n }] = await tx`
      select count(*)::int as n
      from public.reward_scan_tokens
      where reward_event_id = ${fixture.rewardEventId}::uuid`

      assert.equal(reward.status, "unlocked")
      assert.equal(n, 0)
    })
  }
)
