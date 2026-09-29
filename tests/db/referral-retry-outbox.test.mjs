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
    insert into public.customers (email, email_verified_at, phone_hmac, phone_last4, phone_verified_at, created_at, updated_at)
    values (${`ro-${randomUUID()}@test.local`}, now(), encode(extensions.gen_random_bytes(32), 'hex'), '0123', now(), now(), now()) returning id`
  return c.id
}
async function joinNoStamp(tx, customerId, slug, ref = null) {
  const [row] = await tx`
    select * from public.join_customer_membership_with_first_stamp(
      ${customerId}::uuid, ${slug}, null, false, '2026-06-06', null, null, ${ref})`
  return row
}
async function codeFor(tx, membershipId) {
  const [{ referral_code }] =
    await tx`select referral_code from public.customer_memberships where id = ${membershipId}`
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
  const [{ n }] =
    await tx`select count(*)::int as n from public.notification_events
    where membership_id = ${membershipId} and event_type = ${eventType}`
  return n
}
async function eventCount(tx, edgeId, eventName) {
  const [{ n }] = await tx`select count(*)::int as n from public.product_events
    where event_name = ${eventName} and metadata->>'referral_edge_id' = ${edgeId}::text`
  return n
}

async function fillReferrerToOneShort(tx, seeded, merchantId) {
  const [card] = await tx`
    select id, location_id, stamps_required from public.loyalty_cards
    where merchant_id = ${merchantId}::uuid and is_active
    order by created_at asc limit 1`
  const [{ earned }] = await tx`
    select count(*)::integer as earned from public.stamp_events
    where membership_id = ${seeded.referrer.membership_id}::uuid
      and event_type = 'earned' and cycle_number = 1`
  const missing = card.stamps_required - Number(earned) - 1
  assert.ok(missing >= 0, "fixture starts before the completing stamp")
  await tx`
    insert into public.stamp_events (
      merchant_id, customer_id, membership_id, loyalty_card_id, location_id,
      event_type, stamps_delta, earned_business_date, cycle_number, metadata
    )
    select ${merchantId}::uuid, ${seeded.referrerCustomer}::uuid,
           ${seeded.referrer.membership_id}::uuid, ${card.id}::uuid,
           ${card.location_id}::uuid, 'earned', 1, null, 1,
           jsonb_build_object('source', 'referral_completion_fixture')
    from generate_series(1, ${missing}::integer)`
  await tx`
    update public.customer_memberships
    set current_stamp_count = ${card.stamps_required - 1},
        total_stamps_earned = total_stamps_earned + ${missing}
    where id = ${seeded.referrer.membership_id}::uuid`
  return card
}

// Referrer (no same-day stamp) + friend qualified, ready to settle/hold.
async function seedQualified(tx, qr) {
  const referrerCustomer = await makeCustomer(tx)
  const referrer = await joinNoStamp(
    tx,
    referrerCustomer,
    qr.business_slug,
    null
  )
  const code = await codeFor(tx, referrer.membership_id)
  const friendCustomer = await makeCustomer(tx)
  const friend = await joinNoStamp(tx, friendCustomer, qr.business_slug, code)
  const s = {
    referrerCustomer,
    referrer,
    friendCustomer,
    friend,
    code,
    merchantId: qr.merchant_id,
  }
  s.card = await cardFor(tx, qr.merchant_id)
  const stampId = await insertFriendVisit(tx, s, s.card)
  await tx`select public.qualify_referral_on_stamp(${friend.membership_id}::uuid, ${stampId}::uuid)`
  s.edgeId = (await edgeRow(tx, friend.membership_id)).id
  return s
}

test(
  "RO-1/RO-6: creating an edge writes referral_attributed + one deduped friend-joined notification",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [qr] = await tx.unsafe(PICK_QR)
      assert.ok(qr, "an active join QR exists")
      const referrerCustomer = await makeCustomer(tx)
      const referrer = await joinNoStamp(
        tx,
        referrerCustomer,
        qr.business_slug,
        null
      )
      const code = await codeFor(tx, referrer.membership_id)
      const friendCustomer = await makeCustomer(tx)
      const friend = await joinNoStamp(
        tx,
        friendCustomer,
        qr.business_slug,
        code
      )
      const e = await edgeRow(tx, friend.membership_id)

      assert.equal(
        await eventCount(tx, e.id, "referral_attributed"),
        1,
        "one referral_attributed event (RO-1)"
      )
      assert.equal(
        await notifCount(tx, referrer.membership_id, "referral_friend_joined"),
        1,
        "one friend-joined notification (RO-1)"
      )
      const [notification] = await tx`
      select payload from public.notification_events
      where membership_id = ${referrer.membership_id}
        and event_type = 'referral_friend_joined'`
      assert.equal(
        notification.payload.title,
        "Your friend joined",
        "SQL outbox includes referral title"
      )
      assert.ok(
        notification.payload.body.includes("just joined"),
        "SQL outbox includes referral body"
      )
      assert.ok(notification.payload.tag, "SQL outbox includes a stable tag")
      assert.equal(
        notification.payload.eventType,
        "referral_friend_joined",
        "SQL outbox includes event type"
      )
    })
  }
)

test(
  "RO-2/RO-3/RO-4/RO-6: qualified, held, and awarded each notify the referrer once",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [qr] = await tx.unsafe(PICK_QR)
      const s = await seedQualified(tx, qr)
      assert.equal(
        await notifCount(tx, s.referrer.membership_id, "referral_qualified"),
        1,
        "one referral_qualified notification (RO-2)"
      )

      const card = await fillReferrerToOneShort(tx, s, qr.merchant_id)
      await tx`update public.reward_pool_items set is_active = false
        where loyalty_card_id = ${card.id}::uuid`
      await tx`select public.settle_referral_bonus(${s.edgeId}::uuid)`
      assert.equal(
        (await edgeRow(tx, s.friend.membership_id)).status,
        "held",
        "edge held"
      )
      assert.equal(
        await notifCount(tx, s.referrer.membership_id, "referral_bonus_saved"),
        1,
        "one bonus-saved notification (RO-3)"
      )

      // Repeated hold does not double-notify (RO-6).
      await tx`select public.settle_referral_bonus(${s.edgeId}::uuid)`
      assert.equal(
        await notifCount(tx, s.referrer.membership_id, "referral_bonus_saved"),
        1,
        "bonus-saved deduped (RO-6)"
      )

      await tx`update public.reward_pool_items set is_active = true
        where loyalty_card_id = ${card.id}::uuid`
      await tx`select public.settle_referral_bonus(${s.edgeId}::uuid)`
      assert.equal(
        (await edgeRow(tx, s.friend.membership_id)).status,
        "awarded",
        "edge awarded"
      )
      assert.equal(
        await notifCount(
          tx,
          s.referrer.membership_id,
          "referral_bonus_stamp_issued"
        ),
        1,
        "one awarded notification (RO-4)"
      )
    })
  }
)

test(
  "RO-5: an unexpected settlement error emits referral_bonus_failed distinct from held",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [qr] = await tx.unsafe(PICK_QR)
      const s = await seedQualified(tx, qr)
      await tx`alter table public.stamp_events add constraint tmp_block_bonus
             check (coalesce(metadata->>'source','') <> 'referral_bonus') not valid`
      await tx`select public.settle_referral_bonus(${s.edgeId}::uuid)`
      const e = await edgeRow(tx, s.friend.membership_id)
      assert.equal(e.hold_reason, "temporary_processing_error", "held on error")
      assert.equal(
        await eventCount(tx, s.edgeId, "referral_bonus_failed"),
        1,
        "one referral_bonus_failed event (RO-5)"
      )
      assert.ok(
        (await eventCount(tx, s.edgeId, "referral_bonus_held")) >= 1,
        "and a held event too (RO-5)"
      )
    })
  }
)

test(
  "RO-7: a due processing hold settles before the next venue visit",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [qr] = await tx.unsafe(PICK_QR)
      const s = await seedQualified(tx, qr) // referrer joined without a same-day stamp
      await tx`select public.hold_referral_bonus(
        ${s.edgeId}::uuid, 'temporary_processing_error', 'retry fixture')`
      assert.equal(
        (await edgeRow(tx, s.friend.membership_id)).status,
        "held",
        "held for retry"
      )

      await tx`update public.referrals set next_retry_at = now() - interval '1 minute'
        where id = ${s.edgeId}::uuid`
      await tx`select * from public.issue_self_service_stamp(
      ${s.referrer.membership_id}::uuid, ${s.referrerCustomer}::uuid, ${qr.qr_id}, null, null)`
      assert.equal(
        (await bonusStamps(tx, s.referrer.membership_id)).length,
        1,
        "the held bonus settled on the visit (RO-7)"
      )
      assert.equal(
        (await edgeRow(tx, s.friend.membership_id)).status,
        "awarded",
        "edge awarded once"
      )
    })
  }
)

test(
  "RO-9: replenishing the reward pool settles a reward_unavailable hold",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [qr] = await tx.unsafe(PICK_QR_REWARDS)
      assert.ok(qr, "a reward-backed card exists")
      const s = await seedQualified(tx, qr)
      // Completing bonus, but the pool is emptied → hold reward_unavailable.
      await fillReferrerToOneShort(tx, s, qr.merchant_id)
      await tx`update public.reward_pool_items set is_active = false where loyalty_card_id = ${qr.loyalty_card_id}::uuid`
      await tx`select public.settle_referral_bonus(${s.edgeId}::uuid)`
      assert.equal(
        (await edgeRow(tx, s.friend.membership_id)).hold_reason,
        "reward_unavailable",
        "held reward_unavailable"
      )

      // Merchant re-activates the pool → the retry trigger settles the held bonus.
      await tx`update public.reward_pool_items set is_active = true where loyalty_card_id = ${qr.loyalty_card_id}::uuid`
      assert.equal(
        (await bonusStamps(tx, s.referrer.membership_id)).length,
        1,
        "the held bonus settled on replenish (RO-9)"
      )
      assert.equal(
        (await edgeRow(tx, s.friend.membership_id)).status,
        "awarded",
        "edge awarded"
      )
    })
  }
)

test(
  "review hardening: a completing bonus and the next-cycle visit survive one QR transaction",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [qr] = await tx.unsafe(PICK_QR_REWARDS)
      assert.ok(qr, "a reward-backed card exists")
      const s = await seedQualified(tx, qr)
      await fillReferrerToOneShort(tx, s, qr.merchant_id)

      const [result] = await tx`select * from public.issue_self_service_stamp(
      ${s.referrer.membership_id}::uuid, ${s.referrerCustomer}::uuid, ${qr.qr_id}, null, null)`

      assert.equal(
        result.reward_unlocked,
        false,
        "the visit itself starts the next cycle without completing it"
      )
      assert.equal(
        (await bonusStamps(tx, s.referrer.membership_id)).length,
        1,
        "the completing bonus is not rolled back"
      )
      assert.equal(
        (await edgeRow(tx, s.friend.membership_id)).status,
        "awarded",
        "the referral remains awarded"
      )
      const [{ n: visits }] = await tx`
      select count(*)::int as n from public.stamp_events
      where membership_id = ${s.referrer.membership_id}
        and event_type = 'earned'
        and metadata->>'source' = 'self_service_qr' and cycle_number = 2`
      assert.equal(
        visits,
        1,
        "the visit is added to the next cycle opened by the referral bonus"
      )
      const [after] = await tx`
        select last_visit_at, current_stamp_count, active_cycle_number
        from public.customer_memberships where id = ${s.referrer.membership_id}`
      assert.ok(after.last_visit_at, "the actual visit updates last_visit_at")
      assert.deepEqual(
        { count: after.current_stamp_count, cycle: after.active_cycle_number },
        { count: 1, cycle: 2 }
      )
      const [{ rewards }] = await tx`
        select count(*)::integer as rewards from public.reward_events
        where membership_id = ${s.referrer.membership_id}::uuid
          and source = 'stamp_cycle' and cycle_number = 1`
      assert.equal(rewards, 1, "the bonus creates exactly one cycle-one reward")
      const [{ n: visitEvents }] = await tx`
      select count(*)::int as n from public.product_events
      where membership_id = ${s.referrer.membership_id}
        and event_name = 'visit_without_stamp'`
      assert.equal(visitEvents, 0, "no unverified visit event is emitted")
    })
  }
)
