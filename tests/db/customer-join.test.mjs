import { after, test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"

/**
 * customer join — live-DB invariant tier.
 *
 * Proves the atomic enrol-plus-first-stamp (J-6) and idempotent re-join (J-7)
 * via the real `join_customer_membership_with_first_stamp` RPC, inside a
 * rolled-back transaction with a freshly-created customer so nothing persists.
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
        where bc.merchant_id = m.id and bc.status in ('trialing', 'active')
      )
    )
  order by q.created_at
  limit 1`

test(
  "J-6/J-7: a QR join enrols + issues the first stamp atomically, and re-join is idempotent",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [qr] = await tx.unsafe(PICK_QR)
      assert.ok(qr, "an active QR for a billing-eligible merchant exists")

      // A brand-new verified customer (email contact satisfies the contact
      // constraint; the app verifies identity before calling the RPC).
      const [customer] = await tx`
        insert into public.customers (email, email_verified_at, created_at, updated_at)
        values (${`e2e-${randomUUID()}@test.local`}, now(), now(), now())
        returning id`
      assert.ok(customer?.id, "created a fresh customer")

      // J-6: join + first stamp in one RPC call.
      const [first] = await tx`
        select * from public.join_customer_membership_with_first_stamp(
          ${customer.id}::uuid, ${qr.business_slug}, ${qr.qr_id}, false, '2026-06-06')`
      assert.equal(first.created_membership, true, "a new membership is created")
      assert.equal(
        first.first_stamp_issued,
        true,
        "the first stamp is issued atomically when joining from a QR"
      )

      const [{ memberships }] = await tx`
        select count(*)::int as memberships from public.customer_memberships
        where customer_id = ${customer.id} and merchant_id = ${qr.merchant_id}`
      assert.equal(memberships, 1, "exactly one membership for the customer+merchant")

      const [{ stamps }] = await tx`
        select count(*)::int as stamps from public.stamp_events
        where membership_id = ${first.membership_id} and event_type = 'earned'`
      assert.equal(stamps, 1, "exactly one earned stamp from the join")

      // J-7: re-joining the same merchant returns the existing membership.
      const [again] = await tx`
        select * from public.join_customer_membership_with_first_stamp(
          ${customer.id}::uuid, ${qr.business_slug}, ${qr.qr_id}, false, '2026-06-06')`
      assert.equal(again.created_membership, false, "re-join does not create a duplicate")
      assert.equal(again.membership_id, first.membership_id, "same membership returned")

      const [{ memberships: after2 }] = await tx`
        select count(*)::int as memberships from public.customer_memberships
        where customer_id = ${customer.id} and merchant_id = ${qr.merchant_id}`
      assert.equal(after2, 1, "still exactly one membership after re-join")
    })
  }
)
