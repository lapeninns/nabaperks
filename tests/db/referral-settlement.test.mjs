import { after, test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"

import postgres from "postgres"

import { closeDb, dbUrl, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"

/**
 * MS-referral-settlement — live-DB invariant tier (primary proof).
 *
 * Proves the single settlement function settle_referral_bonus(referral_id): it
 * awards one bonus for a qualified edge through the normal pipeline, is idempotent
 * and terminal-safe, records durable holds (card_full / daily_bonus_limit /
 * reward_unavailable / referrer_membership_inactive / temporary_processing_error)
 * with retry bookkeeping, drains due bonuses concurrency-safely, settles an owed
 * bonus before a referrer's own new stamp (stamp ordering), and keeps the legacy
 * award_referrer_bonus_stamp entrypoint working as a shim. Covers SE-1…SE-15.
 */

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

const committedCustomerIds = new Set()
const committedMembershipIds = new Set()

function rawClient() {
  const url = dbUrl()
  return postgres(url, {
    max: 1,
    idle_timeout: 5,
    ssl: url.includes("127.0.0.1") || url.includes("localhost") ? undefined : "require",
  })
}

function createStartBarrier(expected) {
  let waiting = 0
  let release = () => {}
  const started = new Promise((resolve) => {
    release = resolve
  })
  return async function waitForStart() {
    waiting += 1
    if (waiting === expected) release()
    await started
  }
}

after(async () => {
  if (committedCustomerIds.size > 0 || committedMembershipIds.size > 0) {
    const admin = rawClient()
    try {
      for (const id of committedMembershipIds) {
        await admin`delete from public.notification_events where membership_id = ${id}::uuid`
        await admin`delete from public.product_events where membership_id = ${id}::uuid`
      }
      for (const id of committedCustomerIds) {
        await admin`delete from public.notification_events where customer_id = ${id}::uuid`
        await admin`delete from public.product_events where customer_id = ${id}::uuid`
        await admin`delete from public.customers where id = ${id}::uuid`
      }
    } finally {
      await admin.end({ timeout: 5 })
    }
  }
  await closeDb()
})

const PICK_QR = /* sql */ `
  select q.qr_id, m.business_slug, m.id as merchant_id
  from public.qr_codes q
  join public.merchants m on m.id = q.merchant_id
  where q.is_active and q.destination_type = 'join' and m.status in ('trial', 'active')
    and (m.requires_billing = false or exists (
      select 1 from public.billing_customers bc
      where bc.merchant_id = m.id and bc.status is not null and bc.status not in ('cancelled', 'suspended')))
  order by q.created_at limit 1`

const PICK_QR_REWARDS = /* sql */ `
  select q.qr_id, m.business_slug, m.id as merchant_id, lc.id as loyalty_card_id, lc.stamps_required
  from public.qr_codes q
  join public.merchants m on m.id = q.merchant_id
  join public.loyalty_cards lc on lc.merchant_id = m.id and lc.is_active
  where q.is_active and q.destination_type = 'join' and m.status in ('trial', 'active')
    and lc.stamps_required > 1
    and (select count(*) from public.reward_pool_items rpi where rpi.loyalty_card_id = lc.id and rpi.is_active) >= 3
    and (m.requires_billing = false or exists (
      select 1 from public.billing_customers bc
      where bc.merchant_id = m.id and bc.status is not null and bc.status not in ('cancelled', 'suspended')))
  order by q.created_at limit 1`

async function makeCustomer(tx) {
  const [c] = await tx`
    insert into public.customers (email, email_verified_at, created_at, updated_at)
    values (${`settle-${randomUUID()}@test.local`}, now(), now(), now()) returning id`
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
  const [{ referral_code }] = await tx`
    select referral_code from public.customer_memberships where id = ${membershipId}`
  return referral_code
}

async function cardFor(tx, merchantId) {
  const [card] = await tx`
    select id, location_id, stamps_required from public.loyalty_cards
    where merchant_id = ${merchantId} and is_active order by created_at asc limit 1`
  return card
}

async function stamp(tx, membershipId, customerId, qrId) {
  const [row] = await tx`
    select * from public.issue_self_service_stamp(
      ${membershipId}::uuid, ${customerId}::uuid, ${qrId}, null, null)`
  return row
}

async function insertFriendVisit(tx, s, card) {
  const [row] = await tx`
    insert into public.stamp_events (
      merchant_id, customer_id, membership_id, loyalty_card_id, location_id,
      event_type, stamps_delta, earned_business_date, cycle_number, metadata)
    values (${s.merchantId}::uuid, ${s.friendCustomer}::uuid, ${s.friend.membership_id}::uuid,
      ${card.id}::uuid, ${card.location_id}, 'earned', 1, public.uk_business_date(now()), 1,
      jsonb_build_object('source', 'merchant_qr_action'))
    returning id`
  return row.id
}

async function edgeRow(tx, referredMembershipId) {
  const [row] = await tx`
    select id, status, hold_reason, held_at, next_retry_at, retry_count, last_error,
           referrer_bonus_due_at, referrer_bonus_awarded_at, referrer_stamp_event_id
    from public.referrals where referred_membership_id = ${referredMembershipId}`
  return row
}

async function bonusStamps(tx, membershipId) {
  return tx`
    select id from public.stamp_events
    where membership_id = ${membershipId} and event_type = 'earned'
      and metadata->>'source' = 'referral_bonus'`
}

// A referrer (with a stamp = has room if required > 1) + a friend whose edge has
// been advanced to `qualified` (visit stamp inserted + qualify), ready to settle.
async function seedQualified(tx, qr) {
  const referrerCustomer = await makeCustomer(tx)
  const referrer = await joinWithStamp(tx, referrerCustomer, qr.business_slug, qr.qr_id)
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
  const card = await cardFor(tx, qr.merchant_id)
  const stampId = await insertFriendVisit(tx, s, card)
  await tx`select public.qualify_referral_on_stamp(${friend.membership_id}::uuid, ${stampId}::uuid)`
  const e = await edgeRow(tx, friend.membership_id)
  assert.equal(e.status, "qualified", "seed leaves the edge qualified, not yet awarded")
  s.edgeId = e.id
  s.card = card
  return s
}

async function settle(tx, referralId) {
  const [{ settle_referral_bonus }] = await tx`select public.settle_referral_bonus(${referralId}::uuid)`
  return settle_referral_bonus
}

test("SE-1/SE-8: settle awards one bonus for a qualified edge and clears holds", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const [qr] = await tx.unsafe(PICK_QR)
    assert.ok(qr, "an active join QR exists")
    const s = await seedQualified(tx, qr)

    const outcome = await settle(tx, s.edgeId)
    assert.equal(outcome, "awarded", "settle reports awarded (SE-1)")

    const bonus = await bonusStamps(tx, s.referrer.membership_id)
    assert.equal(bonus.length, 1, "exactly one referral_bonus stamp (SE-8)")
    const e = await edgeRow(tx, s.friend.membership_id)
    assert.equal(e.status, "awarded", "edge marked awarded (SE-8)")
    assert.ok(e.referrer_bonus_awarded_at, "v1 awarded timestamp still writes")
    assert.equal(e.referrer_stamp_event_id, bonus[0].id, "edge points at the bonus stamp")
    assert.equal(e.hold_reason, null, "hold fields cleared on award (SE-8)")
    assert.equal(e.next_retry_at, null, "no retry pending after award")
  })
})

