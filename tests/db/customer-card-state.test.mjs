import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { after, test } from "node:test"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"

/**
 * get_customer_card_state — live-DB tier.
 *
 * The one-hop card read must prove ownership before it reads any detail,
 * keep `not_found` distinct from `unauthorized`, and pick the same loyalty
 * card the home dashboard picks.
 */

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(async () => {
  await closeDb()
})

async function fixture(tx) {
  const [merchant] = await tx`
    select m.id, m.business_name, m.business_slug, m.status
    from public.merchants m
    where m.status in ('trial', 'active')
      and exists (select 1 from public.merchant_locations l where l.merchant_id = m.id)
    order by m.created_at
    limit 1`
  assert.ok(merchant, "a seeded merchant with a location is available")
  const [location] = await tx`select id from public.merchant_locations
    where merchant_id = ${merchant.id}::uuid order by created_at limit 1`
  const [owner] =
    await tx`insert into public.customers (email, email_verified_at)
    values (${`card-owner-${randomUUID()}@test.local`}, now()) returning id`
  const [stranger] =
    await tx`insert into public.customers (email, email_verified_at)
    values (${`card-stranger-${randomUUID()}@test.local`}, now()) returning id`
  const [membership] = await tx`
    insert into public.customer_memberships (merchant_id, customer_id)
    values (${merchant.id}::uuid, ${owner.id}::uuid) returning id`
  return { merchant, locationId: location.id, owner, stranger, membership }
}

async function state(tx, membershipId, customerId) {
  const [{ get_customer_card_state: result }] = await tx`
    select public.get_customer_card_state(${membershipId}::uuid, ${customerId}::uuid)`
  return result
}

async function expectedCard(tx, merchantId) {
  const [card] = await tx`select card_name, stamps_required, reward_name,
      reward_terms, is_active
    from public.loyalty_cards
    where merchant_id = ${merchantId}::uuid
    order by is_active desc, created_at asc
    limit 1`
  return card ?? null
}

test(
  "card state: the owner receives a ready card that matches direct reads",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const { merchant, owner, membership } = await fixture(tx)

      const result = await state(tx, membership.id, owner.id)
      assert.equal(result.status, "ready")
      assert.equal(result.membership.id, membership.id)
      assert.equal(result.membership.customer_id, owner.id)
      assert.equal(result.membership.merchant_id, merchant.id)
      assert.equal(result.merchant.business_name, merchant.business_name)
      assert.equal(result.merchant.business_slug, merchant.business_slug)
      assert.equal(result.merchant.status, merchant.status)
      assert.deepEqual(result.loyalty_card, await expectedCard(tx, merchant.id))
      const rewardIds = await tx`select id from public.reward_events
      where membership_id = ${membership.id}::uuid and status = 'unlocked'
      order by created_at desc`
      assert.deepEqual(
        result.unlocked_rewards.map((reward) => reward.id),
        rewardIds.map((row) => row.id)
      )
      const [billing] = await tx`select status from public.billing_customers
      where merchant_id = ${merchant.id}::uuid`
      assert.equal(result.billing_status, billing?.status ?? null)
    })
  }
)

test(
  "card state: the card selection matches the home dashboard, including a merchant with no active card",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const { merchant, locationId, owner, membership } = await fixture(tx)
      await tx`update public.loyalty_cards set is_active = false
      where merchant_id = ${merchant.id}::uuid`
      await tx`insert into public.loyalty_cards (
        merchant_id, location_id, card_name, stamps_required, reward_name,
        reward_terms, is_active, created_at
      ) values
      (${merchant.id}::uuid, ${locationId}::uuid, 'Older inactive', 5, 'A', 'a', false, now() - interval '2 days'),
      (${merchant.id}::uuid, ${locationId}::uuid, 'Newer active', 5, 'B', 'b', true, now() - interval '1 day')`

      const active = await state(tx, membership.id, owner.id)
      assert.equal(active.loyalty_card.card_name, "Newer active")
      assert.deepEqual(active.loyalty_card, await expectedCard(tx, merchant.id))

      await tx`update public.loyalty_cards set is_active = false
      where merchant_id = ${merchant.id}::uuid and card_name = 'Newer active'`
      const none = await state(tx, membership.id, owner.id)
      assert.deepEqual(none.loyalty_card, await expectedCard(tx, merchant.id))
      assert.equal(none.loyalty_card.is_active, false)
    })
  }
)

test(
  "card state: a stranger and an unknown id receive a bare status only",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const { stranger, membership } = await fixture(tx)

      const unauthorized = await state(tx, membership.id, stranger.id)
      assert.deepEqual(unauthorized, { status: "unauthorized" })

      const missing = await state(tx, randomUUID(), stranger.id)
      assert.deepEqual(missing, { status: "not_found" })

      const [{ get_customer_card_state: nullCustomer }] = await tx`
      select public.get_customer_card_state(${membership.id}::uuid, null)`
      assert.deepEqual(nullCustomer, { status: "unauthorized" })
    })
  }
)

test("card state: service role only", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const [row] = await tx`select
      has_function_privilege('public', 'public.get_customer_card_state(uuid,uuid)', 'execute') as public_can,
      has_function_privilege('anon', 'public.get_customer_card_state(uuid,uuid)', 'execute') as anon_can,
      has_function_privilege('authenticated', 'public.get_customer_card_state(uuid,uuid)', 'execute') as authenticated_can,
      has_function_privilege('service_role', 'public.get_customer_card_state(uuid,uuid)', 'execute') as service_can`
    assert.equal(row.public_can, false)
    assert.equal(row.anon_can, false)
    assert.equal(row.authenticated_can, false)
    assert.equal(row.service_can, true)

    const { owner, membership } = await fixture(tx)
    await assert.rejects(
      () =>
        tx.savepoint(async (sp) => {
          await sp`select set_config('request.jwt.claim.role', 'authenticated', true)`
          await sp`select public.get_customer_card_state(
            ${membership.id}::uuid, ${owner.id}::uuid)`
        }),
      /service role required/i
    )
  })
})
