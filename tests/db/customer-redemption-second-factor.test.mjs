import assert from "node:assert/strict"
import { after, test } from "node:test"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"
import { createRewardPoolFixture } from "./helpers/reward-pool-fixture.mjs"

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(async () => closeDb())

test(
  "unverified email blocks reward token value transfer at the database boundary",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const created = await createRewardPoolFixture(tx)
      const fixture = {
        reward_id: created.rewardEventId,
        customer_id: created.customerId,
      }
      await tx`
        insert into public.reward_events (
          id, merchant_id, customer_id, membership_id, loyalty_card_id,
          status, reward_name, reward_terms, redeemable_from
        ) values (
          ${fixture.reward_id}::uuid, ${created.merchantId}::uuid,
          ${fixture.customer_id}::uuid, ${created.membershipId}::uuid,
          ${created.cardId}::uuid, 'unlocked', 'Verified email reward',
          'Subject to availability.', public.uk_business_date(now())
        )`

      await tx`
        select set_config('app.customer_erasure', 'true', true)`
      await tx`
        update public.customers
        set email_verified_at = null
        where id = ${fixture.customer_id}::uuid`

      await assert.rejects(
        tx.savepoint(async (sp) => {
          await sp`
            insert into public.reward_scan_tokens (
              reward_event_id, merchant_id, customer_id, membership_id
            )
            select id, merchant_id, customer_id, membership_id
            from public.reward_events
            where id = ${fixture.reward_id}::uuid`
        }),
        /verified email required/i
      )

      await tx`
        update public.customers
        set
          email_verified_at = now(),
          email_hmac = coalesce(
            email_hmac,
            encode(extensions.digest(lower(email), 'sha256'), 'hex')
          )
        where id = ${fixture.customer_id}::uuid`
      const [token] = await tx`
        insert into public.reward_scan_tokens (
          reward_event_id, merchant_id, customer_id, membership_id
        )
        select id, merchant_id, customer_id, membership_id
        from public.reward_events
        where id = ${fixture.reward_id}::uuid
        returning id`
      assert.ok(token?.id)
    })
  }
)
