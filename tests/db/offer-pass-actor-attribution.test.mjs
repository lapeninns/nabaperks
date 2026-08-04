import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { after, test } from "node:test"

import { closeDb, db, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"
import { createRewardPoolFixture } from "./helpers/reward-pool-fixture.mjs"

/**
 * Who redeemed the discount pass.
 *
 * `redeem_offer_pass` has always accepted `p_actor_user_id` and written it to
 * `offer_redemptions.redeemed_by_user_id`, but the merchant boundary never sent
 * one — so every redemption recorded a null user and a generic 'merchant'
 * actor, and a venue could not tell which member of staff confirmed the ID
 * check and the no-stacking rule. That defeats the purpose of storing the
 * attestations at all: an unattributable attestation is not evidence.
 *
 * This suite proves the id reaches the ledger, the product event and the audit
 * log, and that a redemption without one is still recorded rather than refused
 * (the parameter is attribution, never authorisation).
 *
 * The other half of the fix — that `lib/merchant/offer-pass-redemption.ts`
 * actually passes the signed-in user — is pinned in
 * `tests/contracts/offer-pass-redemption-guards.test.mjs`.
 */

async function offerPassDbReady() {
  if (!(await isLiveDbReady())) return false
  try {
    const [{ n }] = await db()`
      select count(*)::int as n from pg_proc where proname in (
        'create_offer_pass_scan_token', 'redeem_offer_pass')`
    return n >= 2
  } catch {
    return false
  }
}

const ready = await offerPassDbReady()
const skip = ready
  ? false
  : "live Supabase DB with offer pass RPCs not reachable"

after(async () => {
  await closeDb()
})

/** A live campaign, a claim and the issued pass, written directly. */
async function issuePass(tx, fx) {
  const campaignId = randomUUID()
  const claimId = randomUUID()
  const entitlementId = randomUUID()

  await tx`
    insert into public.offer_campaigns (
      id, merchant_id, status, discount_percent, starts_on, ends_on,
      requires_id_check, published_at
    ) values (
      ${campaignId}::uuid, ${fx.merchantId}::uuid, 'live', 10,
      public.uk_business_date(now()) - 1, public.uk_business_date(now()) + 30,
      true, now()
    )`

  await tx`
    insert into public.offer_campaign_claims (
      id, campaign_id, merchant_id, customer_id, membership_id,
      bonus_stamps_awarded
    ) values (
      ${claimId}::uuid, ${campaignId}::uuid, ${fx.merchantId}::uuid,
      ${fx.customerId}::uuid, ${fx.membershipId}::uuid, 0
    )`

  await tx`
    insert into public.offer_discount_entitlements (
      id, claim_id, campaign_id, merchant_id, customer_id, membership_id,
      discount_percent, requires_id_check, status, valid_from, valid_to
    ) values (
      ${entitlementId}::uuid, ${claimId}::uuid, ${campaignId}::uuid,
      ${fx.merchantId}::uuid, ${fx.customerId}::uuid, ${fx.membershipId}::uuid,
      10, true, 'active',
      public.uk_business_date(now()) - 1, public.uk_business_date(now()) + 30
    )`

  return { campaignId, entitlementId }
}

async function mint(tx, entitlementId, customerId) {
  const [row] = await tx`
    select * from public.create_offer_pass_scan_token(
      ${entitlementId}::uuid, ${customerId}::uuid)`
  return row
}

async function redeemAs(tx, scanToken, merchantId, actorUserId) {
  const [row] = await tx`
    select * from public.redeem_offer_pass(
      ${scanToken}::uuid, ${merchantId}::uuid, true, true,
      ${actorUserId}::uuid)`
  return row
}

test(
  "the redeeming member of staff is recorded on the redemption",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fx = await createRewardPoolFixture(tx)
      const pass = await issuePass(tx, fx)
      const minted = await mint(tx, pass.entitlementId, fx.customerId)

      const result = await redeemAs(
        tx,
        minted.scan_token,
        fx.merchantId,
        fx.ownerUserId
      )

      const [row] = await tx`
        select redeemed_by_user_id, id_check_attested, no_stacking_attested
        from public.offer_redemptions where id = ${result.redemption_id}::uuid`

      // The attestations and the person who made them travel together, or the
      // attestations are worth nothing.
      assert.equal(row.redeemed_by_user_id, fx.ownerUserId)
      assert.equal(row.id_check_attested, true)
      assert.equal(row.no_stacking_attested, true)
    })
  }
)

test(
  "the same user is the actor on the product and audit records",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fx = await createRewardPoolFixture(tx)
      const pass = await issuePass(tx, fx)
      const minted = await mint(tx, pass.entitlementId, fx.customerId)

      const result = await redeemAs(
        tx,
        minted.scan_token,
        fx.merchantId,
        fx.ownerUserId
      )

      const [event] = await tx`
        select actor_type, actor_id from public.product_events
        where event_name = 'offer_pass_redeemed'
          and merchant_id = ${fx.merchantId}::uuid
        order by created_at desc limit 1`
      assert.equal(event.actor_type, "merchant")
      assert.equal(
        event.actor_id,
        fx.ownerUserId,
        "the product event must name the person, not the generic 'merchant'"
      )

      const [entry] = await tx`
        select actor_type, actor_id from public.audit_logs
        where target_table = 'offer_redemptions'
          and target_id = ${result.redemption_id}::uuid`
      assert.equal(entry.actor_type, "merchant")
      assert.equal(entry.actor_id, fx.ownerUserId)
    })
  }
)

test(
  "an unattributed redemption is still recorded, never refused",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fx = await createRewardPoolFixture(tx)
      const pass = await issuePass(tx, fx)
      const minted = await mint(tx, pass.entitlementId, fx.customerId)

      // p_actor_user_id is attribution, not authorisation: the merchant id is
      // what proves the venue may redeem. A session that cannot name a user
      // must still be able to honour the customer's pass at the counter.
      const result = await redeemAs(tx, minted.scan_token, fx.merchantId, null)

      const [row] = await tx`
        select redeemed_by_user_id from public.offer_redemptions
        where id = ${result.redemption_id}::uuid`
      assert.equal(row.redeemed_by_user_id, null)

      const [event] = await tx`
        select actor_id from public.product_events
        where event_name = 'offer_pass_redeemed'
          and merchant_id = ${fx.merchantId}::uuid
        order by created_at desc limit 1`
      assert.equal(event.actor_id, "merchant")
    })
  }
)
