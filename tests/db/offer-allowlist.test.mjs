import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { after, test } from "node:test"

import { closeDb, db, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"

/**
 * DB integration tier for the Offers pilot allowlist.
 *
 * `admin_set_merchant_offer_campaigns` was already named in the privilege
 * containment array, but that array asserts the SHAPE of the grant — who may
 * execute the function — and says nothing about what happens when they do. A
 * function can be correctly granted and still let the wrong caller through, or
 * write no audit row, or fail to persist. These tests execute it.
 *
 * The GRANT layer is proved separately from the function body: every call runs
 * through `asAuthenticated`, which switches to the real `authenticated`
 * Postgres role so table GRANTs and RLS both apply, and `expectDenied` accepts
 * nothing but SQLSTATE 42501 or an RLS-empty result. Every write is inside
 * `inRolledBackTxn`.
 *
 * Skips cleanly when the RPC is not deployed, so the DB-free gates are never
 * blocked by a missing database.
 */

async function allowlistDbReady() {
  if (!(await isLiveDbReady())) return false
  try {
    const [{ n }] = await db()`
      select count(*)::int as n from pg_proc
      where proname = 'admin_set_merchant_offer_campaigns'`
    return n >= 1
  } catch {
    return false
  }
}

const ready = await allowlistDbReady()
const skip = ready
  ? false
  : "live Supabase DB with the offers allowlist RPC not reachable"

after(async () => {
  await closeDb()
})

/** Runs `fn` as the real `authenticated` role, so GRANTs and RLS both apply. */
async function asAuthenticated(tx, userId, fn) {
  return tx.savepoint(async (sp) => {
    const claims = JSON.stringify({ sub: userId, role: "authenticated" })
    await sp`set local role authenticated`
    await sp`select set_config('request.jwt.claims', ${claims}, true)`
    await sp`select set_config('request.jwt.claim.role', 'authenticated', true)`
    await sp`select set_config('request.jwt.claim.sub', ${userId}, true)`
    try {
      return await fn(sp)
    } finally {
      await sp`reset role`
      await sp`select set_config('request.jwt.claims', '', true)`
      await sp`select set_config('request.jwt.claim.role', 'service_role', true)`
    }
  })
}

/**
 * True only for a genuine authorisation denial (SQLSTATE 42501) or an empty
 * result. A missing column or a typo must never read as a pass.
 */
async function expectDenied(tx, userId, fn) {
  try {
    const result = await asAuthenticated(tx, userId, fn)
    return (result?.count ?? 0) === 0
  } catch (error) {
    if (error?.code === "42501") return true
    throw error
  }
}

/** A fresh, active internal admin with no enrolled authenticator. */
async function freshAdmin(tx) {
  const userId = randomUUID()
  await tx`insert into auth.users (id) values (${userId}::uuid)`
  await tx`
    insert into public.internal_admins (user_id, email, is_active)
    values (${userId}::uuid, ${`admin-${userId}@nabaperks.test`}, true)`
  return userId
}

/** Any seeded venue — the allowlist is per-merchant and cares about no other column. */
async function anyMerchant(tx) {
  const [merchant] = await tx`
    select id, offer_campaigns_enabled
    from public.merchants
    order by created_at
    limit 1`
  return merchant
}

async function offersEnabled(tx, merchantId) {
  const [row] = await tx`
    select offer_campaigns_enabled as enabled
    from public.merchants where id = ${merchantId}::uuid`
  return row.enabled
}

function setAllowlist(tx, merchantId, enabled) {
  return tx`
    select public.admin_set_merchant_offer_campaigns(
      ${merchantId}::uuid, ${enabled}) as updated`
}

test(
  "a signed-in non-admin cannot move a venue in or out of the Offers pilot",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const merchant = await anyMerchant(tx)
      assert.ok(merchant, "a seeded merchant exists")

      const stranger = randomUUID()
      await tx`insert into auth.users (id) values (${stranger}::uuid)`

      assert.ok(
        await expectDenied(tx, stranger, (sp) =>
          setAllowlist(sp, merchant.id, true)
        ),
        "a non-admin calling the allowlist RPC is refused"
      )

      assert.equal(
        await offersEnabled(tx, merchant.id),
        merchant.offer_campaigns_enabled,
        "the refused call changed nothing"
      )
    })
  }
)

test(
  "an internal admin turns the pilot on and off, and the value round-trips",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const merchant = await anyMerchant(tx)
      assert.ok(merchant, "a seeded merchant exists")
      const adminId = await freshAdmin(tx)

      const [turnedOn] = await asAuthenticated(tx, adminId, (sp) =>
        setAllowlist(sp, merchant.id, true)
      )
      assert.equal(turnedOn.updated, true, "the RPC reports the venue updated")
      assert.equal(
        await offersEnabled(tx, merchant.id),
        true,
        "the venue is inside the pilot"
      )

      const [turnedOff] = await asAuthenticated(tx, adminId, (sp) =>
        setAllowlist(sp, merchant.id, false)
      )
      assert.equal(turnedOff.updated, true)
      assert.equal(
        await offersEnabled(tx, merchant.id),
        false,
        "the venue is outside the pilot again"
      )
    })
  }
)

test(
  "every allowlist change leaves an audit row naming the admin and the value",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const merchant = await anyMerchant(tx)
      assert.ok(merchant, "a seeded merchant exists")
      const adminId = await freshAdmin(tx)

      await asAuthenticated(tx, adminId, (sp) =>
        setAllowlist(sp, merchant.id, true)
      )
      await asAuthenticated(tx, adminId, (sp) =>
        setAllowlist(sp, merchant.id, false)
      )

      const trail = await tx`
        select actor_type, actor_id, merchant_id, target_table, metadata
        from public.audit_logs
        where action = 'offer_campaigns_allowlist_set'
          and target_id = ${merchant.id}::uuid
          and actor_id = ${adminId}
        order by created_at`

      assert.equal(trail.length, 2, "both changes are recorded")
      assert.deepEqual(
        trail.map((row) => row.metadata.enabled),
        [true, false],
        "the audit trail records which way each change went"
      )
      for (const row of trail) {
        assert.equal(row.actor_type, "admin")
        assert.equal(row.merchant_id, merchant.id)
        assert.equal(row.target_table, "merchants")
      }
    })
  }
)

test(
  "the allowlist column is not writable directly, so the RPC is the only route",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const merchant = await anyMerchant(tx)
      assert.ok(merchant, "a seeded merchant exists")
      const adminId = await freshAdmin(tx)

      // `authenticated` holds column-level UPDATE on four profile columns only
      // (20260801130000), so even an internal admin cannot set this column with
      // their own session. The admin surface therefore cannot quietly drift to a
      // table update and lose the guard and the audit row with it.
      assert.ok(
        await expectDenied(
          tx,
          adminId,
          (sp) => sp`
            update public.merchants set offer_campaigns_enabled = true
            where id = ${merchant.id}::uuid`
        ),
        "a direct write to offer_campaigns_enabled is refused"
      )
    })
  }
)

test(
  "an allowlist change against a merchant that no longer exists reports false",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const adminId = await freshAdmin(tx)
      const missing = randomUUID()

      const [result] = await asAuthenticated(tx, adminId, (sp) =>
        setAllowlist(sp, missing, true)
      )
      assert.equal(result.updated, false, "nothing was updated")

      const [{ n }] = await tx`
        select count(*)::int as n from public.audit_logs
        where action = 'offer_campaigns_allowlist_set'
          and target_id = ${missing}::uuid`
      assert.equal(n, 0, "a no-op writes no audit row")
    })
  }
)
