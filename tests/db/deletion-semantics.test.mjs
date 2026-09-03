import { after, test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"
import { actAsActivatedInternalAdmin } from "./helpers/admin-auth.mjs"

/**
 * db deletion semantics — live-DB tier.
 *
 * The 2026-07-04 prod incident deleted auth users and the CASCADE chain took
 * the whole loyalty ledger with them. This suite pins the corrected deletion
 * semantics:
 *   1. an auth-user delete is REFUSED while its public.customers row exists
 *      (customers.auth_user_id is ON DELETE RESTRICT), and succeeds once the
 *      customers row has been explicitly removed first;
 *   2. deleting a customers row PRESERVES its consent_records rows with a
 *      nulled customer reference — PECR/UK-GDPR consent evidence outlives the
 *      account, matching audit_logs/fraud_flags survival;
 *   3. admin_erase_customer_pii leaves consent rows present and unmodified;
 *   4. the explicit customer-row delete still cascades the loyalty ledger
 *      (membership + stamp events) exactly as before this change.
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

/** Auth user + linked customer with a real membership, stamp, and consent row. */
async function seedLinkedCustomer(tx) {
  const [v] = await tx.unsafe(PICK)
  assert.ok(v, "the seeded journey venue exists")

  const authId = randomUUID()
  await tx`insert into auth.users (id) values (${authId}::uuid)`

  const [customer] = await tx`
    insert into public.customers
      (auth_user_id, email, email_verified_at, full_name, created_at, updated_at)
    values (${authId}::uuid, ${`deletion-${randomUUID()}@test.local`}, now(),
            'Deletion Semantics', now(), now())
    returning id`

  const [joined] = await tx`
    select * from public.join_customer_membership_with_first_stamp(
      ${customer.id}::uuid, ${v.business_slug}, ${v.qr_id}, false, '2026-06-06')`

  const [consent] = await tx`
    insert into public.consent_records
      (merchant_id, customer_id, channel, consent_status, source, policy_version)
    values (${v.merchant_id}::uuid, ${customer.id}::uuid, 'email', 'opted_in',
            'customer_profile', '2026-06-06')
    returning id`

  return {
    venue: v,
    authId,
    customerId: customer.id,
    membershipId: joined.membership_id,
    consentId: consent.id,
  }
}

test(
  "deletion semantics: an auth-user delete is refused while the customers row exists",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const { authId, customerId } = await seedLinkedCustomer(tx)

      let refused = false
      try {
        await tx.savepoint(async (sp) => {
          await sp`delete from auth.users where id = ${authId}::uuid`
        })
      } catch (error) {
        refused =
          error?.code === "23503" ||
          /foreign key|violates/i.test(String(error.message))
      }
      assert.ok(
        refused,
        "deleting the auth user must fail with a foreign-key violation while the customers row exists"
      )

      const [{ n: customersAfter }] = await tx`
        select count(*)::int as n from public.customers where id = ${customerId}`
      assert.equal(
        customersAfter,
        1,
        "the customers row (and its ledger) survives the refused delete"
      )

      // The sanctioned order: remove the customers row first, then the auth user.
      await tx`delete from public.customers where id = ${customerId}`
      await tx`delete from auth.users where id = ${authId}::uuid`
      const [{ n: authAfter }] = await tx`
        select count(*)::int as n from auth.users where id = ${authId}::uuid`
      assert.equal(
        authAfter,
        0,
        "the auth user can be deleted once the customers row is gone"
      )
    })
  }
)

test(
  "deletion semantics: consent evidence survives a customer-row delete with a nulled reference",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const { customerId, consentId } = await seedLinkedCustomer(tx)

      await tx`delete from public.customers where id = ${customerId}`

      const [consent] = await tx`
        select customer_id, merchant_id, channel, consent_status, source, policy_version
        from public.consent_records where id = ${consentId}`
      assert.ok(consent, "the consent row survives the customer-row delete")
      assert.equal(
        consent.customer_id,
        null,
        "the customer reference is nulled, not cascaded"
      )
      assert.equal(consent.channel, "email", "channel evidence is retained")
      assert.equal(
        consent.consent_status,
        "opted_in",
        "status evidence is retained"
      )
      assert.equal(
        consent.source,
        "customer_profile",
        "source evidence is retained"
      )
      assert.equal(
        consent.policy_version,
        "2026-06-06",
        "policy version evidence is retained"
      )
      assert.ok(consent.merchant_id, "merchant attribution is retained")
    })
  }
)

test(
  "deletion semantics: admin erasure leaves consent rows present and unmodified",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const { venue, customerId, consentId } = await seedLinkedCustomer(tx)

      await actAsActivatedInternalAdmin(tx, ADMIN_UID)
      const [{ result }] = await tx`
        select public.admin_erase_customer_pii(
          ${customerId}::uuid, ${venue.merchant_id}::uuid, 'email',
          'Deletion-semantics suite: erasure must not touch consent evidence.') as result`
      assert.equal(result.ok, true, "erasure reports success")

      const [consent] = await tx`
        select customer_id, channel, consent_status, policy_version
        from public.consent_records where id = ${consentId}`
      assert.ok(consent, "the consent row is still present after erasure")
      assert.equal(
        consent.customer_id,
        customerId,
        "erasure keeps the customer reference intact"
      )
      assert.equal(
        consent.consent_status,
        "opted_in",
        "erasure does not rewrite consent evidence"
      )
    })
  }
)

test(
  "deletion semantics: an explicit customer-row delete still cascades the loyalty ledger",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const { customerId, membershipId } = await seedLinkedCustomer(tx)

      const [{ n: stampsBefore }] = await tx`
        select count(*)::int as n from public.stamp_events where membership_id = ${membershipId}`
      assert.ok(
        stampsBefore >= 1,
        "the membership has a stamp ledger before deletion"
      )

      await tx`delete from public.customers where id = ${customerId}`

      const [{ n: memberships }] = await tx`
        select count(*)::int as n from public.customer_memberships where id = ${membershipId}`
      assert.equal(
        memberships,
        0,
        "the membership cascades away with the customers row"
      )
      const [{ n: stamps }] = await tx`
        select count(*)::int as n from public.stamp_events where membership_id = ${membershipId}`
      assert.equal(
        stamps,
        0,
        "the stamp ledger cascades away with the customers row"
      )
    })
  }
)
