import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { after, test } from "node:test"

import { closeDb, inRolledBackTxn } from "./helpers/db.mjs"
import {
  createSuspensionGraceFixture,
  isSuspensionGraceReady,
  setServiceRole,
  suspendAsAdmin,
} from "./helpers/merchant-suspension-grace-fixture.mjs"

const ready = await isSuspensionGraceReady()
const skip = ready ? false : "suspension-grace migration is not deployed"

after(closeDb)

test(
  "stored expiry cannot block token mint or redemption during grace",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await createSuspensionGraceFixture(tx)
      await suspendAsAdmin(tx, fixture)
      await setServiceRole(tx)
      await tx`
      update public.reward_events
      set expires_at = now() - interval '1 day'
      where id = ${fixture.rewardEventId}::uuid`

      await tx`select public.expire_due_reward_events(now())`
      const [minted] = await tx`
        select scan_token, expires_at as "expiresAt"
        from public.create_reward_scan_token(
          ${fixture.rewardEventId}::uuid, ${fixture.customerId}::uuid
        )`
      assert.ok(minted.scan_token)
      assert.ok(minted.expiresAt.getTime() > Date.now())

      const [redeemed] = await tx`
        select * from public.redeem_self_service_reward(
          ${fixture.rewardEventId}::uuid,
          ${fixture.customerId}::uuid,
          null,
          null
        )`
      const [reward] = await tx`
      select rewards.status, collection.state
      from public.reward_events rewards
      cross join lateral private.reward_collection_state(rewards.id, now()) collection
      where rewards.id = ${fixture.rewardEventId}::uuid`

      assert.equal(redeemed.reward_event_id, fixture.rewardEventId)
      assert.equal(reward.status, "redeemed")
      assert.equal(reward.state, "redeemed")
    })
  }
)

test(
  "billing lapse uses the same grace and blocked-to-blocked events cannot reset it",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await createSuspensionGraceFixture(tx)
      const lapseStart = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      await tx`
        update public.billing_customers
        set status = 'past_due',
            stripe_state_event_created_at = ${lapseStart},
            stripe_state_event_id = ${`evt_${randomUUID()}`}
        where merchant_id = ${fixture.merchantId}::uuid`

      const [duringLapse] = await tx`
        select billing.loyalty_suspended_at as "loyaltySuspendedAt", grace.*
        from public.billing_customers billing
        cross join lateral private.reward_collection_state(
          ${fixture.rewardEventId}::uuid, now()
        ) grace
        where billing.merchant_id = ${fixture.merchantId}::uuid`
      assert.equal(duringLapse.state, "ready")
      const [notice] = await tx`
        select category, metadata
        from public.notification_events
        where reward_event_id = ${fixture.rewardEventId}::uuid
          and event_type = 'venue_paused'`
      assert.equal(notice.category, "transactional")
      assert.equal(notice.metadata.source, "billing_lapse")
      assert.equal(notice.metadata.service_message, true)

      await tx`
        update public.billing_customers
        set status = 'cancelled',
            stripe_state_event_created_at = now() - interval '1 day',
            stripe_state_event_id = ${`evt_${randomUUID()}`}
        where merchant_id = ${fixture.merchantId}::uuid`
      const [blockedAgain] = await tx`
        select loyalty_suspended_at as "loyaltySuspendedAt"
        from public.billing_customers
        where merchant_id = ${fixture.merchantId}::uuid`
      assert.equal(
        blockedAgain.loyaltySuspendedAt.getTime(),
        duringLapse.loyaltySuspendedAt.getTime()
      )
    })
  }
)

test(
  "billing recovery extends expiry once and repeated active events are inert",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await createSuspensionGraceFixture(tx)
      await tx`
        update public.billing_customers
        set status = 'past_due',
            stripe_state_event_created_at = now() - interval '2 days',
            stripe_state_event_id = ${`evt_${randomUUID()}`}
      where merchant_id = ${fixture.merchantId}::uuid`
      const [before] = await tx`
      select expires_at as "expiresAt"
      from public.reward_events where id = ${fixture.rewardEventId}::uuid`

      await tx`
        update public.billing_customers
        set status = 'active', stripe_state_event_created_at = now(),
            stripe_state_event_id = ${`evt_${randomUUID()}`}
        where merchant_id = ${fixture.merchantId}::uuid`
      const [recovered] = await tx`
      select expires_at as "expiresAt"
      from public.reward_events where id = ${fixture.rewardEventId}::uuid`
      assert.ok(recovered.expiresAt.getTime() > before.expiresAt.getTime())

      await tx`
        update public.billing_customers
        set status = 'active', stripe_state_event_created_at = now() + interval '1 minute',
            stripe_state_event_id = ${`evt_${randomUUID()}`}
        where merchant_id = ${fixture.merchantId}::uuid`
      const [repeated] = await tx`
      select expires_at as "expiresAt"
      from public.reward_events where id = ${fixture.rewardEventId}::uuid`
      assert.equal(repeated.expiresAt.getTime(), recovered.expiresAt.getTime())
    })
  }
)

for (const staleStatus of ["past_due", "cancelled"]) {
  test(
    `complimentary venue ignores stale ${staleStatus} billing state`,
    { skip },
    async () => {
      await inRolledBackTxn(async (tx) => {
        const fixture = await createSuspensionGraceFixture(tx)
        await setServiceRole(tx)
        await tx`
        update public.merchants
        set requires_billing = false
        where id = ${fixture.merchantId}::uuid`
        await tx`
        update public.reward_events
        set expires_at = now() + interval '60 days'
        where id = ${fixture.rewardEventId}::uuid`
        await tx`
        update public.billing_customers
        set status = ${staleStatus},
            stripe_state_event_created_at = now() - interval '45 days',
            stripe_state_event_id = ${`evt_${randomUUID()}`}
        where merchant_id = ${fixture.merchantId}::uuid`

        const [state] = await tx`
        select private.merchant_suspended_at(${fixture.merchantId}::uuid) as "suspendedAt",
               collection.state
        from private.reward_collection_state(${fixture.rewardEventId}::uuid, now()) collection`
        assert.equal(state.suspendedAt, null)
        assert.equal(state.state, "ready")

        await tx`
        insert into public.stamp_events (
          merchant_id, customer_id, membership_id, loyalty_card_id,
          location_id, event_type, stamps_delta, cycle_number
        ) values (
          ${fixture.merchantId}::uuid, ${fixture.customerId}::uuid,
          ${fixture.membershipId}::uuid, ${fixture.cardId}::uuid,
          ${fixture.locationId}::uuid, 'earned', 1, 2
        )`
        await tx`select public.expire_due_reward_events(now() + interval '31 days')`
        const [minted] = await tx`
        select scan_token from public.create_reward_scan_token(
          ${fixture.rewardEventId}::uuid, ${fixture.customerId}::uuid
        )`
        assert.ok(minted.scan_token)
        await tx`
        select * from public.redeem_self_service_reward(
          ${fixture.rewardEventId}::uuid, ${fixture.customerId}::uuid, null, null
        )`

        const [result] = await tx`
        select rewards.status,
               count(notices.id)::int as "noticeCount"
        from public.reward_events rewards
        left join public.notification_events notices
          on notices.reward_event_id = rewards.id
         and notices.event_type = 'venue_paused'
        where rewards.id = ${fixture.rewardEventId}::uuid
        group by rewards.status`
        assert.equal(result.status, "redeemed")
        assert.equal(result.noticeCount, 0)
      })
    }
  )
}
