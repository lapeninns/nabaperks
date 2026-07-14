import { after, test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"

/**
 * referral retry outbox — live-DB invariant tier (primary proof).
 *
 * Proves the transactional outbox (referral_attributed / qualified / bonus_held /
 * bonus_awarded / bonus_failed) + deduped member notifications, and the
 * event-driven retry triggers (settle a held bonus when the referrer's stamp count
 * changes or a merchant replenishes rewards) without recursion. Covers RO-1…RO-10.
 */

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(closeDb)

const PICK_QR = /* sql */ `
  select q.qr_id, m.business_slug, m.id as merchant_id
  from public.qr_codes q join public.merchants m on m.id = q.merchant_id
  where q.is_active and q.destination_type = 'join' and m.status in ('trial', 'active')
    and (m.requires_billing = false or exists (
      select 1 from public.billing_customers bc
      where bc.merchant_id = m.id and bc.status in ('trialing', 'active')))
  order by q.created_at limit 1`

const PICK_QR_REWARDS = /* sql */ `
  select q.qr_id, m.business_slug, m.id as merchant_id, lc.id as loyalty_card_id, lc.stamps_required
  from public.qr_codes q join public.merchants m on m.id = q.merchant_id
  join public.loyalty_cards lc on lc.merchant_id = m.id and lc.is_active
  where q.is_active and q.destination_type = 'join' and m.status in ('trial', 'active')
    and lc.stamps_required > 1
    and (select count(*) from public.reward_pool_items rpi where rpi.loyalty_card_id = lc.id and rpi.is_active) >= 3
    and (m.requires_billing = false or exists (
      select 1 from public.billing_customers bc
      where bc.merchant_id = m.id and bc.status in ('trialing', 'active')))
  order by q.created_at limit 1`

async function makeCustomer(tx) {
  const [c] = await tx`
    insert into public.customers (email, email_verified_at, created_at, updated_at)
    values (${`ro-${randomUUID()}@test.local`}, now(), now(), now()) returning id`
  return c.id
}
async function joinNoStamp(tx, customerId, slug, ref = null) {
  const [row] = await tx`
    select * from public.join_customer_membership_with_first_stamp(
      ${customerId}::uuid, ${slug}, null, false, '2026-06-06', null, null, ${ref})`
  return row
}
async function joinWithStamp(tx, customerId, slug, qrId) {
  const [row] = await tx`
    select * from public.join_customer_membership_with_first_stamp(
      ${customerId}::uuid, ${slug}, ${qrId}, false, '2026-06-06', null, null, null)`
  return row
}
async function codeFor(tx, membershipId) {
  const [{ referral_code }] = await tx`select referral_code from public.customer_memberships where id = ${membershipId}`
  return referral_code
}
async function cardFor(tx, merchantId) {
  const [card] = await tx`
    select id, location_id, stamps_required from public.loyalty_cards
    where merchant_id = ${merchantId} and is_active order by created_at asc limit 1`
  return card
}
async function insertFriendVisit(tx, s, card) {
  const [row] = await tx`
    insert into public.stamp_events (merchant_id, customer_id, membership_id, loyalty_card_id, location_id,
      event_type, stamps_delta, earned_business_date, cycle_number, metadata)
    values (${s.merchantId}::uuid, ${s.friendCustomer}::uuid, ${s.friend.membership_id}::uuid, ${card.id}::uuid,
      ${card.location_id}, 'earned', 1, public.uk_business_date(now()), 1, jsonb_build_object('source','merchant_qr_action'))
    returning id`
  return row.id
}
async function edgeRow(tx, referredMembershipId) {
  const [row] = await tx`
    select id, status, hold_reason from public.referrals where referred_membership_id = ${referredMembershipId}`
  return row
}
async function bonusStamps(tx, membershipId) {
  return tx`select id from public.stamp_events where membership_id = ${membershipId}
    and event_type = 'earned' and metadata->>'source' = 'referral_bonus'`
}
async function notifCount(tx, membershipId, eventType) {
  const [{ n }] = await tx`select count(*)::int as n from public.notification_events
    where membership_id = ${membershipId} and event_type = ${eventType}`
  return n
}
async function eventCount(tx, edgeId, eventName) {
  const [{ n }] = await tx`select count(*)::int as n from public.product_events
    where event_name = ${eventName} and metadata->>'referral_edge_id' = ${edgeId}::text`
  return n
}

// Referrer (no same-day stamp) + friend qualified, ready to settle/hold.
async function seedQualified(tx, qr) {
  const referrerCustomer = await makeCustomer(tx)
  const referrer = await joinNoStamp(tx, referrerCustomer, qr.business_slug, null)
  const code = await codeFor(tx, referrer.membership_id)
  const friendCustomer = await makeCustomer(tx)
  const friend = await joinNoStamp(tx, friendCustomer, qr.business_slug, code)
  const s = { referrerCustomer, referrer, friendCustomer, friend, code, merchantId: qr.merchant_id }
  s.card = await cardFor(tx, qr.merchant_id)
  const stampId = await insertFriendVisit(tx, s, s.card)
  await tx`select public.qualify_referral_on_stamp(${friend.membership_id}::uuid, ${stampId}::uuid)`
  s.edgeId = (await edgeRow(tx, friend.membership_id)).id
  return s
}

test("RO-1/RO-6: creating an edge writes referral_attributed + one deduped friend-joined notification", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const [qr] = await tx.unsafe(PICK_QR)
    assert.ok(qr, "an active join QR exists")
    const referrerCustomer = await makeCustomer(tx)
    const referrer = await joinNoStamp(tx, referrerCustomer, qr.business_slug, null)
    const code = await codeFor(tx, referrer.membership_id)
    const friendCustomer = await makeCustomer(tx)
    const friend = await joinNoStamp(tx, friendCustomer, qr.business_slug, code)
    const e = await edgeRow(tx, friend.membership_id)

    assert.equal(await eventCount(tx, e.id, "referral_attributed"), 1, "one referral_attributed event (RO-1)")
    assert.equal(await notifCount(tx, referrer.membership_id, "referral_friend_joined"), 1, "one friend-joined notification (RO-1)")
    const [notification] = await tx`
      select payload from public.notification_events
      where membership_id = ${referrer.membership_id}
        and event_type = 'referral_friend_joined'`
    assert.equal(notification.payload.title, "Your friend joined", "SQL outbox includes referral title")
    assert.ok(notification.payload.body.includes("just joined"), "SQL outbox includes referral body")
    assert.ok(notification.payload.tag, "SQL outbox includes a stable tag")
    assert.equal(notification.payload.eventType, "referral_friend_joined", "SQL outbox includes event type")
  })
})

