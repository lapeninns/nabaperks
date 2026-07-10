import { after, test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"

/**
 * MS-referral-fraud-controls — live-DB invariant tier (primary proof).
 *
 * Proves referral fraud controls: concentration past a rolling-24h threshold pauses
 * the newest qualifying referral (rejected) + raises a deduped referral_concentration
 * flag without touching stamps; admin_review_referral clears/rejects (admin-only,
 * audited) and a cleared referrer is not re-paused; admin_disable_referral_code
 * deactivates a code + flags it. Covers FC-1…FC-8.
 */

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(closeDb)

const ADMIN_UID = "00000000-0000-0000-0000-000000000001"
const MERCHANT_ID = "10000000-0000-0000-0000-000000000001"

const PICK_QR = /* sql */ `
  select q.qr_id, m.business_slug, m.id as merchant_id
  from public.qr_codes q join public.merchants m on m.id = q.merchant_id
  where q.is_active and q.destination_type = 'join' and m.status in ('trial', 'active')
    and (m.requires_billing = false or exists (
      select 1 from public.billing_customers bc
      where bc.merchant_id = m.id and bc.status is not null and bc.status not in ('cancelled', 'suspended')))
  order by q.created_at limit 1`

async function actAsService(tx) {
  await tx`select set_config('request.jwt.claim.role', 'service_role', true)`
}
async function actAsAdmin(tx) {
  await tx`select set_config('request.jwt.claim.role', 'authenticated', true)`
  await tx`select set_config('request.jwt.claim.sub', ${ADMIN_UID}, true)`
  await tx`select set_config('request.jwt.claim.aal', 'aal2', true)`
}
function isRejection(error) {
  return /privilege|admin|owner|access|authori/i.test(String(error.message))
}

async function makeCustomer(tx) {
  const [c] = await tx`
    insert into public.customers (email, email_verified_at, created_at, updated_at)
    values (${`fc-${randomUUID()}@test.local`}, now(), now(), now()) returning id`
  return c.id
}
async function makeMembership(tx, customerId) {
  const [m] = await tx`
    insert into public.customer_memberships (merchant_id, customer_id)
    values (${MERCHANT_ID}::uuid, ${customerId}::uuid) returning id`
  return m.id
}
// Insert an already-qualified referral for a referrer (no trigger — INSERT, not UPDATE).
async function seedQualified(tx, referrerM) {
  const friendM = await makeMembership(tx, await makeCustomer(tx))
  const [e] = await tx`
    insert into public.referrals (
      referred_membership_id, referrer_membership_id, referral_code_used, status, qualified_at)
    values (${friendM}::uuid, ${referrerM}::uuid, 'seed', 'qualified', now()) returning id`
  return e.id
}
// Insert an attributed referral then transition it to qualified (fires the trigger).
async function attributeThenQualify(tx, referrerM) {
  const friendM = await makeMembership(tx, await makeCustomer(tx))
  const [e] = await tx`
    insert into public.referrals (
      referred_membership_id, referrer_membership_id, referral_code_used, status)
    values (${friendM}::uuid, ${referrerM}::uuid, 'seed', 'attributed') returning id`
  await tx`update public.referrals set status = 'qualified', qualified_at = now() where id = ${e.id}`
  return e.id
}
async function statusOf(tx, referralId) {
  const [r] = await tx`select status from public.referrals where id = ${referralId}`
  return r.status
}
async function concentrationFlags(tx, referrerM) {
  const [{ n }] = await tx`
    select count(*)::int as n from public.fraud_flags
    where signal = 'referral_concentration' and membership_id = ${referrerM}`
  return n
}

test("FC-1/FC-2/FC-3: past the concentration threshold, the newest referral is paused + flagged", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    await actAsService(tx)
    const referrerM = await makeMembership(tx, await makeCustomer(tx))
    for (let i = 0; i < 5; i++) await seedQualified(tx, referrerM) // at threshold

    const sixth = await attributeThenQualify(tx, referrerM) // one over
    assert.equal(await statusOf(tx, sixth), "rejected", "the over-threshold referral is paused (FC-1)")
    assert.equal(await concentrationFlags(tx, referrerM), 1, "one referral_concentration flag (FC-2)")

    // Settlement awards it no bonus (terminal).
    await tx`select public.settle_referral_bonus(${sixth}::uuid)`
    const [r] = await tx`select referrer_bonus_awarded_at from public.referrals where id = ${sixth}`
    assert.equal(r.referrer_bonus_awarded_at, null, "no bonus for the paused referral (FC-3)")
  })
})

test("FC-4: at or below the threshold, referrals are not paused or flagged", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    await actAsService(tx)
    const referrerM = await makeMembership(tx, await makeCustomer(tx))
    for (let i = 0; i < 2; i++) await seedQualified(tx, referrerM)

    const third = await attributeThenQualify(tx, referrerM)
    assert.equal(await statusOf(tx, third), "qualified", "a below-threshold referral stays qualified (FC-4)")
    assert.equal(await concentrationFlags(tx, referrerM), 0, "no concentration flag below threshold (FC-4)")
  })
})