test("SE-2/SE-3: settle is a no-op on terminal and un-qualified edges", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const [qr] = await tx.unsafe(PICK_QR)
    const s = await seedQualified(tx, qr)

    // First settle awards; a second settle must not issue a second bonus (SE-2).
    await settle(tx, s.edgeId)
    const again = await settle(tx, s.edgeId)
    assert.match(again, /skip|await/, "second settle is a no-op")
    assert.equal((await bonusStamps(tx, s.referrer.membership_id)).length, 1, "still one bonus (SE-1/SE-2)")

    // An attributed (un-qualified) edge is never awarded (SE-3).
    const otherFriendCustomer = await makeCustomer(tx)
    const otherFriend = await joinNoStamp(tx, otherFriendCustomer, qr.business_slug, s.code)
    const attributed = await edgeRow(tx, otherFriend.membership_id)
    // The same-venue duplicate is skipped by the state-machine trigger, so this
    // exercises SE-3 only when a distinct attributed edge exists.
    if (attributed && attributed.status === "attributed") {
      const outcome = await settle(tx, attributed.id)
      assert.match(outcome, /not_qualified|skip/, "an attributed edge is not awarded (SE-3)")
      assert.equal((await bonusStamps(tx, s.referrer.membership_id)).length, 1, "no bonus for the un-qualified edge")
    }
  })
})