test("RO-2/RO-3/RO-4/RO-6: qualified, held, and awarded each notify the referrer once", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const [qr] = await tx.unsafe(PICK_QR)
    const s = await seedQualified(tx, qr)
    assert.equal(await notifCount(tx, s.referrer.membership_id, "referral_qualified"), 1, "one referral_qualified notification (RO-2)")

    // Full card → hold → bonus-saved notification.
    await tx`update public.customer_memberships set current_stamp_count = ${s.card.stamps_required} where id = ${s.referrer.membership_id}`
    await tx`select public.settle_referral_bonus(${s.edgeId}::uuid)`
    assert.equal((await edgeRow(tx, s.friend.membership_id)).status, "held", "edge held")
    assert.equal(await notifCount(tx, s.referrer.membership_id, "referral_bonus_saved"), 1, "one bonus-saved notification (RO-3)")

    // Repeated hold does not double-notify (RO-6).
    await tx`select public.settle_referral_bonus(${s.edgeId}::uuid)`
    assert.equal(await notifCount(tx, s.referrer.membership_id, "referral_bonus_saved"), 1, "bonus-saved deduped (RO-6)")

    // Free room, settle → awarded notification (RO-4).
    await tx`update public.customer_memberships set current_stamp_count = 0 where id = ${s.referrer.membership_id}`
    await tx`select public.settle_referral_bonus(${s.edgeId}::uuid)`
    assert.equal((await edgeRow(tx, s.friend.membership_id)).status, "awarded", "edge awarded")
    assert.equal(await notifCount(tx, s.referrer.membership_id, "referral_bonus_stamp_issued"), 1, "one awarded notification (RO-4)")
  })
})

