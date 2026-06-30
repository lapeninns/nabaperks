import { after, test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"

/**
 * MS-admin-console / MS-customer-home (erasure) — live-DB tier.
 *
 * GDPR erasure was previously covered ONLY by grepping migration SQL text. This
 * EXECUTES `admin_erase_customer_pii` and proves the three things that matter:
 *   1. it is admin-gated (a non-admin caller is refused),
 *   2. it anonymises contact PII (email → erased+{uuid}@privacy.invalid, name /
 *      DOB / phone nulled), bypassing the verified-contact-immutability trigger,
 *   3. it RETAINS the loyalty ledger (membership + stamp history survive).
 *
 * Correction baked in: there is NO customer-initiated erasure entry point in the
 * app (app/privacy/page.tsx is prose-only); erasure is admin-executed on
 * request. The seeded internal admin is user_id 00000000-…-001.
 */

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(async () => {
  await closeDb()
})

const ADMIN_UID = "00000000-0000-0000-0000-000000000001"

const PICK = /* sql */ `
  select m.id as merchant_id, m.business_slug, q.qr_id
  from public.merchants m
  join public.loyalty_cards lc on lc.merchant_id = m.id and lc.is_active
  join public.qr_codes q
    on q.merchant_id = m.id and q.is_active and q.destination_type = 'join'
   and q.loyalty_card_id = lc.id
  where m.business_slug = 'old-crown-girton' and m.status in ('trial', 'active')
  limit 1`

test(
  "erasure: admin-gated, anonymises PII, retains the loyalty ledger",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [v] = await tx.unsafe(PICK)
      assert.ok(v, "the seeded journey venue exists")

      // A real customer with full contact PII and a real ledger to protect.
      const [customer] = await tx`
        insert into public.customers
          (email, email_verified_at, full_name, date_of_birth,
           phone_last4, phone_verified_at, created_at, updated_at)
        values (${`erase-${randomUUID()}@test.local`}, now(), 'Erase Me',
                '1988-02-02', '4321', now(), now(), now())
        returning id`
      const [joined] = await tx`
        select * from public.join_customer_membership_with_first_stamp(
          ${customer.id}::uuid, ${v.business_slug}, ${v.qr_id}, false, '2026-06-06')`
      const membershipId = joined.membership_id
      const stampsBefore = (
        await tx`select count(*)::int as n from public.stamp_events
                 where membership_id = ${membershipId} and event_type = 'earned'`
      )[0].n
      assert.ok(stampsBefore >= 1, "the customer has a real stamp ledger before erasure")

      // ---- Admin gate: a NON-admin auth context is refused.
      let refusedNonAdmin = false
      try {
        await tx.savepoint(async (sp) => {
          await sp`select set_config('request.jwt.claim.sub', ${randomUUID()}, true)`
          await sp`select public.admin_erase_customer_pii(
            ${customer.id}::uuid, ${v.merchant_id}::uuid, 'email', 'unauthorised attempt')`
        })
      } catch (error) {
        refusedNonAdmin = /privilege|admin|not authori/i.test(String(error.message))
      }
      assert.ok(refusedNonAdmin, "a non-admin caller cannot erase a customer")

      // ---- Authorised erasure as the seeded internal admin.
      await tx`select set_config('request.jwt.claim.sub', ${ADMIN_UID}, true)`
      const [{ uid }] = await tx`select (auth.uid())::text as uid`
      assert.equal(uid, ADMIN_UID, "auth context is the internal admin")

      const [{ result }] = await tx`
        select public.admin_erase_customer_pii(
          ${customer.id}::uuid, ${v.merchant_id}::uuid, 'email',
          'Customer-requested erasure, verified via email.') as result`
      assert.equal(result.ok, true, "erasure reports success")
      assert.equal(result.ledger_retained, true, "erasure reports the ledger is retained")

      // ---- PII is anonymised.
      const [erased] = await tx`
        select email, full_name, date_of_birth, phone, phone_hmac,
               phone_ciphertext, phone_last4, auth_user_id, email_verified_at
        from public.customers where id = ${customer.id}`
      assert.match(
        erased.email,
        /^erased\+[0-9a-f]+@privacy\.invalid$/i,
        "email is masked to a privacy surrogate"
      )
      assert.equal(erased.full_name, null, "full name is nulled")
      assert.equal(erased.date_of_birth, null, "date of birth is nulled")
      assert.equal(erased.phone_last4, null, "phone last4 is nulled")
      assert.equal(erased.email_verified_at, null, "email verification is cleared")

      // ---- The loyalty ledger is RETAINED (the whole point of anonymise-not-delete).
      const [{ n: membershipsAfter }] = await tx`
        select count(*)::int as n from public.customer_memberships where id = ${membershipId}`
      assert.equal(membershipsAfter, 1, "membership row is retained")
      const [{ n: stampsAfter }] = await tx`
        select count(*)::int as n from public.stamp_events
        where membership_id = ${membershipId} and event_type = 'earned'`
      assert.equal(stampsAfter, stampsBefore, "stamp ledger is fully retained")
    })
  }
)