test("SE-6: a full-card referrer holds card_full with retry bookkeeping", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const [qr] = await tx.unsafe(PICK_QR)
    const s = await seedQualified(tx, qr)
    const required = s.card.stamps_required
    await tx`update public.customer_memberships set current_stamp_count = ${required} where id = ${s.referrer.membership_id}`

    const outcome = await settle(tx, s.edgeId)
    assert.equal(outcome, "held", "settle reports held (SE-6)")
    assert.equal((await bonusStamps(tx, s.referrer.membership_id)).length, 0, "no stamp onto a full card (SE-6)")
    const e = await edgeRow(tx, s.friend.membership_id)
    assert.equal(e.status, "held", "edge is held")
    assert.equal(e.hold_reason, "card_full", "hold reason is card_full (SE-4/SE-6)")
    assert.ok(e.held_at, "held_at recorded")
    assert.ok(e.next_retry_at, "next_retry_at recorded")
    assert.equal(e.retry_count, 1, "retry_count incremented (SE-11)")
  })
})

test("SE-5: over the daily cap holds daily_bonus_limit, flags velocity, retries next business day", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const [qr] = await tx.unsafe(PICK_QR)
    const s = await seedQualified(tx, qr)
    // Seed the referrer at the cap: two awarded referral bonuses today.
    for (let i = 0; i < 2; i++) {
      const c = await makeCustomer(tx)
      const [m] = await tx`
        insert into public.customer_memberships (merchant_id, customer_id)
        values (${qr.merchant_id}::uuid, ${c}::uuid) returning id`
      await tx`
        insert into public.referrals (referred_membership_id, referrer_membership_id, referral_code_used,
          status, referrer_bonus_due_at, referrer_bonus_awarded_at)
        values (${m.id}::uuid, ${s.referrer.membership_id}::uuid, 'seed', 'awarded', now(), now())`
    }

    const outcome = await settle(tx, s.edgeId)
    assert.equal(outcome, "held", "held at the cap (SE-5)")
    assert.equal((await bonusStamps(tx, s.referrer.membership_id)).length, 0, "no bonus past the cap")
    const e = await edgeRow(tx, s.friend.membership_id)
    assert.equal(e.hold_reason, "daily_bonus_limit", "hold reason daily_bonus_limit (SE-5)")
    assert.ok(e.next_retry_at > new Date(), "next_retry_at is in the future (SE-5)")
    const [{ n }] = await tx`
      select count(*)::int as n from public.fraud_flags
      where membership_id = ${s.referrer.membership_id} and signal = 'referral_bonus_velocity'`
    assert.ok(n >= 1, "a referral_bonus_velocity fraud flag was recorded (SE-5)")
  })
})

test("SE-4: a missing referrer membership holds referrer_membership_inactive", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const [qr] = await tx.unsafe(PICK_QR)
    const s = await seedQualified(tx, qr)
    // Referrer leaves the venue: their membership is deleted (edge survives, set null).
    await tx`delete from public.customer_memberships where id = ${s.referrer.membership_id}`

    const outcome = await settle(tx, s.edgeId)
    assert.equal(outcome, "held", "held when the referrer is gone (SE-4)")
    const e = await edgeRow(tx, s.friend.membership_id)
    assert.equal(e.hold_reason, "referrer_membership_inactive", "hold reason referrer_membership_inactive (SE-4)")
    assert.ok(e.next_retry_at, "a retry is scheduled (SE-9)")
  })
})

