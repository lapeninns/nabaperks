import { after, test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"

/**
 * referral code controls — live-DB invariant tier (primary proof).
 *
 * Proves referral code rotation + deactivation: rotation writes a fresh unique code
 * (old code stops attributing, new code attributes), deactivation stops attribution
 * without blocking the join, reactivation restores it, and the mutating RPCs are
 * owner-guarded. Covers CC-1…CC-7.
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

async function makeCustomer(tx) {
  const [c] = await tx`
    insert into public.customers (email, email_verified_at, created_at, updated_at)
    values (${`cc-${randomUUID()}@test.local`}, now(), now(), now()) returning id`
  return c.id
}
async function joinWithStamp(tx, customerId, slug, qrId) {
  const [row] = await tx`
    select * from public.join_customer_membership_with_first_stamp(
      ${customerId}::uuid, ${slug}, ${qrId}, false, '2026-06-06', null, null, null)`
  return row
}
async function joinNoStamp(tx, customerId, slug, ref = null) {
  const [row] = await tx`
    select * from public.join_customer_membership_with_first_stamp(
      ${customerId}::uuid, ${slug}, null, false, '2026-06-06', null, null, ${ref})`
  return row
}
async function membershipRow(tx, membershipId) {
  const [row] = await tx`
    select referral_code, referral_code_active, referral_code_rotated_at
    from public.customer_memberships where id = ${membershipId}`
  return row
}
async function hasEdge(tx, referredMembershipId) {
  const [row] = await tx`
    select id from public.referrals where referred_membership_id = ${referredMembershipId}`
  return Boolean(row)
}

test("CC-1/CC-7: a membership carries an active referral code by default", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const [qr] = await tx.unsafe(PICK_QR)
    assert.ok(qr, "an active join QR exists")
    const referrer = await joinWithStamp(tx, await makeCustomer(tx), qr.business_slug, qr.qr_id)
    const row = await membershipRow(tx, referrer.membership_id)
    assert.equal(row.referral_code_active, true, "new code is active (CC-1/CC-7)")
    assert.equal(row.referral_code_rotated_at, null, "not rotated yet")
    assert.ok(row.referral_code, "has a code")
  })
})

test("CC-3/CC-6/CC-2: rotating retires the old code and activates a fresh unique one", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const [qr] = await tx.unsafe(PICK_QR)
    const referrer = await joinWithStamp(tx, await makeCustomer(tx), qr.business_slug, qr.qr_id)
    const before = await membershipRow(tx, referrer.membership_id)

    const [{ rotate_membership_referral_code: newCode }] = await tx`
      select public.rotate_membership_referral_code(${referrer.membership_id}::uuid)`
    assert.ok(newCode, "rotate returns the new code")
    const after = await membershipRow(tx, referrer.membership_id)
    assert.notEqual(after.referral_code, before.referral_code, "the code changed (CC-3)")
    assert.equal(after.referral_code, newCode, "membership carries the new code")
    assert.ok(after.referral_code_rotated_at, "rotated_at recorded (CC-3)")
    assert.equal(after.referral_code_active, true, "the fresh code is active (CC-3)")

    // A friend joining with the OLD code is not attributed; the NEW code attributes.
    const friendOld = await joinNoStamp(tx, await makeCustomer(tx), qr.business_slug, before.referral_code)
    assert.equal(await hasEdge(tx, friendOld.membership_id), false, "the retired code attributes nothing (CC-2)")
    const friendNew = await joinNoStamp(tx, await makeCustomer(tx), qr.business_slug, newCode)
    assert.equal(await hasEdge(tx, friendNew.membership_id), true, "the fresh code attributes (CC-2)")
  })
})

test("CC-2/CC-4: deactivating stops attribution without blocking the join; reactivating restores it", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const [qr] = await tx.unsafe(PICK_QR)
    const referrer = await joinWithStamp(tx, await makeCustomer(tx), qr.business_slug, qr.qr_id)
    const code = (await membershipRow(tx, referrer.membership_id)).referral_code

    await tx`select public.set_membership_referral_code_active(${referrer.membership_id}::uuid, false)`
    assert.equal((await membershipRow(tx, referrer.membership_id)).referral_code_active, false, "deactivated")

    const friendPaused = await joinNoStamp(tx, await makeCustomer(tx), qr.business_slug, code)
    assert.equal(friendPaused.created_membership, true, "the friend still enrols while paused (CC-2)")
    assert.equal(await hasEdge(tx, friendPaused.membership_id), false, "a paused code attributes nothing (CC-4)")

    await tx`select public.set_membership_referral_code_active(${referrer.membership_id}::uuid, true)`
    const friendResumed = await joinNoStamp(tx, await makeCustomer(tx), qr.business_slug, code)
    assert.equal(await hasEdge(tx, friendResumed.membership_id), true, "reactivating restores attribution (CC-4)")
  })
})

test("CC-5: a non-owner cannot rotate or deactivate a membership's code", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const [qr] = await tx.unsafe(PICK_QR)
    const referrer = await joinWithStamp(tx, await makeCustomer(tx), qr.business_slug, qr.qr_id)

    // Switch to an unrelated authenticated user (not the owner, not service-role).
    async function asStranger(sp) {
      await sp`select set_config('request.jwt.claim.role', 'authenticated', true)`
      await sp`select set_config('request.jwt.claim.sub', ${randomUUID()}, true)`
    }

    let rotateRejected = false
    try {
      await tx.savepoint(async (sp) => {
        await asStranger(sp)
        await sp`select public.rotate_membership_referral_code(${referrer.membership_id}::uuid)`
      })
    } catch (error) {
      rotateRejected = /privilege|owner|access|authori/i.test(String(error.message))
    }
    assert.ok(rotateRejected, "a non-owner cannot rotate (CC-5)")

    let setRejected = false
    try {
      await tx.savepoint(async (sp) => {
        await asStranger(sp)
        await sp`select public.set_membership_referral_code_active(${referrer.membership_id}::uuid, false)`
      })
    } catch (error) {
      setRejected = /privilege|owner|access|authori/i.test(String(error.message))
    }
    assert.ok(setRejected, "a non-owner cannot deactivate (CC-5)")
  })
})