test("FC-5/FC-6/FC-8: admin_review_referral clears a paused referral and is not re-paused", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    await actAsService(tx)
    const referrerM = await makeMembership(tx, await makeCustomer(tx))
    for (let i = 0; i < 5; i++) await seedQualified(tx, referrerM)
    const paused = await attributeThenQualify(tx, referrerM)
    assert.equal(await statusOf(tx, paused), "rejected", "paused by concentration")

    // A non-admin cannot review (FC-8).
    let rejected = false
    try {
      await tx.savepoint(async (sp) => {
        await sp`select set_config('request.jwt.claim.role', 'authenticated', true)`
        await sp`select set_config('request.jwt.claim.sub', ${randomUUID()}, true)`
        await sp`select public.admin_review_referral(${paused}::uuid, 'clear', 'looks legitimate')`
      })
    } catch (error) {
      rejected = isRejection(error)
    }
    assert.ok(rejected, "a non-admin cannot review (FC-8)")

    // Admin clears → qualified, flags dismissed, audit written (FC-5).
    await actAsAdmin(tx)
    await tx`select public.admin_review_referral(${paused}::uuid, 'clear', 'reviewed: legitimate high referrer')`
    await actAsService(tx)
    assert.equal(await statusOf(tx, paused), "qualified", "clear returns it to qualified (FC-5)")
    const [{ n: openFlags }] = await tx`
      select count(*)::int as n from public.fraud_flags
      where membership_id = ${referrerM} and signal = 'referral_concentration' and status = 'open'`
    assert.equal(openFlags, 0, "the concentration flag is dismissed on clear (FC-5)")
    const [{ n: audit }] = await tx`
      select count(*)::int as n from public.audit_logs
      where action = 'referral_reviewed' and target_id = ${paused}::uuid`
    assert.ok(audit >= 1, "an audit row is written (FC-8)")

    // A subsequent qualify for the same referrer is NOT re-paused (review respected, FC-6).
    const another = await attributeThenQualify(tx, referrerM)
    assert.equal(await statusOf(tx, another), "qualified", "a cleared referrer is not re-paused (FC-6)")
  })
})

test("FC-7/FC-8: admin_disable_referral_code deactivates + flags, and the code then attributes nothing", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const [qr] = await tx.unsafe(PICK_QR)
    assert.ok(qr, "an active join QR exists")
    await actAsService(tx)
    const referrerCustomer = await makeCustomer(tx)
    const [referrer] = await tx`
      select * from public.join_customer_membership_with_first_stamp(
        ${referrerCustomer}::uuid, ${qr.business_slug}, ${qr.qr_id}, false, '2026-06-06', null, null, null)`
    const [{ referral_code: code }] = await tx`
      select referral_code from public.customer_memberships where id = ${referrer.membership_id}`

    // Non-admin cannot disable (FC-8).
    let rejected = false
    try {
      await tx.savepoint(async (sp) => {
        await sp`select set_config('request.jwt.claim.role', 'authenticated', true)`
        await sp`select set_config('request.jwt.claim.sub', ${randomUUID()}, true)`
        await sp`select public.admin_disable_referral_code(${referrer.membership_id}::uuid, 'abuse report')`
      })
    } catch (error) {
      rejected = isRejection(error)
    }
    assert.ok(rejected, "a non-admin cannot disable a code (FC-8)")

    // Admin disables → deactivated + flagged + audited (FC-7).
    await actAsAdmin(tx)
    await tx`select public.admin_disable_referral_code(${referrer.membership_id}::uuid, 'confirmed referral abuse')`
    await actAsService(tx)
    const [m] = await tx`
      select referral_code_active from public.customer_memberships where id = ${referrer.membership_id}`
    assert.equal(m.referral_code_active, false, "the code is deactivated (FC-7)")
    const [{ n: flags }] = await tx`
      select count(*)::int as n from public.fraud_flags
      where membership_id = ${referrer.membership_id} and signal = 'referral_code_disabled'`
    assert.ok(flags >= 1, "a referral_code_disabled flag is raised (FC-7)")

    // The disabled code now attributes nothing.
    const friendCustomer = await makeCustomer(tx)
    const [friend] = await tx`
      select * from public.join_customer_membership_with_first_stamp(
        ${friendCustomer}::uuid, ${qr.business_slug}, null, false, '2026-06-06', null, null, ${code})`
    const [edge] = await tx`
      select id from public.referrals where referred_membership_id = ${friend.membership_id}`
    assert.equal(edge, undefined, "a disabled code attributes nothing (FC-7)")
  })
})