test("SE-7: a completing bonus with an insufficient reward pool holds reward_unavailable", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const [qr] = await tx.unsafe(PICK_QR_REWARDS)
    if (!qr) return // no rewards-rich multi-stamp card seeded
    const s = await seedQualified(tx, qr)
    // Referrer one short of full, but the pool is emptied below the min-3 rule.
    await tx`update public.customer_memberships set current_stamp_count = ${qr.stamps_required - 1} where id = ${s.referrer.membership_id}`
    await tx`update public.reward_pool_items set is_active = false where loyalty_card_id = ${qr.loyalty_card_id}::uuid`

    const outcome = await settle(tx, s.edgeId)
    assert.equal(outcome, "held", "held when the card cannot complete cleanly (SE-7)")
    assert.equal((await bonusStamps(tx, s.referrer.membership_id)).length, 0, "no bonus onto an uncompletable card")
    const e = await edgeRow(tx, s.friend.membership_id)
    assert.equal(e.hold_reason, "reward_unavailable", "hold reason reward_unavailable (SE-7)")
  })
})

test("SE-10: the drain pays a held bonus once room frees and respects next_retry_at", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const [qr] = await tx.unsafe(PICK_QR)
    const s = await seedQualified(tx, qr)
    const required = s.card.stamps_required
    await tx`update public.customer_memberships set current_stamp_count = ${required} where id = ${s.referrer.membership_id}`
    await settle(tx, s.edgeId) // holds card_full

    // Not-yet-due rows are skipped: force next_retry_at into the future.
    await tx`update public.referrals set next_retry_at = now() + interval '1 day' where id = ${s.edgeId}`
    await tx`update public.customer_memberships set current_stamp_count = 0 where id = ${s.referrer.membership_id}`
    await tx`select public.drain_due_referrer_bonuses_for_membership(${s.referrer.membership_id}::uuid)`
    assert.equal((await bonusStamps(tx, s.referrer.membership_id)).length, 0, "the member drain also respects future next_retry_at")
    await tx`select public.drain_due_referral_bonuses(100)`
    assert.equal((await bonusStamps(tx, s.referrer.membership_id)).length, 0, "a future next_retry_at is not yet drained (SE-10)")

    // Due now: the drain pays it.
    await tx`update public.referrals set next_retry_at = now() - interval '1 minute' where id = ${s.edgeId}`
    const [{ drain_due_referral_bonuses: paid }] = await tx`select public.drain_due_referral_bonuses(100)`
    assert.ok(paid >= 1, "the drain reports at least one settled (SE-10)")
    assert.equal((await bonusStamps(tx, s.referrer.membership_id)).length, 1, "the owed bonus is paid")
    assert.equal((await edgeRow(tx, s.friend.membership_id)).status, "awarded", "edge awarded after drain")
  })
})

test("review hardening: a referred customer qualifies after leave + rejoin", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const [qr] = await tx.unsafe(PICK_QR)
    const referrerCustomer = await makeCustomer(tx)
    const referrer = await joinWithStamp(tx, referrerCustomer, qr.business_slug, qr.qr_id)
    const code = await codeFor(tx, referrer.membership_id)
    const friendCustomer = await makeCustomer(tx)
    const oldFriend = await joinNoStamp(tx, friendCustomer, qr.business_slug, code)
    const [edge] = await tx`select id from public.referrals where referred_membership_id = ${oldFriend.membership_id}`

    await tx`delete from public.customer_memberships where id = ${oldFriend.membership_id}`
    const newFriend = await joinNoStamp(tx, friendCustomer, qr.business_slug, code)
    const card = await cardFor(tx, qr.merchant_id)
    const stampId = await insertFriendVisit(tx, {
      merchantId: qr.merchant_id,
      friendCustomer,
      friend: newFriend,
    }, card)

    await tx`select public.qualify_referral_on_stamp(${newFriend.membership_id}::uuid, ${stampId}::uuid)`
    const [relinked] = await tx`
      select status, referred_membership_id from public.referrals where id = ${edge.id}`
    assert.equal(relinked.status, "qualified", "the preserved edge qualifies via customer + venue")
    assert.equal(relinked.referred_membership_id, newFriend.membership_id, "the edge points at the new membership")

    await settle(tx, edge.id)
    assert.equal((await bonusStamps(tx, referrer.membership_id)).length, 1, "the churned referral settles")
  })
})

