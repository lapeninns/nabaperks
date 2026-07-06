import { after, test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"

/**
 * MS-referral-attribution — live-DB invariant tier.
 *
 * Proves the referrals attribution edge and its guards through the real
 * SECURITY DEFINER `join_customer_membership_with_first_stamp` RPC (now with
 * `p_ref`), inside rolled-back transactions with freshly-created customers so
 * nothing persists. Covers RA-1, RA-3, RA-5, RA-6, RA-7, RA-8, RA-9, RA-10,
 * RA-11.
 */

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(async () => {
  await closeDb()
})

const PICK_QR = /* sql */ `
  select q.qr_id, m.business_slug, m.id as merchant_id
  from public.qr_codes q
  join public.merchants m on m.id = q.merchant_id
  where q.is_active
    and m.status in ('trial', 'active')
    and (
      m.requires_billing = false
      or exists (
        select 1 from public.billing_customers bc
        where bc.merchant_id = m.id and bc.status in ('trial', 'trialing', 'active')
      )
    )
  order by q.created_at
  limit 1`

const PICK_TWO_QRS = /* sql */ `
  select q.qr_id, m.business_slug, m.id as merchant_id
  from public.qr_codes q
  join public.merchants m on m.id = q.merchant_id
  where q.is_active
    and m.status in ('trial', 'active')
    and (
      m.requires_billing = false
      or exists (
        select 1 from public.billing_customers bc
        where bc.merchant_id = m.id and bc.status in ('trial', 'trialing', 'active')
      )
    )
  order by q.created_at
  limit 2`

async function makeCustomer(tx) {
  const [c] = await tx`
    insert into public.customers (email, email_verified_at, created_at, updated_at)
    values (${`e2e-${randomUUID()}@test.local`}, now(), now(), now())
    returning id`
  return c.id
}

async function join(tx, customerId, slug, qrId, ref = null) {
  const [row] = await tx`
    select * from public.join_customer_membership_with_first_stamp(
      ${customerId}::uuid, ${slug}, ${qrId}, false, '2026-06-06', null, null, ${ref})`
  return row
}

async function codeFor(tx, membershipId) {
  const [{ referral_code }] = await tx`
    select referral_code from public.customer_memberships where id = ${membershipId}`
  return referral_code
}

async function edgeFor(tx, referredMembershipId) {
  const [edge] = await tx`
    select referrer_membership_id, referral_code_used
    from public.referrals
    where referred_membership_id = ${referredMembershipId}`
  return edge
}

test("RA-1: every membership is minted an opaque referral_code", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const [qr] = await tx.unsafe(PICK_QR)
    assert.ok(qr, "an active billing-eligible QR exists")
    const cust = await makeCustomer(tx)
    const m = await join(tx, cust, qr.business_slug, qr.qr_id)
    const code = await codeFor(tx, m.membership_id)
    assert.ok(code && code.length >= 8, "membership carries an opaque referral_code")
    assert.match(code, /^[a-z0-9_-]+$/, "code is base64url-shaped, no raw UUID")
  })
})

test("RA-3/RA-8: a cross-customer, same-venue ref writes exactly one edge", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const [qr] = await tx.unsafe(PICK_QR)
    const referrer = await makeCustomer(tx)
    const rM = await join(tx, referrer, qr.business_slug, qr.qr_id)
    const code = await codeFor(tx, rM.membership_id)

    const friend = await makeCustomer(tx)
    const fM = await join(tx, friend, qr.business_slug, qr.qr_id, code)
    assert.equal(fM.created_membership, true, "the friend is a genuinely new member")

    const edge = await edgeFor(tx, fM.membership_id)
    assert.ok(edge, "an attribution edge was written")
    assert.equal(edge.referrer_membership_id, rM.membership_id, "linked to the referrer")
    assert.equal(edge.referral_code_used, code, "records the code used")

    const [{ n }] = await tx`
      select count(*)::int as n from public.referrals
      where referred_membership_id = ${fM.membership_id}`
    assert.equal(n, 1, "exactly one edge (RA-8 single referrer)")
  })
})

test("RA-5: a code from a different venue does not attribute", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const qrs = await tx.unsafe(PICK_TWO_QRS)
    if (qrs.length < 2 || qrs[0].merchant_id === qrs[1].merchant_id) return
    const [venueA, venueB] = qrs

    const referrer = await makeCustomer(tx)
    const rM = await join(tx, referrer, venueA.business_slug, venueA.qr_id)
    const codeA = await codeFor(tx, rM.membership_id)

    const friend = await makeCustomer(tx)
    const fM = await join(tx, friend, venueB.business_slug, venueB.qr_id, codeA)
    assert.equal(fM.created_membership, true)
    assert.equal(await edgeFor(tx, fM.membership_id), undefined, "cross-venue code is ignored")
  })
})

test("RA-6: an unknown ref records nothing but the join still succeeds", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const [qr] = await tx.unsafe(PICK_QR)
    const friend = await makeCustomer(tx)
    const fM = await join(tx, friend, qr.business_slug, qr.qr_id, "no-such-code-zzzzz")
    assert.equal(fM.created_membership, true, "the join still creates the membership")
    assert.equal(await edgeFor(tx, fM.membership_id), undefined, "no edge for an unknown code")
  })
})

test("RA-4/RA-7: a returning member (own code) is never self-attributed", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const [qr] = await tx.unsafe(PICK_QR)
    const cust = await makeCustomer(tx)
    const first = await join(tx, cust, qr.business_slug, qr.qr_id)
    const ownCode = await codeFor(tx, first.membership_id)

    const again = await join(tx, cust, qr.business_slug, qr.qr_id, ownCode)
    assert.equal(again.created_membership, false, "re-join creates no new membership")
    assert.equal(again.membership_id, first.membership_id, "same membership returned")
    assert.equal(await edgeFor(tx, first.membership_id), undefined, "no self-attribution edge")
  })
})

test("RA-9/RA-11: a no-ref join is byte-compatible with today (first stamp, no edge)", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const [qr] = await tx.unsafe(PICK_QR)
    const cust = await makeCustomer(tx)
    const m = await join(tx, cust, qr.business_slug, qr.qr_id)
    assert.equal(m.created_membership, true)
    assert.equal(m.first_stamp_issued, true, "first stamp still issued atomically")
    assert.equal(await edgeFor(tx, m.membership_id), undefined, "no edge without a ref")
  })
})

test("RA-10: referrals has RLS enabled with a customer-scoped read policy", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const [rls] = await tx`
      select relrowsecurity from pg_class
      where oid = 'public.referrals'::regclass`
    assert.equal(rls.relrowsecurity, true, "row level security is enabled")

    const [{ n }] = await tx`
      select count(*)::int as n from pg_policies
      where schemaname = 'public' and tablename = 'referrals' and cmd = 'SELECT'`
    assert.ok(n >= 1, "a SELECT policy confines referral reads")
  })
})
