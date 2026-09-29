import assert from "node:assert/strict"
import { randomBytes, randomUUID } from "node:crypto"
import { after, test } from "node:test"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"

// QA BUG-004 (38c42a1..2c45031): email-only wallets made every plus-alias of
// one inbox a "new member" that paid its referrer bonus stamps. A referral now
// qualifies only once the referee wallet holds a verified phone (phone_hmac and
// phone_verified_at), mirroring the phone-only offer campaigns. The edge stays
// attributed, so a later earned stamp after phone verification qualifies it.
const skip = (await isLiveDbReady()) ? false : "local Supabase is not available"

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
        where bc.merchant_id = m.id and bc.status in ('trialing', 'active')
      )
    )
  order by q.created_at
  limit 1`

async function makeCustomer(tx, phone = "verified", email = null) {
  const hmac = phone === "none" ? null : randomBytes(32).toString("hex")
  const [c] = await tx`
    insert into public.customers (
      email, email_verified_at, phone_hmac, phone_last4, phone_verified_at,
      created_at, updated_at
    )
    values (
      ${email ?? `ref-phone-${randomUUID()}@test.local`}, now(),
      ${hmac}, ${hmac ? "0123" : null},
      ${phone === "verified" ? tx`now()` : null},
      now(), now()
    )
    returning id`
  return c.id
}

async function verifyPhone(tx, customerId) {
  await tx`
    update public.customers
    set phone_hmac = coalesce(phone_hmac, ${randomBytes(32).toString("hex")}),
        phone_last4 = coalesce(phone_last4, '0123'),
        phone_verified_at = now()
    where id = ${customerId}::uuid`
}

async function join(tx, customerId, qr, { withStamp, ref = null }) {
  const [row] = await tx`
    select * from public.join_customer_membership_with_first_stamp(
      ${customerId}::uuid, ${qr.business_slug}, ${withStamp ? qr.qr_id : null},
      false, '2026-06-06', null, null, ${ref})`
  return row
}

async function referrerFor(tx, qr) {
  const customerId = await makeCustomer(tx)
  const referrer = await join(tx, customerId, qr, { withStamp: true })
  const [{ referral_code: code }] = await tx`
    select referral_code from public.customer_memberships
    where id = ${referrer.membership_id}::uuid`
  return { membershipId: referrer.membership_id, code }
}

async function insertEarnedStamp(tx, qr, membershipId, customerId, daysAgo) {
  const [card] = await tx`
    select id, location_id from public.loyalty_cards
    where merchant_id = ${qr.merchant_id}::uuid and is_active
    order by created_at asc limit 1`
  const [row] = await tx`
    insert into public.stamp_events (
      merchant_id, customer_id, membership_id, loyalty_card_id, location_id,
      event_type, stamps_delta, earned_business_date, cycle_number, metadata,
      created_at)
    values (${qr.merchant_id}::uuid, ${customerId}::uuid, ${membershipId}::uuid,
      ${card.id}::uuid, ${card.location_id}, 'earned', 1,
      public.uk_business_date(now()) - ${daysAgo}::int, 1,
      jsonb_build_object('source', 'merchant_qr_action'),
      now() - make_interval(days => ${daysAgo}))
    returning id`
  return row.id
}

async function edgeFor(tx, membershipId) {
  const [row] = await tx`
    select id, status, qualified_at, qualifying_stamp_id
    from public.referrals
    where referred_membership_id = ${membershipId}::uuid`
  return row
}

async function referrerStamps(tx, membershipId) {
  const [row] = await tx`
    select total_stamps_earned from public.customer_memberships
    where id = ${membershipId}::uuid`
  return row.total_stamps_earned
}

async function qualifiedEvents(tx, edgeId) {
  const [{ n }] = await tx`
    select count(*)::int as n from public.product_events
    where event_name = 'referral_qualified'
      and metadata->>'referral_edge_id' = ${edgeId}::text`
  return n
}

test(
  "Given plus-aliases of one inbox join through a referral link When each gets its first stamp Then none qualifies and the referrer earns no bonus",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [qr] = await tx.unsafe(PICK_QR)
      assert.ok(qr, "an active billing-eligible join QR exists")
      const referrer = await referrerFor(tx, qr)
      const before = await referrerStamps(tx, referrer.membershipId)
      const tag = randomUUID().slice(0, 8)

      for (let alias = 1; alias <= 3; alias += 1) {
        const aliasCustomer = await makeCustomer(
          tx,
          "none",
          `ref-alias-${tag}+${alias}@test.local`
        )
        const joined = await join(tx, aliasCustomer, qr, {
          withStamp: true,
          ref: referrer.code,
        })
        assert.equal(joined.first_stamp_issued, true)
        const edge = await edgeFor(tx, joined.membership_id)
        assert.equal(edge.status, "attributed")
        assert.equal(edge.qualified_at, null)
        assert.equal(await qualifiedEvents(tx, edge.id), 0)
      }

      assert.equal(await referrerStamps(tx, referrer.membershipId), before)
    })
  }
)

test(
  "Given a referee with an unverified phone When they earn a stamp Then the referral stays attributed",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [qr] = await tx.unsafe(PICK_QR)
      const referrer = await referrerFor(tx, qr)
      const friend = await makeCustomer(tx, "unverified")
      const joined = await join(tx, friend, qr, {
        withStamp: false,
        ref: referrer.code,
      })
      const stampId = await insertEarnedStamp(
        tx,
        qr,
        joined.membership_id,
        friend,
        0
      )

      await tx`select public.award_referrer_bonus_stamp(${joined.membership_id}::uuid, ${stampId}::uuid)`

      assert.equal(
        (await edgeFor(tx, joined.membership_id)).status,
        "attributed"
      )
    })
  }
)

test(
  "Given an email-only referee who later verifies a phone When they earn another stamp Then the referral qualifies from their first visit",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [qr] = await tx.unsafe(PICK_QR)
      const referrer = await referrerFor(tx, qr)
      const friend = await makeCustomer(tx, "none")
      const joined = await join(tx, friend, qr, {
        withStamp: false,
        ref: referrer.code,
      })
      const firstVisit = await insertEarnedStamp(
        tx,
        qr,
        joined.membership_id,
        friend,
        1
      )
      await tx`select public.award_referrer_bonus_stamp(${joined.membership_id}::uuid, ${firstVisit}::uuid)`
      assert.equal(
        (await edgeFor(tx, joined.membership_id)).status,
        "attributed"
      )

      await verifyPhone(tx, friend)
      const laterVisit = await insertEarnedStamp(
        tx,
        qr,
        joined.membership_id,
        friend,
        0
      )
      await tx`select public.award_referrer_bonus_stamp(${joined.membership_id}::uuid, ${laterVisit}::uuid)`

      const edge = await edgeFor(tx, joined.membership_id)
      assert.notEqual(edge.status, "attributed")
      assert.ok(edge.qualified_at)
      assert.equal(await qualifiedEvents(tx, edge.id), 1)
    })
  }
)

test(
  "Given a phone-verified referee When they earn their first stamp Then the referral qualifies as before",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [qr] = await tx.unsafe(PICK_QR)
      const referrer = await referrerFor(tx, qr)
      const friend = await makeCustomer(tx, "verified")
      const joined = await join(tx, friend, qr, {
        withStamp: false,
        ref: referrer.code,
      })
      const stampId = await insertEarnedStamp(
        tx,
        qr,
        joined.membership_id,
        friend,
        0
      )

      await tx`select public.qualify_referral_on_stamp(${joined.membership_id}::uuid, ${stampId}::uuid)`

      const edge = await edgeFor(tx, joined.membership_id)
      assert.equal(edge.status, "qualified")
      assert.equal(edge.qualifying_stamp_id, stampId)
    })
  }
)