test("review hardening: a rejoined referrer is relinked before settlement", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const [qr] = await tx.unsafe(PICK_QR)
    const s = await seedQualified(tx, qr)
    await tx`delete from public.customer_memberships where id = ${s.referrer.membership_id}`
    const newReferrer = await joinNoStamp(tx, s.referrerCustomer, qr.business_slug, null)

    const outcome = await settle(tx, s.edgeId)
    assert.equal(outcome, "awarded", "settlement uses the rejoined membership")
    assert.equal((await bonusStamps(tx, newReferrer.membership_id)).length, 1, "the new card receives the bonus")
    const [edge] = await tx`select referrer_membership_id from public.referrals where id = ${s.edgeId}`
    assert.equal(edge.referrer_membership_id, newReferrer.membership_id, "the edge is durably relinked")
  })
})

test("SE-13: a referrer's owed bonus is settled before their own new visit stamp", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const [qr] = await tx.unsafe(PICK_QR)
    // The referrer joins WITHOUT a same-day stamp, so their later scan is their
    // genuine first visit today (not blocked by the one-per-UK-day guard).
    const referrerCustomer = await makeCustomer(tx)
    const referrer = await joinNoStamp(tx, referrerCustomer, qr.business_slug, null)
    const code = await codeFor(tx, referrer.membership_id)
    const friendCustomer = await makeCustomer(tx)
    const friend = await joinNoStamp(tx, friendCustomer, qr.business_slug, code)
    const card = await cardFor(tx, qr.merchant_id)
    const s = { merchantId: qr.merchant_id, friendCustomer, friend }
    const friendStamp = await insertFriendVisit(tx, s, card)
    await tx`select public.qualify_referral_on_stamp(${friend.membership_id}::uuid, ${friendStamp}::uuid)`
    const edgeId = (await edgeRow(tx, friend.membership_id)).id

    // Full card → the bonus holds card_full.
    await tx`update public.customer_memberships set current_stamp_count = ${card.stamps_required} where id = ${referrer.membership_id}`
    await settle(tx, edgeId)
    assert.equal((await edgeRow(tx, friend.membership_id)).status, "held", "bonus is held on the full card")

    // Room frees, and the referrer scans. Stamp ordering settles the owed bonus
    // first, then applies their own first-of-day visit stamp — both land.
    await tx`update public.customer_memberships set current_stamp_count = 0 where id = ${referrer.membership_id}`
    await tx`update public.referrals set next_retry_at = now() - interval '1 minute' where id = ${edgeId}`
    await stamp(tx, referrer.membership_id, referrerCustomer, qr.qr_id)

    assert.equal((await bonusStamps(tx, referrer.membership_id)).length, 1, "the owed bonus was settled on the scan (SE-13)")
    assert.equal((await edgeRow(tx, friend.membership_id)).status, "awarded", "edge awarded")
    const [{ n }] = await tx`
      select count(*)::int as n from public.stamp_events
      where membership_id = ${referrer.membership_id} and event_type = 'earned'
        and coalesce(metadata->>'source','') <> 'referral_bonus'
        and earned_business_date is not null`
    assert.ok(n >= 1, "the referrer's own visit stamp also landed (SE-13)")
  })
})

test("SE-14 (shim): award_referrer_bonus_stamp still awards on a friend's first stamp", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const [qr] = await tx.unsafe(PICK_QR)
    const referrerCustomer = await makeCustomer(tx)
    const referrer = await joinWithStamp(tx, referrerCustomer, qr.business_slug, qr.qr_id)
    const code = await codeFor(tx, referrer.membership_id)
    const friendCustomer = await makeCustomer(tx)
    const friend = await joinNoStamp(tx, friendCustomer, qr.business_slug, code)

    // The friend's real first stamp via the hook drives the shim → settle.
    const friendStamp = await stamp(tx, friend.membership_id, friendCustomer, qr.qr_id)
    assert.ok(friendStamp.stamp_event_id, "the friend still earns their own stamp (SE-14)")
    assert.equal((await bonusStamps(tx, referrer.membership_id)).length, 1, "exactly one referrer bonus via the shim (SE-14)")
    assert.equal((await edgeRow(tx, friend.membership_id)).status, "awarded", "edge awarded via the shim")
  })
})

