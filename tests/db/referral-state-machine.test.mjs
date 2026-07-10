import { after, test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"

/**
 * MS-referral-state-machine — live-DB invariant tier (primary proof).
 *
 * Proves the referral v2 state machine and the decoupling of qualification from
 * attribution through the real SECURITY DEFINER surface: a `?ref` enrolment writes
 * an `attributed` edge with denormalised identities; only the referred friend's
 * FIRST non-bonus `earned` stamp transitions it to `qualified`
 * (`qualify_referral_on_stamp`), one-way and idempotent; a surviving edge keeps
 * one referrer per (venue, customer) across membership deletion; the backfill maps
 * v1 timestamps onto the new `status`; and the v1 bonus award is unchanged except
 * that it now also records `status='awarded'`. Covers SM-1…SM-12. Everything runs
 * inside rolled-back transactions with freshly-created customers so nothing
 * persists.
 */

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(closeDb)

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
    values (${`sm-${randomUUID()}@test.local`}, now(), now(), now())
    returning id`
  return c.id
}

// Join without a QR: creates the membership + referral edge but NO first stamp.
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

async function stamp(tx, membershipId, customerId, qrId) {
  const [row] = await tx`
    select * from public.issue_self_service_stamp(
      ${membershipId}::uuid, ${customerId}::uuid, ${qrId}, null, null)`
  return row
}

async function cardFor(tx, merchantId) {
  const [card] = await tx`
    select id, location_id, stamps_required from public.loyalty_cards
    where merchant_id = ${merchantId} and is_active
    order by created_at asc limit 1`
  return card
}

// Insert a friend's earned stamp DIRECTLY (bypassing the self-service hook and its
// instant award), so the qualification transition can be observed on its own.
async function insertEarnedStamp(tx, s, card, source = "merchant_qr_action") {
  const businessDate =
    source === "referral_bonus" ? tx`null` : tx`public.uk_business_date(now())`
  const [row] = await tx`
    insert into public.stamp_events (
      merchant_id, customer_id, membership_id, loyalty_card_id, location_id,
      event_type, stamps_delta, earned_business_date, cycle_number, metadata)
    values (${s.merchantId}::uuid, ${s.friendCustomer}::uuid, ${s.friend.membership_id}::uuid,
      ${card.id}::uuid, ${card.location_id}, 'earned', 1,
      ${businessDate}, 1,
      jsonb_build_object('source', ${source}::text))
    returning id`
  return row.id
}

async function edge(tx, referredMembershipId) {
  const [row] = await tx`
    select id, status, venue_id, referrer_customer_id, referred_customer_id,
           qualified_at, qualifying_stamp_id, updated_at,
           referrer_bonus_due_at, referrer_bonus_awarded_at, referrer_stamp_event_id
    from public.referrals
    where referred_membership_id = ${referredMembershipId}`
  return row
}

// A referrer + attributed friend at the same venue; friend has an edge, no stamp.
async function seedReferrerAndFriend(tx, qr) {
  const referrerCustomer = await makeCustomer(tx)
  const referrer = await joinWithStamp(tx, referrerCustomer, qr.business_slug, qr.qr_id)
  const code = await codeFor(tx, referrer.membership_id)
  const friendCustomer = await makeCustomer(tx)
  const friend = await joinNoStamp(tx, friendCustomer, qr.business_slug, code)
  assert.equal(friend.created_membership, true, "friend is a genuinely new member")
  return {
    referrerCustomer,
    referrer,
    friendCustomer,
    friend,
    code,
    merchantId: qr.merchant_id,
  }
}

test(
  "SM-1/SM-2/SM-4: a ?ref enrolment writes an attributed edge with denormalised identities",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [qr] = await tx.unsafe(PICK_QR)
      assert.ok(qr, "an active billing-eligible join QR exists")
      const s = await seedReferrerAndFriend(tx, qr)

      const e = await edge(tx, s.friend.membership_id)
      assert.ok(e, "an attribution edge exists")
      assert.equal(e.status, "attributed", "new edge is attributed, not qualified (SM-4)")
      assert.equal(e.venue_id, qr.merchant_id, "venue_id = merchant (SM-2)")
      assert.equal(e.referrer_customer_id, s.referrerCustomer, "referrer_customer_id set (SM-2)")
      assert.equal(e.referred_customer_id, s.friendCustomer, "referred_customer_id set (SM-2)")
      assert.equal(e.qualified_at, null, "not qualified at join (SM-4)")
    })
  }
)

test(
  "SM-5/SM-12: the friend's first non-bonus earned stamp qualifies the edge and emits referral_qualified",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [qr] = await tx.unsafe(PICK_QR)
      const s = await seedReferrerAndFriend(tx, qr)
      const card = await cardFor(tx, qr.merchant_id)
      const stampId = await insertEarnedStamp(tx, s, card)

      await tx`select public.qualify_referral_on_stamp(${s.friend.membership_id}::uuid, ${stampId}::uuid)`

      const e = await edge(tx, s.friend.membership_id)
      assert.equal(e.status, "qualified", "edge is now qualified (SM-5)")
      assert.ok(e.qualified_at, "qualified_at is set (SM-5)")
      assert.equal(e.qualifying_stamp_id, stampId, "qualifying_stamp_id points at the visit stamp (SM-5)")

      const [{ n }] = await tx`
        select count(*)::int as n from public.product_events
        where event_name = 'referral_qualified' and metadata->>'referral_edge_id' = ${e.id}::text`
      assert.equal(n, 1, "exactly one referral_qualified product event (SM-12)")
    })
  }
)

test(
  "SM-6: membership creation alone and a referral-bonus stamp never qualify a referral",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [qr] = await tx.unsafe(PICK_QR)
      const s = await seedReferrerAndFriend(tx, qr)
      const card = await cardFor(tx, qr.merchant_id)

      // No stamp at all → attempting to qualify is a no-op.
      await tx`select public.qualify_referral_on_stamp(${s.friend.membership_id}::uuid, null)`
      assert.equal(
        (await edge(tx, s.friend.membership_id)).status,
        "attributed",
        "membership creation alone does not qualify (SM-6)"
      )

      // A referral_bonus stamp is not a qualifying visit.
      const bonusStampId = await insertEarnedStamp(tx, s, card, "referral_bonus")
      await tx`select public.qualify_referral_on_stamp(${s.friend.membership_id}::uuid, ${bonusStampId}::uuid)`
      assert.equal(
        (await edge(tx, s.friend.membership_id)).status,
        "attributed",
        "a referral_bonus stamp does not qualify (SM-6)"
      )

      // A genuine venue stamp does, and records itself (not the bonus) as the qualifier.
      const realStampId = await insertEarnedStamp(tx, s, card)
      await tx`select public.qualify_referral_on_stamp(${s.friend.membership_id}::uuid, ${realStampId}::uuid)`
      const e = await edge(tx, s.friend.membership_id)
      assert.equal(e.status, "qualified", "the real visit qualifies (SM-5)")
      assert.equal(e.qualifying_stamp_id, realStampId, "the non-bonus stamp is the qualifier (SM-6)")
    })
  }
)

test(
  "SM-7/SM-11: qualification is one-way and idempotent, and updated_at advances",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [qr] = await tx.unsafe(PICK_QR)
      const s = await seedReferrerAndFriend(tx, qr)
      const card = await cardFor(tx, qr.merchant_id)
      const before = await edge(tx, s.friend.membership_id)
      const stampId = await insertEarnedStamp(tx, s, card)

      await tx`select public.qualify_referral_on_stamp(${s.friend.membership_id}::uuid, ${stampId}::uuid)`
      const first = await edge(tx, s.friend.membership_id)
      assert.equal(first.status, "qualified")
      assert.ok(first.updated_at > before.updated_at, "updated_at advanced on the transition (SM-11)")

      // A repeat call does not re-qualify or move qualified_at.
      await tx`select public.qualify_referral_on_stamp(${s.friend.membership_id}::uuid, ${stampId}::uuid)`
      const after = await edge(tx, s.friend.membership_id)
      assert.equal(after.qualified_at.getTime(), first.qualified_at.getTime(), "qualified_at unchanged (SM-7)")
      assert.equal(after.qualifying_stamp_id, stampId, "qualifying stamp unchanged (SM-7)")

      const [{ n }] = await tx`
        select count(*)::int as n from public.product_events
        where event_name = 'referral_qualified' and metadata->>'referral_edge_id' = ${first.id}::text`
      assert.equal(n, 1, "only one referral_qualified event despite repeat calls (SM-12)")

      // An already-awarded edge is never regressed by a later qualify call.
      await tx`update public.referrals set status = 'awarded' where id = ${first.id}`
      await tx`select public.qualify_referral_on_stamp(${s.friend.membership_id}::uuid, ${stampId}::uuid)`
      assert.equal(
        (await edge(tx, s.friend.membership_id)).status,
        "awarded",
        "an awarded edge is not regressed to qualified (SM-7)"
      )
    })
  }
)

test(
  "SM-3: at most one referrer per (venue, customer), surviving a membership deletion and re-join",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [qr] = await tx.unsafe(PICK_QR)
      const s = await seedReferrerAndFriend(tx, qr)
      const e1 = await edge(tx, s.friend.membership_id)
      assert.ok(e1, "the first attribution edge exists")

      // The friend leaves the venue: the membership is deleted but the edge
      // survives (referred_membership_id set null), preserving the attribution.
      await tx`delete from public.customer_memberships where id = ${s.friend.membership_id}`
      const [{ n: survivors }] = await tx`
        select count(*)::int as n from public.referrals
        where venue_id = ${qr.merchant_id} and referred_customer_id = ${s.friendCustomer}`
      assert.equal(survivors, 1, "the edge survives membership deletion")

      // The friend re-joins with the same referrer's code. The join must succeed
      // and must NOT mint a second referrer for the same (venue, customer).
      const rejoin = await joinNoStamp(tx, s.friendCustomer, qr.business_slug, s.code)
      assert.equal(rejoin.created_membership, true, "the re-join succeeds (never blocked)")
      const [{ n: total }] = await tx`
        select count(*)::int as n from public.referrals
        where venue_id = ${qr.merchant_id} and referred_customer_id = ${s.friendCustomer}`
      assert.equal(total, 1, "still exactly one referrer per (venue, customer) (SM-3)")

      // A hand-forced duplicate is silently skipped by the denormalise trigger
      // (RETURN NULL), so invariant #1 holds without ever raising into the join.
      await tx`
        insert into public.referrals (
          referred_membership_id, referrer_membership_id, referral_code_used,
          venue_id, referrer_customer_id, referred_customer_id, status)
        values (null, ${s.referrer.membership_id}::uuid, ${s.code},
          ${qr.merchant_id}::uuid, ${s.referrerCustomer}::uuid, ${s.friendCustomer}::uuid, 'attributed')`
      const [{ n: afterDup }] = await tx`
        select count(*)::int as n from public.referrals
        where venue_id = ${qr.merchant_id} and referred_customer_id = ${s.friendCustomer}`
      assert.equal(afterDup, 1, "a duplicate (venue, referred_customer) edge is skipped, not duplicated (SM-3)")

      // The unique index exists as the backstop behind the trigger.
      const [{ n: idx }] = await tx`
        select count(*)::int as n from pg_indexes
        where schemaname = 'public' and indexname = 'referrals_venue_referred_customer_key'`
      assert.equal(idx, 1, "the (venue, referred_customer) unique index exists (SM-3)")
    })
  }
)

test(
  "SM-9: the backfill maps v1 timestamps onto the new status",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [qr] = await tx.unsafe(PICK_QR)

      async function legacyEdge({ due, awarded }) {
        const s = await seedReferrerAndFriend(tx, qr)
        // Simulate a pre-migration row: only the v1 timestamps set, status reset
        // to the column default the migration would have applied to legacy rows.
        await tx`update public.referrals set
            status = 'attributed', qualified_at = null,
            referrer_bonus_due_at = ${due ? tx`now()` : null},
            referrer_bonus_awarded_at = ${awarded ? tx`now()` : null}
          where referred_membership_id = ${s.friend.membership_id}`
        return s.friend.membership_id
      }

      const awardedId = await legacyEdge({ due: true, awarded: true })
      const qualifiedId = await legacyEdge({ due: true, awarded: false })
      const attributedId = await legacyEdge({ due: false, awarded: false })

      await tx`select public.backfill_referral_states()`

      assert.equal((await edge(tx, awardedId)).status, "awarded", "awarded_at → awarded (SM-9)")
      const q = await edge(tx, qualifiedId)
      assert.equal(q.status, "qualified", "due_at only → qualified (SM-9)")
      assert.ok(q.qualified_at, "qualified_at backfilled from due_at (SM-9)")
      assert.equal((await edge(tx, attributedId)).status, "attributed", "no timestamps → attributed (SM-9)")
    })
  }
)

test(
  "SM-10: the v1 bonus award is unchanged except that it now records status='awarded'",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [qr] = await tx.unsafe(PICK_QR)
      const s = await seedReferrerAndFriend(tx, qr)

      // The friend's real first stamp via the self-service hook: they get their
      // own stamp, the referrer gets exactly one bonus (v1 behaviour preserved),
      // and the edge now carries the full lifecycle: qualified then awarded.
      const friendStamp = await stamp(tx, s.friend.membership_id, s.friendCustomer, qr.qr_id)
      assert.ok(friendStamp.stamp_event_id, "the friend still earns their own stamp (SM-10)")

      const [{ n: bonuses }] = await tx`
        select count(*)::int as n from public.stamp_events
        where membership_id = ${s.referrer.membership_id}
          and event_type = 'earned' and metadata->>'source' = 'referral_bonus'`
      assert.equal(bonuses, 1, "exactly one referrer bonus, as in v1 (SM-10)")

      const e = await edge(tx, s.friend.membership_id)
      assert.equal(e.status, "awarded", "the edge is awarded after the bonus (SM-10)")
      assert.ok(e.qualified_at, "qualification was recorded on the way to awarded (SM-5)")
      assert.ok(e.qualifying_stamp_id, "the qualifying stamp is recorded (SM-5)")
      assert.ok(e.referrer_bonus_awarded_at, "the v1 awarded timestamp still writes (SM-10)")
      assert.equal(e.referrer_stamp_event_id, (
        await tx`select id from public.stamp_events
          where membership_id = ${s.referrer.membership_id}
            and metadata->>'source' = 'referral_bonus' limit 1`
      )[0].id, "the v1 bonus-stamp pointer still writes (SM-10)")
    })
  }
)

test(
  "SM-10 (no edge): a friend with no referral edge still stamps with no bonus",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [qr] = await tx.unsafe(PICK_QR)
      const soloCustomer = await makeCustomer(tx)
      const solo = await joinNoStamp(tx, soloCustomer, qr.business_slug, null)
      assert.equal(await edge(tx, solo.membership_id), undefined, "no edge")

      const s = await stamp(tx, solo.membership_id, soloCustomer, qr.qr_id)
      assert.ok(s.stamp_event_id, "the solo member earns their stamp unchanged (SM-10)")
      const [{ n }] = await tx`
        select count(*)::int as n from public.stamp_events
        where membership_id = ${solo.membership_id} and metadata->>'source' = 'referral_bonus'`
      assert.equal(n, 0, "no bonus without a referral edge (SM-10)")
    })
  }
)
