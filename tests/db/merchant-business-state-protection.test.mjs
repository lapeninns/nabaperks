import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { after, test } from "node:test"

import { closeDb, db, isLiveDbReady } from "./helpers/db.mjs"
import { ensureActivatedInternalAdmin } from "./helpers/admin-auth.mjs"

/**
 * db emergency containment — Blocker 2: merchant owners can bypass billing.
 *
 * `authenticated` holds broad table mutation grants and the merchants UPDATE
 * policy only checks ownership, so an owner can run
 * `update merchants set requires_billing = false` (or flip `status` to
 * 'active') directly and make `loyalty_availability_reason` treat the venue as
 * live without ever paying. A BEFORE UPDATE trigger must refuse changes to the
 * protected business-state columns from any non-privileged session while
 * leaving service_role and internal-admin writers untouched.
 */

after(closeDb)

async function withMerchant(claims, run) {
  const ROLLBACK = Symbol("rollback")
  let captured
  try {
    await db().begin(async (tx) => {
      const ownerId = randomUUID()
      const merchantId = randomUUID()
      const short = merchantId.slice(0, 8)
      // Seed as a privileged session so the insert itself is never blocked.
      await tx`select set_config('request.jwt.claim.role', 'service_role', true)`
      await tx`insert into auth.users (id) values (${ownerId}::uuid)`
      await tx`
        insert into public.merchants (
          id, owner_user_id, business_name, business_slug, business_type, email,
          status, requires_billing
        ) values (
          ${merchantId}::uuid, ${ownerId}::uuid, ${`Protect ${short}`},
          ${`protect-${short}`}, 'pub', ${`protect-${short}@example.test`},
          'trial', true
        )`
      await tx`
        insert into public.merchant_locations (id, merchant_id, name)
        values (${randomUUID()}::uuid, ${merchantId}::uuid, ${`Protect ${short}`})`

      // Switch to the caller context under test.
      await tx`select set_config('request.jwt.claim.role', ${claims.role}, true)`
      await tx`select set_config('request.jwt.claim.sub', ${claims.sub ?? ownerId}, true)`
      if (claims.aal)
        await tx`select set_config('request.jwt.claim.aal', ${claims.aal}, true)`

      captured = await run(tx, { merchantId, ownerId })
      throw ROLLBACK
    })
  } catch (error) {
    if (error !== ROLLBACK) throw error
  }
  return captured
}

test("an owner cannot flip requires_billing directly", async (t) => {
  if (!(await isLiveDbReady())) return t.skip("no live DB")

  await assert.rejects(
    withMerchant({ role: "authenticated" }, async (tx, { merchantId }) => {
      await tx`update public.merchants set requires_billing = false where id = ${merchantId}::uuid`
    }),
    (error) => {
      assert.match(
        String(error.message),
        /billing|protected|not authorized|privilege/i
      )
      return true
    }
  )
})

test("an owner cannot flip status to active directly", async (t) => {
  if (!(await isLiveDbReady())) return t.skip("no live DB")

  await assert.rejects(
    withMerchant({ role: "authenticated" }, async (tx, { merchantId }) => {
      await tx`update public.merchants set status = 'active' where id = ${merchantId}::uuid`
    }),
    (error) => {
      assert.match(
        String(error.message),
        /status|protected|not authorized|privilege/i
      )
      return true
    }
  )
})

test("an owner venue rename keeps the location mirror synchronized", async (t) => {
  if (!(await isLiveDbReady())) return t.skip("no live DB")

  const names = await withMerchant(
    { role: "authenticated" },
    async (tx, { merchantId }) => {
      await tx`update public.merchants set business_name = 'Renamed Venue' where id = ${merchantId}::uuid`
      const [row] = await tx`
      select merchants.business_name, merchant_locations.name as location_name
      from public.merchants
      join public.merchant_locations on merchant_locations.merchant_id = merchants.id
      where merchants.id = ${merchantId}::uuid`
      return row
    }
  )

  assert.deepEqual(names, {
    business_name: "Renamed Venue",
    location_name: "Renamed Venue",
  })
})

test("a direct location write cannot create a second venue name", async (t) => {
  if (!(await isLiveDbReady())) return t.skip("no live DB")

  const locationName = await withMerchant(
    { role: "authenticated" },
    async (tx, { merchantId }) => {
      await tx`
        update public.merchant_locations
        set name = 'Forged branch name'
        where merchant_id = ${merchantId}::uuid`
      const [row] = await tx`
        select name from public.merchant_locations
        where merchant_id = ${merchantId}::uuid`
      return row.name
    }
  )

  assert.match(locationName, /^Protect /)
})

test("service_role may change the protected columns", async (t) => {
  if (!(await isLiveDbReady())) return t.skip("no live DB")

  const result = await withMerchant(
    { role: "service_role" },
    async (tx, { merchantId }) => {
      await tx`update public.merchants set requires_billing = false, status = 'active' where id = ${merchantId}::uuid`
      const [row] =
        await tx`select requires_billing, status from public.merchants where id = ${merchantId}::uuid`
      return row
    }
  )

  assert.equal(result.requires_billing, false)
  assert.equal(result.status, "active")
})

test("an internal admin may change the protected columns", async (t) => {
  if (!(await isLiveDbReady())) return t.skip("no live DB")

  const result = await withMerchant(
    { role: "authenticated", aal: "aal2" },
    async (tx, { merchantId, ownerId }) => {
      // Promote the acting session to an internal admin.
      await tx`insert into public.internal_admins (user_id, email, is_active)
               values (${ownerId}::uuid, ${`admin-${ownerId.slice(0, 8)}@example.test`}, true)
               on conflict (user_id) do update set is_active = true`
      await ensureActivatedInternalAdmin(tx, ownerId)
      await tx`update public.merchants set requires_billing = false where id = ${merchantId}::uuid`
      const [row] =
        await tx`select requires_billing from public.merchants where id = ${merchantId}::uuid`
      return row
    }
  )

  assert.equal(result.requires_billing, false)
})