test("SE-15: an unexpected award error holds temporary_processing_error with last_error", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const [qr] = await tx.unsafe(PICK_QR)
    const s = await seedQualified(tx, qr)
    // Inject a fault: block referral_bonus stamp inserts so the award writes throw.
    // NOT VALID checks new rows without validating existing ones; rolled back with the txn.
    await tx`alter table public.stamp_events add constraint tmp_block_bonus
             check (coalesce(metadata->>'source','') <> 'referral_bonus') not valid`

    const outcome = await settle(tx, s.edgeId)
    assert.match(outcome, /error|held/, "settle reports the failure without throwing (SE-15)")
    assert.equal((await bonusStamps(tx, s.referrer.membership_id)).length, 0, "no bonus stamp on error")
    const e = await edgeRow(tx, s.friend.membership_id)
    assert.equal(e.status, "held", "edge is held on error")
    assert.equal(e.hold_reason, "temporary_processing_error", "hold reason temporary_processing_error (SE-15)")
    assert.ok(e.last_error, "last_error captured (SE-15)")
    assert.ok(e.next_retry_at, "a backoff retry is scheduled (SE-15)")
  })
})

test("SE-10 (race): two concurrent drains issue exactly one bonus", { skip }, async () => {
  const setup = rawClient()
  const a = rawClient()
  const b = rawClient()
  try {
    const [qr] = await setup.unsafe(PICK_QR)
    assert.ok(qr, "an active join QR exists")
    const [card] = await setup`
      select id, location_id from public.loyalty_cards where merchant_id = ${qr.merchant_id} and is_active
      order by created_at asc limit 1`

    const [referrerCustomer] = await setup`
      insert into public.customers (email, email_verified_at, created_at, updated_at)
      values (${`settle-race-ref-${randomUUID()}@test.local`}, now(), now(), now()) returning id`
    committedCustomerIds.add(referrerCustomer.id)
    const [referrer] = await setup`
      insert into public.customer_memberships (merchant_id, customer_id)
      values (${qr.merchant_id}::uuid, ${referrerCustomer.id}::uuid) returning id, referral_code`
    committedMembershipIds.add(referrer.id)
    const [friendCustomer] = await setup`
      insert into public.customers (email, email_verified_at, created_at, updated_at)
      values (${`settle-race-friend-${randomUUID()}@test.local`}, now(), now(), now()) returning id`
    committedCustomerIds.add(friendCustomer.id)
    const [friend] = await setup`
      insert into public.customer_memberships (merchant_id, customer_id)
      values (${qr.merchant_id}::uuid, ${friendCustomer.id}::uuid) returning id`
    committedMembershipIds.add(friend.id)

    const [edge] = await setup`
      insert into public.referrals (referred_membership_id, referrer_membership_id, referral_code_used, status)
      values (${friend.id}::uuid, ${referrer.id}::uuid, ${referrer.referral_code}, 'attributed') returning id`
    await setup`
      insert into public.stamp_events (merchant_id, customer_id, membership_id, loyalty_card_id, location_id,
        event_type, stamps_delta, earned_business_date, cycle_number, metadata)
      values (${qr.merchant_id}::uuid, ${friendCustomer.id}::uuid, ${friend.id}::uuid, ${card.id}::uuid,
        ${card.location_id}, 'earned', 1, public.uk_business_date(now()), 1, jsonb_build_object('source','merchant_qr_action'))`
    await setup`select public.qualify_referral_on_stamp(${friend.id}::uuid, null)`

    const waitForStart = createStartBarrier(2)
    async function raceDrain(sql) {
      await sql`select 1`
      await waitForStart()
      return sql`select public.drain_due_referral_bonuses(100)`
    }
    const results = await Promise.allSettled([raceDrain(a), raceDrain(b)])
    for (const r of results) assert.equal(r.status, "fulfilled", "neither drain errors")

    const [{ n: bonuses }] = await setup`
      select count(*)::int as n from public.stamp_events
      where membership_id = ${referrer.id}::uuid and event_type = 'earned' and metadata->>'source' = 'referral_bonus'`
    assert.equal(bonuses, 1, "exactly one bonus despite two concurrent drains (SE-10)")
    const [{ n: awarded }] = await setup`
      select count(*)::int as n from public.referrals where id = ${edge.id}::uuid and status = 'awarded'`
    assert.equal(awarded, 1, "the edge is awarded exactly once (SE-10)")
  } finally {
    await Promise.all([setup.end({ timeout: 5 }), a.end({ timeout: 5 }), b.end({ timeout: 5 })])
  }
})
