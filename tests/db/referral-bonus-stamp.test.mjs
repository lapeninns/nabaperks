import { after, test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"

import postgres from "postgres"

import {
  closeDb,
  dbUrl,
  inRolledBackTxn,
  isLiveDbReady,
} from "./helpers/db.mjs"

/**
 * MS-referral-bonus-stamp — live-DB invariant tier (primary proof).
 *
 * Proves the "Bring a Regular" referrer bonus through the real SECURITY DEFINER
 * ledger: a referred friend's FIRST earned stamp issues exactly one bonus stamp
 * to the referrer (event_type='earned', source='referral_bonus',
 * earned_business_date NULL) in the friend's stamp transaction, advancing the
 * referrer's cycle, while the friend's own outcome is unchanged. Covers
 * RB-1, RB-2, RB-3, RB-5, RB-6, RB-7, RB-8, RB-10, RB-12. Most work runs inside
 * rolled-back transactions with freshly-created customers so nothing persists;
 * the double-award race test uses committed rows across two connections (the
 * only way to race a lock) and tears them down afterwards.
 */

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

// Committed customers created by the concurrency test (two real connections must
// see the same row) are tracked here and torn down after the run; deleting a
// customer cascades its memberships, referrals, and stamp_events.
const committedCustomerIds = new Set()

function rawClient() {
  const url = dbUrl()
  return postgres(url, {
    max: 1,
    idle_timeout: 5,
    ssl:
      url.includes("127.0.0.1") || url.includes("localhost")
        ? undefined
        : "require",
  })
}

after(async () => {
  if (committedCustomerIds.size > 0) {
    const admin = rawClient()
    try {
      for (const id of committedCustomerIds) {
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
  where q.is_active
    and q.destination_type = 'join'
    and m.status in ('trial', 'active')
    and (
      m.requires_billing = false
      or exists (
        select 1 from public.billing_customers bc
        where bc.merchant_id = m.id and bc.status is not null and bc.status not in ('cancelled', 'suspended')
      )
    )
  order by q.created_at
  limit 1`

async function makeCustomer(tx) {
  const [c] = await tx`
    insert into public.customers (email, email_verified_at, created_at, updated_at)
    values (${`bonus-${randomUUID()}@test.local`}, now(), now(), now())
    returning id`
  return c.id
}

// Join without a QR: creates the membership + referral edge but NO first stamp,
// mirroring the canonical share-a-link flow (friend joins from home, visits later).
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

// The friend's own venue stamp — the QR-gated overload that the app calls.
async function stamp(tx, membershipId, customerId, qrId) {
  const [row] = await tx`
    select * from public.issue_self_service_stamp(
      ${membershipId}::uuid, ${customerId}::uuid, ${qrId}, null, null)`
  return row
}

async function bonusStampsFor(tx, membershipId) {
  return tx`
    select id, earned_business_date, metadata
    from public.stamp_events
    where membership_id = ${membershipId}
      and event_type = 'earned'
      and metadata->>'source' = 'referral_bonus'`
}

async function edgeState(tx, referredMembershipId) {
  const [edge] = await tx`
    select referrer_membership_id, referrer_bonus_due_at,
           referrer_bonus_awarded_at, referrer_stamp_event_id
    from public.referrals
    where referred_membership_id = ${referredMembershipId}`
  return edge
}

async function stampsRequiredFor(tx, merchantId) {
  const [card] = await tx`
    select stamps_required from public.loyalty_cards
    where merchant_id = ${merchantId} and is_active
    order by created_at asc limit 1`
  return card?.stamps_required
}

// A referrer + attributed friend at the same venue; friend has an edge, no stamp.
async function seedReferrerAndFriend(tx, qr) {
  const referrerCustomer = await makeCustomer(tx)
  const referrer = await joinWithStamp(
    tx,
    referrerCustomer,
    qr.business_slug,
    qr.qr_id
  )
  const code = await codeFor(tx, referrer.membership_id)

  const friendCustomer = await makeCustomer(tx)
  const friend = await joinNoStamp(tx, friendCustomer, qr.business_slug, code)
  assert.equal(
    friend.created_membership,
    true,
    "friend is a genuinely new member"
  )
  assert.ok(
    await edgeState(tx, friend.membership_id),
    "an attribution edge exists"
  )

  return { referrerCustomer, referrer, friendCustomer, friend, code }
}

test(
  "RB-1/RB-2: a referred friend's first stamp issues one referral_bonus stamp to the referrer",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [qr] = await tx.unsafe(PICK_QR)
      assert.ok(qr, "an active billing-eligible join QR exists")
      const s = await seedReferrerAndFriend(tx, qr)

      const before = await bonusStampsFor(tx, s.referrer.membership_id)
      assert.equal(before.length, 0, "no bonus before the friend's first stamp")

      const friendStamp = await stamp(
        tx,
        s.friend.membership_id,
        s.friendCustomer,
        qr.qr_id
      )
      assert.ok(
        friendStamp.stamp_event_id,
        "friend earns their own first stamp (RB-7)"
      )

      const bonus = await bonusStampsFor(tx, s.referrer.membership_id)
      assert.equal(bonus.length, 1, "exactly one referrer bonus stamp (RB-1)")
      assert.equal(
        bonus[0].earned_business_date,
        null,
        "bonus has NULL business date (RB-2)"
      )
      assert.equal(
        bonus[0].metadata.source,
        "referral_bonus",
        "provenance is referral_bonus"
      )
    })
  }
)

test(
  "RB-3: the bonus is idempotent — one per edge, ever",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [qr] = await tx.unsafe(PICK_QR)
      const s = await seedReferrerAndFriend(tx, qr)

      await stamp(tx, s.friend.membership_id, s.friendCustomer, qr.qr_id)
      // A second driver of the primitive must not mint a second bonus.
      await tx`select public.award_referrer_bonus_stamp(${s.friend.membership_id}::uuid, null)`

      const bonus = await bonusStampsFor(tx, s.referrer.membership_id)
      assert.equal(
        bonus.length,
        1,
        "still exactly one bonus after a repeat trigger"
      )

      const edge = await edgeState(tx, s.friend.membership_id)
      assert.ok(edge.referrer_bonus_awarded_at, "edge marked awarded")
      assert.equal(
        edge.referrer_stamp_event_id,
        bonus[0].id,
        "edge points at the bonus stamp"
      )
    })
  }
)

test(
  "RB-12: a stamp with no referral edge issues no bonus",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [qr] = await tx.unsafe(PICK_QR)
      const soloCustomer = await makeCustomer(tx)
      const solo = await joinNoStamp(tx, soloCustomer, qr.business_slug, null)
      assert.equal(
        await edgeState(tx, solo.membership_id),
        undefined,
        "no edge"
      )

      await stamp(tx, solo.membership_id, soloCustomer, qr.qr_id)
      const bonus = await bonusStampsFor(tx, solo.membership_id)
      assert.equal(bonus.length, 0, "no bonus without an edge")
    })
  }
)

test(
  "RB-2 (cap bypass): a referrer who already stamped today still receives the bonus",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [qr] = await tx.unsafe(PICK_QR)
      const s = await seedReferrerAndFriend(tx, qr)
      // Referrer already earned a normal stamp today (joinWithStamp did so); the
      // bonus is NULL-dated so it must not collide with the one-per-UK-day index.
      await stamp(tx, s.friend.membership_id, s.friendCustomer, qr.qr_id)
      const bonus = await bonusStampsFor(tx, s.referrer.membership_id)
      assert.equal(
        bonus.length,
        1,
        "bonus lands despite the referrer's same-day stamp"
      )
    })
  }
)

test(
  "RB-5/RB-6: a full-card referrer holds the bonus due, drain pays it when room frees",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [qr] = await tx.unsafe(PICK_QR)
      const s = await seedReferrerAndFriend(tx, qr)
      const required = await stampsRequiredFor(tx, qr.merchant_id)

      // Force the referrer's card full (reward awaiting redemption).
      await tx`update public.customer_memberships
             set current_stamp_count = ${required}
             where id = ${s.referrer.membership_id}`

      await stamp(tx, s.friend.membership_id, s.friendCustomer, qr.qr_id)
      assert.equal(
        (await bonusStampsFor(tx, s.referrer.membership_id)).length,
        0,
        "no stamp onto a full card (RB-5)"
      )
      let edge = await edgeState(tx, s.friend.membership_id)
      assert.ok(edge.referrer_bonus_due_at, "bonus recorded due")
      assert.equal(edge.referrer_bonus_awarded_at, null, "not yet awarded")

      // Room frees; the sweep pays the owed bonus.
      await tx`update public.customer_memberships set current_stamp_count = 0
             where id = ${s.referrer.membership_id}`
      await tx`select public.drain_due_referrer_bonuses()`

      assert.equal(
        (await bonusStampsFor(tx, s.referrer.membership_id)).length,
        1,
        "drain pays the owed bonus (RB-6)"
      )
      edge = await edgeState(tx, s.friend.membership_id)
      assert.ok(edge.referrer_bonus_awarded_at, "edge now awarded")
    })
  }
)

test(
  "RB-8/RB-11: awarding a bonus writes a notification and a product event in-txn",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [qr] = await tx.unsafe(PICK_QR)
      const s = await seedReferrerAndFriend(tx, qr)
      await stamp(tx, s.friend.membership_id, s.friendCustomer, qr.qr_id)

      const [{ n: notifs }] = await tx`
      select count(*)::int as n from public.notification_events
      where event_type = 'referral_bonus_stamp_issued'
        and membership_id = ${s.referrer.membership_id}`
      assert.equal(
        notifs,
        1,
        "one referral_bonus_stamp_issued notification (RB-8)"
      )

      const [{ n: events }] = await tx`
      select count(*)::int as n from public.product_events
      where event_name = 'referral_bonus_awarded'
        and membership_id = ${s.referrer.membership_id}`
      assert.equal(
        events,
        1,
        "one referral_bonus_awarded product event (RB-11)"
      )
    })
  }
)

test(
  "RB-7 (fail-safe): a bonus that cannot be issued never blocks the friend's stamp",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [qr] = await tx.unsafe(PICK_QR)
      const s = await seedReferrerAndFriend(tx, qr)
      // Delete the referrer membership so the bonus lookup/insert would fail; the
      // friend's own stamp must still commit (the hook is wrapped, non-blocking).
      await tx`delete from public.referrals where referred_membership_id = ${s.friend.membership_id}`
      await tx`delete from public.customer_memberships where id = ${s.referrer.membership_id}`

      const friendStamp = await stamp(
        tx,
        s.friend.membership_id,
        s.friendCustomer,
        qr.qr_id
      )
      assert.ok(
        friendStamp.stamp_event_id,
        "friend's stamp still succeeds with no referrer present"
      )
    })
  }
)

test(
  "RB-4: a bonus that completes the referrer's card unlocks their reward",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [qr] = await tx`
      select q.qr_id, m.business_slug, m.id as merchant_id, lc.stamps_required
      from public.qr_codes q
      join public.merchants m on m.id = q.merchant_id
      join public.loyalty_cards lc on lc.merchant_id = m.id and lc.is_active
      where q.is_active and q.destination_type = 'join' and m.status in ('trial', 'active')
        and (m.requires_billing = false or exists (
          select 1 from public.billing_customers bc
          where bc.merchant_id = m.id and bc.status is not null and bc.status not in ('cancelled', 'suspended')))
        and (select count(*) from public.reward_pool_items rpi
             where rpi.loyalty_card_id = lc.id and rpi.is_active) >= 3
      order by q.created_at
      limit 1`
      if (!qr) return // no rewards-rich merchant seeded; unlock proven where data allows
      const s = await seedReferrerAndFriend(tx, qr)
      // Put the referrer one stamp short of a full card so the bonus completes it.
      await tx`update public.customer_memberships
             set current_stamp_count = ${qr.stamps_required - 1}
             where id = ${s.referrer.membership_id}`

      await stamp(tx, s.friend.membership_id, s.friendCustomer, qr.qr_id)

      const [{ n }] = await tx`
      select count(*)::int as n from public.reward_events
      where membership_id = ${s.referrer.membership_id}
        and status = 'unlocked'
        and metadata->>'source' = 'referral_bonus'`
      assert.equal(
        n,
        1,
        "the completing bonus unlocked exactly one referrer reward"
      )
      assert.equal(
        (await bonusStampsFor(tx, s.referrer.membership_id)).length,
        1,
        "and issued the bonus stamp"
      )
    })
  }
)

test(
  "RB-10: past the per-referrer daily cap, the bonus is held due and flagged",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [qr] = await tx.unsafe(PICK_QR)
      const referrerCustomer = await makeCustomer(tx)
      const referrer = await joinWithStamp(
        tx,
        referrerCustomer,
        qr.business_slug,
        qr.qr_id
      )
      const code = await codeFor(tx, referrer.membership_id)

      // Seed the referrer at the cap: 20 already-awarded bonuses in the last 24h.
      for (let i = 0; i < 20; i++) {
        const c = await makeCustomer(tx)
        const [m] = await tx`
        insert into public.customer_memberships (merchant_id, customer_id)
        values (${qr.merchant_id}::uuid, ${c}::uuid) returning id`
        await tx`
        insert into public.referrals (
          referred_membership_id, referrer_membership_id, referral_code_used,
          referrer_bonus_due_at, referrer_bonus_awarded_at)
        values (${m.id}::uuid, ${referrer.membership_id}::uuid, 'seed', now(), now())`
      }

      const friendCustomer = await makeCustomer(tx)
      const friend = await joinNoStamp(
        tx,
        friendCustomer,
        qr.business_slug,
        code
      )
      await stamp(tx, friend.membership_id, friendCustomer, qr.qr_id)

      assert.equal(
        (await bonusStampsFor(tx, referrer.membership_id)).length,
        0,
        "no bonus stamp past the cap"
      )
      const edge = await edgeState(tx, friend.membership_id)
      assert.ok(edge.referrer_bonus_due_at, "the bonus is held due")
      assert.equal(edge.referrer_bonus_awarded_at, null, "and not awarded")

      const [{ n }] = await tx`
      select count(*)::int as n from public.fraud_flags
      where membership_id = ${referrer.membership_id} and signal = 'referral_bonus_velocity'`
      assert.ok(n >= 1, "a referral_bonus_velocity fraud flag was recorded")
    })
  }
)

test(
  "RB-3 (race): two concurrent award attempts on one edge issue exactly one bonus",
  { skip },
  async () => {
    const setup = rawClient()
    const a = rawClient()
    const b = rawClient()
    try {
      const [qr] = await setup.unsafe(PICK_QR)
      assert.ok(qr, "an active join QR exists")
      const [card] = await setup`
        select id, location_id from public.loyalty_cards
        where merchant_id = ${qr.merchant_id} and is_active
        order by created_at asc limit 1`

      // Committed seed: a referrer with room, and a friend whose first earned
      // stamp is inserted DIRECTLY (not via the hook) so the bonus is owed but
      // unawarded — the exact state two award calls can race on.
      const [referrerCustomer] = await setup`
        insert into public.customers (email, email_verified_at, created_at, updated_at)
        values (${`race-ref-${randomUUID()}@test.local`}, now(), now(), now())
        returning id`
      committedCustomerIds.add(referrerCustomer.id)
      const [referrer] = await setup`
        insert into public.customer_memberships (merchant_id, customer_id)
        values (${qr.merchant_id}::uuid, ${referrerCustomer.id}::uuid)
        returning id, referral_code`

      const [friendCustomer] = await setup`
        insert into public.customers (email, email_verified_at, created_at, updated_at)
        values (${`race-friend-${randomUUID()}@test.local`}, now(), now(), now())
        returning id`
      committedCustomerIds.add(friendCustomer.id)
      const [friend] = await setup`
        insert into public.customer_memberships (merchant_id, customer_id)
        values (${qr.merchant_id}::uuid, ${friendCustomer.id}::uuid)
        returning id`

      await setup`
        insert into public.referrals (
          referred_membership_id, referrer_membership_id, referral_code_used)
        values (${friend.id}::uuid, ${referrer.id}::uuid, ${referrer.referral_code})`
      await setup`
        insert into public.stamp_events (
          merchant_id, customer_id, membership_id, loyalty_card_id, location_id,
          event_type, stamps_delta, earned_business_date, cycle_number, metadata)
        values (${qr.merchant_id}::uuid, ${friendCustomer.id}::uuid, ${friend.id}::uuid,
          ${card.id}::uuid, ${card.location_id}, 'earned', 1,
          public.uk_business_date(now()), 1,
          jsonb_build_object('source', 'merchant_qr_action'))`

      // Race two award calls for the same edge on two connections. The loser
      // does not error — it no-ops when the winner's commit fails its
      // `awarded_at is null` guard — so the invariant is the OUTCOME: one bonus.
      const attempts = await Promise.allSettled([
        a`select public.award_referrer_bonus_stamp(${friend.id}::uuid, null)`,
        b`select public.award_referrer_bonus_stamp(${friend.id}::uuid, null)`,
      ])
      for (const attempt of attempts) {
        assert.equal(attempt.status, "fulfilled", "neither award call errors")
      }

      const [{ n: bonuses }] = await setup`
        select count(*)::int as n from public.stamp_events
        where membership_id = ${referrer.id}::uuid
          and event_type = 'earned'
          and metadata->>'source' = 'referral_bonus'`
      assert.equal(bonuses, 1, "exactly one bonus stamp despite the race")

      const [{ current_stamp_count }] = await setup`
        select current_stamp_count from public.customer_memberships
        where id = ${referrer.id}::uuid`
      assert.equal(
        current_stamp_count,
        1,
        "the referrer advanced by exactly one"
      )

      const [{ n: awarded }] = await setup`
        select count(*)::int as n from public.referrals
        where referred_membership_id = ${friend.id}::uuid
          and referrer_bonus_awarded_at is not null`
      assert.equal(awarded, 1, "the edge is marked awarded exactly once")
    } finally {
      await Promise.all([
        setup.end({ timeout: 5 }),
        a.end({ timeout: 5 }),
        b.end({ timeout: 5 }),
      ])
    }
  }
)

test(
  "RB-6 (any-path visit): a first earned stamp issued by any means drains to the referrer",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [qr] = await tx.unsafe(PICK_QR)
      const s = await seedReferrerAndFriend(tx, qr)
      const [card] = await tx`
        select id, location_id from public.loyalty_cards
        where merchant_id = ${qr.merchant_id} and is_active
        order by created_at asc limit 1`

      // Not the self-service hook: the friend's first earned stamp is inserted
      // directly (as a merchant staff-pin / mystery stamp would), so the instant
      // award never ran — the drain sweep must still pay the referrer.
      await tx`
        insert into public.stamp_events (
          merchant_id, customer_id, membership_id, loyalty_card_id, location_id,
          event_type, stamps_delta, earned_business_date, cycle_number, metadata)
        values (${qr.merchant_id}::uuid, ${s.friendCustomer}::uuid, ${s.friend.membership_id}::uuid,
          ${card.id}::uuid, ${card.location_id}, 'earned', 1,
          public.uk_business_date(now()), 1,
          jsonb_build_object('source', 'merchant_qr_action'))`

      assert.equal(
        (await bonusStampsFor(tx, s.referrer.membership_id)).length,
        0,
        "no instant bonus (the self-service hook never fired)"
      )

      await tx`select public.drain_due_referrer_bonuses()`

      assert.equal(
        (await bonusStampsFor(tx, s.referrer.membership_id)).length,
        1,
        "the drain pays the bonus for a non-self-service first stamp"
      )
      assert.ok(
        (await edgeState(tx, s.friend.membership_id)).referrer_bonus_awarded_at,
        "the edge is awarded"
      )
    })
  }
)

test(
  "RB-5 (pool guard): a completing bonus with too few active rewards is held due, not issued",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [qr] = await tx.unsafe(PICK_QR)
      const s = await seedReferrerAndFriend(tx, qr)
      const required = await stampsRequiredFor(tx, qr.merchant_id)

      // Referrer one short of full, but the merchant's reward pool is below the
      // 3-active minimum the ledger needs to unlock — the bonus must hold, not
      // push the card into an uncompletable full state.
      await tx`update public.customer_memberships
               set current_stamp_count = ${required - 1}
               where id = ${s.referrer.membership_id}`
      await tx`update public.reward_pool_items set is_active = false
               where merchant_id = ${qr.merchant_id}`

      await stamp(tx, s.friend.membership_id, s.friendCustomer, qr.qr_id)

      assert.equal(
        (await bonusStampsFor(tx, s.referrer.membership_id)).length,
        0,
        "no bonus onto a card that cannot complete cleanly"
      )
      const edge = await edgeState(tx, s.friend.membership_id)
      assert.ok(edge.referrer_bonus_due_at, "the bonus is held due")
      assert.equal(edge.referrer_bonus_awarded_at, null, "and not awarded")
    })
  }
)
