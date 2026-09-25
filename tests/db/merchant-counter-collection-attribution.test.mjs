import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { after, test } from "node:test"

import { closeDb, isLiveDbReady } from "./helpers/db.mjs"
import {
  closeVerificationDb,
  createIdCheckFixture,
  inVerificationTxn,
  verifyFixture,
} from "./helpers/merchant-id-verification.mjs"
import { asPostgrestRole } from "./helpers/postgrest-role.mjs"
import { createRewardPoolFixture } from "./helpers/reward-pool-fixture.mjs"

const skip = (await isLiveDbReady()) ? false : "local Supabase is not available"
after(async () => {
  await closeVerificationDb()
  await closeDb()
})

// Venue A checks photo ID (which verifies the account), then venue B holds a
// second unlocked reward for the same customer that needs no further ID check.
async function createCounterFixture(tx) {
  const venueA = await createIdCheckFixture(tx, "merchant_direct")
  await verifyFixture(tx, venueA)
  const venueB = await createRewardPoolFixture(tx)
  const [membership] = await tx`
    insert into public.customer_memberships(merchant_id, customer_id)
    values (${venueB.merchantId}::uuid, ${venueA.customerId}::uuid) returning id`
  const [reward] = await tx`
    insert into public.reward_events(
      merchant_id, customer_id, membership_id, loyalty_card_id, status, source,
      reward_name, reward_terms, redeemable_from, reward_policy_version, available_from
    ) values (
      ${venueB.merchantId}::uuid, ${venueA.customerId}::uuid, ${membership.id}::uuid,
      ${venueB.cardId}::uuid, 'unlocked', 'merchant_direct', 'Counter test reward',
      'One reward per member.', public.uk_business_date(now()), 'v2', now() - interval '1 minute'
    ) returning id`
  const [token] = await asPostgrestRole(
    tx,
    "service_role",
    {},
    (sp) => sp`
    select * from public.create_reward_scan_token(${reward.id}::uuid, ${venueA.customerId}::uuid)`
  )
  return {
    venueA,
    customerId: venueA.customerId,
    merchantId: venueB.merchantId,
    ownerUserId: venueB.ownerUserId,
    membershipId: membership.id,
    rewardEventId: reward.id,
    scanToken: token.scan_token,
  }
}

function collectAsOwner(tx, scanToken, ownerId, role = "authenticated") {
  return asPostgrestRole(
    tx,
    role,
    { sub: ownerId },
    (sp) => sp`
    select * from public.collect_owner_reward_scan_token(${scanToken}::uuid)`
  )
}

async function attribution(tx, rewardEventId) {
  const [row] = await tx`
    select
      rewards.status,
      rewards.metadata->>'redeemed_by' as redeemed_by,
      tokens.consumed_by_merchant_id,
      audit.actor_type as audit_actor_type,
      audit.actor_id as audit_actor_id,
      audit.merchant_id as audit_merchant_id,
      audit.metadata->>'collection_method' as collection_method,
      product.actor_type as product_actor_type,
      product.actor_id as product_actor_id,
      (select count(*)::int from private.merchant_counter_collection_receipts receipts
       where receipts.reward_event_id = rewards.id) as counter_receipts
    from public.reward_events rewards
    left join public.reward_scan_tokens tokens
      on tokens.reward_event_id = rewards.id and tokens.consumed_at is not null
    left join public.audit_logs audit
      on audit.target_id = rewards.id and audit.action = 'reward_redeemed'
    left join public.product_events product
      on product.event_name = 'reward_redeemed'
     and product.metadata->>'reward_id' = rewards.id::text
    where rewards.id = ${rewardEventId}::uuid`
  return row
}

test(
  "a plain counter collection is recorded as the signed-in owner, not customer self-service",
  { skip },
  async () => {
    await inVerificationTxn(async (tx) => {
      const f = await createCounterFixture(tx)
      const [collected] = await collectAsOwner(tx, f.scanToken, f.ownerUserId)
      assert.equal(collected.reward_event_id, f.rewardEventId)
      assert.deepEqual(await attribution(tx, f.rewardEventId), {
        status: "redeemed",
        redeemed_by: "merchant_scan",
        consumed_by_merchant_id: f.merchantId,
        audit_actor_type: "merchant",
        audit_actor_id: f.ownerUserId,
        audit_merchant_id: f.merchantId,
        collection_method: "owner_counter",
        product_actor_type: "merchant",
        product_actor_id: f.ownerUserId,
        counter_receipts: 1,
      })
      await assert.rejects(
        () => collectAsOwner(tx, f.scanToken, f.ownerUserId),
        /already collected/i
      )
    })
  }
)

