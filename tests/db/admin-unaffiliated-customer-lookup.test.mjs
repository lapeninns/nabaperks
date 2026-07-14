import { after, test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"

import { closeDb, db, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"

/**
 * db privacy lifecycle — verified customers with no membership must be
 * discoverable by admins.
 *
 * The admin lookups query FROM `customer_memberships`, so a verified customer
 * who never joined a venue is invisible. A service-role-only
 * `customers_unaffiliated` view exposes exactly those customers (excluding
 * erased surrogates) so the privacy console can list and service them.
 */

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(async () => {
  await closeDb()
})

const PICK = /* sql */ `
  select m.id as merchant_id, m.business_slug, q.qr_id
  from public.merchants m
  join public.loyalty_cards lc on lc.merchant_id = m.id and lc.is_active
  join public.qr_codes q
    on q.merchant_id = m.id and q.is_active and q.destination_type = 'join'
   and q.loyalty_card_id = lc.id
  where m.business_slug = 'old-crown-girton' and m.status in ('trial', 'active')
  limit 1`

test("customers_unaffiliated is service-role only", { skip }, async () => {
  const [{ svc }] = await db()`
    select has_table_privilege('service_role', 'public.customers_unaffiliated', 'SELECT') as svc`
  assert.equal(svc, true, "service_role can select the view")

  for (const role of ["authenticated", "anon"]) {
    const [{ can }] = await db()`
      select has_table_privilege(${role}, 'public.customers_unaffiliated', 'SELECT') as can`
    assert.equal(can, false, `${role} must not be able to select the view`)
  }
})

test(
  "customers_unaffiliated includes verified no-membership customers and excludes the rest",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [v] = await tx.unsafe(PICK)
      assert.ok(v, "the seeded journey venue exists")

      // (1) a verified customer with NO membership — should appear, verified.
      const [unaffiliated] = await tx`
        insert into public.customers
          (email, email_verified_at, full_name, phone_last4, created_at, updated_at)
        values (${`solo-${randomUUID()}@test.local`}, now(), 'Solo Verified',
                '1122', now(), now())
        returning id`

      // (2) a customer WITH a membership — should be excluded.
      const [member] = await tx`
        insert into public.customers
          (email, email_verified_at, created_at, updated_at)
        values (${`member-${randomUUID()}@test.local`}, now(), now(), now())
        returning id`
      await tx`select * from public.join_customer_membership_with_first_stamp(
        ${member.id}::uuid, ${v.business_slug}, ${v.qr_id}, false, '2026-06-06')`

      // (3) an erased surrogate with no membership — should be excluded.
      const [erased] = await tx`
        insert into public.customers
          (email, phone_last4, created_at, updated_at)
        values (${`erased+${randomUUID().replace(/-/g, "")}@privacy.invalid`},
                '0000', now(), now())
        returning id`

      const rows = await tx`
        select id, is_verified from public.customers_unaffiliated
        where id in (${unaffiliated.id}, ${member.id}, ${erased.id})`
      const byId = new Map(rows.map((r) => [r.id, r]))

      assert.ok(byId.has(unaffiliated.id), "the verified no-membership customer is listed")
      assert.equal(byId.get(unaffiliated.id).is_verified, true, "it is flagged verified")
      assert.ok(!byId.has(member.id), "a customer with a membership is excluded")
      assert.ok(!byId.has(erased.id), "an erased surrogate is excluded")
    })
  }
)
