import assert from "node:assert/strict"
import { after, test } from "node:test"

import { actAsActivatedInternalAdmin } from "./helpers/admin-auth.mjs"
import { closeDb, inRolledBackTxn } from "./helpers/db.mjs"
import {
  createSuspensionGraceFixture,
  isSuspensionGraceReady,
  setServiceRole,
  suspendAsAdmin,
} from "./helpers/merchant-suspension-grace-fixture.mjs"
import { actAsMerchantOwner } from "./helpers/reward-pool-fixture.mjs"

const ready = await isSuspensionGraceReady()
const skip = ready ? false : "suspension-grace migration is not deployed"

after(closeDb)

test(
  "merchant owners cannot invoke suspension administration",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await createSuspensionGraceFixture(tx)
      await actAsMerchantOwner(tx, fixture.ownerUserId)

      await assert.rejects(
        tx.savepoint(
          () =>
            tx`select public.admin_suspend_merchant(${fixture.merchantId}::uuid, 'Owner attempt')`
        ),
        (error) => error.code === "42501"
      )

      const [merchant] = await tx`
      select status, suspended_at as "suspendedAt"
      from public.merchants where id = ${fixture.merchantId}::uuid`
      assert.equal(merchant.status, "active")
      assert.equal(merchant.suspendedAt, null)
    })
  }
)

test(
  "manual suspension is attributed and preserves pre-suspension rewards for 30 days",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await createSuspensionGraceFixture(tx)
      await suspendAsAdmin(tx, fixture)

      const [state] = await tx`
      select collection.*, collection.expires_at as "expiresAt"
      from private.reward_collection_state(${fixture.rewardEventId}::uuid, now()) collection`
      const [merchant] = await tx`
      select status, suspension_reason as "suspensionReason",
             suspended_by as "suspendedBy",
             status_before_suspension as "statusBeforeSuspension",
             suspended_at as "suspendedAt"
      from public.merchants where id = ${fixture.merchantId}::uuid`
      const [notice] = await tx`
      select category, payload, metadata
      from public.notification_events
      where reward_event_id = ${fixture.rewardEventId}::uuid
        and event_type = 'venue_paused'`

      assert.equal(state.state, "ready")
      assert.equal(merchant.status, "suspended")
      assert.equal(merchant.suspensionReason, "Policy review")
      assert.equal(merchant.suspendedBy, fixture.adminUserId)
      assert.equal(merchant.statusBeforeSuspension, "active")
      assert.ok(merchant.suspendedAt)
      assert.equal(
        state.expiresAt.getTime() - merchant.suspendedAt.getTime(),
        30 * 24 * 60 * 60 * 1000
      )
      assert.equal(notice.category, "transactional")
      assert.equal(notice.metadata.service_message, true)
      assert.match(notice.payload.body, /30 days/i)
    })
  }
)

test(
  "suspension blocks earning and rewards issued after the pause",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await createSuspensionGraceFixture(tx)
      await suspendAsAdmin(tx, fixture)
      await setServiceRole(tx)

      const [availability] = await tx`
      select public.loyalty_availability_reason(
        merchants.status, cards.is_active, billing.status, merchants.requires_billing
      ) as reason
      from public.merchants merchants
      join public.loyalty_cards cards on cards.merchant_id = merchants.id
      left join public.billing_customers billing on billing.merchant_id = merchants.id
      where merchants.id = ${fixture.merchantId}::uuid`
      assert.equal(availability.reason, "merchant_inactive")

      await assert.rejects(
        tx.savepoint(
          () => tx`
          insert into public.stamp_events (
            merchant_id, customer_id, membership_id, loyalty_card_id,
            location_id, event_type, stamps_delta, cycle_number
          ) values (
            ${fixture.merchantId}::uuid, ${fixture.customerId}::uuid,
            ${fixture.membershipId}::uuid, ${fixture.cardId}::uuid,
            ${fixture.locationId}::uuid, 'earned', 1, 2
          )`
        ),
        /paused|unavailable/i
      )

      await assert.rejects(
        tx.savepoint(
          () => tx`
          insert into public.reward_events (
            merchant_id, customer_id, membership_id, loyalty_card_id,
            reward_pool_item_id, reward_name, reward_terms, redeemable_from,
            status, source, reward_policy_version, reward_policy_snapshot
          )
          select merchant_id, customer_id, membership_id, loyalty_card_id,
                 reward_pool_item_id, reward_name, reward_terms, redeemable_from,
                 'unlocked', 'merchant_direct', reward_policy_version,
                 reward_policy_snapshot
          from public.reward_events
          where id = ${fixture.rewardEventId}::uuid`
        ),
        /paused|unavailable/i
      )

      await tx`
      update public.merchants
      set suspended_at = now() - interval '11 days'
      where id = ${fixture.merchantId}::uuid`
      await tx`
      update public.reward_events
      set created_at = now() - interval '10 days'
      where id = ${fixture.rewardEventId}::uuid`

      const [state] = await tx`
      select * from private.reward_collection_state(${fixture.rewardEventId}::uuid, now())`
      assert.equal(state.state, "blocked")
      assert.equal(state.reason, "venue_paused")
    })
  }
)

