import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { after, describe, it } from "node:test"

import {
  actAsMerchantOwner,
  createOrGetJoinQr,
  createRewardPoolFixture,
  expectRewardPoolRpcRejection,
  isRewardPoolDbReady,
  upsertRewardPoolItem,
} from "./helpers/reward-pool-fixture.mjs"
import { closeDb, inRolledBackTxn } from "./helpers/db.mjs"

async function expectDbRejection(tx, action, pattern, message) {
  let rejected = false

  try {
    await tx.savepoint(async (sp) => {
      await action(sp)
    })
  } catch (error) {
    rejected = pattern.test(String(error.message))
  }

  assert.ok(rejected, message)
}

describe("merchant multi-location RLS/RPC behaviour", () => {
  after(async () => {
    await closeDb()
  })

  it("keeps second-location provisioning owner-scoped and location-derived", async (t) => {
    if (!(await isRewardPoolDbReady())) {
      t.skip("SUPABASE_DB_URL or reward-pool RPCs are not available")
      return
    }

    await inRolledBackTxn(async (tx) => {
      const fixture = await createRewardPoolFixture(tx)
      const secondLocationId = randomUUID()
      const secondCardId = randomUUID()

      await actAsMerchantOwner(tx, fixture.ownerUserId)

      const primaryRewards = await Promise.all([
        upsertRewardPoolItem(tx, fixture, {
          rewardName: "Primary pint",
          displayOrder: 0,
        }),
        upsertRewardPoolItem(tx, fixture, {
          rewardName: "Primary starter",
          displayOrder: 1,
        }),
        upsertRewardPoolItem(tx, fixture, {
          rewardName: "Primary dessert",
          displayOrder: 2,
        }),
      ])
      assert.equal(primaryRewards.length, 3)

      const primaryQr = await createOrGetJoinQr(tx, fixture)

      await tx`
        insert into public.merchant_locations (
          id,
          merchant_id,
          name,
          address,
          latitude,
          longitude,
          geofence_radius_meters,
          require_geofence,
          is_primary,
          soft_geofence_trigger_stamp_number
        )
        values (
          ${secondLocationId}::uuid,
          ${fixture.merchantId}::uuid,
          'Second Test Venue',
          '2 Reward Street',
          52.208,
          0.122,
          100,
          false,
          false,
          3
        )`

      await tx`
        insert into public.loyalty_cards (
          id,
          merchant_id,
          location_id,
          card_name,
          stamps_required,
          reward_name,
          reward_terms,
          is_active
        )
        select
          ${secondCardId}::uuid,
          merchant_id,
          ${secondLocationId}::uuid,
          card_name,
          stamps_required,
          reward_name,
          reward_terms,
          true
        from public.loyalty_cards
        where id = ${fixture.cardId}::uuid`

      await expectRewardPoolRpcRejection(
        tx,
        (sp) =>
          createOrGetJoinQr(sp, {
            ...fixture,
            locationId: secondLocationId,
            cardId: secondCardId,
          }),
        /3 active mystery rewards/i,
        "second location join QR must be blocked until the cloned card has at least 3 active rewards"
      )

      const secondFixture = {
        ...fixture,
        locationId: secondLocationId,
        cardId: secondCardId,
      }

      await Promise.all([
        upsertRewardPoolItem(tx, secondFixture, {
          rewardName: "Second pint",
          displayOrder: 0,
        }),
        upsertRewardPoolItem(tx, secondFixture, {
          rewardName: "Second starter",
          displayOrder: 1,
        }),
        upsertRewardPoolItem(tx, secondFixture, {
          rewardName: "Second dessert",
          displayOrder: 2,
        }),
      ])

      const [{ reward_count: rewardCount }] = await tx`
        select count(*)::int as reward_count
        from public.reward_pool_items
        where merchant_id = ${fixture.merchantId}::uuid
          and location_id = ${secondLocationId}::uuid
          and loyalty_card_id = ${secondCardId}::uuid`
      assert.equal(rewardCount, 3)

      const secondQr = await createOrGetJoinQr(tx, secondFixture)
      assert.notEqual(secondQr.qr_code_uuid, primaryQr.qr_code_uuid)
      assert.notEqual(secondQr.qr_public_id, primaryQr.qr_public_id)

      await expectDbRejection(
        tx,
        (sp) => sp`
          insert into public.loyalty_cards (
            merchant_id,
            location_id,
            card_name,
            stamps_required,
            reward_name,
            reward_terms,
            is_active
          )
          values (
            ${fixture.merchantId}::uuid,
            ${secondLocationId}::uuid,
            'Duplicate active card',
            3,
            'Duplicate reward',
            'Subject to house rules.',
            true
          )`,
        /loyalty_cards_one_active_per_location_idx/i,
        "a second active card for the same location must be rejected"
      )

      const otherOwnerUserId = randomUUID()
      const otherMerchantId = randomUUID()
      const otherRunId = randomUUID().slice(0, 8)

      await tx`
        insert into auth.users (id)
        values (${otherOwnerUserId}::uuid)`
      await tx`
        insert into public.merchants (
          id,
          owner_user_id,
          business_name,
          business_slug,
          business_type,
          email,
          status,
          requires_billing
        )
        values (
          ${otherMerchantId}::uuid,
          ${otherOwnerUserId}::uuid,
          'Other Pub',
          ${`other-pub-${otherRunId}`},
          'pub',
          ${`other-pub-${otherRunId}@example.test`},
          'active',
          false
        )`

      await expectDbRejection(
        tx,
        async (sp) => {
          await sp`set local role authenticated`
          await sp`select set_config('request.jwt.claim.role', 'authenticated', true)`
          await sp`select set_config('request.jwt.claim.sub', ${fixture.ownerUserId}, true)`
          await sp`
          insert into public.merchant_locations (
            merchant_id,
            name,
            address,
            latitude,
            longitude,
            geofence_radius_meters,
            require_geofence,
            is_primary,
            soft_geofence_trigger_stamp_number
          )
          values (
            ${otherMerchantId}::uuid,
            'Cross Tenant Venue',
            '3 Reward Street',
            52.21,
            0.13,
            100,
            false,
            false,
            3
          )`
          await sp`reset role`
        },
        /row-level security|violates row-level|new row violates row-level security policy/i,
        "current merchant owner must not insert locations for a different merchant"
      )
    })
  })
})