test(
  "an ID-check collection keeps its owner attribution and writes no counter receipt",
  { skip },
  async () => {
    await inVerificationTxn(async (tx) => {
      const f = await createIdCheckFixture(tx)
      await verifyFixture(tx, f)
      assert.deepEqual(await attribution(tx, f.rewardEventId), {
        status: "redeemed",
        redeemed_by: "merchant_scan",
        consumed_by_merchant_id: f.merchantId,
        audit_actor_type: "merchant",
        audit_actor_id: f.ownerUserId,
        audit_merchant_id: f.merchantId,
        collection_method: "owner_id_check",
        product_actor_type: "merchant",
        product_actor_id: f.ownerUserId,
        counter_receipts: 0,
      })
    })
  }
)

test(
  "merchant A's owner cannot collect merchant B's reward, and nothing changes",
  { skip },
  async () => {
    await inVerificationTxn(async (tx) => {
      const f = await createCounterFixture(tx)
      await assert.rejects(
        () => collectAsOwner(tx, f.scanToken, f.venueA.ownerUserId),
        (error) =>
          error.code === "42501" &&
          error.message === "Reward not available to this merchant"
      )
      const state = await attribution(tx, f.rewardEventId)
      assert.equal(state.status, "unlocked")
      assert.equal(state.consumed_by_merchant_id, null)
      assert.equal(state.audit_actor_type, null)
      assert.equal(state.counter_receipts, 0)
    })
  }
)

test(
  "only an authenticated venue owner can call the owner collector",
  { skip },
  async () => {
    await inVerificationTxn(async (tx) => {
      const f = await createCounterFixture(tx)
      for (const caller of [
        { role: "anon", ownerId: "" },
        { role: "service_role", ownerId: "" },
        { role: "authenticated", ownerId: f.venueA.customerUserId },
        { role: "authenticated", ownerId: randomUUID() },
      ]) {
        await assert.rejects(
          () => collectAsOwner(tx, f.scanToken, caller.ownerId, caller.role),
          (error) => error.code === "42501"
        )
      }
      assert.equal((await attribution(tx, f.rewardEventId)).status, "unlocked")
    })
  }
)

test(
  "counter receipts cannot be forged, and a stray receipt does not make a customer redemption look like the owner",
  { skip },
  async () => {
    await inVerificationTxn(async (tx) => {
      const f = await createCounterFixture(tx)
      for (const role of ["service_role", "authenticated"]) {
        await assert.rejects(
          () =>
            asPostgrestRole(
              tx,
              role,
              { sub: f.ownerUserId },
              (sp) => sp`
        insert into private.merchant_counter_collection_receipts
          (reward_event_id, scan_token_id, customer_id, merchant_id, owner_user_id)
        values (${f.rewardEventId}::uuid, ${f.scanToken}::uuid, ${f.customerId}::uuid,
          ${f.merchantId}::uuid, ${f.ownerUserId}::uuid)`
            ),
          /permission denied/i
        )
      }
      // Even a receipt written in this transaction only counts for the owner
      // who is signed in; the customer's own redemption stays self-service.
      await tx`
        insert into private.merchant_counter_collection_receipts
          (reward_event_id, scan_token_id, customer_id, merchant_id, owner_user_id)
        values (${f.rewardEventId}::uuid, ${f.scanToken}::uuid, ${f.customerId}::uuid,
          ${f.merchantId}::uuid, ${f.ownerUserId}::uuid)`
      await asPostgrestRole(
        tx,
        "authenticated",
        { sub: f.venueA.customerUserId },
        (sp) => sp`
        select * from public.redeem_self_service_reward(${f.rewardEventId}::uuid, ${f.customerId}::uuid)`
      )
      const state = await attribution(tx, f.rewardEventId)
      assert.equal(state.redeemed_by, "self_service")
      assert.equal(state.audit_actor_type, "customer")
      assert.equal(state.audit_actor_id, f.venueA.customerUserId)
    })
  }
)

test(
  "the legacy service-role collector still works for the deployed app",
  { skip },
  async () => {
    await inVerificationTxn(async (tx) => {
      const f = await createCounterFixture(tx)
      const [collected] = await asPostgrestRole(
        tx,
        "service_role",
        {},
        (sp) => sp`
        select * from public.collect_current_reward_scan_token(${f.scanToken}::uuid, ${f.merchantId}::uuid)`
      )
      assert.equal(collected.reward_event_id, f.rewardEventId)
      const state = await attribution(tx, f.rewardEventId)
      assert.equal(state.status, "redeemed")
      assert.equal(state.consumed_by_merchant_id, f.merchantId)
      assert.equal(state.counter_receipts, 0)
    })
  }
)