test(
  "a grace reward expires when the 30-day suspension window elapses",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await createSuspensionGraceFixture(tx)
      await suspendAsAdmin(tx, fixture)
      await setServiceRole(tx)
      await tx`
      update public.merchants
      set suspended_at = '2026-01-01T12:00:00Z'::timestamptz
      where id = ${fixture.merchantId}::uuid`
      await tx`
      update public.reward_events
      set created_at = '2025-12-01T12:00:00Z'::timestamptz,
          expires_at = '2025-12-31T12:00:00Z'::timestamptz
      where id = ${fixture.rewardEventId}::uuid`

      await assert.rejects(
        () =>
          tx.savepoint(
            (sp) => sp`
              select scan_token from public.create_reward_scan_token(
                ${fixture.rewardEventId}::uuid,
                ${fixture.customerId}::uuid
              )`
          ),
        /expired/i
      )

      await tx`
      select public.expire_due_reward_events(
        '2026-01-31T12:00:00Z'::timestamptz
      )`
      const [reward] = await tx`
      select status, metadata ->> 'expired_by' as "expiredBy"
      from public.reward_events where id = ${fixture.rewardEventId}::uuid`

      assert.equal(reward.status, "expired")
      assert.equal(reward.expiredBy, "suspension_grace_elapsed")
    })
  }
)

test(
  "reinstatement restores status and extends each open expiry exactly once",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await createSuspensionGraceFixture(tx)
      await suspendAsAdmin(tx, fixture)
      await setServiceRole(tx)
      await tx`
      update public.merchants
      set suspended_at = now() - interval '2 days'
      where id = ${fixture.merchantId}::uuid`
      const [before] = await tx`
      select expires_at as "expiresAt"
      from public.reward_events where id = ${fixture.rewardEventId}::uuid`

      await actAsActivatedInternalAdmin(tx, fixture.adminUserId)
      await tx`select public.admin_reinstate_merchant(${fixture.merchantId}::uuid)`
      const [after] = await tx`
      select rewards.expires_at as "expiresAt", merchants.status,
             merchants.suspended_at as "suspendedAt",
             extensions.extension_count as "extensionCount",
             extensions.paused_seconds as "pausedSeconds"
      from public.reward_events rewards
      join public.merchants merchants on merchants.id = rewards.merchant_id
      cross join lateral (
        select count(*)::int as extension_count,
               extract(epoch from max(ended_at - started_at))::bigint as paused_seconds
        from private.reward_suspension_extensions
        where merchant_id = merchants.id
      ) extensions
      where rewards.id = ${fixture.rewardEventId}::uuid`

      const extensionMs = after.expiresAt.getTime() - before.expiresAt.getTime()
      assert.ok(extensionMs >= 2 * 24 * 60 * 60 * 1000)
      assert.ok(after.pausedSeconds >= 2 * 24 * 60 * 60)
      assert.ok(after.pausedSeconds < 2 * 24 * 60 * 60 + 60)
      assert.equal(after.status, "active")
      assert.equal(after.suspendedAt, null)
      assert.equal(after.extensionCount, 1)

      await assert.rejects(
        tx.savepoint(
          () =>
            tx`select public.admin_reinstate_merchant(${fixture.merchantId}::uuid)`
        ),
        /not suspended/i
      )
      const [unchanged] = await tx`
      select expires_at as "expiresAt"
      from public.reward_events where id = ${fixture.rewardEventId}::uuid`
      assert.equal(unchanged.expiresAt.getTime(), after.expiresAt.getTime())
    })
  }
)