test("RO-5: an unexpected settlement error emits referral_bonus_failed distinct from held", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const [qr] = await tx.unsafe(PICK_QR)
    const s = await seedQualified(tx, qr)
    await tx`alter table public.stamp_events add constraint tmp_block_bonus
             check (coalesce(metadata->>'source','') <> 'referral_bonus') not valid`
    await tx`select public.settle_referral_bonus(${s.edgeId}::uuid)`
    const e = await edgeRow(tx, s.friend.membership_id)
    assert.equal(e.hold_reason, "temporary_processing_error", "held on error")
    assert.equal(await eventCount(tx, s.edgeId, "referral_bonus_failed"), 1, "one referral_bonus_failed event (RO-5)")
    assert.ok(await eventCount(tx, s.edgeId, "referral_bonus_held") >= 1, "and a held event too (RO-5)")
  })
})

test("RO-7: a held card_full bonus settles on the referrer's next venue visit (stamp ordering)", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const [qr] = await tx.unsafe(PICK_QR)
    const s = await seedQualified(tx, qr) // referrer joined without a same-day stamp
    // Full card → hold card_full.
    await tx`update public.customer_memberships set current_stamp_count = ${s.card.stamps_required} where id = ${s.referrer.membership_id}`
    await tx`select public.settle_referral_bonus(${s.edgeId}::uuid)`
    assert.equal((await edgeRow(tx, s.friend.membership_id)).status, "held", "held on the full card")

    // Room frees and the referrer makes their next visit: the settlement stamp
    // ordering hook settles the owed bonus before their own stamp — exactly once.
    await tx`update public.customer_memberships set current_stamp_count = 0 where id = ${s.referrer.membership_id}`
    await tx`select * from public.issue_self_service_stamp(
      ${s.referrer.membership_id}::uuid, ${s.referrerCustomer}::uuid, ${qr.qr_id}, null, null)`
    assert.equal((await bonusStamps(tx, s.referrer.membership_id)).length, 1, "the held bonus settled on the visit (RO-7)")
    assert.equal((await edgeRow(tx, s.friend.membership_id)).status, "awarded", "edge awarded once")
  })
})

test("RO-9: replenishing the reward pool settles a reward_unavailable hold", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const [qr] = await tx.unsafe(PICK_QR_REWARDS)
    if (!qr) return // no rewards-rich multi-stamp card seeded
    const s = await seedQualified(tx, qr)
    // Completing bonus, but the pool is emptied → hold reward_unavailable.
    await tx`update public.customer_memberships set current_stamp_count = ${qr.stamps_required - 1} where id = ${s.referrer.membership_id}`
    await tx`update public.reward_pool_items set is_active = false where loyalty_card_id = ${qr.loyalty_card_id}::uuid`
    await tx`select public.settle_referral_bonus(${s.edgeId}::uuid)`
    assert.equal((await edgeRow(tx, s.friend.membership_id)).hold_reason, "reward_unavailable", "held reward_unavailable")

    // Merchant re-activates the pool → the retry trigger settles the held bonus.
    await tx`update public.reward_pool_items set is_active = true where loyalty_card_id = ${qr.loyalty_card_id}::uuid`
    assert.equal((await bonusStamps(tx, s.referrer.membership_id)).length, 1, "the held bonus settled on replenish (RO-9)")
    assert.equal((await edgeRow(tx, s.friend.membership_id)).status, "awarded", "edge awarded")
  })
})

test("review hardening: a bonus that completes the card survives the QR transaction", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const [qr] = await tx.unsafe(PICK_QR_REWARDS)
    if (!qr) return
    const s = await seedQualified(tx, qr)
    await tx`update public.customer_memberships
      set current_stamp_count = ${qr.stamps_required - 1}
      where id = ${s.referrer.membership_id}`

    const [result] = await tx`select * from public.issue_self_service_stamp(
      ${s.referrer.membership_id}::uuid, ${s.referrerCustomer}::uuid, ${qr.qr_id}, null, null)`

    assert.equal(result.reward_unlocked, true, "the scan reports the reward unlocked by the bonus")
    assert.equal((await bonusStamps(tx, s.referrer.membership_id)).length, 1, "the completing bonus is not rolled back")
    assert.equal((await edgeRow(tx, s.friend.membership_id)).status, "awarded", "the referral remains awarded")
    const [{ n: visits }] = await tx`
      select count(*)::int as n from public.stamp_events
      where membership_id = ${s.referrer.membership_id}
        and event_type = 'earned'
        and coalesce(metadata->>'source', '') <> 'referral_bonus'`
    assert.equal(visits, 0, "the wrapper stops before adding a visit stamp to the completed card")
  })
})
