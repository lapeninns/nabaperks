import assert from "node:assert/strict"
import { after, test } from "node:test"

import { closeDb, inRolledBackTxn } from "./helpers/db.mjs"
import {
  actAsMerchantOwner,
  createOrGetJoinQr,
  createRewardPoolFixture,
  expectRewardPoolRpcRejection,
  insertIssuedRewardEvent,
  isRewardPoolDbReady,
  upsertRewardPoolItem,
} from "./helpers/reward-pool-fixture.mjs"

/**
 * Flow 19 reward-pool setup — live-DB tier.
 *
 * These tests execute the merchant-owned reward-pool RPCs rather than only
 * source-reading the SQL migration. Each test uses disposable rows inside a
 * rollback transaction and sets request.jwt.claim.sub to the seeded owner.
 */

const ready = await isRewardPoolDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(async () => {
  await closeDb()
})

test("reward-pool RPCs create/update rewards and only provision join QR at three active rewards", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const fixture = await createRewardPoolFixture(tx)
    await actAsMerchantOwner(tx, fixture.ownerUserId)

    await expectRewardPoolRpcRejection(
      tx,
      () => createOrGetJoinQr(tx, fixture),
      /3 active mystery rewards/i,
      "a join QR cannot be created before three active rewards exist"
    )

    const first = await upsertRewardPoolItem(tx, fixture, {
      rewardName: "First pour",
      displayOrder: 1,
    })
    assert.equal(first.saved_action, "reward_pool_item_created")

    await upsertRewardPoolItem(tx, fixture, {
      rewardName: "Second plate",
      displayOrder: 2,
    })

    await expectRewardPoolRpcRejection(
      tx,
      () => createOrGetJoinQr(tx, fixture),
      /3 active mystery rewards/i,
      "two active rewards are still not launch-ready"
    )

    await upsertRewardPoolItem(tx, fixture, {
      rewardName: "Third treat",
      displayOrder: 3,
    })

    const qr = await createOrGetJoinQr(tx, fixture)
    assert.ok(qr.qr_code_uuid, "the third active reward unlocks QR creation")

    await expectRewardPoolRpcRejection(
      tx,
      () =>
        upsertRewardPoolItem(tx, fixture, {
          rewardPoolItemId: first.reward_pool_item_id,
          rewardName: "First pour",
          isActive: false,
          displayOrder: 1,
        }),
      /3 active rewards/i,
      "a live join QR blocks edits that would drop below three active rewards"
    )

    const updated = await upsertRewardPoolItem(tx, fixture, {
      rewardPoolItemId: first.reward_pool_item_id,
      rewardName: "Updated first pour",
      weight: 5,
      displayOrder: 7,
    })
    assert.equal(updated.saved_action, "reward_pool_item_updated")

    const [state] = await tx`
      select
        (
          select count(*)::int
          from public.reward_pool_items
          where merchant_id = ${fixture.merchantId}::uuid
            and loyalty_card_id = ${fixture.cardId}::uuid
            and is_active
        ) as active_reward_count,
        (
          select count(*)::int
          from public.qr_codes
          where merchant_id = ${fixture.merchantId}::uuid
            and loyalty_card_id = ${fixture.cardId}::uuid
            and destination_type = 'join'
            and is_active
        ) as active_join_qr_count,
        (
          select weight::int
          from public.reward_pool_items
          where id = ${first.reward_pool_item_id}::uuid
        ) as updated_weight,
        (
          select display_order::int
          from public.reward_pool_items
          where id = ${first.reward_pool_item_id}::uuid
        ) as updated_display_order`

    assert.equal(state.active_reward_count, 3)
    assert.equal(state.active_join_qr_count, 1)
    assert.equal(state.updated_weight, 5)
    assert.equal(state.updated_display_order, 7)

    await tx`
      update public.qr_codes
      set is_active = false
      where id = ${qr.qr_code_uuid}::uuid`

    const reenabled = await createOrGetJoinQr(tx, fixture)
    assert.equal(
      reenabled.qr_code_uuid,
      qr.qr_code_uuid,
      "disabled join QR is re-enabled in place"
    )

    const [audit] = await tx`
      select count(*)::int as n
      from public.audit_logs
      where merchant_id = ${fixture.merchantId}::uuid
        and target_table = 'reward_pool_items'
        and action in ('reward_pool_item_created', 'reward_pool_item_updated')`

    assert.equal(audit.n, 4)
  })
})

test("delete reward-pool RPC deletes unused rewards and archives rewards with ledger history", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const fixture = await createRewardPoolFixture(tx)
    await actAsMerchantOwner(tx, fixture.ownerUserId)

    const unused = await upsertRewardPoolItem(tx, fixture, {
      rewardName: "Unused reward",
      displayOrder: 1,
    })
    const used = await upsertRewardPoolItem(tx, fixture, {
      rewardName: "Issued reward",
      displayOrder: 2,
    })

    await insertIssuedRewardEvent(tx, fixture, used.reward_pool_item_id)

    const [deleted] = await tx`
      select *
      from public.delete_reward_pool_item(
        ${fixture.merchantId}::uuid,
        ${unused.reward_pool_item_id}::uuid
      )`
    assert.equal(deleted.deleted, true)

    const [archived] = await tx`
      select *
      from public.delete_reward_pool_item(
        ${fixture.merchantId}::uuid,
        ${used.reward_pool_item_id}::uuid
      )`
    assert.equal(archived.deleted, false)

    const [state] = await tx`
      select
        (
          select count(*)::int
          from public.reward_pool_items
          where id = ${unused.reward_pool_item_id}::uuid
        ) as unused_count,
        (
          select is_active
          from public.reward_pool_items
          where id = ${used.reward_pool_item_id}::uuid
        ) as used_is_active,
        (
          select count(*)::int
          from public.audit_logs
          where merchant_id = ${fixture.merchantId}::uuid
            and action in (
              'reward_pool_item_deleted',
              'reward_pool_item_archived'
            )
        ) as audit_count`

    assert.equal(state.unused_count, 0)
    assert.equal(state.used_is_active, false)
    assert.equal(state.audit_count, 2)
  })
})
