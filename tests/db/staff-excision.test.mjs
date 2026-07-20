import { after, test } from "node:test"
import assert from "node:assert/strict"

import { closeDb, db, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"

/**
 * db staff excision — live-DB tier.
 *
 * The staff subsystem was reachable from nothing (zero importers of the lib
 * module, no routes, no UI). This suite pins the excision AND the part that
 * must not move: is_staff_for_merchant sat inside NINE SELECT policies, so
 * every policy rewrite must grant owners and admins exactly what they had,
 * and other tenants exactly nothing.
 */

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(async () => {
  await closeDb()
})

// Seeded fixtures (supabase/seed.sql): two venues + an admin. Owners are
// derived from the live rows at test time — local fixture seeds (e.g. the
// +32 perf fixture) may reassign a venue's owner, and this test proves
// owner-scoped access, not a particular owner identity.
const ADMIN = "00000000-0000-0000-0000-000000000001"
const MERCHANT_A = "10000000-0000-0000-0000-000000000001" // Old Crown Girton
const MERCHANT_B = "10000000-0000-0000-0000-000000000002" // Bubble Yard

async function seededOwner(tx, merchantId) {
  const [row] = await tx`
    select owner_user_id from public.merchants where id = ${merchantId}::uuid
  `
  assert.ok(row?.owner_user_id, `merchant ${merchantId} must have a seeded owner`)
  return row.owner_user_id
}

test("the staff subsystem is gone from the schema", { skip }, async () => {
  const sql = db()
  const tables = await sql.unsafe(
    `select tablename from pg_tables where schemaname='public' and tablename='staff_users'`
  )
  assert.equal(tables.length, 0, "staff_users must be dropped")

  const functions = await sql.unsafe(
    `select proname from pg_proc
     where pronamespace='public'::regnamespace
       and proname in ('add_staff_member','set_staff_member_active','is_staff_for_merchant')`
  )
  assert.equal(functions.length, 0, "all three staff functions must be dropped")

  const staffArms = await sql.unsafe(
    `select polname from pg_policy where pg_get_expr(polqual, polrelid) like '%is_staff_for_merchant%'`
  )
  assert.equal(staffArms.length, 0, "no policy may keep a staff arm")
})

test("the two staff-named policies are renamed, the seven scoped ones survive", { skip }, async () => {
  const sql = db()
  const rows = await sql.unsafe(
    `select polname from pg_policy where polname in (
       'qr_codes_select_owner_admin','reward_pool_items_select_owner_admin',
       'qr_codes_select_owner_staff_admin','reward_pool_items_select_owner_staff_admin',
       'merchants_select_owned_or_admin','merchant_locations_select_scoped',
       'loyalty_cards_select_scoped','customer_memberships_select_scoped',
       'stamp_events_select_scoped','reward_events_select_scoped','audit_logs_select_scoped')`
  )
  const names = rows.map((row) => row.polname).sort()
  assert.ok(names.includes("qr_codes_select_owner_admin"), "qr_codes policy renamed")
  assert.ok(
    names.includes("reward_pool_items_select_owner_admin"),
    "reward_pool_items policy renamed"
  )
  assert.ok(!names.includes("qr_codes_select_owner_staff_admin"), "old qr_codes name gone")
  assert.ok(
    !names.includes("reward_pool_items_select_owner_staff_admin"),
    "old reward_pool_items name gone"
  )
  for (const scoped of [
    "merchants_select_owned_or_admin",
    "merchant_locations_select_scoped",
    "loyalty_cards_select_scoped",
    "customer_memberships_select_scoped",
    "stamp_events_select_scoped",
    "reward_events_select_scoped",
    "audit_logs_select_scoped",
  ]) {
    assert.ok(names.includes(scoped), `${scoped} still exists under its own name`)
  }
})

test("owner and admin access is unchanged; other tenants stay locked out", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const OWNER_A = await seededOwner(tx, MERCHANT_A)
    const OWNER_B = await seededOwner(tx, MERCHANT_B)

    const ownQr = await asAuthenticatedUser(tx, OWNER_A, (sp) =>
      sp`select id from public.qr_codes where merchant_id = ${MERCHANT_A}::uuid`
    )
    assert.ok(ownQr.length >= 1, "the owner still sees their own QR codes")

    const ownPool = await asAuthenticatedUser(tx, OWNER_A, (sp) =>
      sp`select id from public.reward_pool_items where merchant_id = ${MERCHANT_A}::uuid`
    )
    assert.ok(ownPool.length >= 3, "the owner still sees their reward pool")

    const adminQr = await asAuthenticatedUser(tx, ADMIN, (sp) =>
      sp`select id from public.qr_codes where merchant_id = ${MERCHANT_A}::uuid`
    )
    assert.ok(adminQr.length >= 1, "the internal admin still sees merchant QR codes")

    const foreignQr = await asAuthenticatedUser(tx, OWNER_B, (sp) =>
      sp`select id from public.qr_codes where merchant_id = ${MERCHANT_A}::uuid`
    )
    assert.equal(foreignQr.length, 0, "another tenant's owner sees none of merchant A's QR codes")

    const foreignPool = await asAuthenticatedUser(tx, OWNER_B, (sp) =>
      sp`select id from public.reward_pool_items where merchant_id = ${MERCHANT_A}::uuid`
    )
    assert.equal(foreignPool.length, 0, "another tenant's owner sees none of merchant A's pool")

    const foreignMemberships = await asAuthenticatedUser(tx, OWNER_B, (sp) =>
      sp`select id from public.customer_memberships where merchant_id = ${MERCHANT_A}::uuid`
    )
    assert.equal(
      foreignMemberships.length,
      0,
      "the rewritten scoped policies keep tenant isolation on memberships"
    )
  })
})

async function asAuthenticatedUser(tx, userId, fn) {
  return tx.savepoint(async (sp) => {
    await sp`set local role authenticated`
    await sp`select set_config('request.jwt.claim.role', 'authenticated', true)`
    await sp`select set_config('request.jwt.claim.sub', ${userId}, true)`
    // is_internal_admin() no longer requires MFA (aal2) as of migration
    // 20260720100000; aal2 remains a valid level and is harmless here.
    await sp`select set_config('request.jwt.claim.aal', 'aal2', true)`
    try {
      return await fn(sp)
    } finally {
      await sp`reset role`
      await sp`select set_config('request.jwt.claim.role', 'service_role', true)`
    }
  })
}
