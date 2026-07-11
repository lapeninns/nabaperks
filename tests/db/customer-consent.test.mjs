import { after, test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"

/**
 * MS-customer-home (consent) — live-DB tier.
 *
 * Marketing consent was previously covered only by source-grep. This executes
 * the real `record_customer_marketing_consent` RPC and proves the GDPR-relevant
 * behaviours: consent is append-only (a toggle never mutates a prior row), it
 * writes one audit row PER membership (so every merchant's trail stays
 * independently complete), and a customer with no memberships is a silent no-op.
 *
 * Note: within one transaction `now()` is constant, so the app's
 * "latest-row-per-channel wins" read cannot be asserted by timestamp here; it is
 * an app-read concern. This tier proves the write/audit invariants.
 */

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(async () => {
  await closeDb()
})

// Two distinct billing-eligible merchants that each have an active join QR.
const PICK_TWO = /* sql */ `
  select distinct on (m.id) m.id as merchant_id, m.business_slug, q.qr_id
  from public.merchants m
  join public.loyalty_cards lc on lc.merchant_id = m.id and lc.is_active
  join public.qr_codes q
    on q.merchant_id = m.id and q.is_active and q.destination_type = 'join'
   and q.loyalty_card_id = lc.id
  where m.status in ('trial', 'active')
    and (
      m.requires_billing = false
      or exists (select 1 from public.billing_customers bc
                 where bc.merchant_id = m.id and bc.status in ('trialing', 'active'))
    )
  order by m.id, q.created_at
  limit 2`

const POLICY = "2026-06-06"

test(
  "consent: append-only, one audit row per membership, zero-membership is a no-op",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const venues = await tx.unsafe(PICK_TWO)
      assert.equal(venues.length, 2, "two billing-eligible join venues are seeded")

      const [customer] = await tx`
        insert into public.customers (email, email_verified_at, created_at, updated_at)
        values (${`e2e-${randomUUID()}@test.local`}, now(), now(), now())
        returning id`

      // Enrol the customer at BOTH merchants.
      for (const venue of venues) {
        await tx`
          select public.join_customer_membership_with_first_stamp(
            ${customer.id}::uuid, ${venue.business_slug}, ${venue.qr_id}, false, ${POLICY})`
      }
      const [{ n: memberships }] = await tx`
        select count(*)::int as n from public.customer_memberships
        where customer_id = ${customer.id}`
      assert.equal(memberships, 2, "customer has two memberships")

      const emailRows = async (status) => {
        const [{ n }] = await tx`
          select count(*)::int as n from public.consent_records
          where customer_id = ${customer.id} and channel = 'email'
            ${status ? tx`and consent_status = ${status}` : tx``}`
        return n
      }

      // Opt IN to email marketing → one row PER membership (audit trail per venue).
      await tx`select public.record_customer_marketing_consent(
        ${customer.id}::uuid, 'email', 'opted_in', ${POLICY})`
      assert.equal(await emailRows("opted_in"), 2, "opt-in writes one row per membership")

      // Opt OUT → APPENDS, does not mutate: the opted_in rows survive.
      await tx`select public.record_customer_marketing_consent(
        ${customer.id}::uuid, 'email', 'opted_out', ${POLICY})`
      assert.equal(await emailRows("opted_in"), 2, "append-only: prior opt-in rows are untouched")
      assert.equal(await emailRows("opted_out"), 2, "opt-out appends one row per membership")
      assert.equal(await emailRows(), 4, "two toggles × two memberships = four audit rows")

      // Policy version is stamped on every consent row.
      const [{ n: stamped }] = await tx`
        select count(*)::int as n from public.consent_records
        where customer_id = ${customer.id} and policy_version = ${POLICY}`
      assert.equal(stamped, 4, "every consent row carries the policy version")

      // A customer with NO memberships: the per-membership loop writes nothing.
      const [orphan] = await tx`
        insert into public.customers (email, email_verified_at, created_at, updated_at)
        values (${`e2e-${randomUUID()}@test.local`}, now(), now(), now())
        returning id`
      await tx`select public.record_customer_marketing_consent(
        ${orphan.id}::uuid, 'email', 'opted_in', ${POLICY})`
      const [{ n: orphanRows }] = await tx`
        select count(*)::int as n from public.consent_records where customer_id = ${orphan.id}`
      assert.equal(orphanRows, 0, "zero-membership consent toggle persists nothing")
    })
  }
)
